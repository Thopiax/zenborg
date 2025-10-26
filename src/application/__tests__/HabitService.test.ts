import { describe, expect, it, beforeEach } from "vitest";
import { HabitService } from "../services/HabitService";
import { habits$ } from "@/infrastructure/state/store";
import { Attitude } from "@/domain/value-objects/Attitude";

describe("HabitService", () => {
  const service = new HabitService();

  beforeEach(() => {
    // Clear habits before each test
    habits$.set({});
  });

  describe("createHabit", () => {
    it("should create habit and add to store", () => {
      const habit = service.createHabit({
        name: "Morning Run",
        areaId: "area-123",
        order: 0,
      });

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.id).toBeDefined();
      expect(habit.name).toBe("Morning Run");
      expect(habit.areaId).toBe("area-123");
      expect(habit.isArchived).toBe(false);

      // Verify it's in the store
      const storeHabits = habits$.get();
      expect(storeHabits[habit.id]).toEqual(habit);
    });

    it("should create habit with attitude and tags", () => {
      const habit = service.createHabit({
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
      const habit = service.createHabit({
        name: "Yoga",
        areaId: "area-789",
        order: 2,
        emoji: "🧘",
      });

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.emoji).toBe("🧘");
    });

    it("should reject invalid name (too many words)", () => {
      const result = service.createHabit({
        name: "This Is Way Too Many Words For A Habit Name",
        areaId: "area-123",
        order: 0,
      });

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("3 words");
      }

      // Should not be added to store
      const storeHabits = habits$.get();
      expect(Object.keys(storeHabits)).toHaveLength(0);
    });

    it("should reject empty areaId", () => {
      const result = service.createHabit({
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
    it("should update habit name in store", () => {
      const habit = service.createHabit({
        name: "Running",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const updated = service.updateHabit(habit.id, { name: "Jogging" });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.name).toBe("Jogging");

      // Verify store is updated
      const storeHabit = habits$.get()[habit.id];
      expect(storeHabit.name).toBe("Jogging");
    });

    it("should update attitude", () => {
      const habit = service.createHabit({
        name: "Meditation",
        areaId: "area-456",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const updated = service.updateHabit(habit.id, {
        attitude: Attitude.PUSHING,
      });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.attitude).toBe(Attitude.PUSHING);

      // Verify store
      const storeHabit = habits$.get()[habit.id];
      expect(storeHabit.attitude).toBe(Attitude.PUSHING);
    });

    it("should update tags", () => {
      const habit = service.createHabit({
        name: "Yoga",
        areaId: "area-789",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const updated = service.updateHabit(habit.id, {
        tags: ["flexibility", "strength"],
      });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.tags).toEqual(["flexibility", "strength"]);
    });

    it("should reject invalid name on update", () => {
      const habit = service.createHabit({
        name: "Running",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const result = service.updateHabit(habit.id, {
        name: "This Is Way Too Long",
      });

      expect("error" in result).toBe(true);

      // Original name should be preserved in store
      const storeHabit = habits$.get()[habit.id];
      expect(storeHabit.name).toBe("Running");
    });

    it("should return error if habit not found", () => {
      const result = service.updateHabit("non-existent-id", {
        name: "Test",
      });

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("not found");
      }
    });
  });

  describe("archiveHabit", () => {
    it("should archive habit in store", () => {
      const habit = service.createHabit({
        name: "Old Habit",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const archived = service.archiveHabit(habit.id);

      if ("error" in archived) throw new Error(archived.error);

      expect(archived.isArchived).toBe(true);

      // Verify store
      const storeHabit = habits$.get()[habit.id];
      expect(storeHabit.isArchived).toBe(true);
    });

    it("should return error if habit not found", () => {
      const result = service.archiveHabit("non-existent-id");

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("not found");
      }
    });
  });

  describe("unarchiveHabit", () => {
    it("should unarchive habit in store", () => {
      const habit = service.createHabit({
        name: "Restored Habit",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const archived = service.archiveHabit(habit.id);
      if ("error" in archived) throw new Error(archived.error);

      const unarchived = service.unarchiveHabit(habit.id);

      if ("error" in unarchived) throw new Error(unarchived.error);

      expect(unarchived.isArchived).toBe(false);

      // Verify store
      const storeHabit = habits$.get()[habit.id];
      expect(storeHabit.isArchived).toBe(false);
    });

    it("should return error if habit not found", () => {
      const result = service.unarchiveHabit("non-existent-id");

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("not found");
      }
    });
  });

  describe("getHabit", () => {
    it("should get habit from store by ID", () => {
      const created = service.createHabit({
        name: "Running",
        areaId: "area-123",
        order: 0,
      });
      if ("error" in created) throw new Error(created.error);

      const habit = service.getHabit(created.id);

      expect(habit).toBeDefined();
      expect(habit?.id).toBe(created.id);
      expect(habit?.name).toBe("Running");
    });

    it("should return null if habit not found", () => {
      const habit = service.getHabit("non-existent-id");

      expect(habit).toBeNull();
    });
  });

  describe("getAllHabits", () => {
    it("should get all habits from store", () => {
      service.createHabit({ name: "Habit 1", areaId: "area-1", order: 0 });
      service.createHabit({ name: "Habit 2", areaId: "area-2", order: 1 });
      service.createHabit({ name: "Habit 3", areaId: "area-3", order: 2 });

      const habits = service.getAllHabits();

      expect(habits).toHaveLength(3);
    });

    it("should include archived habits", () => {
      const habit1 = service.createHabit({
        name: "Active",
        areaId: "area-1",
        order: 0,
      });
      const habit2 = service.createHabit({
        name: "Archived",
        areaId: "area-2",
        order: 1,
      });

      if ("error" in habit1 || "error" in habit2) {
        throw new Error("Failed to create habits");
      }

      service.archiveHabit(habit2.id);

      const habits = service.getAllHabits();

      expect(habits).toHaveLength(2);
      expect(habits.some((h) => h.isArchived)).toBe(true);
    });
  });

  describe("getActiveHabits", () => {
    it("should get only non-archived habits", () => {
      const habit1 = service.createHabit({
        name: "Active",
        areaId: "area-1",
        order: 0,
      });
      const habit2 = service.createHabit({
        name: "Archived",
        areaId: "area-2",
        order: 1,
      });

      if ("error" in habit1 || "error" in habit2) {
        throw new Error("Failed to create habits");
      }

      service.archiveHabit(habit2.id);

      const activeHabits = service.getActiveHabits();

      expect(activeHabits).toHaveLength(1);
      expect(activeHabits[0].name).toBe("Active");
      expect(activeHabits.every((h) => !h.isArchived)).toBe(true);
    });

    it("should return habits sorted by order", () => {
      service.createHabit({ name: "Third", areaId: "area-1", order: 2 });
      service.createHabit({ name: "First", areaId: "area-2", order: 0 });
      service.createHabit({ name: "Second", areaId: "area-3", order: 1 });

      const activeHabits = service.getActiveHabits();

      expect(activeHabits[0].name).toBe("First");
      expect(activeHabits[1].name).toBe("Second");
      expect(activeHabits[2].name).toBe("Third");
    });
  });
});
