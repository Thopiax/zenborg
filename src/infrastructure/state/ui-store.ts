import { observable } from "@legendapp/state";

/**
 * UI State Store - Transient application state
 *
 * This store contains ephemeral UI state that doesn't need to be persisted
 * to IndexedDB or synced to the backend. Examples:
 * - Last used area ID (for convenience, not critical data)
 * - UI preferences (theme, collapsed sections, etc.)
 * - Temporary UI state (loading states, error messages)
 * - Focus state
 * - Modal/drawer open states
 *
 * Design decision: Use localStorage for UI preferences that should persist
 * across sessions, but keep state in-memory by default for performance.
 */

// ============================================================================
// UI Preferences (persisted to localStorage)
// ============================================================================

/**
 * Last used area ID - for preserving area selection in Create mode
 * Persisted to localStorage (lightweight, synchronous, UI-only)
 */
export const lastUsedAreaId$ = observable<string | null>(null);

/**
 * Duplicate mode flag for drag & drop
 * True when Option/Alt is held during drag operations
 * Ephemeral - not persisted
 */
export const isDuplicateMode$ = observable<boolean>(false);

/**
 * Grouping mode for drawing board
 * Determines how unallocated moments are organized
 * Persisted to localStorage
 */
export type DrawingBoardGroupBy = "none" | "area" | "created" | "cycle";

export const drawingBoardGroupBy$ = observable<DrawingBoardGroupBy>("none");

/**
 * Drawing board expanded state
 * Controls whether the drawing board is visible (expanded) or collapsed at bottom
 * Ephemeral - not persisted
 */
export const drawingBoardExpanded$ = observable<boolean>(false);

// ============================================================================
// Focus State (for keyboard navigation)
// ============================================================================

/**
 * Currently focused moment ID (for keyboard navigation)
 * Ephemeral - not persisted
 */
export const focusedMomentId$ = observable<string | null>(null);

/**
 * Currently focused timeline cell (for keyboard navigation)
 * Ephemeral - not persisted
 */
export const focusedCell$ = observable<{
  day: string;
  phase: import("@/domain/value-objects/Phase").Phase;
} | null>(null);

// ============================================================================
// Future UI State (examples for when needed)
// ============================================================================

/**
 * Compass view visibility
 * Ephemeral - not persisted
 */
// export const isCompassVisible$ = observable<boolean>(false);

/**
 * Drawing board collapsed state (mobile)
 * Could be persisted to localStorage if desired
 */
// export const isDrawingBoardCollapsed$ = observable<boolean>(false);
