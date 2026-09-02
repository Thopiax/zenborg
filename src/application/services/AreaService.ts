import {
  type Area,
  type AreaResult,
  type CreateAreaProps,
  canDeleteArea,
  createArea,
  updateArea,
} from "@zenborg/core/domain/entities/Area";
import { areas$, habits$, moments$ } from "@/infrastructure/state/store";

export class AreaService {
  createArea(props: CreateAreaProps): AreaResult {
    const result = createArea(props);

    if ("error" in result) {
      return result;
    }

    areas$[result.id].set(result);

    return result;
  }

  updateArea(
    areaId: string,
    updates: Partial<
      Pick<Area, "name" | "color" | "emoji" | "order" | "attitude" | "tags">
    >,
  ): AreaResult {
    const existing = areas$[areaId].get();

    if (!existing) {
      return { error: `Area with ID ${areaId} not found` };
    }

    const result = updateArea(existing, updates);

    if ("error" in result) {
      return result;
    }

    areas$[areaId].set(result);

    return result;
  }

  deleteArea(areaId: string): { success: true } | { error: string } {
    const area = areas$[areaId].get();

    if (!area) {
      return { error: `Area with ID ${areaId} not found` };
    }

    const allHabits = Object.values(habits$.peek());
    const areaHabits = allHabits.filter((h) => h.areaId === areaId);
    if (areaHabits.length > 0) {
      return {
        error: `Cannot delete area: it has ${areaHabits.length} habit(s). Move or delete them first.`,
      };
    }

    const allMoments = Object.values(moments$.peek());
    if (!canDeleteArea(area, allMoments)) {
      return {
        error:
          "Cannot delete area: it has moments referencing it. Reassign or delete them first.",
      };
    }

    areas$[areaId].delete();

    return { success: true };
  }

  getArea(areaId: string): Area | null {
    return areas$[areaId].get() || null;
  }

  getAllAreas(): Area[] {
    const areasRecord = areas$.get();
    return Object.values(areasRecord);
  }

}
