import { describe, expect, it } from "vitest";
import { isMomentError } from "@/domain/entities/Moment";
import { Phase } from "@/domain/value-objects/Phase";
import { MomentCreationService } from "../services/MomentCreationService";

describe("MomentCreationService", () => {
  const service = new MomentCreationService();

  describe("createMomentWithWorkflow", () => {
    describe("Basic Creation", () => {
      it("should create unallocated moment when no prefilled allocation", () => {
        const result = service.createMomentWithWorkflow({
          name: "Morning Run",
          areaId: "area-123",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.name).toBe("Morning Run");
          expect(result.areaId).toBe("area-123");
          expect(result.day).toBeNull();
          expect(result.phase).toBeNull();
          expect(result.id).toBeDefined();
          expect(result.createdAt).toBeDefined();
          expect(result.updatedAt).toBeDefined();
        }
      });

      it("should create moment with phase grouping (for drawing board)", () => {
        const result = service.createMomentWithWorkflow({
          name: "Deep Work",
          areaId: "area-123",
          phase: Phase.MORNING,
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.phase).toBe(Phase.MORNING);
          expect(result.day).toBeNull(); // Still unallocated
        }
      });

      it("should create moment with tags", () => {
        const result = service.createMomentWithWorkflow({
          name: "Learning React",
          areaId: "area-123",
          tags: ["learning", "react"],
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.tags).toEqual(["learning", "react"]);
        }
      });

      it("should create moment with custom metric", () => {
        const result = service.createMomentWithWorkflow({
          name: "Run 5K",
          areaId: "area-123",
          customMetric: {
            name: "Distance",
            unit: "km",
            target: 5,
          },
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.customMetric).toEqual({
            name: "Distance",
            unit: "km",
            target: 5,
          });
        }
      });
    });

    describe("Prefilled Allocation Workflow", () => {
      it("should allocate moment when prefilled allocation provided", () => {
        const result = service.createMomentWithWorkflow({
          name: "Morning Run",
          areaId: "area-123",
          prefilledAllocation: {
            day: "2025-01-15",
            phase: Phase.MORNING,
          },
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.name).toBe("Morning Run");
          expect(result.day).toBe("2025-01-15");
          expect(result.phase).toBe(Phase.MORNING);
          expect(result.order).toBe(0);
        }
      });

      it("should prioritize prefilled allocation over phase", () => {
        const result = service.createMomentWithWorkflow({
          name: "Deep Work",
          areaId: "area-123",
          phase: Phase.AFTERNOON, // Form value
          prefilledAllocation: {
            day: "2025-01-15",
            phase: Phase.MORNING, // Timeline click
          },
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          // Should use prefilled allocation, not form values
          expect(result.day).toBe("2025-01-15");
          expect(result.phase).toBe(Phase.MORNING);
        }
      });

      it("should allocate with tags preserved", () => {
        const result = service.createMomentWithWorkflow({
          name: "Learning",
          areaId: "area-123",
          tags: ["focus"],
          prefilledAllocation: {
            day: "2025-01-15",
            phase: Phase.EVENING,
          },
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.day).toBe("2025-01-15");
          expect(result.phase).toBe(Phase.EVENING);
          expect(result.tags).toEqual(["focus"]);
        }
      });
    });

    describe("Validation", () => {
      it("should reject invalid moment name (too many words)", () => {
        const result = service.createMomentWithWorkflow({
          name: "This is way too many words",
          areaId: "area-123",
        });

        expect(isMomentError(result)).toBe(true);
        if (isMomentError(result)) {
          expect(result.error).toBe("Moment name cannot exceed 3 words");
        }
      });

      it("should reject empty moment name", () => {
        const result = service.createMomentWithWorkflow({
          name: "",
          areaId: "area-123",
        });

        expect(isMomentError(result)).toBe(true);
        if (isMomentError(result)) {
          expect(result.error).toBe("Moment name cannot be empty");
        }
      });

      it("should reject empty areaId", () => {
        const result = service.createMomentWithWorkflow({
          name: "Morning Run",
          areaId: "",
        });

        expect(isMomentError(result)).toBe(true);
        if (isMomentError(result)) {
          expect(result.error).toBe("Moment must have an areaId");
        }
      });

      it("should trim moment name", () => {
        const result = service.createMomentWithWorkflow({
          name: "  Morning Run  ",
          areaId: "area-123",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.name).toBe("Morning Run");
        }
      });

      it("should filter out invalid tags", () => {
        const result = service.createMomentWithWorkflow({
          name: "Learning",
          areaId: "area-123",
          tags: ["valid-tag", "INVALID TAG WITH SPACES", "valid123"],
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          // Only valid tags should be included
          expect(result.tags?.length).toBeLessThan(3);
          expect(result.tags).toContain("valid-tag");
          expect(result.tags).toContain("valid123");
        }
      });
    });

    describe("Business Rules", () => {
      it("should set order to 0 for newly allocated moments", () => {
        const result = service.createMomentWithWorkflow({
          name: "Task",
          areaId: "area-123",
          prefilledAllocation: {
            day: "2025-01-15",
            phase: Phase.AFTERNOON,
          },
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.order).toBe(0);
        }
      });

      it("should preserve customMetric when allocating", () => {
        const result = service.createMomentWithWorkflow({
          name: "Workout",
          areaId: "area-123",
          customMetric: {
            name: "Reps",
            unit: "count",
            target: 50,
          },
          prefilledAllocation: {
            day: "2025-01-15",
            phase: Phase.MORNING,
          },
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.customMetric).toBeDefined();
          expect(result.customMetric?.name).toBe("Reps");
        }
      });
    });

    describe("Edge Cases", () => {
      it("should handle partial prefilled allocation (missing phase)", () => {
        const result = service.createMomentWithWorkflow({
          name: "Task",
          areaId: "area-123",
          prefilledAllocation: {
            day: "2025-01-15",
            phase: undefined as any,
          },
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          // Should not allocate if phase is missing
          expect(result.day).toBeNull();
        }
      });

      it("should handle partial prefilled allocation (missing day)", () => {
        const result = service.createMomentWithWorkflow({
          name: "Task",
          areaId: "area-123",
          prefilledAllocation: {
            day: undefined as any,
            phase: Phase.MORNING,
          },
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          // Should not allocate if day is missing
          expect(result.day).toBeNull();
        }
      });

      it("should handle null/undefined optional parameters", () => {
        const result = service.createMomentWithWorkflow({
          name: "Task",
          areaId: "area-123",
          phase: null,
          tags: undefined,
          customMetric: undefined,
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.phase).toBeNull();
          expect(result.tags).toEqual([]);
          expect(result.customMetric).toBeUndefined();
        }
      });
    });
  });
});
