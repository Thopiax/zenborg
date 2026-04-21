/**
 * Legend State synced() factory for the zenborg vault.
 *
 * Produces a SyncedOptions config that:
 *   - Reads from $HOME/.zenborg/{collection}.json on boot
 *   - Writes on mutation (debounced 2s)
 *   - Subscribes to external edits via the Tauri watcher
 *   - Uses IndexedDB as a hot cache
 *
 * Usage:
 *   syncObservable(moments$, syncedVaultCollection("moments"));
 */

import { observablePersistIndexedDB } from "@legendapp/state/persist-plugins/indexeddb";
import { synced } from "@legendapp/state/sync";
import type { CollectionName } from "@/domain/registry";
import {
  readCollection,
  subscribeToCollection,
  writeCollection,
} from "./adapter";

/**
 * IndexedDB plugin config — shared across collections.
 * Must match the tableNames registered in persistence.ts.
 */
const IDB_CONFIG = {
  databaseName: "zenborg",
  version: 7,
  tableNames: [
    "moments",
    "areas",
    "habits",
    "cycles",
    "cyclePlans",
    "phaseConfigs",
    "metricLogs",
  ],
};

const DEBOUNCE_MS = 2000;

/**
 * Build a synced() config for a single vault collection.
 *
 * The returned config can be passed to syncObservable(obs$, config).
 */
export function syncedVaultCollection<T>(collection: CollectionName) {
  return synced<Record<string, T>>({
    // Initial + on-demand load from vault
    get: async () => {
      const value = await readCollection<T>(collection);
      // Return {} rather than null so Legend State treats "no vault file" as
      // "empty collection" rather than "not loaded yet". Respects IDB cache.
      return value ?? ({} as Record<string, T>);
    },

    // Debounced write on mutation. Legend State batches rapid changes.
    set: async ({ value }) => {
      await writeCollection(collection, value);
    },

    // External-edit subscription. When the watcher fires, we return a no-op
    // to force Legend State to re-run `get()` and refresh the observable.
    subscribe: ({ refresh }) => {
      let unlisten: (() => void) | undefined;
      subscribeToCollection(collection, refresh).then((fn) => {
        unlisten = fn;
      });
      return () => {
        if (unlisten) unlisten();
      };
    },

    // Hot cache in IndexedDB — survives app restarts, provides instant boot.
    persist: {
      plugin: observablePersistIndexedDB(IDB_CONFIG),
      name: collection,
    },

    // Coalesce rapid mutations (e.g. typing a habit name) into one write.
    debounceSet: DEBOUNCE_MS,

    // Retry with exponential backoff on write failures (e.g. disk full).
    retry: {
      infinite: true,
      backoff: "exponential",
    },
  });
}
