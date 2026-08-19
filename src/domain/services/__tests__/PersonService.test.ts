import { describe, expect, it } from "vitest";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import {
  daysSinceLastContact,
  hasArrangedContact,
  latestContactDate,
  personHealth,
  personMoments,
} from "@/domain/services/PersonService";
import { Attitude } from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import type { Rhythm } from "@/domain/value-objects/Rhythm";

const NOW = new Date("2026-08-07T12:00:00.000Z");

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

const WEEKLY: Rhythm = { period: "weekly", count: 1 };
const TWICE_WEEKLY: Rhythm = { period: "weekly", count: 2 };

function person(over: Partial<Habit> = {}): Habit {
  return {
    id: "p-uma",
    name: "Uma",
    areaId: "a-friends",
    attitude: null,
    phase: null,
    tags: ["bcn"],
    emoji: null,
    isArchived: false,
    order: 0,
    kind: "person",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

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
    const m = moment({ personIds: ["p-uma", "p-cleo"] });
    expect(personMoments("p-uma", [m])).toEqual([m]);
  });

  it("matches a legacy moment that references the person via habitId", () => {
    const m = moment({ habitId: "p-uma" });
    expect(personMoments("p-uma", [m])).toEqual([m]);
  });

  it("does not match a moment about someone else", () => {
    const m = moment({ personIds: ["p-cleo"] });
    expect(personMoments("p-uma", [m])).toEqual([]);
  });

  // The vault is mostly moments that predate `personIds` and were never about
  // a person at all: habitId null, personIds absent. The optional chain is the
  // only thing standing between that shape and a TypeError, and nothing above
  // reaches it — `habitId === personId` short-circuits, or personIds is there.
  it("does not match — and does not throw — when a moment has neither habitId nor personIds", () => {
    const m = moment({ habitId: null });
    expect(() => personMoments("p-uma", [m])).not.toThrow();
    expect(personMoments("p-uma", [m])).toEqual([]);
  });

  it("matches on personIds alone, with habitId null", () => {
    const m = moment({ habitId: null, personIds: ["p-uma"] });
    expect(personMoments("p-uma", [m])).toEqual([m]);
  });

  it("walks a vault where most moments carry no personIds at all", () => {
    const ms = [
      moment({ id: "m1", habitId: null }),
      moment({ id: "m2", habitId: "h-yoga" }),
      moment({ id: "m3", habitId: null, personIds: ["p-uma"] }),
      moment({ id: "m4", habitId: null }),
    ];
    expect(personMoments("p-uma", ms)).toEqual([ms[2]]);
  });

  it("derives contact from a personIds-only moment without touching habitId", () => {
    const ms = [
      moment({ id: "m1", habitId: null }),
      moment({ id: "m2", habitId: null, day: TODAY, personIds: ["p-uma"] }),
    ];
    expect(daysSinceLastContact("p-uma", ms, NOW)).toBe(0);
  });
});

describe("latestContactDate", () => {
  it("returns the most recent past day", () => {
    const ms = [
      moment({ id: "m1", day: "2026-07-01", personIds: ["p-uma"] }),
      moment({ id: "m2", day: "2026-08-01", personIds: ["p-uma"] }),
    ];
    expect(latestContactDate("p-uma", ms, NOW)).toEqual(
      new Date("2026-08-01T00:00:00"),
    );
  });

  it("ignores future days — an arranged dinner is not contact yet", () => {
    const ms = [moment({ day: "2026-09-01", personIds: ["p-uma"] })];
    expect(latestContactDate("p-uma", ms, NOW)).toBeNull();
  });

  it("ignores unallocated moments with no day", () => {
    const ms = [moment({ day: null, personIds: ["p-uma"] })];
    expect(latestContactDate("p-uma", ms, NOW)).toBeNull();
  });

  // A day parses to LOCAL MIDNIGHT, so a moment dated today is already behind
  // `now` and counts as contact. `d > now` is the most semantically loaded
  // line in the module; today is the case that sits right on it.
  it("counts a moment dated today — local midnight is already behind us", () => {
    const ms = [moment({ day: TODAY, personIds: ["p-uma"] })];
    expect(latestContactDate("p-uma", ms, NOW)).toEqual(MIDNIGHT);
  });

  it("prefers today over an earlier day", () => {
    const ms = [
      moment({ id: "m1", day: dayBefore(NOW, 3), personIds: ["p-uma"] }),
      moment({ id: "m2", day: TODAY, personIds: ["p-uma"] }),
    ];
    expect(latestContactDate("p-uma", ms, NOW)).toEqual(MIDNIGHT);
  });
});

describe("hasArrangedContact", () => {
  it("is true when a moment is dated in the future", () => {
    const ms = [moment({ day: "2026-09-01", personIds: ["p-uma"] })];
    expect(hasArrangedContact("p-uma", ms, NOW)).toBe(true);
  });

  it("is false when every moment is in the past", () => {
    const ms = [moment({ day: "2026-08-01", personIds: ["p-uma"] })];
    expect(hasArrangedContact("p-uma", ms, NOW)).toBe(false);
  });

  // Today is contact, not an arrangement — seeing someone this evening is not
  // a reason for the outreach queue to call you sorted.
  it("is false for a moment dated today", () => {
    const ms = [moment({ day: TODAY, personIds: ["p-uma"] })];
    expect(hasArrangedContact("p-uma", ms, NOW)).toBe(false);
  });

  it("is true when tomorrow is booked even though today already happened", () => {
    const ms = [
      moment({ id: "m1", day: TODAY, personIds: ["p-uma"] }),
      moment({ id: "m2", day: dayBefore(NOW, -1), personIds: ["p-uma"] }),
    ];
    expect(hasArrangedContact("p-uma", ms, NOW)).toBe(true);
  });
});

describe("daysSinceLastContact", () => {
  it("counts whole days back to the last past moment", () => {
    const ms = [moment({ day: "2026-08-01", personIds: ["p-uma"] })];
    expect(daysSinceLastContact("p-uma", ms, NOW)).toBe(6);
  });

  it("is null when there has never been contact", () => {
    expect(daysSinceLastContact("p-uma", [], NOW)).toBeNull();
  });

  it("is zero for a moment dated today", () => {
    const ms = [moment({ day: TODAY, personIds: ["p-uma"] })];
    expect(daysSinceLastContact("p-uma", ms, NOW)).toBe(0);
  });

  it("floors — the count ticks over at local midnight, not at the hour of contact", () => {
    const ms = [moment({ day: dayBefore(NOW, 1), personIds: ["p-uma"] })];
    expect(daysSinceLastContact("p-uma", ms, NOW)).toBe(1);
  });
});

describe("personHealth", () => {
  it("is unstated without a rhythm — a roster is not a commitment", () => {
    expect(personHealth(person(), [], NOW)).toBe("unstated");
  });

  it("is wilting when there is a rhythm but no contact at all", () => {
    const p = person({ rhythm: { period: "weekly", count: 1 } });
    expect(personHealth(p, [], NOW)).toBe("wilting");
  });

  it("is blooming inside the silence threshold", () => {
    const p = person({ rhythm: { period: "weekly", count: 1 } });
    const ms = [moment({ day: "2026-08-05", personIds: ["p-uma"] })];
    expect(personHealth(p, ms, NOW)).toBe("blooming");
  });

  it("is wilting past the silence threshold", () => {
    const p = person({ rhythm: { period: "weekly", count: 1 } });
    const ms = [moment({ day: "2026-06-01", personIds: ["p-uma"] })];
    expect(personHealth(p, ms, NOW)).toBe("wilting");
  });

  it("never consults attitude — a null-attitude person still wilts", () => {
    const p = person({
      attitude: null,
      rhythm: { period: "weekly", count: 1 },
    });
    const ms = [moment({ day: "2026-06-01", personIds: ["p-uma"] })];
    expect(personHealth(p, ms, NOW)).toBe("wilting");
  });

  it("counts a moment shared with several people for each of them", () => {
    const p = person({ rhythm: { period: "weekly", count: 1 } });
    const ms = [
      moment({ day: "2026-08-05", personIds: ["p-uma", "p-cleo", "p-manu"] }),
    ];
    expect(personHealth(p, ms, NOW)).toBe("blooming");
    expect(
      personHealth(
        person({ id: "p-cleo", rhythm: { period: "weekly", count: 1 } }),
        ms,
        NOW,
      ),
    ).toBe("blooming");
  });
});

/**
 * The reason this module exists. `HabitHealthService.computeHealth` reads
 * attitude BEFORE rhythm — null short-circuits to "unstated", BEING to
 * "evergreen", BUILDING into a budding/pace branch. If any of that leaked in
 * here, most of the real roster would be judged on a field people do not set.
 * These cases must therefore vary attitude and see the health NOT move.
 */
describe("personHealth — attitude is never consulted", () => {
  const seen = [moment({ day: dayBefore(NOW, 2), personIds: ["p-uma"] })];
  const silent = [moment({ day: dayBefore(NOW, 40), personIds: ["p-uma"] })];

  it("judges a BUILDING person on rhythm and silence, where computeHealth would branch", () => {
    const p = person({ attitude: Attitude.BUILDING, rhythm: WEEKLY });
    expect(personHealth(p, seen, NOW)).toBe("blooming");
    expect(personHealth(p, silent, NOW)).toBe("wilting");
  });

  it("judges a KEEPING person exactly as it judges a BUILDING one", () => {
    const keeping = person({ attitude: Attitude.KEEPING, rhythm: WEEKLY });
    const building = person({ attitude: Attitude.BUILDING, rhythm: WEEKLY });
    expect(personHealth(keeping, seen, NOW)).toBe(
      personHealth(building, seen, NOW),
    );
    expect(personHealth(keeping, silent, NOW)).toBe(
      personHealth(building, silent, NOW),
    );
  });

  it("returns the same health for every attitude, including BEING and null", () => {
    const attitudes: (Attitude | null)[] = [
      null,
      Attitude.BEGINNING,
      Attitude.RETURNING,
      Attitude.KEEPING,
      Attitude.BUILDING,
      Attitude.PUSHING,
      Attitude.BEING,
    ];
    for (const attitude of attitudes) {
      const p = person({ attitude, rhythm: WEEKLY });
      expect(personHealth(p, seen, NOW)).toBe("blooming");
      expect(personHealth(p, silent, NOW)).toBe("wilting");
    }
  });

  it("is unstated for a BEING person with no rhythm — not evergreen", () => {
    const p = person({ attitude: Attitude.BEING });
    expect(personHealth(p, seen, NOW)).toBe("unstated");
  });
});

/**
 * The threshold is `PERIOD_DAYS[period] / count` compared with `<=`. Every
 * part of that must be pinned: drop `count`, shift by a day, or flip the
 * comparison, and one of these has to go red.
 */
describe("personHealth — silence threshold arithmetic", () => {
  it("blooms when silence equals the threshold exactly (<=, not <)", () => {
    // MIDNIGHT as `now` is the only way to make daysSince land on exactly 7.0 —
    // from a mid-day `now` the fraction is never zero and `<` would still pass.
    const ms = [moment({ day: dayBefore(MIDNIGHT, 7), personIds: ["p-uma"] })];
    expect(personHealth(person({ rhythm: WEEKLY }), ms, MIDNIGHT)).toBe(
      "blooming",
    );
  });

  it("wilts one day past the threshold", () => {
    const ms = [moment({ day: dayBefore(MIDNIGHT, 8), personIds: ["p-uma"] })];
    expect(personHealth(person({ rhythm: WEEKLY }), ms, MIDNIGHT)).toBe(
      "wilting",
    );
  });

  it("blooms just inside the threshold and wilts just outside it", () => {
    const inside = [moment({ day: dayBefore(NOW, 6), personIds: ["p-uma"] })];
    const outside = [moment({ day: dayBefore(NOW, 7), personIds: ["p-uma"] })];
    expect(personHealth(person({ rhythm: WEEKLY }), inside, NOW)).toBe(
      "blooming",
    );
    expect(personHealth(person({ rhythm: WEEKLY }), outside, NOW)).toBe(
      "wilting",
    );
  });

  it("honours rhythm.count — twice weekly halves the threshold to 3.5 days", () => {
    // Same person, same moment, same period. Only `count` differs, and it flips
    // the verdict: 5 days of silence is fine weekly, not fine twice weekly.
    const ms = [moment({ day: dayBefore(NOW, 5), personIds: ["p-uma"] })];
    expect(personHealth(person({ rhythm: WEEKLY }), ms, NOW)).toBe("blooming");
    expect(personHealth(person({ rhythm: TWICE_WEEKLY }), ms, NOW)).toBe(
      "wilting",
    );
  });

  it("blooms inside a twice-weekly threshold", () => {
    const ms = [moment({ day: dayBefore(NOW, 2), personIds: ["p-uma"] })];
    expect(personHealth(person({ rhythm: TWICE_WEEKLY }), ms, NOW)).toBe(
      "blooming",
    );
  });

  it("stretches the threshold for a longer period — monthly tolerates 20 days", () => {
    const ms = [moment({ day: dayBefore(NOW, 20), personIds: ["p-uma"] })];
    expect(
      personHealth(
        person({ rhythm: { period: "monthly", count: 1 } }),
        ms,
        NOW,
      ),
    ).toBe("blooming");
    expect(personHealth(person({ rhythm: WEEKLY }), ms, NOW)).toBe("wilting");
  });
});
