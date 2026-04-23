/**
 * Drag & Drop Type Definitions
 *
 * Types for @dnd-kit integration with Zenborg's moment allocation system.
 */

import type { Phase } from "@/domain/value-objects/Phase";

/**
 * Source location types for draggable moments
 */
export type DragSourceType = "timeline" | "cycle-deck";

/**
 * Target location types for droppable zones
 */
export type DropTargetType =
  | "timeline-cell"
  | "cycle-deck";

/**
 * Data attached to draggable items.
 *
 * Two variants:
 *  - A concrete Moment being dragged (from timeline or from the cycle deck
 *    in the legacy "materialized deck moment" paradigm — kept for allocated
 *    moments dragged back onto the deck).
 *  - A virtual deck card representing a plan ghost slot (new derive paradigm).
 *    These carry `type: "deck-card"` plus `cycleId` + `habitId`; dropping one
 *    on a timeline slot calls `CycleService.allocateFromPlan(...)`.
 */
export interface DraggableData {
  type?: "deck-card";
  momentId?: string;
  cycleId?: string;
  habitId?: string;
  sourceType?: DragSourceType;
  sourceDay?: string; // ISO date, undefined if from cycle deck
  sourcePhase?: Phase; // undefined if from cycle deck
  sourceOrder?: number; // 0-2, undefined if from cycle deck
}

/**
 * Data attached to droppable zones
 */
export interface DroppableData {
  targetType: DropTargetType;
  targetDay?: string; // ISO date for timeline cells
  targetPhase?: Phase; // Phase for timeline cells
  cycleId?: string; // Cycle ID for cycle deck
}

/**
 * Result of drag operation validation
 */
export interface DragValidationResult {
  isValid: boolean;
  reason?: string; // Error message if invalid
}

/**
 * Drag event payload combining source and target data
 */
export interface DragEndEvent {
  active: {
    id: string;
    data: {
      current?: DraggableData;
    };
  };
  over: {
    id: string;
    data: {
      current?: DroppableData;
    };
  } | null;
}

/**
 * State update payload for drag operations
 */
export interface DragStateUpdate {
  momentId: string;
  day: string | null;
  phase: Phase | null;
  order: number;
}
