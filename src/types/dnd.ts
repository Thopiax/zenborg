/**
 * Drag & Drop Type Definitions
 *
 * Types for @dnd-kit integration with Zenborg's moment allocation system.
 */

import type { Phase } from "@/domain/value-objects/Phase";

/**
 * Source location types for draggable moments
 */
export type DragSourceType = "timeline";

/**
 * Target location types for droppable zones
 */
export type DropTargetType = "timeline-cell";

/**
 * Data attached to draggable items (concrete Moment being dragged).
 */
export type DraggableData = {
  type?: undefined;
  momentId: string;
  sourceType: DragSourceType;
  sourceDay?: string;
  sourcePhase?: Phase;
  sourceOrder?: number;
};

/**
 * Data attached to droppable zones
 */
export interface DroppableData {
  targetType: DropTargetType;
  targetDay?: string;
  targetPhase?: Phase;
}

/**
 * Result of drag operation validation
 */
export interface DragValidationResult {
  isValid: boolean;
  reason?: string;
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
