import { describe, expect, it } from "vitest";
import {
  allocateMoment,
  canAllocateToPhase,
  createMoment,
  isMomentError,
  type Moment,
  unallocateMoment,
  updateMomentName,
  validateMomentName,
} from "../entities/Moment";
import { Phase } from "../value-objects/Phase";

describe("Moment", () => {
  describe("validateMomentName", () => {
    it("should accept 1 word", () => {
      const result = validateMomentName("Running");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("should accept 2 words", () => {
      const result = validateMomentName("Morning Run");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(2);
    });

    it("should accept 3 words", () => {
      const result = validateMomentName("Deep Work Session");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(3);
    });

    it("should reject 4 words", () => {
      const result = validateMomentName("This is too many words");
      expect(result.valid).toBe(false);
      expect(result.wordCount).toBe(5);
      expect(result.error).toBe("Moment name cannot exceed 3 words");
    });

    it("should reject empty string", () => {
      const result = validateMomentName("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Moment name cannot be empty");
    });

    it("should reject whitespace only", () => {
      const result = validateMomentName("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Moment name cannot be empty");
    });

    it("should handle multiple spaces between words", () => {
      const result = validateMomentName("Deep    Work");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(2);
    });

    it("should trim leading and trailing spaces", () => {
      const result = validateMomentName("  Morning Run  ");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(2);
    });
  });

  describe("createMoment", () => {
    it("should create a valid moment", () => {
      const result = createMoment({ name: "Morning Run", areaId: "area-1" });

      expect(isMomentError(result)).toBe(false);
      if (!isMomentError(result)) {
        expect(result.id).toBeDefined();
        expect(result.name).toBe("morning run");
        expect(result.areaId).toBe("area-1");
        expect(result.phase).toBeNull();
        expect(result.day).toBeNull();
        expect(result.order).toBe(0);
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
      }
    });

    it("should reject invalid name", () => {
      const result = createMoment({
        name: "Too many words here",
        areaId: "area-1",
      });

      expect(isMomentError(result)).toBe(true);
      if (isMomentError(result)) {
        expect(result.error).toBe("Moment name cannot exceed 3 words");
      }
    });

    it("should reject empty areaId", () => {
      const result = createMoment({ name: "Running", areaId: "" });

      expect(isMomentError(result)).toBe(true);
      if (isMomentError(result)) {
        expect(result.error).toBe("Moment must have an areaId");
      }
    });

    it("should trim name", () => {
      const result = createMoment({ name: "  Running  ", areaId: "area-1" });

      expect(isMomentError(result)).toBe(false);
      if (!isMomentError(result)) {
        expect(result.name).toBe("running");
      }
    });

    it("should create moment with habitId (linked to habit)", () => {
      const moment = createMoment({
        name: "Morning Run",
        areaId: "area-123",
        habitId: "habit-456",
      });

      if ("error" in moment) throw new Error(moment.error);

      expect(moment.habitId).toBe("habit-456");
      expect(moment.areaId).toBe("area-123");
    });

    it("should create orphaned moment (no habitId)", () => {
      const moment = createMoment({
        name: "One Time Thing",
        areaId: "area-123",
      });

      if ("error" in moment) throw new Error(moment.error);

      expect(moment.habitId).toBeNull();
    });
  });

  describe("allocateMoment", () => {
    it("should allocate moment to a phase", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        const allocated = allocateMoment(moment, {
          day: "2025-01-15",
          phase: Phase.MORNING,
          order: 0,
        });

        expect(allocated.day).toBe("2025-01-15");
        expect(allocated.phase).toBe(Phase.MORNING);
        expect(allocated.order).toBe(0);
        expect(allocated.updatedAt).toBeDefined();
      }
    });

    it("should throw error for invalid order", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        expect(() =>
          allocateMoment(moment, {
            day: "2025-01-15",
            phase: Phase.MORNING,
            order: -1,
          })
        ).toThrow("Order must be between 0 and 2");

        expect(() =>
          allocateMoment(moment, {
            day: "2025-01-15",
            phase: Phase.MORNING,
            order: 3,
          })
        ).toThrow("Order must be between 0 and 2");
      }
    });
  });

  describe("unallocateMoment", () => {
    it("should unallocate a moment", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        const allocated = allocateMoment(moment, {
          day: "2025-01-15",
          phase: Phase.MORNING,
          order: 1,
        });
        const unallocated = unallocateMoment(allocated);

        expect(unallocated.day).toBeNull();
        expect(unallocated.phase).toBeNull();
        expect(unallocated.order).toBe(0);
        expect(unallocated.updatedAt).toBeDefined();
      }
    });
  });

  describe("updateMomentName", () => {
    it("should update moment name", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        const updated = updateMomentName(moment, { name: "Morning Jog" });

        expect(isMomentError(updated)).toBe(false);
        if (!isMomentError(updated)) {
          expect(updated.name).toBe("morning jog");
          expect(updated.updatedAt).toBeDefined();
        }
      }
    });

    it("should reject invalid new name", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        const updated = updateMomentName(moment, {
          name: "Too many words here",
        });

        expect(isMomentError(updated)).toBe(true);
        if (isMomentError(updated)) {
          expect(updated.error).toBe("Moment name cannot exceed 3 words");
        }
      }
    });
  });

  describe("canAllocateToPhase", () => {
    const day = "2025-01-15";
    const phase = Phase.MORNING;

    it("should allow allocation when phase has 0 moments", () => {
      const moments: Moment[] = [];
      expect(canAllocateToPhase(moments, day, phase)).toBe(true);
    });

    it("should allow allocation when phase has 1 moment", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);

      if (!isMomentError(moment1)) {
        const allocated = allocateMoment(moment1, { day, phase, order: 0 });
        expect(canAllocateToPhase([allocated], day, phase)).toBe(true);
      }
    });

    it("should allow allocation when phase has 2 moments", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      const moment2 = createMoment({ name: "Meditation", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);
      expect(isMomentError(moment2)).toBe(false);

      if (!isMomentError(moment1) && !isMomentError(moment2)) {
        const allocated1 = allocateMoment(moment1, { day, phase, order: 0 });
        const allocated2 = allocateMoment(moment2, { day, phase, order: 1 });
        expect(canAllocateToPhase([allocated1, allocated2], day, phase)).toBe(
          true
        );
      }
    });

    it("should reject allocation when phase has 3 moments", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      const moment2 = createMoment({ name: "Meditation", areaId: "area-1" });
      const moment3 = createMoment({ name: "Breakfast", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);
      expect(isMomentError(moment2)).toBe(false);
      expect(isMomentError(moment3)).toBe(false);

      if (
        !isMomentError(moment1) &&
        !isMomentError(moment2) &&
        !isMomentError(moment3)
      ) {
        const allocated1 = allocateMoment(moment1, { day, phase, order: 0 });
        const allocated2 = allocateMoment(moment2, { day, phase, order: 1 });
        const allocated3 = allocateMoment(moment3, { day, phase, order: 2 });
        expect(
          canAllocateToPhase([allocated1, allocated2, allocated3], day, phase)
        ).toBe(false);
      }
    });

    it("should not count moments from different days", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      const moment2 = createMoment({ name: "Meditation", areaId: "area-1" });
      const moment3 = createMoment({ name: "Breakfast", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);
      expect(isMomentError(moment2)).toBe(false);
      expect(isMomentError(moment3)).toBe(false);

      if (
        !isMomentError(moment1) &&
        !isMomentError(moment2) &&
        !isMomentError(moment3)
      ) {
        const allocated1 = allocateMoment(moment1, { day, phase, order: 0 });
        const allocated2 = allocateMoment(moment2, { day, phase, order: 1 });
        const allocated3 = allocateMoment(moment3, {
          day: "2025-01-16",
          phase,
          order: 0,
        });
        expect(
          canAllocateToPhase([allocated1, allocated2, allocated3], day, phase)
        ).toBe(true);
      }
    });

    it("should not count moments from different phases", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      const moment2 = createMoment({ name: "Meditation", areaId: "area-1" });
      const moment3 = createMoment({ name: "Breakfast", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);
      expect(isMomentError(moment2)).toBe(false);
      expect(isMomentError(moment3)).toBe(false);

      if (
        !isMomentError(moment1) &&
        !isMomentError(moment2) &&
        !isMomentError(moment3)
      ) {
        const allocated1 = allocateMoment(moment1, { day, phase, order: 0 });
        const allocated2 = allocateMoment(moment2, { day, phase, order: 1 });
        const allocated3 = allocateMoment(moment3, {
          day,
          phase: Phase.AFTERNOON,
          order: 0,
        });
        expect(
          canAllocateToPhase([allocated1, allocated2, allocated3], day, phase)
        ).toBe(true);
      }
    });
  });
});
