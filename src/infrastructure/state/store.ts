import { observable } from "@legendapp/state";
import type { Area } from "@/domain/entities/Area";
import type { CrystallizedRoutine } from "@/domain/entities/CrystallizedRoutine";
import type { Cycle } from "@/domain/entities/Cycle";
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Habit } from "@/domain/entities/Habit";
import type { MetricLog } from "@/domain/entities/MetricLog";
import type { Moment } from "@/domain/entities/Moment";
import type { PhaseConfig } from "@/domain/value-objects/Phase";

/**
 * Core application state stored as observables
 *
 * Design decisions:
 * - Stored as Record<string, Entity> (objects keyed by UUID) for:
 *   - Fine-grained reactivity (moments$[id].name.set())
 *   - Direct access via ID (areas$[moment.areaId])
 *   - PostgreSQL-ready structure
 *   - Future Supabase sync compatibility
 *
 * - IndexedDB persistence with:
 *   - Auto-save (500ms debounce built-in)
 *   - Asynchronous I/O (non-blocking)
 *   - Large storage capacity
 *   - Indexed queries support
 */

// ============================================================================
// Core State Observables
// ============================================================================

/**
 * Moments collection - keyed by moment ID
 */
export const moments$ = observable<Record<string, Moment>>({});

/**
 * Areas collection - keyed by area ID
 */
export const areas$ = observable<Record<string, Area>>({});

/**
 * Habits collection - keyed by habit ID
 * Emergent patterns from repeated moments
 */
export const habits$ = observable<Record<string, Habit>>({});

/**
 * Cycles collection - keyed by cycle ID
 */
export const cycles$ = observable<Record<string, Cycle>>({});

/**
 * Cycle plans collection - keyed by cycle plan ID
 * Links habits to cycles with budget counts
 */
export const cyclePlans$ = observable<Record<string, CyclePlan>>({});

/**
 * Phase configurations collection - keyed by config ID
 */
export const phaseConfigs$ = observable<Record<string, PhaseConfig>>({});

/**
 * Crystallized routines collection - keyed by routine ID
 * Moments that have graduated to "being" attitude
 */
export const crystallizedRoutines$ = observable<
  Record<string, CrystallizedRoutine>
>({});

/**
 * Metric logs collection - keyed by log ID
 * Performance tracking entries for PUSHING attitude moments
 */
export const metricLogs$ = observable<Record<string, MetricLog>>({});

// ============================================================================
// History State
// ============================================================================

/**
 * History state and utilities - undo/redo functionality
 * Imported and re-exported from history.ts
 */
export {
  canRedo,
  canUndo,
  clearHistory,
  endBatch,
  getHistoryStats,
  history$,
  recordOperation,
  redo,
  startBatch,
  undo,
  withBatch,
} from "./history";

/**
 * History middleware - functions to apply operations with history tracking
 * Imported and re-exported from history-middleware.ts
 */
export {
  allocateMomentWithHistory,
  applyInverseOperation,
  applyOperation,
  bulkDeleteMomentsWithHistory,
  clearSelectionWithHistory,
  createMomentWithHistory,
  deleteMomentWithHistory,
  deselectMomentsWithHistory,
  duplicateMomentWithHistory,
  moveMomentWithHistory,
  reorderMomentsWithHistory,
  selectAllWithHistory,
  selectMomentsWithHistory,
  unallocateMomentWithHistory,
  updateMomentWithHistory,
} from "./history-middleware";

// ============================================================================
// Computed Observables
// ============================================================================

/**
 * All moments that are unallocated (not assigned to any day)
 * Computed from moments$ - automatically updates when moments change
 */
export const unallocatedMoments$ = observable(() => {
  const moments = moments$.get();
  return Object.values(moments).filter((m) => m.day === null);
});

/**
 * All moments that are allocated to a specific day
 * Computed from moments$ - automatically updates when moments change
 */
export const allocatedMoments$ = observable(() => {
  const moments = moments$.get();
  return Object.values(moments).filter((m) => m.day !== null);
});

/**
 * The currently active cycle (only one can be active at a time)
 * Computed from cycles$ - automatically updates when cycles change
 */
export const activeCycle$ = observable(() => {
  const cycles = cycles$.get();
  return Object.values(cycles).find((c) => c.isActive) || null;
});

/**
 * All visible phase configurations, sorted by order
 * Computed from phaseConfigs$ - automatically updates when configs change
 */
export const visiblePhases$ = observable(() => {
  const configs = phaseConfigs$.get();
  return Object.values(configs)
    .filter((config) => config.isVisible)
    .sort((a, b) => a.order - b.order);
});

/**
 * All active (non-archived) areas, sorted by order
 * Computed from areas$ - automatically updates when areas change
 * Archived areas are filtered out to keep the UI clean
 */
export const activeAreas$ = observable(() => {
  const allAreas = areas$.get();
  return Object.values(allAreas)
    .filter((area) => !area.isArchived)
    .sort((a, b) => a.order - b.order);
});

/**
 * All archived areas, sorted by updatedAt (most recently archived first)
 * Computed from areas$ - automatically updates when areas change
 */
export const archivedAreas$ = observable(() => {
  const allAreas = areas$.get();
  return Object.values(allAreas)
    .filter((area) => area.isArchived)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
});

/**
 * All active (non-archived) habits, sorted by order
 * Computed from habits$ - automatically updates when habits change
 * Archived habits are filtered out to keep the UI clean
 */
export const activeHabits$ = observable(() => {
  const allHabits = habits$.get();
  return Object.values(allHabits)
    .filter((habit) => !habit.isArchived)
    .sort((a, b) => a.order - b.order);
});

/**
 * All archived habits, sorted by updatedAt (most recently archived first)
 * Computed from habits$ - automatically updates when habits change
 */
export const archivedHabits$ = observable(() => {
  const allHabits = habits$.get();
  return Object.values(allHabits)
    .filter((habit) => habit.isArchived)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
});

/**
 * Moments grouped by day
 * Useful for timeline rendering
 */
export const momentsByDay$ = observable(() => {
  const moments = allocatedMoments$.get();
  return moments.reduce((acc, moment) => {
    if (!moment.day) return acc;
    if (!acc[moment.day]) {
      acc[moment.day] = [];
    }
    acc[moment.day].push(moment);
    return acc;
  }, {} as Record<string, Moment[]>);
});

/**
 * Moments grouped by (day, phase) for grid rendering
 * Returns structure: { "2025-01-15": { "MORNING": [...], "AFTERNOON": [...] } }
 */
export const momentsByDayAndPhase$ = observable(() => {
  const moments = allocatedMoments$.get();
  return moments.reduce((acc, moment) => {
    if (!moment.day || !moment.phase) return acc;

    if (!acc[moment.day]) {
      acc[moment.day] = {};
    }

    if (!acc[moment.day][moment.phase]) {
      acc[moment.day][moment.phase] = [];
    }

    acc[moment.day][moment.phase].push(moment);
    return acc;
  }, {} as Record<string, Record<string, Moment[]>>);
});

/**
 * All unique tags across all moments, sorted alphabetically
 * Computed from moments$ - automatically updates when moments change
 */
export const allTags$ = observable(() => {
  const moments = moments$.get();
  const tagsSet = new Set<string>();

  for (const moment of Object.values(moments)) {
    if (!moment.tags) continue;

    for (const tag of moment.tags) {
      tagsSet.add(tag);
    }
  }

  return Array.from(tagsSet).sort();
});

/**
 * Tag usage count - how many moments have each tag
 * Returns structure: { "running": 8, "creative": 5, ... }
 */
export const tagUsageCount$ = observable(() => {
  const moments = moments$.get();
  const counts: Record<string, number> = {};

  for (const moment of Object.values(moments)) {
    if (!moment.tags) continue;

    for (const tag of moment.tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }

  return counts;
});

/**
 * Moments grouped by tag
 * Returns structure: { "running": [...moments], "creative": [...moments] }
 */
export const momentsByTag$ = observable(() => {
  const moments = moments$.get();
  const byTag: Record<string, Moment[]> = {};

  for (const moment of Object.values(moments)) {
    if (!moment.tags) continue;
    for (const tag of moment.tags) {
      if (!byTag[tag]) {
        byTag[tag] = [];
      }
      byTag[tag].push(moment);
    }
  }

  return byTag;
});

// ============================================================================
// Unified Tag Observables (Moments + Areas + Habits)
// ============================================================================

/**
 * All unique tags across moments, areas, and habits, sorted alphabetically
 * Computed from moments$, areas$, habits$ - automatically updates when any change
 */
export const allUnifiedTags$ = observable(() => {
  const moments = moments$.get();
  const areas = areas$.get();
  const habits = habits$.get();
  const tagsSet = new Set<string>();

  // Collect tags from moments
  for (const moment of Object.values(moments)) {
    if (!moment.tags) continue;
    for (const tag of moment.tags) {
      tagsSet.add(tag);
    }
  }

  // Collect tags from areas
  for (const area of Object.values(areas)) {
    if (!area.tags) continue;
    for (const tag of area.tags) {
      tagsSet.add(tag);
    }
  }

  // Collect tags from habits
  for (const habit of Object.values(habits)) {
    if (!habit.tags) continue;
    for (const tag of habit.tags) {
      tagsSet.add(tag);
    }
  }

  return Array.from(tagsSet).sort();
});

/**
 * Unified tag usage count - how many entities (moments + areas + habits) have each tag
 * Returns structure: { "running": 12, "creative": 8, ... }
 */
export const unifiedTagUsageCount$ = observable(() => {
  const moments = moments$.get();
  const areas = areas$.get();
  const habits = habits$.get();
  const counts: Record<string, number> = {};

  // Count from moments
  for (const moment of Object.values(moments)) {
    if (!moment.tags) continue;
    for (const tag of moment.tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }

  // Count from areas
  for (const area of Object.values(areas)) {
    if (!area.tags) continue;
    for (const tag of area.tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }

  // Count from habits
  for (const habit of Object.values(habits)) {
    if (!habit.tags) continue;
    for (const tag of habit.tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }

  return counts;
});

/**
 * Metric logs grouped by moment ID
 * Returns structure: { "moment-id": [...logs], ... }
 */
export const metricLogsByMoment$ = observable(() => {
  const logs = metricLogs$.get();
  const byMoment: Record<string, MetricLog[]> = {};

  for (const log of Object.values(logs)) {
    if (!byMoment[log.momentId]) {
      byMoment[log.momentId] = [];
    }
    byMoment[log.momentId].push(log);
  }

  // Sort logs by date (newest first) for each moment
  for (const momentId in byMoment) {
    byMoment[momentId].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  return byMoment;
});

// ============================================================================
// Cycle-Specific Computed Observables
// ============================================================================

/**
 * Moments in the cycle deck (unallocated but budgeted)
 * These are moments created from cycle plans that haven't been allocated yet
 */
export const deckMoments$ = observable(() => {
  const moments = moments$.get();
  const activeCycle = activeCycle$.get();

  if (!activeCycle) return [];

  return Object.values(moments).filter(
    (m) =>
      m.cycleId === activeCycle.id &&
      m.cyclePlanId !== null &&
      m.day === null &&
      m.phase === null
  );
});

/**
 * Allocated moments in the active cycle
 */
export const allocatedMomentsInCycle$ = observable(() => {
  const moments = moments$.get();
  const activeCycle = activeCycle$.get();

  if (!activeCycle) return [];

  return Object.values(moments).filter(
    (m) => m.cycleId === activeCycle.id && m.day !== null && m.phase !== null
  );
});

/**
 * Spontaneous moments in the active cycle (not from budget)
 */
export const spontaneousMomentsInCycle$ = observable(() => {
  const moments = moments$.get();
  const activeCycle = activeCycle$.get();

  if (!activeCycle) return [];

  return Object.values(moments).filter(
    (m) =>
      m.cycleId === activeCycle.id &&
      m.cyclePlanId === null &&
      m.day !== null &&
      m.phase !== null
  );
});

/**
 * Cycle plans for the active cycle
 */
export const activeCyclePlans$ = observable(() => {
  const plans = cyclePlans$.get();
  const activeCycle = activeCycle$.get();

  if (!activeCycle) return [];

  return Object.values(plans).filter((p) => p.cycleId === activeCycle.id);
});

/**
 * Deck moments grouped by area, then by habit
 * Returns structure: { "area-id": { "habit-id": [...moments] } }
 * Used for rendering the cycle deck with stacks
 * Moments are sorted by creation time to maintain stable order
 */
export const deckMomentsByAreaAndHabit$ = observable(() => {
  const deckMoments = deckMoments$.get();
  const byArea: Record<string, Record<string, Moment[]>> = {};

  // Sort moments by creation time first to ensure stable order
  const sortedMoments = deckMoments.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const moment of sortedMoments) {
    if (!byArea[moment.areaId]) {
      byArea[moment.areaId] = {};
    }

    const habitId = moment.habitId || "standalone";
    if (!byArea[moment.areaId][habitId]) {
      byArea[moment.areaId][habitId] = [];
    }

    byArea[moment.areaId][habitId].push(moment);
  }

  return byArea;
});

// ============================================================================
// Database Management
// ============================================================================

/**
 * Reset all data to initial state
 * WARNING: This permanently deletes all moments, areas, habits, cycles, crystallized routines, metric logs, and settings
 */
export function resetDatabase() {
  console.log("[resetDatabase] Resetting all data...");

  // Clear all observables
  moments$.set({});
  areas$.set({});
  habits$.set({});
  cycles$.set({});
  cyclePlans$.set({});
  phaseConfigs$.set({});
  crystallizedRoutines$.set({});
  metricLogs$.set({});

  console.log("[resetDatabase] Database reset complete");

  // Note: IndexedDB will be cleared automatically by Legend State persistence
  // The initialize.ts will re-seed default data on next load
}
