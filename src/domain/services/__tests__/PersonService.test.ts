import { describe, expect, it } from "vitest";
import type { Moment } from "@/domain/entities/Moment";
import {
  daysSinceLastContact,
  hasArrangedContact,
  latestContactDate,
  personHealth,
  personMoments,
} from "@/domain/services/PersonService";
import { Phase } from "@/domain/value-objects/Phase";

const NOW = new Date("2026-08-18T12:00:00.000Z");

/** Local-calendar day string — exactly the form `fromISODate` reads back. */
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

/**
 * Local midnight of NOW's own day. Passed as `now` where a test needs
 * `daysSince` to land on the threshold EXACTLY — from a mid-day `now` the
 * elapsed fraction is never zero, so `<=` and `<` stay indistinguishable.
 */
const MIDNIGHT = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

/** Today, derived from the frozen NOW — never from the wall clock. */
const TODAY = isoDay(NOW);

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: "m1",
    name: "dinner",
    areaId: "a-friends",
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: Phase.EVENING,
    day: "2026-08-01",
    order: 0,
    tags: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

describe("personMoments", () => {
  it("matches a moment that carries the person in personIds", () => {
    const m = moment({ personIds: ["ada", "bea"] });
    expect(personMoments("ada", [m])).toEqual([m]);
  });

  it("matches a legacy moment that references the person via habitId", () => {
    const m = moment({ habitId: "ada" });
    expect(personMoments("ada", [m])).toEqual([m]);
  });

  it("does not match a moment about someone else", () => {
    const m = moment({ personIds: ["bea"] });
    expect(personMoments("ada", [m])).toEqual([]);
  });

  // The vault is mostly moments that predate `personIds` and were never about
  // a person at all: habitId null, personIds absent. The optional chain is the
  // only thing standing between that shape and a TypeError, and nothing above
  // reaches it — `habitId === personKey` short-circuits, or personIds is there.
  it("does not match — and does not throw — when a moment has neither habitId nor personIds", () => {
    const m = moment({ habitId: null });
    expect(() => personMoments("ada", [m])).not.toThrow();
    expect(personMoments("ada", [m])).toEqual([]);
  });

  it("matches on personIds alone, with habitId null", () => {
    const m = moment({ habitId: null, personIds: ["ada"] });
    expect(personMoments("ada", [m])).toEqual([m]);
  });

  it("walks a vault where most moments carry no personIds at all", () => {
    const ms = [
      moment({ id: "m1", habitId: null }),
      moment({ id: "m2", habitId: "h-yoga" }),
      moment({ id: "m3", habitId: null, personIds: ["ada"] }),
      moment({ id: "m4", habitId: null }),
    ];
    expect(personMoments("ada", ms)).toEqual([ms[2]]);
  });

  it("derives contact from a personIds-only moment without touching habitId", () => {
    const ms = [
      moment({ id: "m1", habitId: null }),
      moment({ id: "m2", habitId: null, day: TODAY, personIds: ["ada"] }),
    ];
    expect(daysSinceLastContact("ada", ms, NOW)).toBe(0);
  });
});

describe("latestContactDate", () => {
  it("returns the most recent past day", () => {
    const ms = [
      moment({ id: "m1", day: "2026-07-01", personIds: ["ada"] }),
      moment({ id: "m2", day: "2026-08-01", personIds: ["ada"] }),
    ];
    expect(latestContactDate("ada", ms, NOW)).toEqual(
      new Date("2026-08-01T00:00:00"),
    );
  });

  it("ignores future days — an arranged dinner is not contact yet", () => {
    const ms = [moment({ day: "2026-09-01", personIds: ["ada"] })];
    expect(latestContactDate("ada", ms, NOW)).toBeNull();
  });

  it("ignores unallocated moments with no day", () => {
    const ms = [moment({ day: null, personIds: ["ada"] })];
    expect(latestContactDate("ada", ms, NOW)).toBeNull();
  });

  // A day parses to LOCAL MIDNIGHT, so a moment dated today is already behind
  // `now` and counts as contact. `d > now` is the most semantically loaded
  // line in the module; today is the case that sits right on it.
  it("counts a moment dated today — local midnight is already behind us", () => {
    const ms = [moment({ day: TODAY, personIds: ["ada"] })];
    expect(latestContactDate("ada", ms, NOW)).toEqual(MIDNIGHT);
  });

  it("prefers today over an earlier day", () => {
    const ms = [
      moment({ id: "m1", day: dayBefore(NOW, 3), personIds: ["ada"] }),
      moment({ id: "m2", day: TODAY, personIds: ["ada"] }),
    ];
    expect(latestContactDate("ada", ms, NOW)).toEqual(MIDNIGHT);
  });
});

describe("hasArrangedContact", () => {
  it("is true when a moment is dated in the future", () => {
    const ms = [moment({ day: "2026-09-01", personIds: ["ada"] })];
    expect(hasArrangedContact("ada", ms, NOW)).toBe(true);
  });

  it("is false when every moment is in the past", () => {
    const ms = [moment({ day: "2026-08-01", personIds: ["ada"] })];
    expect(hasArrangedContact("ada", ms, NOW)).toBe(false);
  });

  // Today is contact, not an arrangement — seeing someone this evening is not
  // a reason for the outreach queue to call you sorted.
  it("is false for a moment dated today", () => {
    const ms = [moment({ day: TODAY, personIds: ["ada"] })];
    expect(hasArrangedContact("ada", ms, NOW)).toBe(false);
  });

  it("is true when tomorrow is booked even though today already happened", () => {
    const ms = [
      moment({ id: "m1", day: TODAY, personIds: ["ada"] }),
      moment({ id: "m2", day: dayBefore(NOW, -1), personIds: ["ada"] }),
    ];
    expect(hasArrangedContact("ada", ms, NOW)).toBe(true);
  });
});

describe("daysSinceLastContact", () => {
  it("counts whole days back to the last past moment", () => {
    const ms = [moment({ day: dayBefore(NOW, 6), personIds: ["ada"] })];
    expect(daysSinceLastContact("ada", ms, NOW)).toBe(6);
  });

  it("is null when there has never been contact", () => {
    expect(daysSinceLastContact("ada", [], NOW)).toBeNull();
  });

  it("is zero for a moment dated today", () => {
    const ms = [moment({ day: TODAY, personIds: ["ada"] })];
    expect(daysSinceLastContact("ada", ms, NOW)).toBe(0);
  });

  it("floors — the count ticks over at local midnight, not at the hour of contact", () => {
    const ms = [moment({ day: dayBefore(NOW, 1), personIds: ["ada"] })];
    expect(daysSinceLastContact("ada", ms, NOW)).toBe(1);
  });
});

/**
 * `personHealth` no longer reads a Habit at all: cadence is a declared fact
 * that lives in wake's registry and arrives as a parameter (spec D9, C4).
 * Attitude cannot leak in here any more — it is not even an input.
 */
describe("personHealth", () => {
  it("is unstated without a cadence — a roster is not a commitment", () => {
    expect(personHealth("ada", null, "active", [], NOW)).toBe("unstated");
  });

  // Spec verification 7: "I stepped back deliberately" is not "I let this
  // slide". A paused person never wilts, however long the silence.
  it("is unstated when paused, regardless of cadence and silence", () => {
    const silent = [moment({ day: dayBefore(NOW, 400), personIds: ["ada"] })];
    expect(personHealth("ada", "weekly", "paused", silent, NOW)).toBe(
      "unstated",
    );
    expect(personHealth("ada", "weekly", "paused", [], NOW)).toBe("unstated");
  });

  it("is wilting when there is a cadence but no contact at all", () => {
    expect(personHealth("ada", "weekly", "active", [], NOW)).toBe("wilting");
  });

  it("is blooming inside the cadence bucket", () => {
    const ms = [moment({ day: dayBefore(NOW, 2), personIds: ["ada"] })];
    expect(personHealth("ada", "weekly", "active", ms, NOW)).toBe("blooming");
  });

  it("is wilting past the cadence bucket", () => {
    const ms = [moment({ day: dayBefore(NOW, 40), personIds: ["ada"] })];
    expect(personHealth("ada", "weekly", "active", ms, NOW)).toBe("wilting");
  });

  it("counts a moment shared with several people for each of them", () => {
    const ms = [
      moment({ day: dayBefore(NOW, 2), personIds: ["ada", "bea", "cai"] }),
    ];
    expect(personHealth("ada", "weekly", "active", ms, NOW)).toBe("blooming");
    expect(personHealth("bea", "weekly", "active", ms, NOW)).toBe("blooming");
  });
});

/**
 * The threshold is `cadenceDays(cadence)` compared with `<=`. Every part of
 * that must be pinned: swap the bucket, shift by a day, or flip the
 * comparison, and one of these has to go red.
 */
describe("personHealth — silence threshold arithmetic", () => {
  it("blooms when silence equals the threshold exactly (<=, not <)", () => {
    // MIDNIGHT as `now` is the only way to make daysSince land on exactly 7.0 —
    // from a mid-day `now` the fraction is never zero and `<` would still pass.
    const ms = [moment({ day: dayBefore(MIDNIGHT, 7), personIds: ["ada"] })];
    expect(personHealth("ada", "weekly", "active", ms, MIDNIGHT)).toBe(
      "blooming",
    );
  });

  it("wilts one day past the threshold", () => {
    const ms = [moment({ day: dayBefore(MIDNIGHT, 8), personIds: ["ada"] })];
    expect(personHealth("ada", "weekly", "active", ms, MIDNIGHT)).toBe(
      "wilting",
    );
  });

  it("blooms just inside the threshold and wilts just outside it", () => {
    const inside = [moment({ day: dayBefore(NOW, 6), personIds: ["ada"] })];
    const outside = [moment({ day: dayBefore(NOW, 7), personIds: ["ada"] })];
    expect(personHealth("ada", "weekly", "active", inside, NOW)).toBe(
      "blooming",
    );
    expect(personHealth("ada", "weekly", "active", outside, NOW)).toBe(
      "wilting",
    );
  });

  it("stretches the threshold for a longer bucket — monthly tolerates 20 days", () => {
    const ms = [moment({ day: dayBefore(NOW, 20), personIds: ["ada"] })];
    expect(personHealth("ada", "monthly", "active", ms, NOW)).toBe("blooming");
    expect(personHealth("ada", "weekly", "active", ms, NOW)).toBe("wilting");
  });

  it("tolerates a quarter of silence quarterly, and a year yearly", () => {
    const ninety = [moment({ day: dayBefore(NOW, 90), personIds: ["ada"] })];
    expect(personHealth("ada", "quarterly", "active", ninety, NOW)).toBe(
      "blooming",
    );
    expect(personHealth("ada", "monthly", "active", ninety, NOW)).toBe(
      "wilting",
    );
    const threeHundred = [
      moment({ day: dayBefore(NOW, 300), personIds: ["ada"] }),
    ];
    expect(personHealth("ada", "yearly", "active", threeHundred, NOW)).toBe(
      "blooming",
    );
    expect(personHealth("ada", "quarterly", "active", threeHundred, NOW)).toBe(
      "wilting",
    );
  });
});
