/**
 * Client-side IndexedDB persistence configuration
 *
 * This file handles the persistence setup for Legend State observables.
 * It MUST only be imported and run on the client side (not during SSR).
 */

import { observablePersistIndexedDB } from "@legendapp/state/persist-plugins/indexeddb";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import { configureSynced, syncObservable } from "@legendapp/state/sync";
import {
  areas$,
  crystallizedRoutines$,
  cyclePlans$,
  cycles$,
  habits$,
  metricLogs$,
  moments$,
  phaseConfigs$,
} from "./store";
import { trmnlSettings$ } from "./integration-store";
import { lastUsedAreaId$ } from "./ui-store";

/**
 * Flag to ensure persistence is only configured once
 */
let persistenceConfigured = false;

/**
 * Configure IndexedDB persistence for all observables
 *
 * This function should be called once on the client side, typically
 * during app initialization in a useEffect hook.
 */
export function configurePersistence(): void {
  // Only configure once
  if (persistenceConfigured) {
    return;
  }

  // Only run in browser environment
  if (typeof window === "undefined") {
    console.warn(
      "[Zenborg] Persistence configuration skipped (not in browser)"
    );
    return;
  }

  try {
    // ========================================================================
    // Domain State - IndexedDB (structured data, large storage)
    // ========================================================================
    const persistIndexedDBOptions = configureSynced({
      persist: {
        plugin: observablePersistIndexedDB({
          databaseName: "zenborg",
          version: 4, // Incremented for cyclePlans table
          tableNames: [
            "moments",
            "areas",
            "habits",
            "cycles",
            "cyclePlans",
            "phaseConfigs",
            "crystallizedRoutines",
            "metricLogs",
          ],
        }),
      },
    });

    // ========================================================================
    // UI State - localStorage (simple key-value, synchronous)
    // ========================================================================
    const persistLocalStorageOptions = configureSynced({
      persist: {
        plugin: ObservablePersistLocalStorage,
      },
    });

    // ========================================================================
    // Sync Domain Entities to IndexedDB
    // ========================================================================
    syncObservable(
      moments$,
      persistIndexedDBOptions({
        persist: {
          name: "moments",
        },
      })
    );

    syncObservable(
      areas$,
      persistIndexedDBOptions({
        persist: {
          name: "areas",
        },
      })
    );

    syncObservable(
      habits$,
      persistIndexedDBOptions({
        persist: {
          name: "habits",
        },
      })
    );

    syncObservable(
      cycles$,
      persistIndexedDBOptions({
        persist: {
          name: "cycles",
        },
      })
    );

    syncObservable(
      cyclePlans$,
      persistIndexedDBOptions({
        persist: {
          name: "cyclePlans",
        },
      })
    );

    syncObservable(
      phaseConfigs$,
      persistIndexedDBOptions({
        persist: {
          name: "phaseConfigs",
        },
      })
    );

    syncObservable(
      crystallizedRoutines$,
      persistIndexedDBOptions({
        persist: {
          name: "crystallizedRoutines",
        },
      })
    );

    syncObservable(
      metricLogs$,
      persistIndexedDBOptions({
        persist: {
          name: "metricLogs",
        },
      })
    );

    // ========================================================================
    // Sync UI Preferences to localStorage
    // ========================================================================
    syncObservable(
      lastUsedAreaId$,
      persistLocalStorageOptions({
        persist: {
          name: "zenborg_lastUsedAreaId",
        },
      })
    );

    syncObservable(
      trmnlSettings$,
      persistLocalStorageOptions({
        persist: {
          name: "zenborg_trmnlSettings",
        },
      })
    );

    persistenceConfigured = true;
    console.log("[Zenborg] IndexedDB persistence configured");
  } catch (error) {
    console.error("[Zenborg] Failed to configure persistence:", error);
  }
}
