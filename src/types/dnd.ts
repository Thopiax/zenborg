/**
 * Drag & Drop Type Definitions
 *
 * Types for @dnd-kit integration with Zenborg's moment allocation system.
 */

import type { Phase } from "@/domain/value-objects/Phase";

/**
 * Source location types for draggable moments
 */
export type DragSourceType = "timeline" | "drawing-board";

/**
 * Target location types for droppable zones
 */
export type DropTargetType =
  | "timeline-cell"
  | "drawing-board"
  | "unallocate-zone";

/**
 * Data attached to draggable moments
 */
export interface DraggableData {
  momentId: string;
  sourceType: DragSourceType;
  sourceDay?: string; // ISO date, undefined if from drawing board
  sourcePhase?: Phase; // undefined if from drawing board
  sourceOrder?: number; // 0-2, undefined if from drawing board
}

/**
 * Data attached to droppable zones
 */
export interface DroppableData {
  targetType: DropTargetType;
  targetDay?: string; // ISO date for timeline cells
  targetPhase?: Phase; // Phase for timeline cells
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
