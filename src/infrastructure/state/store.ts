import { observable } from "@legendapp/state";
import type { Area } from "@/domain/entities/Area";
import type { Cycle } from "@/domain/entities/Cycle";
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

// ============================================================================
// Vim Mode State
// ============================================================================

/**
 * Vim mode state - modal interaction state (NORMAL/INSERT/COMMAND)
 * Imported and re-exported from vim-mode.ts
 */
export { vimState$ } from "./vim-mode";

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
