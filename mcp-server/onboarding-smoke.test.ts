/**
 * Smoke test for the onboarding skill flow.
 *
 * Simulates the four phases against an empty vault:
 *   1. Create areas
 *   2. Create habits per area (with attitudes and rhythms)
 *   3. Create people and places
 *   4. Plant moments for 3 days
 *
 * Exercises the same vault functions the MCP tool handlers call,
 * in the order the skill prescribes.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { slugify } from "./validation.js";
import {
  type Area,
  type Habit,
  type Moment,
  type Person,
  type Phase,
  type Place,
  readCollection,
  writeCollection,
} from "./vault.js";

const NOW = "2026-08-28T10:00:00.000Z";
let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "zenborg-onboarding-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function uuid(): string {
  return crypto.randomUUID();
}

describe("onboarding smoke test", () => {
  it("walks all four phases against an empty vault", () => {
    // ── Pre-check: vault is empty ──────────────────────────────────
    const emptyAreas = readCollection(root, "areas");
    expect(Object.keys(emptyAreas)).toHaveLength(0);

    // ── Phase 1: Create areas ──────────────────────────────────────
    const areaSpecs = [
      { name: "Fitness", emoji: "🏃", color: "#4A7C59" },
      { name: "Work", emoji: "💼", color: "#5B6E8A" },
      { name: "Social", emoji: "👥", color: "#7A5BA0" },
    ];

    const areaIds: Record<string, string> = {};
    const areas = readCollection(root, "areas");
    for (const [i, spec] of areaSpecs.entries()) {
      const id = uuid();
      const area: Area = {
        id,
        name: spec.name,
        color: spec.color,
        emoji: spec.emoji,
        isDefault: false,
        order: i,
        attitude: null,
        tags: [],
        createdAt: NOW,
        updatedAt: NOW,
      };
      areas[id] = area;
      areaIds[spec.name] = id;
    }
    writeCollection(root, "areas", areas);

    const savedAreas = readCollection(root, "areas");
    expect(Object.keys(savedAreas)).toHaveLength(3);
    expect(
      Object.values(savedAreas)
        .map((a) => a.name)
        .sort(),
    ).toEqual(["Fitness", "Social", "Work"]);

    // ── Phase 2: Create habits per area ────────────────────────────
    const habitSpecs = [
      {
        name: "Running",
        area: "Fitness",
        attitude: "KEEPING" as const,
        phase: "MORNING" as const,
        rhythm: { period: "weekly" as const, count: 3 },
      },
      {
        name: "Yoga",
        area: "Fitness",
        attitude: "RETURNING" as const,
        phase: "MORNING" as const,
        rhythm: { period: "weekly" as const, count: 1 },
      },
      {
        name: "Deep work",
        area: "Work",
        attitude: "BUILDING" as const,
        phase: "AFTERNOON" as const,
        rhythm: null,
      },
      {
        name: "Team sync",
        area: "Work",
        attitude: "KEEPING" as const,
        phase: "AFTERNOON" as const,
        rhythm: { period: "weekly" as const, count: 2 },
      },
      {
        name: "Dinner plans",
        area: "Social",
        attitude: "BEGINNING" as const,
        phase: "EVENING" as const,
        rhythm: null,
      },
    ];

    const habitIds: Record<string, string> = {};
    const habits = readCollection(root, "habits");
    for (const [i, spec] of habitSpecs.entries()) {
      const id = uuid();
      const habit: Habit = {
        id,
        name: spec.name,
        areaId: areaIds[spec.area],
        order: i,
        attitude: spec.attitude,
        phase: spec.phase,
        rhythm: spec.rhythm,
        schedule: null,
        emoji: null,
        description: null,
        guidance: null,
        tags: [],
        aliases: [],
        placeIds: [],
        isArchived: false,
        createdAt: NOW,
        updatedAt: NOW,
      };
      habits[id] = habit;
      habitIds[spec.name] = id;
    }
    writeCollection(root, "habits", habits);

    const savedHabits = readCollection(root, "habits");
    expect(Object.keys(savedHabits)).toHaveLength(5);

    const running = Object.values(savedHabits).find(
      (h) => h.name === "Running",
    )!;
    expect(running.attitude).toBe("KEEPING");
    expect(running.rhythm).toEqual({ period: "weekly", count: 3 });
    expect(running.areaId).toBe(areaIds.Fitness);

    const yoga = Object.values(savedHabits).find((h) => h.name === "Yoga")!;
    expect(yoga.attitude).toBe("RETURNING");

    // ── Phase 3: Create people and places ──────────────────────────
    const personSpecs = [
      { name: "Ada", tags: ["friend"], cadence: "monthly" as const },
      { name: "Marco", tags: ["family"], cadence: "weekly" as const },
    ];

    const people = readCollection(root, "people");
    const personKeys: Record<string, string> = {};
    for (const spec of personSpecs) {
      const key = slugify(spec.name);
      const person: Person = {
        key,
        name: spec.name,
        emoji: null,
        tags: spec.tags,
        cadence: spec.cadence,
        basePlace: null,
        status: "active",
        notes: null,
      };
      people[key] = person;
      personKeys[spec.name] = key;
    }
    writeCollection(root, "people", people);

    const savedPeople = readCollection(root, "people");
    expect(Object.keys(savedPeople)).toHaveLength(2);
    expect(savedPeople[personKeys.Ada].cadence).toBe("monthly");

    const placeSpecs = [
      { name: "The gym", parentKey: null },
      { name: "Central Park", parentKey: null },
    ];

    const places = readCollection(root, "places");
    const placeKeys: Record<string, string> = {};
    for (const spec of placeSpecs) {
      const key = slugify(spec.name);
      const place: Place = {
        key,
        name: spec.name,
        emoji: null,
        parentKey: spec.parentKey,
        url: null,
        address: null,
        coordinates: null,
      };
      places[key] = place;
      placeKeys[spec.name] = key;
    }
    writeCollection(root, "places", places);

    const savedPlaces = readCollection(root, "places");
    expect(Object.keys(savedPlaces)).toHaveLength(2);

    // ── Phase 4: Plant moments for 3 days ──────────────────────────
    const days = ["2026-08-29", "2026-08-30", "2026-08-31"];
    const momentSpecs = [
      // Day 1
      {
        name: "Running",
        habitName: "Running",
        day: days[0],
        phase: "MORNING" as Phase,
      },
      {
        name: "Deep work",
        habitName: "Deep work",
        day: days[0],
        phase: "AFTERNOON" as Phase,
      },
      // Day 2
      {
        name: "Yoga",
        habitName: "Yoga",
        day: days[1],
        phase: "MORNING" as Phase,
      },
      {
        name: "Team sync",
        habitName: "Team sync",
        day: days[1],
        phase: "AFTERNOON" as Phase,
      },
      {
        name: "Dinner with Ada",
        habitName: null,
        day: days[1],
        phase: "EVENING" as Phase,
        personIds: [personKeys.Ada],
        placeIds: [],
      },
      // Day 3
      {
        name: "Running",
        habitName: "Running",
        day: days[2],
        phase: "MORNING" as Phase,
      },
    ];

    const moments = readCollection(root, "moments");
    for (const [i, spec] of momentSpecs.entries()) {
      const id = uuid();
      const habitId = spec.habitName ? habitIds[spec.habitName] : null;
      const habit = habitId ? savedHabits[habitId] : null;

      const moment: Moment = {
        id,
        name: spec.name,
        areaId: habit?.areaId ?? areaIds.Social,
        habitId,
        cycleId: null,
        cyclePlanId: null,
        phase: spec.phase,
        day: spec.day,
        order: i,
        emoji: habit?.emoji ?? null,
        tags: [],
        personIds: "personIds" in spec ? (spec.personIds ?? []) : [],
        placeIds: "placeIds" in spec ? (spec.placeIds ?? []) : [],
        createdAt: NOW,
        updatedAt: NOW,
      };
      moments[id] = moment;
    }
    writeCollection(root, "moments", moments);

    const savedMoments = readCollection(root, "moments");
    expect(Object.keys(savedMoments)).toHaveLength(6);

    // Verify day distribution
    const byDay = (day: string) =>
      Object.values(savedMoments).filter((m) => m.day === day);
    expect(byDay("2026-08-29")).toHaveLength(2);
    expect(byDay("2026-08-30")).toHaveLength(3);
    expect(byDay("2026-08-31")).toHaveLength(1);

    // Verify habit-linked moments inherit the right area
    const runMoment = Object.values(savedMoments).find(
      (m) => m.name === "Running" && m.day === "2026-08-29",
    )!;
    expect(runMoment.areaId).toBe(areaIds.Fitness);
    expect(runMoment.habitId).toBe(habitIds.Running);

    // Verify standalone moment with person
    const dinnerMoment = Object.values(savedMoments).find(
      (m) => m.name === "Dinner with Ada",
    )!;
    expect(dinnerMoment.habitId).toBeNull();
    expect(dinnerMoment.areaId).toBe(areaIds.Social);
    expect(dinnerMoment.personIds).toEqual([personKeys.Ada]);

    // ── Summary: verify final vault state ──────────────────────────
    expect(Object.keys(readCollection(root, "areas"))).toHaveLength(3);
    expect(Object.keys(readCollection(root, "habits"))).toHaveLength(5);
    expect(Object.keys(readCollection(root, "people"))).toHaveLength(2);
    expect(Object.keys(readCollection(root, "places"))).toHaveLength(2);
    expect(Object.keys(readCollection(root, "moments"))).toHaveLength(6);
  });

  it("handles an already-populated vault gracefully", () => {
    // Seed one area
    const existingId = uuid();
    const areas: Record<string, Area> = {
      [existingId]: {
        id: existingId,
        name: "Health",
        color: "#336633",
        emoji: "💚",
        isDefault: false,
        order: 0,
        attitude: null,
        tags: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    };
    writeCollection(root, "areas", areas);

    // Onboarding should detect this — skill says "acknowledge what is already planted"
    const existing = readCollection(root, "areas");
    expect(Object.keys(existing)).toHaveLength(1);
    expect(Object.values(existing)[0].name).toBe("Health");

    // Adding a new area alongside the existing one
    const newId = uuid();
    existing[newId] = {
      id: newId,
      name: "Creative",
      color: "#C47A5A",
      emoji: "🎨",
      isDefault: false,
      order: 1,
      attitude: null,
      tags: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    writeCollection(root, "areas", existing);

    const final = readCollection(root, "areas");
    expect(Object.keys(final)).toHaveLength(2);
    expect(
      Object.values(final)
        .map((a) => a.name)
        .sort(),
    ).toEqual(["Creative", "Health"]);
  });
});
