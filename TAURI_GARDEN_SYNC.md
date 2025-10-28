# Tauri Garden Sync Implementation Guide

This document explains how to implement the Rust backend for Garden Sync in your Tauri branch.

## Overview

The frontend (this branch) now supports **dual-mode sync**:
- **WebRTC mode** (web browsers): P2P sync using signaling servers
- **WebSocket mode** (Tauri desktop): Local server sync, reliable and fast

When running in Tauri, the app auto-detects and uses **WebSocket mode**, connecting to `ws://localhost:8765`.

## What You Need to Build (Tauri Backend)

### 1. Add Dependencies to `src-tauri/Cargo.toml`

```toml
[dependencies]
tauri = { version = "2.0", features = [] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.24"  # WebSocket server
yrs = "0.21"                 # Yjs CRDT implementation in Rust
futures-util = "0.3"
```

### 2. Create WebSocket Server (`src-tauri/src/yjs_server.rs`)

```rust
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tokio_tungstenite::accept_async;
use yrs::{Doc, Map, StateVector, Update};
use std::collections::HashMap;

pub struct YjsGardenServer {
    // Shared Yjs document
    doc: Arc<RwLock<Doc>>,
    // Room name -> clients mapping
    rooms: Arc<RwLock<HashMap<String, Vec<ClientConnection>>>>,
}

impl YjsGardenServer {
    pub fn new() -> Self {
        let doc = Doc::new();

        // Initialize Yjs maps for each entity type
        let moments = doc.get_or_insert_map("moments");
        let areas = doc.get_or_insert_map("areas");
        let habits = doc.get_or_insert_map("habits");
        let cycles = doc.get_or_insert_map("cycles");
        let phase_configs = doc.get_or_insert_map("phaseConfigs");
        let crystallized_routines = doc.get_or_insert_map("crystallizedRoutines");
        let metric_logs = doc.get_or_insert_map("metricLogs");

        Self {
            doc: Arc::new(RwLock::new(doc)),
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn run(self, port: u16) -> Result<(), Box<dyn std::error::Error>> {
        let addr = format!("127.0.0.1:{}", port);
        let listener = TcpListener::bind(&addr).await?;

        println!("🌱 Yjs Garden Server listening on ws://{}", addr);

        loop {
            let (stream, _) = listener.accept().await?;
            let doc = Arc::clone(&self.doc);
            let rooms = Arc::clone(&self.rooms);

            tokio::spawn(async move {
                match accept_async(stream).await {
                    Ok(ws_stream) => {
                        handle_client(ws_stream, doc, rooms).await;
                    }
                    Err(e) => {
                        eprintln!("WebSocket connection error: {}", e);
                    }
                }
            });
        }
    }
}

async fn handle_client(
    ws_stream: WebSocketStream<TcpStream>,
    doc: Arc<RwLock<Doc>>,
    rooms: Arc<RwLock<HashMap<String, Vec<ClientConnection>>>>,
) {
    // 1. Receive sync messages from client
    // 2. Apply updates to shared Yjs doc
    // 3. Broadcast updates to other clients in same room
    // 4. Send initial state to new clients

    // Implementation details:
    // - Parse Yjs sync protocol messages
    // - Handle SyncStep1, SyncStep2, Update messages
    // - Track room membership
    // - Broadcast changes to room members
}
```

### 3. Integrate Server into Tauri App (`src-tauri/src/main.rs`)

```rust
mod yjs_server;

use tauri::Manager;
use yjs_server::YjsGardenServer;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Start Yjs WebSocket server
            let server = YjsGardenServer::new();

            tauri::async_runtime::spawn(async move {
                if let Err(e) = server.run(8765).await {
                    eprintln!("Garden server error: {}", e);
                }
            });

            println!("✅ Garden Sync server started on port 8765");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4. Yjs Sync Protocol Implementation

The Yjs sync protocol has 3 message types:

```rust
enum SyncMessage {
    SyncStep1(StateVector),  // Client sends current state
    SyncStep2(Update),       // Server sends missing updates
    Update(Update),          // Real-time updates
}
```

**Flow:**
1. Client connects, sends `SyncStep1` (its current state vector)
2. Server responds with `SyncStep2` (updates client is missing)
3. Both sides send `Update` messages for real-time changes

**Resources:**
- Yjs protocol spec: https://github.com/yjs/yjs/blob/main/PROTOCOL.md
- Rust implementation example: https://github.com/y-crdt/y-crdt/tree/main/yrs

### 5. Optional: mDNS Service Advertisement

Make the server discoverable on the local network:

```toml
# Add to Cargo.toml
mdns-sd = "0.11"
```

```rust
use mdns_sd::{ServiceDaemon, ServiceInfo};

fn advertise_garden_service() -> Result<(), Box<dyn std::error::Error>> {
    let mdns = ServiceDaemon::new()?;

    let service_type = "_zenborg-garden._tcp.local.";
    let instance_name = "Zenborg Garden";
    let port = 8765;

    let service_info = ServiceInfo::new(
        service_type,
        instance_name,
        "zenborg.local",
        "",
        port,
        None,
    )?;

    mdns.register(service_info)?;
    println!("📡 Garden advertised via mDNS as zenborg.local:{}", port);

    Ok(())
}
```

## Testing the Implementation

### 1. Test on Tauri Desktop (Garden)

```bash
# In Tauri branch:
pnpm tauri dev

# Should see:
# ✅ Garden Sync server started on port 8765
# 🌱 Yjs Garden Server listening on ws://127.0.0.1:8765
```

Open Settings → Garden Sync:
- Mode should show: "WebSocket (Tauri local server)"
- Enable sync, select "Garden" role
- Enter room name (e.g., "RAFA")
- Status should go to "Connected"

### 2. Test on Phone/Laptop (Portal)

Open browser on same WiFi network:
```
http://your-desktop-ip:1420  # or your Tauri dev server URL
```

Open Settings → Garden Sync:
- Mode should show: "WebRTC P2P (Web browser)"
- Enable sync, select "Portal" role
- Enter same room name ("RAFA")
- It will try WebRTC first (may fail)

**OR** force WebSocket mode by setting `websocketUrl`:
```typescript
// In browser console:
localStorage.setItem('zenborg_gardenSyncMode', 'websocket')
localStorage.setItem('zenborg_gardenSyncWebsocketUrl', 'ws://YOUR-DESKTOP-IP:8765')
```

### 3. Verify Sync

1. Create a moment on desktop → should appear on phone
2. Edit an area on phone → should update on desktop
3. Check console logs for "WebSocket synced: true"

## Simplified Alternative: Use Existing y-websocket Server

If building a custom Rust server is too complex, you can use the **official Node.js y-websocket server**:

```bash
# Create simple Node.js server
npm install y-websocket yjs ws
```

```javascript
// server.js
const http = require('http')
const WebSocket = require('ws')
const { setupWSConnection } = require('y-websocket/bin/utils')

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('Yjs WebSocket Server\n')
})

const wss = new WebSocket.Server({ server })

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})

server.listen(8765)
console.log('🌱 Yjs server running on ws://localhost:8765')
```

Then run this alongside Tauri:
```bash
node server.js &
pnpm tauri dev
```

## Architecture Diagram

```
Tauri Desktop (Garden)              Phone/Laptop (Portal)
┌──────────────────────┐           ┌────────────────────┐
│  Zenborg Web UI      │           │  Zenborg Web UI    │
│  (React + Legend)    │           │  (React + Legend)  │
│         ↓            │           │         ↓          │
│  YjsGardenSync       │           │  YjsGardenSync     │
│  (WebSocket mode)    │           │  (WebSocket mode)  │
│         ↓            │           │         ↓          │
│  y-websocket client  │           │  y-websocket       │
│         ↓            │           │  client            │
│  ws://localhost:8765 │←── WiFi ─→│  ws://desktop:8765 │
│         ↑            │           └────────────────────┘
│  ┌──────────────┐    │
│  │  Rust Server │    │
│  │  (port 8765) │    │
│  │  yrs (Yjs)   │    │
│  └──────────────┘    │
└──────────────────────┘
```

## Benefits of This Approach

✅ **Reliable**: Direct connection, no NAT/firewall issues
✅ **Fast**: Local network, no relay servers
✅ **Simple**: WebSocket is simpler than WebRTC
✅ **Secure**: Traffic stays on local network
✅ **Offline**: Works without internet
✅ **Portable**: Works on any device with WiFi

## Next Steps

1. Merge this branch into your Tauri branch
2. Implement the Rust WebSocket server (or use Node.js server)
3. Test on desktop + phone on same WiFi
4. Optional: Add QR code UI for easier pairing

## Questions?

The frontend is ready! Once you add the WebSocket server to your Tauri app, Garden Sync will work reliably between your desktop and phone. 🌱
