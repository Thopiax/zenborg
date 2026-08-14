import { describe, expect, it } from "vitest";
import { buildRelatedHabits } from "./graph.js";
import type { Area, Habit, Moment } from "./vault.js";

const NOW = "2026-08-14T00:00:00.000Z";

function habit(overrides: Partial<Habit>): Habit {
  return {
    id: "h-1",
    name: "Gym",
    areaId: "area-fitness",
    attitude: null,
    phase: null,
    tags: [],
    emoji: null,
    isArchived: false,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function moment(overrides: Partial<Moment>): Moment {
  return {
    id: "m-1",
    name: "Gym",
    areaId: "area-fitness",
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: null,
    day: null,
    order: 0,
    emoji: null,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function area(overrides: Partial<Area>): Area {
  return {
    id: "area-fitness",
    name: "Fitness",
    color: "#10b981",
    emoji: "💪",
    isDefault: false,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const habits = [
  habit({ id: "h-gym", name: "Gym" }),
  habit({ id: "h-swim", name: "Swim" }),
  habit({ id: "h-padel", name: "Padel", areaId: "area-friends" }),
  habit({ id: "h-sauna", name: "Sauna" }),
  habit({ id: "h-old", name: "Boxing", isArchived: true }),
];
const areas = [area({}), area({ id: "area-friends", name: "Friends" })];

const moments = [
  // Gym with Fox in Barcelona, twice; sauna the same days.
  moment({ id: "m1", habitId: "h-gym", day: "2025-03-10", tags: ["person-yoel", "place-barcelona"] }),
  moment({ id: "m2", habitId: "h-gym", day: "2025-03-17", tags: ["person-yoel", "place-barcelona"] }),
  moment({ id: "m3", habitId: "h-sauna", day: "2025-03-10" }),
  moment({ id: "m4", habitId: "h-sauna", day: "2025-03-17" }),
  // Padel also with Fox, different day.
  moment({ id: "m5", habitId: "h-padel", day: "2025-04-01", tags: ["person-yoel"] }),
  // Swim alone in Paris.
  moment({ id: "m6", habitId: "h-swim", day: "2026-07-30", tags: ["place-paris"] }),
];

describe("buildRelatedHabits", () => {
  it("returns null for an unknown habit", () => {
    expect(buildRelatedHabits("nope", habits, moments, areas)).toBeNull();
  });

  it("finds people-mediated edges through moment tags", () => {
    const related = buildRelatedHabits("h-gym", habits, moments, areas)!;
    expect(related.habit).toBe("Gym (Fitness)");
    expect(related.sharedTags).toEqual([
      { habit: "Padel", tags: ["person-yoel"] },
    ]);
  });

  it("counts same-day co-occurrence with share of my active days", () => {
    const related = buildRelatedHabits("h-gym", habits, moments, areas)!;
    expect(related.coOccurrence).toEqual([
      { habit: "Sauna", days: 2, shareOfMine: 1 },
    ]);
    expect(related.coOccurrenceTruncated).toBe(false);
  });

  it("lists active area siblings only", () => {
    const related = buildRelatedHabits("h-gym", habits, moments, areas)!;
    expect(related.areaSiblings).toEqual(["Sauna", "Swim"]);
  });

  it("includes habit-level tags in the signature", () => {
    const tagged = [
      habit({ id: "h-a", name: "Surf", tags: ["place-itacare"] }),
      habit({ id: "h-b", name: "Capoeira", tags: ["place-itacare"] }),
    ];
    const related = buildRelatedHabits("h-a", tagged, [], [])!;
    expect(related.sharedTags).toEqual([
      { habit: "Capoeira", tags: ["place-itacare"] },
    ]);
  });

  it("handles a habit with no allocated moments", () => {
    const related = buildRelatedHabits("h-old", habits, moments, areas)!;
    expect(related.coOccurrence).toEqual([]);
    expect(related.sharedTags).toEqual([]);
  });
});
