import { describe, expect, it, beforeEach } from "vitest";
import { HabitService } from "../services/HabitService";
import {
  cyclePlans$,
  habits$,
  moments$,
} from "@/infrastructure/state/store";
import { Attitude } from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import { createMoment } from "@/domain/entities/Moment";
import { createCyclePlan } from "@/domain/entities/CyclePlan";

describe("HabitService", () => {
  const service = new HabitService();

  beforeEach(() => {
    habits$.set({});
    moments$.set({});
    cyclePlans$.set({});
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
      expect(habit.name).toBe("morning run");
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

      expect(updated.name).toBe("jogging");

      // Verify store is updated
      const storeHabit = habits$.get()[habit.id];
      expect(storeHabit.name).toBe("jogging");
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
      expect(storeHabit.name).toBe("running");
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

    it("should preserve all moments linked to the habit (derive paradigm)", () => {
      const habit = service.createHabit({
        name: "Running",
        areaId: "area-1",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      // Unallocated moment — under derive paradigm these shouldn't normally
      // exist (deck is virtual), but legacy records must not be cascaded.
      const unallocated = createMoment({
        name: "Running",
        areaId: "area-1",
        habitId: habit.id,
        cycleId: "cycle-1",
      });
      if ("error" in unallocated) throw new Error(unallocated.error);
      moments$[unallocated.id].set(unallocated);

      // Allocated moment (on timeline) — must be kept (historical record)
      const allocated = createMoment({
        name: "Running",
        areaId: "area-1",
        habitId: habit.id,
        cycleId: "cycle-1",
      });
      if ("error" in allocated) throw new Error(allocated.error);
      moments$[allocated.id].set({
        ...allocated,
        day: "2026-03-04",
        phase: Phase.MORNING,
        order: 0,
      });

      // Unrelated moment — should be kept
      const unrelated = createMoment({
        name: "Reading",
        areaId: "area-2",
        habitId: "other-habit",
      });
      if ("error" in unrelated) throw new Error(unrelated.error);
      moments$[unrelated.id].set(unrelated);

      service.archiveHabit(habit.id);

      const remaining = moments$.get();
      expect(Object.keys(remaining)).toHaveLength(3);
      expect(remaining[allocated.id]).toBeDefined();
      expect(remaining[unrelated.id]).toBeDefined();
      expect(remaining[unallocated.id]).toBeDefined();
    });

    it("should delete cycle plans for the habit", () => {
      const habit = service.createHabit({
        name: "Meditation",
        areaId: "area-1",
        order: 0,
      });
      if ("error" in habit) throw new Error(habit.error);

      const plan = createCyclePlan({
        cycleId: "cycle-1",
        habitId: habit.id,
        budgetedCount: 5,
      });
      if ("error" in plan) throw new Error(plan.error);
      cyclePlans$[plan.id].set(plan);

      // Unrelated plan
      const otherPlan = createCyclePlan({
        cycleId: "cycle-1",
        habitId: "other-habit",
        budgetedCount: 3,
      });
      if ("error" in otherPlan) throw new Error(otherPlan.error);
      cyclePlans$[otherPlan.id].set(otherPlan);

      service.archiveHabit(habit.id);

      const remaining = cyclePlans$.get();
      expect(Object.keys(remaining)).toHaveLength(1);
      expect(remaining[otherPlan.id]).toBeDefined();
    });
  });

  describe("archiveHabit (derive paradigm)", () => {
    it("deletes plans but preserves allocated moments (orphan via habitId)", () => {
      const habitService = new HabitService();
      habits$["h-1"].set({
        id: "h-1",
        name: "fiction",
        areaId: "a-1",
        attitude: null,
        phase: null,
        tags: [],
        emoji: null,
        isArchived: false,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      cyclePlans$["plan-1"].set({
        id: "plan-1",
        cycleId: "c-1",
        habitId: "h-1",
        budgetedCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      moments$["m-allocated"].set({
        id: "m-allocated",
        name: "fiction",
        areaId: "a-1",
        habitId: "h-1",
        cycleId: "c-1",
        cyclePlanId: "plan-1",
        day: "2026-04-24",
        phase: Phase.MORNING,
        order: 0,
        tags: [],
        emoji: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      habitService.archiveHabit("h-1");
      expect(habits$["h-1"].get()?.isArchived).toBe(true);
      expect(cyclePlans$["plan-1"].get()).toBeUndefined();
      expect(moments$["m-allocated"].get()?.id).toBe("m-allocated");
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
      expect(habit?.name).toBe("running");
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
      expect(activeHabits[0].name).toBe("active");
      expect(activeHabits.every((h) => !h.isArchived)).toBe(true);
    });

    it("should return habits sorted by order", () => {
      service.createHabit({ name: "Third", areaId: "area-1", order: 2 });
      service.createHabit({ name: "First", areaId: "area-2", order: 0 });
      service.createHabit({ name: "Second", areaId: "area-3", order: 1 });

      const activeHabits = service.getActiveHabits();

      expect(activeHabits[0].name).toBe("first");
      expect(activeHabits[1].name).toBe("second");
      expect(activeHabits[2].name).toBe("third");
    });
  });
});
