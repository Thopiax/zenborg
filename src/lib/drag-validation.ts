/**
 * Drag & Drop Validation Utilities
 *
 * Business logic for validating drag operations against Zenborg's constraints.
 */

import {
  DAY_VIEW_PHASE_CAPACITY,
  type Moment,
} from '@/domain/entities/Moment';
import type { Phase } from '@/domain/value-objects/Phase';
import type { DragValidationResult } from '@/types/dnd';

/**
 * Check if a moment can be dropped into a specific timeline cell.
 *
 * Enforces the day-view cell capacity (`DAY_VIEW_PHASE_CAPACITY`). This is a
 * display constraint of the coarse day view, not a data-layer invariant — the
 * zoomed-in time-blocked view holds more.
 *
 * @param targetDay - ISO date string of target cell
 * @param targetPhase - Phase of target cell
 * @param allMoments - All moments in the system
 * @param draggingMomentId - ID of moment being dragged (excluded from count)
 * @returns Validation result with isValid flag and optional reason
 */
export function canDropInCell(
  targetDay: string,
  targetPhase: Phase,
  allMoments: Record<string, Moment>,
  draggingMomentId: string
): DragValidationResult {
  // Count moments currently in target cell (excluding the one being dragged)
  const momentsInCell = Object.values(allMoments).filter(
    (m) =>
      m.day === targetDay &&
      m.phase === targetPhase &&
      m.id !== draggingMomentId
  );

  if (momentsInCell.length >= DAY_VIEW_PHASE_CAPACITY) {
    return {
      isValid: false,
      reason: `Cell already shows ${DAY_VIEW_PHASE_CAPACITY} moments (day-view capacity)`,
    };
  }

  return { isValid: true };
}

/**
 * Calculate the next available order (0, 1, or 2) for a moment in a cell.
 *
 * @param targetDay - ISO date string of target cell
 * @param targetPhase - Phase of target cell
 * @param allMoments - All moments in the system
 * @param draggingMomentId - ID of moment being dragged (excluded from calculation)
 * @returns Next available order index (0-2)
 */
export function calculateNextOrder(
  targetDay: string,
  targetPhase: Phase,
  allMoments: Record<string, Moment>,
  draggingMomentId: string
): number {
  const momentsInCell = Object.values(allMoments)
    .filter(
      (m) =>
        m.day === targetDay &&
        m.phase === targetPhase &&
        m.id !== draggingMomentId
    )
    .sort((a, b) => a.order - b.order);

  // Find first available slot (0, 1, or 2)
  for (let i = 0; i <= 2; i++) {
    if (!momentsInCell.some((m) => m.order === i)) {
      return i;
    }
  }

  // If all slots taken, return next index (should never happen due to validation)
  return momentsInCell.length;
}

/**
 * Reorder moments in a cell after one is removed.
 *
 * Closes gaps in order sequence (e.g., [0, 2] becomes [0, 1]).
 *
 * @param targetDay - ISO date string of cell
 * @param targetPhase - Phase of cell
 * @param allMoments - All moments in the system
 * @param removedMomentId - ID of moment that was removed
 * @returns Array of {momentId, newOrder} for moments that need reordering
 */
export function reorderAfterRemoval(
  targetDay: string,
  targetPhase: Phase,
  allMoments: Record<string, Moment>,
  removedMomentId: string
): Array<{ momentId: string; newOrder: number }> {
  const momentsInCell = Object.values(allMoments)
    .filter(
      (m) =>
        m.day === targetDay &&
        m.phase === targetPhase &&
        m.id !== removedMomentId
    )
    .sort((a, b) => a.order - b.order);

  // Reassign sequential orders
  return momentsInCell.map((m, index) => ({
    momentId: m.id,
    newOrder: index,
  }));
}

/**
 * Check if drag operation is a no-op (dragging to same location).
 *
 * @param momentId - ID of moment being dragged
 * @param targetDay - Target day (null for drawing board)
 * @param targetPhase - Target phase (null for drawing board)
 * @param allMoments - All moments in the system
 * @returns True if dragging to same location
 */
export function isSameLocation(
  momentId: string,
  targetDay: string | null,
  targetPhase: Phase | null,
  allMoments: Record<string, Moment>
): boolean {
  const moment = allMoments[momentId];
  if (!moment) return false;

  return moment.day === targetDay && moment.phase === targetPhase;
}
