import {
  archiveArea,
  canDeleteArchivedArea,
  createArea,
  unarchiveArea,
  updateArea,
  type Area,
  type AreaResult,
  type CreateAreaProps,
} from "@/domain/entities/Area";
import { areas$, habits$, moments$ } from "@/infrastructure/state/store";

/**
 * Application Service for Area Management
 *
 * Orchestrates area CRUD operations with Legend State store integration.
 * This service encapsulates business workflows for areas, keeping
 * infrastructure concerns (store management) out of the domain layer.
 *
 * Business Rules:
 * 1. Validate area properties (name, color, emoji)
 * 2. Automatically persist to Legend State store
 * 3. Support archiving (soft delete pattern)
 * 4. Prevent deletion of areas with associated habits/moments
 */
export class AreaService {
  /**
   * Creates a new area and adds it to the store
   *
   * @param props - Area creation parameters
   * @returns Created area or error if validation fails
   */
  createArea(props: CreateAreaProps): AreaResult {
    const result = createArea(props);

    if ("error" in result) {
      return result;
    }

    // Add to store
    areas$[result.id].set(result);

    return result;
  }

  /**
   * Updates an existing area and syncs to store
   *
   * @param areaId - ID of area to update
   * @param updates - Fields to update
   * @returns Updated area or error if validation fails
   */
  updateArea(
    areaId: string,
    updates: Partial<
      Pick<Area, "name" | "color" | "emoji" | "order" | "attitude" | "tags">
    >
  ): AreaResult {
    const existing = areas$[areaId].get();

    if (!existing) {
      return { error: `Area with ID ${areaId} not found` };
    }

    const result = updateArea(existing, updates);

    if ("error" in result) {
      return result;
    }

    // Update store
    areas$[areaId].set(result);

    return result;
  }

  /**
   * Archives an area (soft delete)
   *
   * @param areaId - ID of area to archive
   * @returns Archived area or error if not found
   */
  archiveArea(areaId: string): AreaResult {
    const existing = areas$[areaId].get();

    if (!existing) {
      return { error: `Area with ID ${areaId} not found` };
    }

    const result = archiveArea(existing);

    // Update store
    areas$[areaId].set(result);

    return result;
  }

  /**
   * Unarchives an area
   *
   * @param areaId - ID of area to unarchive
   * @returns Unarchived area or error if not found
   */
  unarchiveArea(areaId: string): AreaResult {
    const existing = areas$[areaId].get();

    if (!existing) {
      return { error: `Area with ID ${areaId} not found` };
    }

    const result = unarchiveArea(existing);

    // Update store
    areas$[areaId].set(result);

    return result;
  }

  /**
   * Deletes an archived area if it has no associated habits or moments
   *
   * @param areaId - ID of archived area to delete
   * @returns Success or error if area cannot be deleted
   */
  deleteArchivedArea(areaId: string): { success: true } | { error: string } {
    const area = areas$[areaId].get();

    if (!area) {
      return { error: `Area with ID ${areaId} not found` };
    }

    const allMoments = Object.values(moments$.peek());

    const canDelete = canDeleteArchivedArea(area, allMoments);

    if (!canDelete) {
      return {
        error: "Cannot delete area: it is not archived or has associated moments",
      };
    }

    // Delete from store
    areas$[areaId].delete();

    return { success: true };
  }

  /**
   * Gets a single area by ID
   *
   * @param areaId - ID of area to retrieve
   * @returns Area if found, null otherwise
   */
  getArea(areaId: string): Area | null {
    return areas$[areaId].get() || null;
  }

  /**
   * Gets all areas (including archived)
   *
   * @returns Array of all areas
   */
  getAllAreas(): Area[] {
    const areasRecord = areas$.get();
    return Object.values(areasRecord);
  }

  /**
   * Gets only active (non-archived) areas, sorted by order
   *
   * @returns Array of active areas
   */
  getActiveAreas(): Area[] {
    const areasRecord = areas$.get();
    return Object.values(areasRecord)
      .filter((area) => !area.isArchived)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Gets only archived areas
   *
   * @returns Array of archived areas
   */
  getArchivedAreas(): Area[] {
    const areasRecord = areas$.get();
    return Object.values(areasRecord).filter((area) => area.isArchived);
  }
}
