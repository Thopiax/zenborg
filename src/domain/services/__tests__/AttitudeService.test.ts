import { describe, it, expect } from "vitest";
import { AttitudeService } from "../AttitudeService";
import { Attitude } from "@/domain/value-objects/Attitude";
import type { Moment } from "@/domain/entities/Moment";
import type { Habit } from "@/domain/entities/Habit";
import type { Area } from "@/domain/entities/Area";

describe("AttitudeService", () => {
  const service = new AttitudeService();

  const createMoment = (
    id: string,
    areaId: string,
    habitId: string | null = null
  ): Moment => ({
    id,
    name: `Moment ${id}`,
    areaId,
    habitId,
    cycleId: null,
    cyclePlanId: null,
    phase: null,
    day: null,
    order: 0,
    emoji: null,
    tags: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createHabit = (id: string, areaId: string, attitude: Attitude | null): Habit => ({
    id,
    name: `Habit ${id}`,
    areaId,
    attitude,
    phase: null,
    tags: [],
    emoji: null,
    isArchived: false,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createArea = (id: string, attitude: Attitude | null): Area => ({
    id,
    name: `Area ${id}`,
    color: "#000000",
    emoji: "🟢",
    attitude,
    tags: [],
    isDefault: false,
    isArchived: false,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  describe("getMomentAttitude", () => {
    it("returns habit attitude when moment has habitId and habit has attitude", () => {
      const moment = createMoment("m1", "area1", "habit1");
      const habits = {
        habit1: createHabit("habit1", "area1", Attitude.BUILDING),
      };
      const areas = {
        area1: createArea("area1", Attitude.KEEPING),
      };

      const result = service.getMomentAttitude(moment, habits, areas);

      expect(result).toBe(Attitude.BUILDING);
    });

    it("falls back to area attitude when moment has habitId but habit has no attitude", () => {
      const moment = createMoment("m1", "area1", "habit1");
      const habits = {
        habit1: createHabit("habit1", "area1", null), // No attitude
      };
      const areas = {
        area1: createArea("area1", Attitude.KEEPING),
      };

      const result = service.getMomentAttitude(moment, habits, areas);

      expect(result).toBe(Attitude.KEEPING);
    });

    it("falls back to area attitude when moment has no habitId", () => {
      const moment = createMoment("m1", "area1", null);
      const habits = {};
      const areas = {
        area1: createArea("area1", Attitude.KEEPING),
      };

      const result = service.getMomentAttitude(moment, habits, areas);

      expect(result).toBe(Attitude.KEEPING);
    });

    it("returns null when moment has habitId but habit does not exist", () => {
      const moment = createMoment("m1", "area1", "habit1");
      const habits = {}; // Habit doesn't exist
      const areas = {
        area1: createArea("area1", Attitude.KEEPING),
      };

      const result = service.getMomentAttitude(moment, habits, areas);

      expect(result).toBe(Attitude.KEEPING); // Falls back to area
    });

    it("returns null when no habit or area attitude", () => {
      const moment = createMoment("m1", "area1", null);
      const habits = {};
      const areas = {
        area1: createArea("area1", null), // No attitude
      };

      const result = service.getMomentAttitude(moment, habits, areas);

      expect(result).toBe(null);
    });

    it("returns null when area does not exist", () => {
      const moment = createMoment("m1", "area1", null);
      const habits = {};
      const areas = {}; // Area doesn't exist

      const result = service.getMomentAttitude(moment, habits, areas);

      expect(result).toBe(null);
    });

    it("handles all attitude types correctly", () => {
      const moment = createMoment("m1", "area1", null);
      const habits = {};

      // Test each attitude type
      const attitudeTypes = [
        Attitude.BEGINNING,
        Attitude.KEEPING,
        Attitude.BUILDING,
        Attitude.PUSHING,
        Attitude.BEING,
      ];

      for (const attitude of attitudeTypes) {
        const areas = {
          area1: createArea("area1", attitude),
        };

        const result = service.getMomentAttitude(moment, habits, areas);
        expect(result).toBe(attitude);
      }
    });
  });

  describe("getMomentsAttitudes", () => {
    it("computes attitudes for multiple moments", () => {
      const moments = [
        createMoment("m1", "area1", "habit1"),
        createMoment("m2", "area2", null),
        createMoment("m3", "area1", null),
      ];

      const habits = {
        habit1: createHabit("habit1", "area1", Attitude.BUILDING),
      };

      const areas = {
        area1: createArea("area1", Attitude.KEEPING),
        area2: createArea("area2", Attitude.BEGINNING),
      };

      const result = service.getMomentsAttitudes(moments, habits, areas);

      expect(result.size).toBe(3);
      expect(result.get("m1")).toBe(Attitude.BUILDING); // From habit
      expect(result.get("m2")).toBe(Attitude.BEGINNING); // From area2
      expect(result.get("m3")).toBe(Attitude.KEEPING); // From area1
    });

    it("returns empty map for empty moments array", () => {
      const result = service.getMomentsAttitudes([], {}, {});

      expect(result.size).toBe(0);
    });

    it("handles moments with null attitudes", () => {
      const moments = [
        createMoment("m1", "area1", null),
        createMoment("m2", "area2", null),
      ];

      const habits = {};
      const areas = {
        area1: createArea("area1", null),
        area2: createArea("area2", Attitude.KEEPING),
      };

      const result = service.getMomentsAttitudes(moments, habits, areas);

      expect(result.size).toBe(2);
      expect(result.get("m1")).toBe(null);
      expect(result.get("m2")).toBe(Attitude.KEEPING);
    });
  });
});
