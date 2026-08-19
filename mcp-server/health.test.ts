import { describe, expect, it } from "vitest";
import { computeHealth, daysSinceLast } from "./health.js";
import type { Habit, Moment, Rhythm } from "./vault.js";

const NOW = new Date("2026-08-07T12:00:00.000Z");

/** Local-calendar day string — exactly the form `parseVaultDay` reads back. */
function isoDay(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The day `n` local calendar days before `d`. Shifts the calendar date rather
 * than subtracting milliseconds, so a DST boundary cannot slide it by a day.
 */
function dayBefore(d: Date, n: number): string {
  const shifted = new Date(d.getTime());
  shifted.setDate(shifted.getDate() - n);
  return isoDay(shifted);
}

const WEEKLY: Rhythm = { period: "weekly", count: 1 }; // 7-day threshold

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: "h-1",
    name: "test habit",
    areaId: "a-1",
    attitude: "KEEPING",
    phase: null,
    tags: [],
    emoji: null,
    isArchived: false,
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: "m-1",
    name: "dinner",
    areaId: "a-1",
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    // MCP `Phase` is a string-literal union (z.enum), not a TS enum.
    phase: "EVENING",
    day: dayBefore(NOW, 2),
    order: 0,
    tags: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    ...over,
  };
}

describe("computeHealth — moments attached via personIds", () => {
  it("counts a moment that names the habit in personIds toward its health", () => {
    // People ARE habit records. One dinner with three friends is ONE moment
    // carrying three ids — it must reach every one of their health reads, or
    // get_habit_health and list_people_to_reach disagree about the same person.
    const yaya = habit({ id: "p-yaya", name: "Yaya", rhythm: WEEKLY });
    const groupDinner = moment({
      id: "m-group-dinner",
      personIds: ["p-abuelo", "p-yaya", "p-mari"],
    });

    expect(computeHealth(yaya, null, [], NOW)).toBe("wilting");
    expect(computeHealth(yaya, null, [groupDinner], NOW)).toBe("blooming");
  });

  it("counts personIds moments for RETURNING as well as KEEPING", () => {
    const mari = habit({
      id: "p-mari",
      name: "Mari",
      attitude: "RETURNING",
      rhythm: WEEKLY,
    });
    const groupDinner = moment({
      id: "m-group-dinner",
      personIds: ["p-mari"],
    });

    expect(computeHealth(mari, null, [], NOW)).toBe("wilting");
    expect(computeHealth(mari, null, [groupDinner], NOW)).toBe("blooming");
  });

  it("leaves an ordinary habit's health untouched by unrelated personIds", () => {
    // No-regression pin: `personIds` can never hold an ordinary habit's own id,
    // so the widened filter is provably inert for every non-person record.
    const meditation = habit({
      id: "h-meditation",
      name: "meditation",
      rhythm: WEEKLY,
    });
    const ownMoment = moment({ id: "m-own", habitId: "h-meditation" });
    const otherPeople = moment({
      id: "m-other",
      personIds: ["p-yaya", "p-abuelo", "p-mari"],
    });

    expect(computeHealth(meditation, null, [otherPeople], NOW)).toBe("wilting");
    expect(computeHealth(meditation, null, [ownMoment, otherPeople], NOW)).toBe(
      "blooming",
    );
  });

  it("does not throw on a moment carrying no personIds at all", () => {
    // `habitId: null` and no `personIds` — the optional chain is genuinely
    // exercised here, not short-circuited by a habitId match.
    const yaya = habit({ id: "p-yaya", rhythm: WEEKLY });
    const orphan = moment({ id: "m-orphan" });
    expect(orphan.personIds).toBeUndefined();
    expect(orphan.habitId).toBeNull();

    expect(() => computeHealth(yaya, null, [orphan], NOW)).not.toThrow();
    expect(computeHealth(yaya, null, [orphan], NOW)).toBe("wilting");
  });

  it("counts personIds moments toward BEGINNING's 5-moment budding gate", () => {
    const uma = habit({
      id: "p-uma",
      name: "Uma",
      attitude: "BEGINNING",
    });
    const five = [1, 2, 3, 4, 5].map((n) =>
      moment({ id: `m-${n}`, personIds: ["p-uma"] }),
    );

    expect(computeHealth(uma, null, five.slice(0, 4), NOW)).toBe("seedling");
    expect(computeHealth(uma, null, five, NOW)).toBe("budding");
  });
});

describe("daysSinceLast — moments attached via personIds", () => {
  it("sees a moment that names the habit in personIds", () => {
    const groupDinner = moment({
      id: "m-group-dinner",
      personIds: ["p-yaya"],
    });
    // Emitted beside `health` in get_habit_health — it must agree with it.
    expect(daysSinceLast("p-yaya", [groupDinner], NOW)).toBe(2);
  });

  it("is unmoved by personIds that do not name this habit", () => {
    const otherPeople = moment({
      id: "m-other",
      personIds: ["p-abuelo", "p-mari"],
    });
    expect(daysSinceLast("h-meditation", [otherPeople], NOW)).toBeNull();
  });

  it("does not throw on a moment carrying no personIds at all", () => {
    const orphan = moment({ id: "m-orphan" });
    expect(() => daysSinceLast("p-yaya", [orphan], NOW)).not.toThrow();
    expect(daysSinceLast("p-yaya", [orphan], NOW)).toBeNull();
  });
});
