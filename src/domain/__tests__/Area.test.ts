import { describe, expect, it } from "vitest";
import {
  archiveArea,
  canDeleteArchivedArea,
  createArea,
  getDefaultAreas,
  isAreaError,
  unarchiveArea,
  updateArea,
} from "../entities/Area";
import { createMoment } from "../entities/Moment";

describe("Area", () => {
  describe("getDefaultAreas", () => {
    it("should create 6 default areas", () => {
      const areas = getDefaultAreas();
      expect(areas).toHaveLength(6);
    });

    it("should have correct default area names", () => {
      const areas = getDefaultAreas();
      const names = areas.map((a) => a.name);
      expect(names).toEqual([
        "Wellness",
        "Craft",
        "Social",
        "Joyful",
        "Introspective",
        "Chore",
      ]);
    });

    it("should have correct colors", () => {
      const areas = getDefaultAreas();
      expect(areas[0].color).toBe("#10b981"); // Wellness - green
      expect(areas[1].color).toBe("#3b82f6"); // Craft - blue
      expect(areas[2].color).toBe("#f97316"); // Social - orange
      expect(areas[3].color).toBe("#eab308"); // Joyful - yellow
      expect(areas[4].color).toBe("#6b7280"); // Introspective - gray
      expect(areas[5].color).toBe("#8b5cf6"); // Chore - purple
    });

    it("should have correct emojis", () => {
      const areas = getDefaultAreas();
      expect(areas[0].emoji).toBe("🧘");
      expect(areas[1].emoji).toBe("🎨");
      expect(areas[2].emoji).toBe("🤝");
      expect(areas[3].emoji).toBe("😄");
      expect(areas[4].emoji).toBe("🤔");
      expect(areas[5].emoji).toBe("🧹");
    });

    it("should mark all as default", () => {
      const areas = getDefaultAreas();
      expect(areas.every((a) => a.isDefault)).toBe(true);
    });

    it("should have sequential order", () => {
      const areas = getDefaultAreas();
      areas.forEach((area, index) => {
        expect(area.order).toBe(index);
      });
    });

    it("should have unique IDs", () => {
      const areas = getDefaultAreas();
      const ids = areas.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(6);
    });

    it("should have timestamps", () => {
      const areas = getDefaultAreas();
      areas.forEach((area) => {
        expect(area.createdAt).toBeDefined();
        expect(area.updatedAt).toBeDefined();
      });
    });
  });

  describe("createArea", () => {
    it("should create a valid custom area", () => {
      const result = createArea("Learning", "#9333ea", "📚", 5);

      expect(isAreaError(result)).toBe(false);
      if (!isAreaError(result)) {
        expect(result.id).toBeDefined();
        expect(result.name).toBe("Learning");
        expect(result.color).toBe("#9333ea");
        expect(result.emoji).toBe("📚");
        expect(result.order).toBe(5);
        expect(result.isDefault).toBe(false);
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
      }
    });

    it("should reject empty name", () => {
      const result = createArea("", "#9333ea", "📚", 0);

      expect(isAreaError(result)).toBe(true);
      if (isAreaError(result)) {
        expect(result.error).toBe("Area name cannot be empty");
      }
    });

    it("should reject whitespace-only name", () => {
      const result = createArea("   ", "#9333ea", "📚", 0);

      expect(isAreaError(result)).toBe(true);
      if (isAreaError(result)) {
        expect(result.error).toBe("Area name cannot be empty");
      }
    });

    it("should reject invalid hex color", () => {
      const result = createArea("Learning", "purple", "📚", 0);

      expect(isAreaError(result)).toBe(true);
      if (isAreaError(result)) {
        expect(result.error).toContain("valid hex code");
      }
    });

    it("should reject short hex color", () => {
      const result = createArea("Learning", "#123", "📚", 0);

      expect(isAreaError(result)).toBe(true);
      if (isAreaError(result)) {
        expect(result.error).toContain("valid hex code");
      }
    });

    it("should accept uppercase hex color and normalize to lowercase", () => {
      const result = createArea("Learning", "#9333EA", "📚", 0);

      expect(isAreaError(result)).toBe(false);
      if (!isAreaError(result)) {
        expect(result.color).toBe("#9333ea");
      }
    });

    it("should reject empty emoji", () => {
      const result = createArea("Learning", "#9333ea", "", 0);

      expect(isAreaError(result)).toBe(true);
      if (isAreaError(result)) {
        expect(result.error).toBe("Emoji cannot be empty");
      }
    });

    it("should reject negative order", () => {
      const result = createArea("Learning", "#9333ea", "📚", -1);

      expect(isAreaError(result)).toBe(true);
      if (isAreaError(result)) {
        expect(result.error).toBe("Order must be non-negative");
      }
    });

    it("should trim name", () => {
      const result = createArea("  Learning  ", "#9333ea", "📚", 0);

      expect(isAreaError(result)).toBe(false);
      if (!isAreaError(result)) {
        expect(result.name).toBe("Learning");
      }
    });

    it("should trim emoji", () => {
      const result = createArea("Learning", "#9333ea", "  📚  ", 0);

      expect(isAreaError(result)).toBe(false);
      if (!isAreaError(result)) {
        expect(result.emoji).toBe("📚");
      }
    });
  });

  describe("updateArea", () => {
    it("should update area name", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const updated = updateArea(result, { name: "Education" });

        expect(isAreaError(updated)).toBe(false);
        if (!isAreaError(updated)) {
          expect(updated.name).toBe("Education");
          expect(updated.color).toBe(result.color);
          expect(updated.emoji).toBe(result.emoji);
          expect(updated.order).toBe(result.order);
          expect(updated.updatedAt).toBeDefined();
        }
      }
    });

    it("should update area color", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const updated = updateArea(result, { color: "#ec4899" });

        expect(isAreaError(updated)).toBe(false);
        if (!isAreaError(updated)) {
          expect(updated.color).toBe("#ec4899");
        }
      }
    });

    it("should update area emoji", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const updated = updateArea(result, { emoji: "🎓" });

        expect(isAreaError(updated)).toBe(false);
        if (!isAreaError(updated)) {
          expect(updated.emoji).toBe("🎓");
        }
      }
    });

    it("should update area order", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const updated = updateArea(result, { order: 10 });

        expect(isAreaError(updated)).toBe(false);
        if (!isAreaError(updated)) {
          expect(updated.order).toBe(10);
        }
      }
    });

    it("should update multiple fields at once", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const updated = updateArea(result, {
          name: "Education",
          color: "#ec4899",
          emoji: "🎓",
          order: 10,
        });

        expect(isAreaError(updated)).toBe(false);
        if (!isAreaError(updated)) {
          expect(updated.name).toBe("Education");
          expect(updated.color).toBe("#ec4899");
          expect(updated.emoji).toBe("🎓");
          expect(updated.order).toBe(10);
        }
      }
    });

    it("should reject empty name update", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const updated = updateArea(result, { name: "" });

        expect(isAreaError(updated)).toBe(true);
        if (isAreaError(updated)) {
          expect(updated.error).toBe("Area name cannot be empty");
        }
      }
    });

    it("should reject invalid color update", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const updated = updateArea(result, { color: "invalid" });

        expect(isAreaError(updated)).toBe(true);
        if (isAreaError(updated)) {
          expect(updated.error).toContain("valid hex code");
        }
      }
    });

    it("should reject empty emoji update", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const updated = updateArea(result, { emoji: "" });

        expect(isAreaError(updated)).toBe(true);
        if (isAreaError(updated)) {
          expect(updated.error).toBe("Emoji cannot be empty");
        }
      }
    });

    it("should reject negative order update", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const updated = updateArea(result, { order: -1 });

        expect(isAreaError(updated)).toBe(true);
        if (isAreaError(updated)) {
          expect(updated.error).toBe("Order must be non-negative");
        }
      }
    });
  });

  describe("archiveArea", () => {
    it("should archive an area (soft delete)", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const archived = archiveArea(result);
        expect(archived.isArchived).toBe(true);
        expect(archived.id).toBe(result.id);
        expect(archived.name).toBe(result.name);
      }
    });
  });

  describe("unarchiveArea", () => {
    it("should unarchive an archived area", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const archived = archiveArea(result);
        const unarchived = unarchiveArea(archived);
        expect(unarchived.isArchived).toBe(false);
        expect(unarchived.id).toBe(result.id);
      }
    });
  });

  describe("canDeleteArchivedArea", () => {
    it("should allow deletion of archived area when no moments reference it", () => {
      const result = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(result)).toBe(false);

      if (!isAreaError(result)) {
        const archived = archiveArea(result);
        expect(canDeleteArchivedArea(archived, [])).toBe(true);
      }
    });

    it("should prevent deletion of archived area when moments reference it", () => {
      const areaResult = createArea("Learning", "#9333ea", "📚", 0);
      expect(isAreaError(areaResult)).toBe(false);

      if (!isAreaError(areaResult)) {
        const archived = archiveArea(areaResult);
        const moment = createMoment("Reading", areaResult.id);

        if ("id" in moment) {
          expect(canDeleteArchivedArea(archived, [moment])).toBe(false);
        }
      }
    });

    it("should allow deletion when moments reference different areas", () => {
      const area1Result = createArea("Learning", "#9333ea", "📚", 0);
      const area2Result = createArea("Work", "#3b82f6", "💼", 1);
      expect(isAreaError(area1Result)).toBe(false);
      expect(isAreaError(area2Result)).toBe(false);

      if (!isAreaError(area1Result) && !isAreaError(area2Result)) {
        const archived = archiveArea(area1Result);
        const moment = createMoment("Reading", area2Result.id);

        if ("id" in moment) {
          expect(canDeleteArchivedArea(archived, [moment])).toBe(true);
        }
      }
    });
  });
});
