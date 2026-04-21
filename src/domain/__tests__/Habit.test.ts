import { describe, it, expect } from "vitest";
import {
  createHabit,
  updateHabit,
  archiveHabit,
  unarchiveHabit,
  isHabitError,
  type Habit,
} from "../entities/Habit";
import { Attitude } from "../value-objects/Attitude";
import type { Rhythm } from "@/domain/value-objects/Rhythm";

describe("Habit", () => {
  describe("createHabit", () => {
    it("should create habit with required fields", () => {
      const habit = createHabit({
        name: "Running",
        areaId: "area-123",
        order: 0,
      });

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.id).toBeDefined();
      expect(habit.name).toBe("Running");
      expect(habit.areaId).toBe("area-123");
      expect(habit.attitude).toBeNull();
      expect(habit.tags).toEqual([]);
      expect(habit.emoji).toBeNull();
      expect(habit.isArchived).toBe(false);
      expect(habit.order).toBe(0);
      expect(habit.createdAt).toBeDefined();
      expect(habit.updatedAt).toBeDefined();
    });

    it("should create habit with attitude and tags", () => {
      const habit = createHabit({
        name: "Meditation",
        areaId: "area-456",
        order: 1,
        attitude: Attitude.BUILDING,
        tags: ["mindfulness", "daily"],
      });

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.attitude).toBe(Attitude.BUILDING);
      expect(habit.tags).toEqual(["mindfulness", "daily"]);
    });

    it("should create habit with custom emoji", () => {
      const habit = createHabit({
        name: "Yoga",
        areaId: "area-789",
        order: 2,
        emoji: "🧘",
      });

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.emoji).toBe("🧘");
    });

    it("should enforce 1-3 word limit on name", () => {
      const valid = createHabit({
        name: "Morning Run",
        areaId: "area-123",
        order: 0,
      });
      expect("error" in valid).toBe(false);

      const tooLong = createHabit({
        name: "My Very Long Habit Name",
        areaId: "area-123",
        order: 0,
      });
      expect("error" in tooLong).toBe(true);
      if ("error" in tooLong) {
        expect(tooLong.error).toContain("3 words");
      }
    });

    it("should normalize tags to lowercase", () => {
      const habit = createHabit({
        name: "Running",
        areaId: "area-123",
        order: 0,
        tags: ["Cardio", "OUTDOOR", "Morning-Run"],
      });

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.tags).toEqual(["cardio", "outdoor", "morning-run"]);
    });

    it("should require non-empty name", () => {
      const result = createHabit({
        name: "",
        areaId: "area-123",
        order: 0,
      });

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("empty");
      }
    });

    it("should require valid areaId", () => {
      const result = createHabit({
        name: "Running",
        areaId: "",
        order: 0,
      });

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("areaId");
      }
    });
  });

  describe("updateHabit", () => {
    it("should update habit name", () => {
      const habit = createHabit({
        name: "Running",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const updated = updateHabit(habit, { name: "Jogging" });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.name).toBe("Jogging");
      expect(updated.updatedAt).toBeDefined();
    });

    it("should update attitude", () => {
      const habit = createHabit({
        name: "Meditation",
        areaId: "area-456",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const updated = updateHabit(habit, { attitude: Attitude.PUSHING });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.attitude).toBe(Attitude.PUSHING);
    });

    it("should update tags", () => {
      const habit = createHabit({
        name: "Yoga",
        areaId: "area-789",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const updated = updateHabit(habit, { tags: ["flexibility", "strength"] });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.tags).toEqual(["flexibility", "strength"]);
    });

    it("should update emoji", () => {
      const habit = createHabit({
        name: "Guitar",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const updated = updateHabit(habit, { emoji: "🎸" });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.emoji).toBe("🎸");
    });

    it("should validate name length on update", () => {
      const habit = createHabit({
        name: "Running",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const result = updateHabit(habit, {
        name: "This Name Is Way Too Long For A Habit",
      });

      expect("error" in result).toBe(true);
    });
  });

  describe("archiveHabit", () => {
    it("should archive habit", () => {
      const habit = createHabit({
        name: "Old Habit",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const archived = archiveHabit(habit);

      expect(archived.isArchived).toBe(true);
      expect(archived.updatedAt).toBeDefined();
    });
  });

  describe("unarchiveHabit", () => {
    it("should unarchive habit", () => {
      const habit = createHabit({
        name: "Restored Habit",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const archived = archiveHabit(habit);
      const unarchived = unarchiveHabit(archived);

      expect(unarchived.isArchived).toBe(false);
      expect(unarchived.updatedAt).toBeDefined();
    });
  });
});

describe("Habit rhythm field", () => {
  it("createHabit accepts an optional rhythm", () => {
    const rhythm: Rhythm = { period: "weekly", count: 3 };
    const result = createHabit({
      name: "running",
      areaId: "area-1",
      order: 0,
      rhythm,
    });
    if (isHabitError(result)) throw new Error(result.error);
    expect(result.rhythm).toEqual(rhythm);
  });

  it("createHabit defaults rhythm to undefined", () => {
    const result = createHabit({
      name: "coffee",
      areaId: "area-1",
      order: 0,
    });
    if (isHabitError(result)) throw new Error(result.error);
    expect(result.rhythm).toBeUndefined();
  });

  it("updateHabit can set rhythm", () => {
    const created = createHabit({
      name: "running",
      areaId: "area-1",
      order: 0,
    });
    if (isHabitError(created)) throw new Error(created.error);
    const rhythm: Rhythm = { period: "monthly", count: 2 };
    const updated = updateHabit(created, { rhythm });
    if (isHabitError(updated)) throw new Error(updated.error);
    expect(updated.rhythm).toEqual(rhythm);
  });

  it("updateHabit can clear rhythm with undefined", () => {
    const created = createHabit({
      name: "running",
      areaId: "area-1",
      order: 0,
      rhythm: { period: "weekly", count: 3 },
    });
    if (isHabitError(created)) throw new Error(created.error);
    const updated = updateHabit(created, { rhythm: undefined });
    if (isHabitError(updated)) throw new Error(updated.error);
    expect(updated.rhythm).toBeUndefined();
  });
});
