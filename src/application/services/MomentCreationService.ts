import type { MomentResult } from "@/domain/entities/Moment";
import {
  allocateMoment,
  createMoment,
  isMomentError,
} from "@/domain/entities/Moment";
import type { CustomMetric } from "@/domain/value-objects/Attitude";
import type { Phase } from "@/domain/value-objects/Phase";

/**
 * Parameters for creating a moment with full workflow orchestration
 */
export interface CreateMomentWithWorkflowParams {
  name: string;
  areaId: string;
  phase?: Phase | null;
  emoji?: string | null;
  prefilledAllocation?: {
    day: string;
    phase: Phase;
  };
  tags?: string[];
  customMetric?: CustomMetric;
  startTime?: string;
  mentionIds?: string[];
}

/**
 * Application Service for Moment Creation
 *
 * Orchestrates the business workflow for creating moments.
 * This service encapsulates the business rules around moment creation
 * and allocation, keeping this logic out of the presentation layer.
 *
 * Business Rules:
 * 1. Validate moment name (1-3 words)
 * 2. If prefilled allocation exists, allocate immediately
 * 3. Otherwise, create unallocated moment
 */
export class MomentCreationService {
  /**
   * Creates a moment with full workflow orchestration
   *
   * Business workflow:
   * - Create the base moment with domain validation
   * - If prefilled allocation provided (e.g., from timeline click), allocate immediately
   * - Otherwise, return unallocated moment (will appear in drawing board)
   *
   * @param params - Moment creation parameters
   * @returns Created (and possibly allocated) moment, or error if validation fails
   */
  createMomentWithWorkflow(
    params: CreateMomentWithWorkflowParams,
  ): MomentResult {
    const {
      name,
      areaId,
      phase = null,
      emoji = null,
      prefilledAllocation,
      tags = [],
      customMetric,
      startTime,
      mentionIds = [],
    } = params;

    const result = createMoment({
      name,
      areaId,
      phase,
      emoji,
      tags,
      customMetric,
      startTime,
    });

    if (isMomentError(result)) {
      return result;
    }

    if (mentionIds.length > 0) {
      result.personIds = mentionIds;
    }

    if (prefilledAllocation?.day && prefilledAllocation?.phase) {
      return allocateMoment(result, {
        day: prefilledAllocation.day,
        phase: prefilledAllocation.phase,
        order: 0,
      });
    }

    return result;
  }
}
