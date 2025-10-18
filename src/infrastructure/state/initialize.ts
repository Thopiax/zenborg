import { getDefaultAreas } from "@/domain/entities/Area";
import { createCycle } from "@/domain/entities/Cycle";
import { getDefaultPhaseConfigs } from "@/domain/value-objects/Phase";
import { configurePersistence } from "./persistence";
import { areas$, cycles$, phaseConfigs$ } from "./store";

/**
 * Initializes the application state on first run
 *
 * Process:
 * 1. Configure IndexedDB persistence (client-side only)
 * 2. Wait for persistence to load existing data
 * 3. Check if data exists (not first run)
 * 4. If empty (first run):
 *    - Create 5 default areas
 *    - Create 4 default phase configurations
 *    - Create first cycle ("First Cycle", starting today)
 * 5. Persist all to IndexedDB (automatically via syncObservable)
 *
 * This function is idempotent - safe to call multiple times.
 * On subsequent runs, it will skip initialization since data exists.
 */
export async function initializeStore(): Promise<void> {
  // Configure IndexedDB persistence (only runs once, only in browser)
  configurePersistence();

  // Small delay to allow IndexedDB to load existing data
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Check if data already exists (not first run)
  const hasAreas = Object.keys(areas$.get()).length > 0;
  const hasCycles = Object.keys(cycles$.get()).length > 0;
  const hasPhaseConfigs = Object.keys(phaseConfigs$.get()).length > 0;

  // If data exists, skip initialization
  if (hasAreas && hasCycles && hasPhaseConfigs) {
    return;
  }

  // First run: seed default data
  console.log("[Zenborg] First run detected - initializing default data");

  // Create 5 default areas
  if (!hasAreas) {
    const defaultAreas = getDefaultAreas();
    const areasRecord = defaultAreas.reduce((acc, area) => {
      acc[area.id] = area;
      return acc;
    }, {} as Record<string, (typeof defaultAreas)[0]>);

    areas$.set(areasRecord);
    console.log("[Zenborg] Created 5 default areas");
  }

  // Create 4 default phase configurations
  if (!hasPhaseConfigs) {
    const defaultPhases = getDefaultPhaseConfigs();
    const phasesRecord = defaultPhases.reduce((acc, phase) => {
      acc[phase.id] = phase;
      return acc;
    }, {} as Record<string, (typeof defaultPhases)[0]>);

    phaseConfigs$.set(phasesRecord);
    console.log("[Zenborg] Created 4 default phase configurations");
  }

  // Create first cycle
  if (!hasCycles) {
    const today = new Date().toISOString().split("T")[0];
    const firstCycle = createCycle("First Cycle", today, null, true);

    if ("error" in firstCycle) {
      console.error(
        "[Zenborg] Failed to create first cycle:",
        firstCycle.error
      );
      return;
    }

    cycles$[firstCycle.id].set(firstCycle);
    console.log("[Zenborg] Created first cycle:", firstCycle.name);
  }

  console.log("[Zenborg] Initialization complete");
}

/**
 * Clears all data from the store and IndexedDB
 * Use with caution - this is irreversible!
 *
 * Useful for:
 * - Testing
 * - Resetting the app to factory defaults
 * - Debugging
 */
export function clearStore(): void {
  areas$.set({});
  cycles$.set({});
  phaseConfigs$.set({});
  console.log("[Zenborg] Store cleared");
}
