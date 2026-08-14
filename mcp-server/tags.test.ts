import { describe, expect, it } from "vitest";
import { buildTagIndex, buildTagProfile } from "./tags.js";
import type { Area, Habit, Moment } from "./vault.js";

const NOW = "2026-08-14T00:00:00.000Z";

function moment(overrides: Partial<Moment>): Moment {
  return {
    id: "m-1",
    name: "Deep work",
    areaId: "area-friends",
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

function area(overrides: Partial<Area>): Area {
  return {
    id: "area-friends",
    name: "Friends",
    color: "#f97316",
    emoji: "🤙",
    isDefault: false,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const gymWithFox = [
  moment({
    id: "m-gym-1",
    name: "Gym",
    habitId: "h-gym",
    areaId: "area-fitness",
    day: "2025-03-10",
    phase: "MORNING",
    tags: ["person-yoel", "place-barcelona"],
  }),
  moment({
    id: "m-gym-2",
    name: "Gym",
    habitId: "h-gym",
    areaId: "area-fitness",
    day: "2025-03-17",
    phase: "MORNING",
    tags: ["person-yoel", "place-barcelona"],
  }),
  moment({
    id: "m-resto",
    name: "Restaurant",
    day: "2025-05-02",
    phase: "EVENING",
    tags: ["person-yanik", "place-barcelona"],
  }),
  moment({
    id: "m-altinha",
    name: "Altinha",
    day: "2026-08-15",
    phase: "AFTERNOON",
    tags: ["person-tiago", "person-greg", "place-la-villette"],
  }),
  moment({ id: "m-untagged", name: "Read", tags: null }),
];

const habits = [habit({ id: "h-gym", name: "Gym", tags: ["place-barcelona"] })];
const areas = [
  area({}),
  area({ id: "area-fitness", name: "Fitness", tags: ["wellness"] }),
];

describe("buildTagIndex", () => {
  it("counts tag usage across moments, habits and areas with a day range", () => {
    const index = buildTagIndex(gymWithFox, habits, areas);
    const barcelona = index.find((e) => e.tag === "place-barcelona");
    expect(barcelona).toEqual({
      tag: "place-barcelona",
      moments: 3,
      habits: 1,
      areas: 0,
      firstDay: "2025-03-10",
      lastDay: "2025-05-02",
    });
    const wellness = index.find((e) => e.tag === "wellness");
    expect(wellness).toMatchObject({ moments: 0, habits: 0, areas: 1 });
  });

  it("filters by prefix — the People index", () => {
    const people = buildTagIndex(gymWithFox, habits, areas, "person-");
    expect(people.map((e) => e.tag).sort()).toEqual([
      "person-greg",
      "person-tiago",
      "person-yanik",
      "person-yoel",
    ]);
  });

  it("sorts by total usage descending", () => {
    const index = buildTagIndex(gymWithFox, habits, areas);
    expect(index[0]!.tag).toBe("place-barcelona");
  });

  it("tolerates null tags and empty collections", () => {
    expect(buildTagIndex([], [], [])).toEqual([]);
    expect(buildTagIndex([moment({ tags: null })], [], [])).toEqual([]);
  });
});

describe("buildTagProfile", () => {
  it("tells the person-yoel story: which habit, which place, when", () => {
    const profile = buildTagProfile("person-yoel", gymWithFox, habits, areas);
    expect(profile.momentCount).toBe(2);
    expect(profile.firstDay).toBe("2025-03-10");
    expect(profile.lastDay).toBe("2025-03-17");
    expect(profile.habits).toEqual([{ name: "Gym", count: 2 }]);
    expect(profile.areas).toEqual([{ name: "Fitness", count: 2 }]);
    expect(profile.coTags).toEqual([{ tag: "place-barcelona", count: 2 }]);
  });

  it("profiles a place across people", () => {
    const profile = buildTagProfile(
      "place-barcelona",
      gymWithFox,
      habits,
      areas,
    );
    expect(profile.momentCount).toBe(3);
    expect(profile.coTags).toEqual([
      { tag: "person-yoel", count: 2 },
      { tag: "person-yanik", count: 1 },
    ]);
  });

  it("lists a habit carrying the tag directly even with zero tagged moments", () => {
    const profile = buildTagProfile(
      "place-barcelona",
      [],
      habits,
      areas,
    );
    expect(profile.habits).toEqual([{ name: "Gym", count: 0 }]);
  });

  it("orders recent moments newest first and flags truncation past the cap", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      moment({
        id: `m-${i}`,
        day: `2026-01-${String(i + 1).padStart(2, "0")}`,
        tags: ["person-yoel"],
      }),
    );
    const profile = buildTagProfile("person-yoel", many, [], areas);
    expect(profile.recentMoments).toHaveLength(10);
    expect(profile.recentMoments[0]!.day).toBe("2026-01-12");
    expect(profile.recentMomentsTruncated).toBe(true);
  });

  it("names an archived habit gracefully", () => {
    const orphan = [
      moment({ id: "m-x", habitId: "h-gone", day: "2025-01-01", tags: ["person-yoel"] }),
    ];
    const profile = buildTagProfile("person-yoel", orphan, [], areas);
    expect(profile.habits).toEqual([{ name: "(archived habit)", count: 1 }]);
  });
});
