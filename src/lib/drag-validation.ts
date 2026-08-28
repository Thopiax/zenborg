/**
 * Drag & Drop Validation Utilities
 *
 * Business logic for validating drag operations against Zenborg's constraints.
 */

import type { Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import type { DragValidationResult } from "@/types/dnd";

/**
 * Check if a moment can be dropped into a specific timeline cell.
 *
 * Always valid. No cardinality constraint on a (day, phase) cell.
 */
export function canDropInCell(
  _targetDay: string,
  _targetPhase: Phase,
  _allMoments: Record<string, Moment>,
  _draggingMomentId: string,
): DragValidationResult {
  return { isValid: true };
}

/**
 * Calculate the next available order for a moment in a cell.
 */
export function calculateNextOrder(
  targetDay: string,
  targetPhase: Phase,
  allMoments: Record<string, Moment>,
  draggingMomentId: string,
): number {
  const momentsInCell = Object.values(allMoments).filter(
    (m) =>
      m.day === targetDay &&
      m.phase === targetPhase &&
      m.id !== draggingMomentId,
  );

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
  removedMomentId: string,
): Array<{ momentId: string; newOrder: number }> {
  const momentsInCell = Object.values(allMoments)
    .filter(
      (m) =>
        m.day === targetDay &&
        m.phase === targetPhase &&
        m.id !== removedMomentId,
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
  allMoments: Record<string, Moment>,
): boolean {
  const moment = allMoments[momentId];
  if (!moment) return false;

  return moment.day === targetDay && moment.phase === targetPhase;
}
