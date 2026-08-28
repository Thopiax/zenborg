import { describe, expect, test } from "vitest";
import {
  fuzzyMatch,
  levenshtein,
  searchHabits,
  searchPeople,
  searchPlaces,
} from "./search.js";
import type { Habit, Person, Place } from "./vault.js";

// ── Levenshtein distance ──────────────────────────────────────────────

describe("levenshtein", () => {
  test("identical strings return 0", () => {
    expect(levenshtein("coffee", "coffee")).toBe(0);
  });

  test("single insertion", () => {
    expect(levenshtein("coffe", "coffee")).toBe(1);
  });

  test("single deletion", () => {
    expect(levenshtein("coffees", "coffee")).toBe(1);
  });

  test("single substitution", () => {
    expect(levenshtein("coffea", "coffee")).toBe(1);
  });

  test("two edits", () => {
    expect(levenshtein("cofe", "coffee")).toBe(2);
  });

  test("empty vs non-empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
});

// ── Fuzzy match ───────────────────────────────────────────────────────

describe("fuzzyMatch", () => {
  test("exact match ranks highest", () => {
    const results = fuzzyMatch("Coffee", ["Coffee", "Coffin", "Toffee"]);
    expect(results[0]).toEqual({ value: "Coffee", score: 0, method: "exact" });
  });

  test("case-insensitive exact match", () => {
    const results = fuzzyMatch("coffee", ["Coffee"]);
    expect(results[0]).toEqual({ value: "Coffee", score: 0, method: "exact" });
  });

  test("prefix match", () => {
    const results = fuzzyMatch("cof", ["Coffee", "Running"]);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      value: "Coffee",
      score: 1,
      method: "prefix",
    });
  });

  test("substring match", () => {
    const results = fuzzyMatch("ffee", ["Coffee", "Running"]);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      value: "Coffee",
      score: 2,
      method: "substring",
    });
  });

  test("levenshtein match within distance 2", () => {
    const results = fuzzyMatch("cofe", ["Coffee", "Running"]);
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("Coffee");
    expect(results[0].method).toBe("levenshtein");
    expect(results[0].score).toBe(3);
  });

  test("no match beyond distance 2", () => {
    const results = fuzzyMatch("xyz", ["Coffee", "Running"]);
    expect(results).toHaveLength(0);
  });

  test("results sorted by score", () => {
    const results = fuzzyMatch("coffee", ["Toffee", "Coffee", "Coffeemaker"]);
    expect(results[0].value).toBe("Coffee");
    expect(results[0].method).toBe("exact");
  });
});

// ── Search habits ─────────────────────────────────────────────────────

function makeHabit(
  overrides: Partial<Habit> & { id: string; name: string; areaId: string },
): Habit {
  return {
    attitude: null,
    phase: null,
    tags: [],
    emoji: null,
    isArchived: false,
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const habits: Record<string, Habit> = {
  h1: makeHabit({ id: "h1", name: "Running", areaId: "a1" }),
  h2: makeHabit({
    id: "h2",
    name: "Coffee",
    areaId: "a2",
    aliases: ["espresso", "cafe"],
  }),
  h3: makeHabit({ id: "h3", name: "Reading", areaId: "a1" }),
  h4: makeHabit({
    id: "h4",
    name: "Meditation",
    areaId: "a3",
    isArchived: true,
  }),
};

describe("searchHabits", () => {
  test("exact name match", () => {
    const results = searchHabits("Running", habits);
    expect(results).toHaveLength(1);
    expect(results[0].habit.id).toBe("h1");
    expect(results[0].matchedOn).toBe("name");
  });

  test("alias match", () => {
    const results = searchHabits("espresso", habits);
    expect(results).toHaveLength(1);
    expect(results[0].habit.id).toBe("h2");
    expect(results[0].matchedOn).toBe("alias");
    expect(results[0].matchedValue).toBe("espresso");
  });

  test("fuzzy name match", () => {
    const results = searchHabits("runing", habits);
    expect(results).toHaveLength(1);
    expect(results[0].habit.id).toBe("h1");
  });

  test("excludes archived by default", () => {
    const results = searchHabits("Meditation", habits);
    expect(results).toHaveLength(0);
  });

  test("includes archived when requested", () => {
    const results = searchHabits("Meditation", habits, {
      includeArchived: true,
    });
    expect(results).toHaveLength(1);
  });

  test("filters by areaId", () => {
    const results = searchHabits("r", habits, { areaId: "a1" });
    const ids = results.map((r) => r.habit.id);
    expect(ids).toContain("h1");
    expect(ids).toContain("h3");
    expect(ids).not.toContain("h2");
  });

  test("returns empty for no match", () => {
    const results = searchHabits("xyz123", habits);
    expect(results).toHaveLength(0);
  });
});

// ── Search people ─────────────────────────────────────────────────────

function makePerson(
  overrides: Partial<Person> & { id: string; name: string; key: string },
): Person {
  return {
    cadence: null,
    status: "active",
    category: null,
    basePlace: null,
    emoji: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const people: Record<string, Person> = {
  p1: makePerson({ id: "p1", name: "Ada Bell", key: "ada-bell" }),
  p2: makePerson({ id: "p2", name: "Bea Cole", key: "bea-cole" }),
  p3: makePerson({
    id: "p3",
    name: "Cai Dunn",
    key: "cai-dunn",
    status: "paused",
  }),
};

describe("searchPeople", () => {
  test("exact name match", () => {
    const results = searchPeople("Ada Bell", people);
    expect(results).toHaveLength(1);
    expect(results[0].person.key).toBe("ada-bell");
    expect(results[0].matchedOn).toBe("name");
  });

  test("name prefix beats key", () => {
    const results = searchPeople("Bea", people);
    expect(results).toHaveLength(1);
    expect(results[0].person.key).toBe("bea-cole");
    expect(results[0].matchedOn).toBe("name");
  });

  test("key match when name does not match", () => {
    const withKeyOnly: Record<string, Person> = {
      p1: makePerson({ id: "p1", name: "Someone Else", key: "bea-cole" }),
    };
    const results = searchPeople("bea-cole", withKeyOnly);
    expect(results).toHaveLength(1);
    expect(results[0].matchedOn).toBe("key");
  });

  test("partial name match (first name only)", () => {
    const results = searchPeople("Ada", people);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].person.key).toBe("ada-bell");
  });

  test("fuzzy match on name", () => {
    const results = searchPeople("Bea Col", people);
    expect(results).toHaveLength(1);
    expect(results[0].person.key).toBe("bea-cole");
  });

  test("includes paused people", () => {
    const results = searchPeople("Cai Dunn", people);
    expect(results).toHaveLength(1);
  });

  test("alias exact match", () => {
    const withAlias: Record<string, Person> = {
      p1: makePerson({
        id: "p1",
        name: "Elena Rossi",
        key: "elena-rossi",
        aliases: ["mom", "mama"],
      }),
    };
    const results = searchPeople("mom", withAlias);
    expect(results).toHaveLength(1);
    expect(results[0].matchedOn).toBe("alias");
    expect(results[0].matchedValue).toBe("mom");
  });

  test("alias prefix match", () => {
    const withAlias: Record<string, Person> = {
      p1: makePerson({
        id: "p1",
        name: "Lina Ferri",
        key: "lina-ferri",
        aliases: ["sasa", "sister"],
      }),
    };
    const results = searchPeople("sas", withAlias);
    expect(results).toHaveLength(1);
    expect(results[0].matchedOn).toBe("alias");
    expect(results[0].matchedValue).toBe("sasa");
  });

  test("name match beats alias match", () => {
    const both: Record<string, Person> = {
      p1: makePerson({
        id: "p1",
        name: "Mom",
        key: "mom",
      }),
      p2: makePerson({
        id: "p2",
        name: "Elena Rossi",
        key: "elena-rossi",
        aliases: ["mom"],
      }),
    };
    const results = searchPeople("Mom", both);
    expect(results[0].matchedOn).toBe("name");
    expect(results[0].person.key).toBe("mom");
  });

  test("alias match has penalty over name match", () => {
    const withAlias: Record<string, Person> = {
      p1: makePerson({
        id: "p1",
        name: "Elena Rossi",
        key: "elena-rossi",
        aliases: ["mama"],
      }),
    };
    const results = searchPeople("mama", withAlias);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.5);
  });
});

// ── Search places ─────────────────────────────────────────────────────

function makePlace(
  overrides: Partial<Place> & { id: string; name: string; key: string },
): Place {
  return {
    parentKey: null,
    address: null,
    coordinates: null,
    emoji: null,
    url: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const places: Record<string, Place> = {
  pl1: makePlace({ id: "pl1", name: "Avalon Park", key: "avalon-park" }),
  pl2: makePlace({
    id: "pl2",
    name: "Home Office",
    key: "home-office",
    parentKey: "home",
  }),
  pl3: makePlace({ id: "pl3", name: "Arcadia", key: "arcadia" }),
};

describe("searchPlaces", () => {
  test("exact name match", () => {
    const results = searchPlaces("Avalon Park", places);
    expect(results).toHaveLength(1);
    expect(results[0].place.key).toBe("avalon-park");
    expect(results[0].matchedOn).toBe("name");
  });

  test("name levenshtein beats key (home-office matches Home Office)", () => {
    const results = searchPlaces("home-office", places);
    expect(results).toHaveLength(1);
    expect(results[0].place.key).toBe("home-office");
    expect(results[0].matchedOn).toBe("name");
  });

  test("key match when name does not match", () => {
    const withKeyOnly: Record<string, Place> = {
      pl1: makePlace({ id: "pl1", name: "Escritorio", key: "home-office" }),
    };
    const results = searchPlaces("home-office", withKeyOnly);
    expect(results).toHaveLength(1);
    expect(results[0].matchedOn).toBe("key");
  });

  test("parentKey match", () => {
    const results = searchPlaces("home", places);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const keys = results.map((r) => r.place.key);
    expect(keys).toContain("home-office");
  });

  test("fuzzy match", () => {
    const results = searchPlaces("Arcadi", places);
    expect(results).toHaveLength(1);
    expect(results[0].place.key).toBe("arcadia");
  });

  test("substring match on multi-word name", () => {
    const results = searchPlaces("avalon", places);
    expect(results).toHaveLength(1);
    expect(results[0].place.key).toBe("avalon-park");
  });
});
