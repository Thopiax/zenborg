import { describe, expect, it } from "vitest";
import { MomentUpdateService } from "../services/MomentUpdateService";
import { createMoment, isMomentError } from "@/domain/entities/Moment";
import { Attitude } from "@/domain/value-objects/Attitude";

describe("MomentUpdateService", () => {
  const service = new MomentUpdateService();

  describe("updateMoment", () => {
    describe("Name Updates", () => {
      it("should update moment name", () => {
        const moment = createMoment({
          name: "Morning Run",
          areaId: "area-123",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          name: "Evening Walk",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.name).toBe("Evening Walk");
          expect(result.areaId).toBe("area-123"); // Unchanged
          expect(result.id).toBe(moment.id); // Same moment
          expect(result.updatedAt).not.toBe(moment.updatedAt); // Timestamp updated
        }
      });

      it("should reject invalid name (too many words)", () => {
        const moment = createMoment({
          name: "Morning Run",
          areaId: "area-123",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          name: "This is way too many words",
        });

        expect(isMomentError(result)).toBe(true);
        if (isMomentError(result)) {
          expect(result.error).toBe("Moment name cannot exceed 3 words");
        }
      });

      it("should reject empty name", () => {
        const moment = createMoment({
          name: "Morning Run",
          areaId: "area-123",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          name: "",
        });

        expect(isMomentError(result)).toBe(true);
        if (isMomentError(result)) {
          expect(result.error).toBe("Moment name cannot be empty");
        }
      });

      it("should trim updated name", () => {
        const moment = createMoment({
          name: "Morning Run",
          areaId: "area-123",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          name: "  Evening Walk  ",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.name).toBe("Evening Walk");
        }
      });
    });

    describe("Area Updates", () => {
      it("should update moment area", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          areaId: "area-456",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.areaId).toBe("area-456");
          expect(result.name).toBe("Task"); // Unchanged
        }
      });
    });

    describe("Horizon Updates", () => {
      it("should update moment horizon", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
          horizon: "this-week",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          horizon: "later",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.horizon).toBe("later");
        }
      });

      it("should clear horizon (set to null)", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
          horizon: "this-week",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          horizon: null,
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.horizon).toBeNull();
        }
      });
    });

    describe("Attitude Updates", () => {
      it("should update moment attitude", () => {
        const moment = createMoment({
          name: "Learning",
          areaId: "area-123",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          attitude: Attitude.BEGINNING,
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.attitude).toBe(Attitude.BEGINNING);
        }
      });

      it("should change attitude from BEGINNING to BUILDING", () => {
        const moment = createMoment({
          name: "Learning",
          areaId: "area-123",
          attitude: Attitude.BEGINNING,
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          attitude: Attitude.BUILDING,
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.attitude).toBe(Attitude.BUILDING);
        }
      });

      it("should clear attitude (set to null)", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
          attitude: Attitude.KEEPING,
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          attitude: null,
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.attitude).toBeNull();
        }
      });
    });

    describe("Tag Updates", () => {
      it("should update moment tags", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
          tags: ["old-tag"],
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          tags: ["new-tag", "another-tag"],
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.tags).toEqual(["new-tag", "another-tag"]);
        }
      });

      it("should clear tags (empty array)", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
          tags: ["tag1", "tag2"],
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          tags: [],
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.tags).toEqual([]);
        }
      });
    });

    describe("Custom Metric Updates", () => {
      it("should update custom metric", () => {
        const moment = createMoment({
          name: "Workout",
          areaId: "area-123",
          attitude: Attitude.PUSHING,
          customMetric: {
            name: "Reps",
            unit: "count",
            target: 50,
          },
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          customMetric: {
            name: "Distance",
            unit: "km",
            target: 10,
          },
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.customMetric?.name).toBe("Distance");
          expect(result.customMetric?.unit).toBe("km");
          expect(result.customMetric?.target).toBe(10);
        }
      });

      it("should clear custom metric", () => {
        const moment = createMoment({
          name: "Workout",
          areaId: "area-123",
          attitude: Attitude.PUSHING,
          customMetric: {
            name: "Reps",
            unit: "count",
            target: 50,
          },
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          customMetric: undefined,
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.customMetric).toBeUndefined();
        }
      });
    });

    describe("Multiple Field Updates", () => {
      it("should update multiple fields at once", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
          horizon: "this-week",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          name: "New Task",
          areaId: "area-456",
          horizon: "later",
          attitude: Attitude.BUILDING,
          tags: ["important"],
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.name).toBe("New Task");
          expect(result.areaId).toBe("area-456");
          expect(result.horizon).toBe("later");
          expect(result.attitude).toBe(Attitude.BUILDING);
          expect(result.tags).toEqual(["important"]);
        }
      });

      it("should only update specified fields", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
          horizon: "this-week",
          attitude: Attitude.BEGINNING,
          tags: ["tag1", "tag2"],
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        // Only update name
        const result = service.updateMoment(moment, {
          name: "Updated Task",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.name).toBe("Updated Task");
          // Other fields unchanged
          expect(result.areaId).toBe("area-123");
          expect(result.horizon).toBe("this-week");
          expect(result.attitude).toBe(Attitude.BEGINNING);
          expect(result.tags).toEqual(["tag1", "tag2"]);
        }
      });
    });

    describe("Timestamp Updates", () => {
      it("should update timestamp when fields change", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          name: "Updated Task",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          // Timestamp should be defined and valid ISO string
          expect(result.updatedAt).toBeDefined();
          expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        }
      });

      it("should preserve createdAt timestamp", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          name: "Updated Task",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.createdAt).toBe(moment.createdAt);
        }
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty updates object", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {});

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          // All fields should be unchanged except timestamp
          expect(result.name).toBe(moment.name);
          expect(result.areaId).toBe(moment.areaId);
          // Timestamp should be updated (valid ISO string)
          expect(result.updatedAt).toBeDefined();
          expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        }
      });

      it("should preserve all moment properties not being updated", () => {
        const moment = createMoment({
          name: "Task",
          areaId: "area-123",
          horizon: "this-week",
          attitude: Attitude.BUILDING,
          tags: ["tag1"],
        });
        if (isMomentError(moment)) throw new Error(moment.error);

        const result = service.updateMoment(moment, {
          name: "New Name",
        });

        expect(isMomentError(result)).toBe(false);
        if (!isMomentError(result)) {
          expect(result.id).toBe(moment.id);
          expect(result.areaId).toBe(moment.areaId);
          expect(result.horizon).toBe(moment.horizon);
          expect(result.attitude).toBe(moment.attitude);
          expect(result.tags).toBe(moment.tags);
          expect(result.day).toBe(moment.day);
          expect(result.phase).toBe(moment.phase);
          expect(result.order).toBe(moment.order);
        }
      });
    });
  });
});
