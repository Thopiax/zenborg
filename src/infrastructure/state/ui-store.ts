import { observable } from "@legendapp/state";
import type { Moment } from "@/domain/entities/Moment";
import type { Attitude, CustomMetric } from "@/domain/value-objects/Attitude";
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
export type DrawingBoardGroupBy =
  | "none"
  | "area"
  | "created"
  | "attitude"
  | "phase"
  | "tag";

export const drawingBoardGroupBy$ = observable<DrawingBoardGroupBy>("area");

/**
 * Drawing board expanded state
 * Controls whether the drawing board is visible (expanded) or collapsed at bottom
 * Ephemeral - not persisted
 */
export const drawingBoardExpanded$ = observable<boolean>(false);

/**
 * Drawing board sorting mode
 * - "auto": Moments are sorted by order (primary) and createdAt (secondary)
 * - "manual": Moments are sorted only by user's drag-and-drop reordering
 * Persisted to localStorage
 */
export type DrawingBoardSortMode = "auto" | "manual";

export const drawingBoardSortMode$ = observable<DrawingBoardSortMode>("auto");

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
  /** Attitudes & Tags (Phase 2 features) */
  emoji: string | null;
  attitude: Attitude | null;
  tags?: string[];
  customMetric?: CustomMetric;
}

export const momentFormState$ = observable<MomentFormState>({
  open: false,
  mode: "create",
  name: "",
  areaId: "",
  phase: null,
  isAllocated: false,
  showCreateMore: false,
  editingMomentId: null,
  prefilledAllocation: null,
  emoji: null,
  attitude: null,
  tags: [],
  customMetric: undefined,
});

/**
 * Helper function to open moment form in create mode
 */
export function openMomentFormCreate(params?: {
  areaId?: string;
  phase?: Phase | null;
  day?: string;
  phaseStr?: string;
  attitude?: Attitude;
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
    phase: params?.phase ?? null,
    isAllocated,
    showCreateMore: true,
    editingMomentId: null,
    prefilledAllocation:
      params?.day && params?.phaseStr
        ? { day: params.day, phase: params.phaseStr }
        : null,
    emoji: null,
    attitude: params?.attitude ?? null,
    tags: [],
    customMetric: undefined,
  });
}

/**
 * Helper function to open moment form in edit mode
 */
export function openMomentFormEdit(momentId: string, moment: Moment) {
  // Note: attitude is now inherited from habit or area, not stored on moment
  // The form state keeps attitude for display/editing purposes
  momentFormState$.set({
    open: true,
    mode: "edit",
    name: moment.name,
    areaId: moment.areaId,
    phase: moment.phase,
    isAllocated: !!(moment.day && moment.phase),
    showCreateMore: false,
    editingMomentId: momentId,
    prefilledAllocation: null,
    emoji: moment.emoji || null,
    attitude: null, // Will be inherited from habit/area in the component
    tags: moment.tags || [],
    customMetric: moment.customMetric,
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
    phase: null,
    isAllocated: false,
    showCreateMore: false,
    editingMomentId: null,
    prefilledAllocation: null,
    emoji: null,
    attitude: null,
    tags: [],
    customMetric: undefined,
  });
}

/**
 * Habit form dialog state
 * Controls the create/edit habit modal
 * Ephemeral - not persisted
 */
export interface HabitFormState {
  open: boolean;
  mode: "create" | "edit";
  /** Form field values - directly editable via the store */
  name: string;
  areaId: string;
  emoji: string | null;
  attitude: Attitude | null;
  phase: Phase | null;
  tags: string[];
  /** For edit mode: the habit ID being edited */
  editingHabitId: string | null;
}

export const habitFormState$ = observable<HabitFormState>({
  open: false,
  mode: "create",
  name: "",
  areaId: "",
  emoji: "⭐",
  attitude: null,
  phase: null,
  tags: [],
  editingHabitId: null,
});

/**
 * Helper function to open habit form in create mode
 */
export function openHabitFormCreate(params?: {
  areaId?: string;
  attitude?: Attitude;
  phase?: Phase;
}) {
  // Use provided areaId, or fall back to last used area
  const areaId = params?.areaId || lastUsedAreaId$.peek() || "";

  habitFormState$.set({
    open: true,
    mode: "create",
    name: "",
    areaId,
    emoji: "⭐",
    attitude: params?.attitude ?? null,
    phase: params?.phase ?? null,
    tags: [],
    editingHabitId: null,
  });
}

/**
 * Helper function to open habit form in edit mode
 */
export function openHabitFormEdit(
  habitId: string,
  habit: { name: string; areaId: string; emoji: string | null; attitude: Attitude | null; phase: Phase | null; tags: string[] }
) {
  habitFormState$.set({
    open: true,
    mode: "edit",
    name: habit.name,
    areaId: habit.areaId,
    emoji: habit.emoji || "⭐",
    attitude: habit.attitude,
    phase: habit.phase,
    tags: habit.tags || [],
    editingHabitId: habitId,
  });
}

/**
 * Helper function to close habit form
 */
export function closeHabitForm() {
  habitFormState$.set({
    open: false,
    mode: "create",
    name: "",
    areaId: "",
    emoji: "⭐",
    attitude: null,
    phase: null,
    tags: [],
    editingHabitId: null,
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

/**
 * Sorting mode conflict dialog state
 * Shown when user tries to manually reorder moments while in auto-sort mode
 * Ephemeral - not persisted
 */
export interface SortModeConflictDialogState {
  open: boolean;
  pendingReorder: {
    activeId: string;
    overId: string;
    columnId?: string;
  } | null;
}

export const sortModeConflictDialogState$ =
  observable<SortModeConflictDialogState>({
    open: false,
    pendingReorder: null,
  });

/**
 * Helper function to open sort mode conflict dialog
 */
export function openSortModeConflictDialog(
  activeId: string,
  overId: string,
  columnId?: string
) {
  sortModeConflictDialogState$.set({
    open: true,
    pendingReorder: {
      activeId,
      overId,
      columnId,
    },
  });
}

/**
 * Helper function to close sort mode conflict dialog
 */
export function closeSortModeConflictDialog() {
  sortModeConflictDialogState$.set({
    open: false,
    pendingReorder: null,
  });
}

/**
 * Helper function to switch to manual sort mode and apply pending reorder
 */
export function switchToManualSort() {
  drawingBoardSortMode$.set("manual");
  closeSortModeConflictDialog();
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

/**
 * Command Palette visibility
 * Ephemeral - not persisted
 */
export const isCommandPaletteOpen$ = observable<boolean>(false);
