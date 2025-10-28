"use client";

import { useEffect, useRef, useState } from "react";
import { initializeStore } from "@/infrastructure/state/initialize";
import { YjsGardenSync } from "@/infrastructure/sync/yjs-adapter";
import {
  gardenSyncSettings$,
  gardenSyncStatus$,
  gardenSyncPeers$,
} from "@/infrastructure/state/ui-store";

/**
 * Client-side component that initializes the Legend State store
 * on first mount. This ensures IndexedDB persistence is set up
 * and default data is seeded if needed.
 *
 * Also manages Garden Sync (Yjs WebRTC P2P) lifecycle based on settings.
 *
 * Separated into its own component to keep the main layout
 * as a Server Component while handling client-side state initialization.
 */
export function StoreInitializer() {
  const [_isInitialized, setIsInitialized] = useState(false);
  const gardenSyncRef = useRef<YjsGardenSync | null>(null);

  // Initialize store
  useEffect(() => {
    initializeStore()
      .then(() => {
        setIsInitialized(true);
      })
      .catch((error) => {
        console.error("[Zenborg] Failed to initialize store:", error);
      });
  }, []);

  // Manage Garden Sync lifecycle
  useEffect(() => {
    const settings = gardenSyncSettings$.get();

    // Only initialize if enabled and room name is set
    if (settings.enabled && settings.roomName) {
      console.log("[Zenborg] Initializing Garden Sync...", {
        role: settings.role,
        room: settings.roomName,
      });

      // Clean up existing instance if any
      if (gardenSyncRef.current) {
        gardenSyncRef.current.disconnect();
        gardenSyncRef.current = null;
      }

      // Create new sync instance
      const sync = new YjsGardenSync({
        role: settings.role,
        roomName: settings.roomName,
        password: settings.password,
        debug: settings.debug,
      });

      // Update status observable
      sync.onStatus((status) => {
        gardenSyncStatus$.set(status);
      });

      // Update peers observable
      sync.onStatsUpdate((stats) => {
        gardenSyncPeers$.set(stats.connectedPeers);
      });

      gardenSyncRef.current = sync;

      console.log("[Zenborg] Garden Sync initialized");
    } else {
      // Clean up if disabled or no room name
      if (gardenSyncRef.current) {
        console.log("[Zenborg] Disconnecting Garden Sync...");
        gardenSyncRef.current.disconnect();
        gardenSyncRef.current = null;
        gardenSyncStatus$.set("disconnected");
        gardenSyncPeers$.set(0);
      }
    }

    // Cleanup on unmount
    return () => {
      if (gardenSyncRef.current) {
        gardenSyncRef.current.disconnect();
        gardenSyncRef.current = null;
      }
    };
  }, [
    gardenSyncSettings$.enabled.get(),
    gardenSyncSettings$.role.get(),
    gardenSyncSettings$.roomName.get(),
    gardenSyncSettings$.password.get(),
    gardenSyncSettings$.debug.get(),
  ]);

  // Don't render anything - this is purely for side effects
  // You could optionally show a loading spinner here if desired
  return null;
}
