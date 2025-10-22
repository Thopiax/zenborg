import { observable } from "@legendapp/state";
import type { Horizon } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";

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
export type DrawingBoardGroupBy = "none" | "area" | "created" | "horizon";

export const drawingBoardGroupBy$ = observable<DrawingBoardGroupBy>("area");

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
// Modal/Dialog State
// ============================================================================

/**
 * Moment form dialog state
 * Controls the create/edit moment modal
 * Ephemeral - not persisted
 */
export interface MomentFormState {
  open: boolean;
  mode: "create" | "edit";
  /** Form field values - directly editable via the store */
  name: string;
  areaId: string;
  horizon: Horizon | null;
  phase: Phase | null;
  isAllocated: boolean;
  showCreateMore: boolean;
  /** For edit mode: the moment ID being edited */
  editingMomentId: string | null;
  /** For create mode: prefilled allocation data (when creating from timeline click) */
  prefilledAllocation: {
    day?: string;
    phase?: string;
  } | null;
}

export const momentFormState$ = observable<MomentFormState>({
  open: false,
  mode: "create",
  name: "",
  areaId: "",
  horizon: null,
  phase: null,
  isAllocated: false,
  showCreateMore: false,
  editingMomentId: null,
  prefilledAllocation: null,
});

/**
 * Helper function to open moment form in create mode
 */
export function openMomentFormCreate(params?: {
  areaId?: string;
  horizon?: Horizon | null;
  phase?: Phase | null;
  day?: string;
  phaseStr?: string;
}) {
  // Use provided areaId, or fall back to last used area
  const areaId = params?.areaId || lastUsedAreaId$.peek() || "";

  // If day and phase are provided, the moment is being created for a specific timeline cell
  const isAllocated = !!(params?.day && params?.phaseStr);

  momentFormState$.set({
    open: true,
    mode: "create",
    name: "",
    areaId,
    horizon: params?.horizon ?? null,
    phase: params?.phase ?? null,
    isAllocated,
    showCreateMore: true,
    editingMomentId: null,
    prefilledAllocation:
      params?.day && params?.phaseStr
        ? { day: params.day, phase: params.phaseStr }
        : null,
  });
}

/**
 * Helper function to open moment form in edit mode
 */
export function openMomentFormEdit(
  momentId: string,
  moment: {
    name: string;
    areaId: string;
    horizon: Horizon | null;
    phase: Phase | null;
    day: string | null;
  }
) {
  momentFormState$.set({
    open: true,
    mode: "edit",
    name: moment.name,
    areaId: moment.areaId,
    horizon: moment.horizon,
    phase: moment.phase,
    isAllocated: !!(moment.day && moment.phase),
    showCreateMore: false,
    editingMomentId: momentId,
    prefilledAllocation: null,
  });
}

/**
 * Helper function to close moment form
 */
export function closeMomentForm() {
  momentFormState$.set({
    open: false,
    mode: "create",
    name: "",
    areaId: "",
    horizon: null,
    phase: null,
    isAllocated: false,
    showCreateMore: false,
    editingMomentId: null,
    prefilledAllocation: null,
  });
}

/**
 * Archive area confirmation dialog state
 * Controls the area archival confirmation modal
 * Ephemeral - not persisted
 *
 * Note: Areas are never truly deleted - they are archived to preserve
 * data integrity for historical moments that reference them.
 */
export interface ArchiveAreaDialogState {
  open: boolean;
  areaId: string | null;
  areaName: string | null;
}

export const archiveAreaDialogState$ = observable<ArchiveAreaDialogState>({
  open: false,
  areaId: null,
  areaName: null,
});

/**
 * Helper function to open archive area dialog
 */
export function openArchiveAreaDialog(areaId: string, areaName: string) {
  archiveAreaDialogState$.set({
    open: true,
    areaId,
    areaName,
  });
}

/**
 * Helper function to close archive area dialog
 */
export function closeArchiveAreaDialog() {
  archiveAreaDialogState$.set({
    open: false,
    areaId: null,
    areaName: null,
  });
}

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
