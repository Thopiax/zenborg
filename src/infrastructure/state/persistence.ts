/**
 * Client-side IndexedDB persistence configuration
 *
 * This file handles the persistence setup for Legend State observables.
 * It MUST only be imported and run on the client side (not during SSR).
 */

import { observablePersistIndexedDB } from "@legendapp/state/persist-plugins/indexeddb";
import { configureSynced, syncObservable } from "@legendapp/state/sync";
import { areas$, cycles$, moments$, phaseConfigs$ } from "./store";

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
    // Configure IndexedDB plugin globally
    const persistOptions = configureSynced({
      persist: {
        plugin: observablePersistIndexedDB({
          databaseName: "zenborg",
          version: 1,
          tableNames: ["moments", "areas", "cycles", "phaseConfigs"],
        }),
      },
    });

    // Configure persistence for each observable
    syncObservable(
      moments$,
      persistOptions({
        persist: {
          name: "moments",
        },
      })
    );

    syncObservable(
      areas$,
      persistOptions({
        persist: {
          name: "areas",
        },
      })
    );

    syncObservable(
      cycles$,
      persistOptions({
        persist: {
          name: "cycles",
        },
      })
    );

    syncObservable(
      phaseConfigs$,
      persistOptions({
        persist: {
          name: "phaseConfigs",
        },
      })
    );

    persistenceConfigured = true;
    console.log("[Zenborg] IndexedDB persistence configured");
  } catch (error) {
    console.error("[Zenborg] Failed to configure persistence:", error);
  }
}
