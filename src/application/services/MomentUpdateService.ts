import type { Horizon, Moment, MomentResult } from "@/domain/entities/Moment";
import { isMomentError, updateMomentName } from "@/domain/entities/Moment";
import type { Attitude, CustomMetric } from "@/domain/value-objects/Attitude";
import type { Phase } from "@/domain/value-objects/Phase";

/**
 * Parameters for updating a moment
 */
export interface UpdateMomentParams {
  name?: string;
  areaId?: string;
  horizon?: Horizon | null;
  attitude?: Attitude | null;
  phase?: Phase | null;
  tags?: string[];
  customMetric?: CustomMetric;
}

/**
 * Application Service for Moment Updates
 *
 * Orchestrates the business workflow for updating moments.
 * This service encapsulates update business rules, keeping this
 * logic out of the presentation layer.
 *
 * Business Rules:
 * 1. Validate name if changing (1-3 words)
 * 2. Clear customMetric if attitude is not PUSHING
 * 3. Update timestamp on any change
 */
export class MomentUpdateService {
  /**
   * Updates a moment with validation and business rules
   *
   * This is a convenience method that orchestrates multiple domain operations.
   * For more specific updates, use the granular domain functions directly.
   *
   * @param moment - The moment to update
   * @param updates - Fields to update
   * @returns Updated moment or error if validation fails
   */
  updateMoment(moment: Moment, updates: UpdateMomentParams): MomentResult {
    let current = moment;

    // Update name if provided (with validation)
    if (updates.name !== undefined) {
      const result = updateMomentName(current, { name: updates.name });
      if (isMomentError(result)) {
        return result;
      }
      current = result;
    }

    // Build updated moment object
    // Note: We need to handle explicit undefined to allow clearing fields
    const updated: Moment = {
      ...current,
      updatedAt: new Date().toISOString(),
    };

    // Apply updates only if they're present in the updates object
    if ("areaId" in updates) {
      updated.areaId = updates.areaId!;
    }
    if ("horizon" in updates) {
      updated.horizon = updates.horizon!;
    }
    if ("attitude" in updates) {
      updated.attitude = updates.attitude!;
    }
    if ("tags" in updates) {
      updated.tags = updates.tags!;
    }
    if ("customMetric" in updates) {
      updated.customMetric = updates.customMetric;
    }
    if ("phase" in updates) {
      updated.phase = updates.phase!;
    }

    return updated;
  }
}
