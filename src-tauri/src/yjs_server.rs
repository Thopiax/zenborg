use futures_util::{SinkExt, StreamExt};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;
use yrs::{Doc, ReadTxn, StateVector, Transact, Update};

type ClientSender = mpsc::UnboundedSender<Vec<u8>>;

/// Represents a client connection with its sender channel
struct Client {
    sender: ClientSender,
    room: String,
}

/// Room state containing the shared Yjs document and connected clients
struct Room {
    doc: Doc,
    clients: HashMap<SocketAddr, Client>,
}

impl Room {
    fn new() -> Self {
        let doc = Doc::new();

        // Initialize Yjs maps for each entity type in Zenborg
        let _moments = doc.get_or_insert_map("moments");
        let _areas = doc.get_or_insert_map("areas");
        let _habits = doc.get_or_insert_map("habits");
        let _cycles = doc.get_or_insert_map("cycles");
        let _phase_configs = doc.get_or_insert_map("phaseConfigs");
        let _crystallized_routines = doc.get_or_insert_map("crystallizedRoutines");
        let _metric_logs = doc.get_or_insert_map("metricLogs");

        Self {
            doc,
            clients: HashMap::new(),
        }
    }

    fn add_client(&mut self, addr: SocketAddr, client: Client) {
        log::info!("🌱 Client {} joined room '{}'", addr, client.room);
        self.clients.insert(addr, client);
    }

    fn remove_client(&mut self, addr: &SocketAddr) {
        if let Some(client) = self.clients.remove(addr) {
            log::info!("🍂 Client {} left room '{}'", addr, client.room);
        }
    }

    /// Broadcast a message to all clients except the sender
    async fn broadcast(&self, sender_addr: &SocketAddr, message: Vec<u8>) {
        for (addr, client) in &self.clients {
            if addr != sender_addr {
                if let Err(e) = client.sender.send(message.clone()) {
                    log::error!("Failed to send to client {}: {}", addr, e);
                }
            }
        }
    }

    /// Send initial sync state to a new client
    fn get_sync_step1_response(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        let state_vector = txn.state_vector();

        // Create SyncStep2 message with the full state
        let update = txn.encode_state_as_update_v1(&StateVector::default());

        // Yjs sync protocol format: [messageType, ...payload]
        // MessageType: 0 = SyncStep1, 1 = SyncStep2, 2 = Update
        let mut message = vec![1]; // SyncStep2
        message.extend_from_slice(&state_vector.encode_v1());
        message.extend_from_slice(&update);

        message
    }

    /// Apply an update to the document and broadcast to other clients
    async fn apply_update(
        &mut self,
        sender_addr: &SocketAddr,
        update: Vec<u8>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let update_obj = Update::decode_v1(&update)?;

        {
            let mut txn = self.doc.transact_mut();
            txn.apply_update(update_obj)?;
        }

        log::debug!("📝 Update applied from {}", sender_addr);

        // Broadcast to other clients
        let mut message = vec![2]; // Update message type
        message.extend_from_slice(&update);
        self.broadcast(sender_addr, message).await;

        Ok(())
    }
}

/// Main Garden Sync server managing all rooms
pub struct YjsGardenServer {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
}

impl YjsGardenServer {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn run(self, port: u16) -> Result<(), Box<dyn std::error::Error>> {
        let addr = format!("127.0.0.1:{}", port);
        let listener = TcpListener::bind(&addr).await?;

        log::info!("🌱 Yjs Garden Server listening on ws://{}", addr);

        // Advertise service via mDNS
        if let Err(e) = advertise_mdns_service(port) {
            log::warn!("⚠️  Failed to advertise mDNS service: {}", e);
            log::info!("Continuing without mDNS (manual IP entry required)");
        } else {
            log::info!("📡 Garden advertised via mDNS as 'zenborg-garden.local'");
        }

        loop {
            let (stream, addr) = listener.accept().await?;
            let rooms = Arc::clone(&self.rooms);

            tokio::spawn(async move {
                if let Err(e) = handle_connection(stream, addr, rooms).await {
                    log::error!("Connection error from {}: {}", addr, e);
                }
            });
        }
    }
}

/// Advertise the Garden Sync service via mDNS/Bonjour
fn advertise_mdns_service(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let mdns = ServiceDaemon::new()?;

    let service_type = "_zenborg-garden._tcp.local.";
    let instance_name = "Zenborg Garden Sync";
    let hostname = "zenborg-garden.local.";

    // Get local IP address (prefer non-loopback)
    let local_ip = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());

    let service_info = ServiceInfo::new(
        service_type,
        instance_name,
        hostname,
        &local_ip,
        port,
        None, // No TXT records needed for now
    )?;

    mdns.register(service_info)?;

    // Keep the daemon alive by leaking it (it will live for the app lifetime)
    std::mem::forget(mdns);

    Ok(())
}

/// Get the local IP address (prefers non-loopback interfaces)
fn get_local_ip() -> Option<String> {
    use std::net::UdpSocket;

    // Try to connect to a public DNS server to determine the local IP
    // This doesn't actually send any data, just determines routing
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip().to_string())
}

/// Handle a single WebSocket connection
async fn handle_connection(
    stream: TcpStream,
    addr: SocketAddr,
    rooms: Arc<RwLock<HashMap<String, Room>>>,
) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("🔌 New connection from {}", addr);

    let ws_stream = accept_async(stream).await?;
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // Channel for sending messages to this client
    let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();

    // Wait for the first message to determine the room name
    let room_name = if let Some(Ok(Message::Text(text))) = ws_receiver.next().await {
        log::debug!("📨 Received room name from {}: {}", addr, text);
        text.to_string()
    } else {
        log::warn!("❌ Client {} didn't send room name", addr);
        return Ok(());
    };

    // Get or create room
    let mut rooms_lock = rooms.write().await;
    let room = rooms_lock
        .entry(room_name.clone())
        .or_insert_with(Room::new);

    // Send initial sync state
    let sync_message = room.get_sync_step1_response();
    tx.send(sync_message)?;

    // Add client to room
    room.add_client(
        addr,
        Client {
            sender: tx.clone(),
            room: room_name.clone(),
        },
    );

    drop(rooms_lock);

    // Task to send outgoing messages
    let send_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if ws_sender
                .send(Message::Binary(message.into()))
                .await
                .is_err()
            {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(message) = ws_receiver.next().await {
        match message {
            Ok(Message::Binary(data)) => {
                if data.is_empty() {
                    continue;
                }

                let msg_type = data[0];
                let payload = &data[1..];

                match msg_type {
                    0 => {
                        // SyncStep1: Client sends state vector, we respond with missing updates
                        log::debug!("📥 SyncStep1 from {}", addr);

                        let state_vector = StateVector::decode_v1(payload)?;
                        let rooms_lock = rooms.read().await;
                        if let Some(room) = rooms_lock.get(&room_name) {
                            let txn = room.doc.transact();
                            let update = txn.encode_state_as_update_v1(&state_vector);

                            let mut response = vec![1]; // SyncStep2
                            response.extend_from_slice(&update);

                            tx.send(response)?;
                        }
                    }
                    2 => {
                        // Update: Apply and broadcast
                        log::debug!("📥 Update from {}", addr);

                        let mut rooms_lock = rooms.write().await;
                        if let Some(room) = rooms_lock.get_mut(&room_name) {
                            room.apply_update(&addr, payload.to_vec()).await?;
                        }
                    }
                    _ => {
                        log::warn!("❓ Unknown message type {} from {}", msg_type, addr);
                    }
                }
            }
            Ok(Message::Close(_)) => {
                log::info!("👋 Client {} closed connection", addr);
                break;
            }
            Err(e) => {
                log::error!("❌ WebSocket error from {}: {}", addr, e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    let mut rooms_lock = rooms.write().await;
    if let Some(room) = rooms_lock.get_mut(&room_name) {
        room.remove_client(&addr);

        // Remove empty rooms
        if room.clients.is_empty() {
            rooms_lock.remove(&room_name);
            log::info!("🧹 Room '{}' removed (no clients)", room_name);
        }
    }

    send_task.abort();

    Ok(())
}
