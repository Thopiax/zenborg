/**
 * Yjs Garden Sync Adapter
 *
 * Implements the "garden pattern" where a primary device (desktop) acts as the
 * main hub and portals (laptop, phone) sync via WebRTC P2P when on the same network.
 *
 * Architecture:
 * - Desktop (Garden) ←→ Yjs CRDT ←→ Portals (Laptop/Phone)
 * - Local-first: Works offline, syncs when online
 * - Conflict-free: Yjs CRDTs handle concurrent edits
 * - No server: Direct P2P via WebRTC + BroadcastChannel
 *
 * Usage:
 * ```typescript
 * const sync = new YjsGardenSync({
 *   role: 'garden',  // or 'portal'
 *   roomName: 'ABC123',
 *   password: 'optional-encryption-key'
 * })
 *
 * // Later...
 * sync.disconnect()
 * ```
 */

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { WebsocketProvider } from "y-websocket";
import type { Observable } from "@legendapp/state";
import { isTauri } from "@/lib/tauri-utils";
import {
	areas$,
	crystallizedRoutines$,
	cycles$,
	habits$,
	metricLogs$,
	moments$,
	phaseConfigs$,
} from "../state/store";

/**
 * Device role in the garden pattern
 * - garden: Primary device (desktop) with full data authority
 * - portal: Secondary device (laptop/phone) that syncs from garden
 */
export type DeviceRole = "garden" | "portal";

/**
 * Sync mode
 * - webrtc: P2P WebRTC (for web-only, cross-network)
 * - websocket: Local WebSocket server (for Tauri desktop)
 */
export type SyncMode = "webrtc" | "websocket";

/**
 * Connection status for garden sync
 */
export type GardenSyncStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "syncing"
	| "error";

/**
 * Sync statistics for monitoring
 */
export interface GardenSyncStats {
	connectedPeers: number;
	lastSyncAt: string | null;
	bytesReceived: number;
	bytesSent: number;
	syncErrors: number;
}

/**
 * Configuration for YjsGardenSync
 */
export interface YjsGardenSyncConfig {
	/**
	 * Device role: 'garden' (primary) or 'portal' (secondary)
	 */
	role: DeviceRole;

	/**
	 * Room name for P2P sync (e.g., 'ABC123')
	 * All devices with same room name will sync together
	 */
	roomName: string;

	/**
	 * Optional encryption password for secure sync
	 * If provided, only devices with same password can connect
	 */
	password?: string | null;

	/**
	 * Sync mode (auto-detected if not specified)
	 * - webrtc: P2P WebRTC (for web-only)
	 * - websocket: Local server (for Tauri)
	 * @default auto-detect based on environment
	 */
	mode?: SyncMode;

	/**
	 * WebSocket server URL (for websocket mode)
	 * @default "ws://localhost:8765"
	 */
	websocketUrl?: string;

	/**
	 * Custom signaling servers (for webrtc mode)
	 * Defaults to public Yjs signaling servers
	 */
	signalingServers?: string[];

	/**
	 * Maximum number of peer connections (for webrtc mode)
	 * @default 5
	 */
	maxConnections?: number;

	/**
	 * Enable debug logging
	 * @default false
	 */
	debug?: boolean;
}

/**
 * YjsGardenSync - Bidirectional sync between Legend State and Yjs
 *
 * Key features:
 * - Automatic sync on changes (debounced)
 * - Conflict resolution via CRDT
 * - Peer discovery via WebRTC
 * - BroadcastChannel for same-device tabs
 * - Offline support (queues changes until connected)
 */
export class YjsGardenSync {
	// Yjs document and provider
	private ydoc: Y.Doc;
	private provider: WebrtcProvider | WebsocketProvider | null = null;

	// Sync mode (webrtc or websocket)
	private mode: SyncMode;

	// Configuration
	private config: Required<Omit<YjsGardenSyncConfig, "mode">> & { mode: SyncMode };

	// Status tracking
	private status: GardenSyncStatus = "disconnected";
	private stats: GardenSyncStats = {
		connectedPeers: 0,
		lastSyncAt: null,
		bytesReceived: 0,
		bytesSent: 0,
		syncErrors: 0,
	};

	// Sync flags to prevent infinite loops
	private isSyncingFromYjs = false;
	private isSyncingToYjs = false;

	// Callbacks for status changes
	private onStatusChange?: (status: GardenSyncStatus) => void;
	private onStatsChange?: (stats: GardenSyncStats) => void;

	constructor(config: YjsGardenSyncConfig) {
		// Auto-detect mode: Tauri = websocket, Web = webrtc
		this.mode = config.mode ?? (isTauri() ? "websocket" : "webrtc");

		this.config = {
			role: config.role,
			roomName: config.roomName,
			password: config.password ?? null,
			mode: this.mode,
			websocketUrl: config.websocketUrl ?? "ws://localhost:8765",
			signalingServers: config.signalingServers ?? [
				"wss://signaling.yjs.dev",
				"wss://y-webrtc-signaling-eu.fly.dev",
			],
			maxConnections: config.maxConnections ?? 5,
			debug: config.debug ?? false,
		};

		// Create Yjs document
		this.ydoc = new Y.Doc();

		// Initialize sync
		this.initialize();
	}

	/**
	 * Initialize Yjs provider and sync setup
	 */
	private initialize(): void {
		this.log("Initializing garden sync...", {
			mode: this.mode,
			role: this.config.role,
			room: this.config.roomName,
		});

		// Update status
		this.setStatus("connecting");

		// Create provider based on mode
		if (this.mode === "websocket") {
			// WebSocket mode (Tauri local server)
			this.log("Using WebSocket mode:", this.config.websocketUrl);
			this.provider = new WebsocketProvider(
				this.config.websocketUrl,
				this.config.roomName,
				this.ydoc,
				{
					// WebSocket provider options
					connect: true,
					awareness: undefined,
				},
			);
		} else {
			// WebRTC mode (P2P)
			this.log("Using WebRTC mode");
			this.provider = new WebrtcProvider(this.config.roomName, this.ydoc, {
				signaling: this.config.signalingServers,
				password: this.config.password ?? undefined,
				awareness: undefined, // We don't need cursor awareness
				maxConns: this.config.maxConnections,
			});
		}

		// Get Yjs shared types (maps for each entity collection)
		const ymomentsMap = this.ydoc.getMap("moments");
		const yareasMap = this.ydoc.getMap("areas");
		const yhabitsMap = this.ydoc.getMap("habits");
		const ycyclesMap = this.ydoc.getMap("cycles");
		const yphaseConfigsMap = this.ydoc.getMap("phaseConfigs");
		const ycrystallizedRoutinesMap = this.ydoc.getMap("crystallizedRoutines");
		const ymetricLogsMap = this.ydoc.getMap("metricLogs");

		// Set up bidirectional sync for each entity type
		this.setupBidirectionalSync(moments$, ymomentsMap, "moments");
		this.setupBidirectionalSync(areas$, yareasMap, "areas");
		this.setupBidirectionalSync(habits$, yhabitsMap, "habits");
		this.setupBidirectionalSync(cycles$, ycyclesMap, "cycles");
		this.setupBidirectionalSync(
			phaseConfigs$,
			yphaseConfigsMap,
			"phaseConfigs",
		);
		this.setupBidirectionalSync(
			crystallizedRoutines$,
			ycrystallizedRoutinesMap,
			"crystallizedRoutines",
		);
		this.setupBidirectionalSync(metricLogs$, ymetricLogsMap, "metricLogs");

		// Listen to provider events
		this.setupProviderListeners();

		this.log("Garden sync initialized");
	}

	/**
	 * Set up bidirectional sync between Legend State observable and Yjs map
	 *
	 * @param observable$ - Legend State observable (Record<string, Entity>)
	 * @param ymap - Yjs shared map
	 * @param name - Entity name for logging
	 */
	private setupBidirectionalSync(
		observable$: Observable<Record<string, any>>,
		ymap: Y.Map<unknown>,
		name: string,
	): void {
		// Legend State → Yjs (outbound)
		// Listen to changes in Legend State and push to Yjs
		observable$.onChange((changes) => {
			// Prevent infinite loop
			if (this.isSyncingFromYjs) return;

			this.isSyncingToYjs = true;

			try {
				this.ydoc.transact(() => {
					const currentState = observable$.get();

					// Sync all entities
					for (const [id, entity] of Object.entries(currentState)) {
						const yjsValue = ymap.get(id);
						const legendValue = entity;

						// Only update if values differ
						if (JSON.stringify(yjsValue) !== JSON.stringify(legendValue)) {
							ymap.set(id, legendValue);
							this.log(`[${name}] Synced to Yjs:`, id);
						}
					}

					// Remove deleted entities
					const currentIds = new Set(Object.keys(currentState));
					for (const id of ymap.keys()) {
						if (!currentIds.has(id)) {
							ymap.delete(id);
							this.log(`[${name}] Deleted from Yjs:`, id);
						}
					}
				});

				// Update stats
				this.stats.lastSyncAt = new Date().toISOString();
				this.stats.bytesSent += JSON.stringify(changes).length;
			} catch (error) {
				this.stats.syncErrors += 1;
				this.log(`[${name}] Error syncing to Yjs:`, error);
			} finally {
				this.isSyncingToYjs = false;
			}
		});

		// Yjs → Legend State (inbound)
		// Listen to changes in Yjs and pull to Legend State
		ymap.observe((event) => {
			// Prevent infinite loop
			if (this.isSyncingToYjs) return;

			this.isSyncingFromYjs = true;

			try {
				const updates: Record<string, unknown> = {};
				const deletes: string[] = [];

				event.changes.keys.forEach((change, key) => {
					if (change.action === "add" || change.action === "update") {
						const value = ymap.get(key);
						if (value !== undefined) {
							updates[key] = value;
							this.log(`[${name}] Received from Yjs:`, key);
						}
					} else if (change.action === "delete") {
						deletes.push(key);
						this.log(`[${name}] Deleted from Yjs:`, key);
					}
				});

				// Apply updates to Legend State
				if (Object.keys(updates).length > 0) {
					const currentState = observable$.get();
					observable$.set({ ...currentState, ...updates });
				}

				// Apply deletions
				if (deletes.length > 0) {
					const currentState = observable$.get();
					const newState = { ...currentState };
					for (const id of deletes) {
						delete newState[id];
					}
					observable$.set(newState);
				}

				// Update stats
				this.stats.lastSyncAt = new Date().toISOString();
				this.stats.bytesReceived += JSON.stringify(updates).length;
			} catch (error) {
				this.stats.syncErrors += 1;
				this.log(`[${name}] Error syncing from Yjs:`, error);
			} finally {
				this.isSyncingFromYjs = false;
			}
		});
	}

	/**
	 * Set up provider event listeners for status tracking
	 */
	private setupProviderListeners(): void {
		if (!this.provider) return;

		if (this.mode === "websocket") {
			// WebSocket provider events
			const wsProvider = this.provider as WebsocketProvider;

			wsProvider.on("status", ({ status }: { status: string }) => {
				this.log("WebSocket status:", status);

				if (status === "connected") {
					this.setStatus("connected");
				} else if (status === "connecting") {
					this.setStatus("connecting");
				} else {
					this.setStatus("disconnected");
				}
			});

			wsProvider.on("sync", (synced: boolean) => {
				this.log("WebSocket synced:", synced);
				if (synced) {
					this.setStatus("connected");
					// For WebSocket, we're always connected to 1 server (the garden)
					this.stats.connectedPeers = 1;
					this.notifyStatsChange();
				}
			});
		} else {
			// WebRTC provider events
			const rtcProvider = this.provider as WebrtcProvider;

			rtcProvider.on("status", ({ connected }: { connected: boolean }) => {
				this.log("WebRTC status:", connected);

				if (connected) {
					this.setStatus("connected");
				} else {
					this.setStatus("disconnected");
				}
			});

			rtcProvider.on("peers", ({ added, removed }: { added: string[], removed: string[] }) => {
				this.log("WebRTC peers changed:", { added, removed });

				// Update peer count - count the peers array
				const peersCount = (added?.length ?? 0) - (removed?.length ?? 0);
				this.stats.connectedPeers = Math.max(0, this.stats.connectedPeers + peersCount);
				this.notifyStatsChange();
			});

			rtcProvider.on("synced", ({ synced }: { synced: boolean }) => {
				this.log("WebRTC synced:", synced);

				if (synced) {
					this.setStatus("connected");
				} else {
					this.setStatus("syncing");
				}
			});
		}
	}

	/**
	 * Set connection status and notify listeners
	 */
	private setStatus(status: GardenSyncStatus): void {
		if (this.status === status) return;

		this.status = status;
		this.log("Status changed:", status);

		if (this.onStatusChange) {
			this.onStatusChange(status);
		}
	}

	/**
	 * Notify stats listeners
	 */
	private notifyStatsChange(): void {
		if (this.onStatsChange) {
			this.onStatsChange({ ...this.stats });
		}
	}

	/**
	 * Log message (only if debug enabled)
	 */
	private log(message: string, ...args: unknown[]): void {
		if (this.config.debug) {
			console.log(`[YjsGardenSync]`, message, ...args);
		}
	}

	// ============================================================================
	// Public API
	// ============================================================================

	/**
	 * Get current connection status
	 */
	getStatus(): GardenSyncStatus {
		return this.status;
	}

	/**
	 * Get current sync statistics
	 */
	getStats(): GardenSyncStats {
		return { ...this.stats };
	}

	/**
	 * Get sync mode (webrtc or websocket)
	 */
	getMode(): SyncMode {
		return this.mode;
	}

	/**
	 * Get device role
	 */
	getRole(): DeviceRole {
		return this.config.role;
	}

	/**
	 * Get room name
	 */
	getRoomName(): string {
		return this.config.roomName;
	}

	/**
	 * Set status change callback
	 */
	onStatus(callback: (status: GardenSyncStatus) => void): void {
		this.onStatusChange = callback;
	}

	/**
	 * Set stats change callback
	 */
	onStatsUpdate(callback: (stats: GardenSyncStats) => void): void {
		this.onStatsChange = callback;
	}

	/**
	 * Disconnect and clean up
	 */
	disconnect(): void {
		this.log("Disconnecting garden sync...");

		if (this.provider) {
			this.provider.disconnect();
			this.provider.destroy();
			this.provider = null;
		}

		this.ydoc.destroy();

		this.setStatus("disconnected");
		this.log("Garden sync disconnected");
	}

	/**
	 * Check if connected to any peers
	 */
	isConnected(): boolean {
		return this.status === "connected" && this.stats.connectedPeers > 0;
	}

	/**
	 * Force a full sync (useful for debugging)
	 */
	forceSync(): void {
		this.log("Forcing full sync...");

		// Trigger a sync by updating all observables
		moments$.set({ ...moments$.get() });
		areas$.set({ ...areas$.get() });
		habits$.set({ ...habits$.get() });
		cycles$.set({ ...cycles$.get() });
		phaseConfigs$.set({ ...phaseConfigs$.get() });
		crystallizedRoutines$.set({ ...crystallizedRoutines$.get() });
		metricLogs$.set({ ...metricLogs$.get() });

		this.log("Full sync triggered");
	}
}
