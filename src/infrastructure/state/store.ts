import { observable } from "@legendapp/state";
import type { Area } from "@/domain/entities/Area";
import type { CrystallizedRoutine } from "@/domain/entities/CrystallizedRoutine";
import type { Cycle } from "@/domain/entities/Cycle";
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
 * Cycles collection - keyed by cycle ID
 */
export const cycles$ = observable<Record<string, Cycle>>({});

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
// Database Management
// ============================================================================

/**
 * Reset all data to initial state
 * WARNING: This permanently deletes all moments, areas, cycles, crystallized routines, metric logs, and settings
 */
export function resetDatabase() {
  console.log("[resetDatabase] Resetting all data...");

  // Clear all observables
  moments$.set({});
  areas$.set({});
  cycles$.set({});
  phaseConfigs$.set({});
  crystallizedRoutines$.set({});
  metricLogs$.set({});

  console.log("[resetDatabase] Database reset complete");

  // Note: IndexedDB will be cleared automatically by Legend State persistence
  // The initialize.ts will re-seed default data on next load
}
