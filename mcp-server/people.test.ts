import { describe, expect, it } from "vitest";
import {
  daysSinceLastContact,
  hasArrangedContact,
  latestContactDate,
  overdueRank,
  personHealth,
  personMoments,
  type RegistryPerson,
  selectPeopleToReach,
} from "./people.js";
import type { Moment } from "./vault.js";

const NOW = new Date("2026-08-18T12:00:00.000Z");

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
    // MCP `Phase` is a string-literal union (z.enum), not a TS enum — the bare
    // string is the correct spelling on this side of the mirror.
    phase: "EVENING",
    day: "2026-08-01",
    order: 0,
    tags: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

/** A registry person, as wake's key-resolve tool will hand them over. */
function registryPerson(over: Partial<RegistryPerson> = {}): RegistryPerson {
  return {
    key: "ada",
    cadence: "weekly",
    status: "active",
    category: "friend",
    favorite: false,
    basePlace: null,
    ...over,
  };
}

describe("personMoments", () => {
  it("matches via personIds and via legacy habitId", () => {
    const a = moment({ id: "a", personIds: ["ada"] });
    const b = moment({ id: "b", habitId: "ada" });
    const c = moment({ id: "c", personIds: ["bea"] });
    expect(personMoments("ada", [a, b, c]).map((m) => m.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("matches a moment carrying the person among several personIds", () => {
    const m = moment({ personIds: ["ada", "bea"] });
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

  it("ignores future days", () => {
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

  it("parses the day as local midnight, not UTC", () => {
    const ms = [moment({ day: "2026-08-01", personIds: ["ada"] })];
    const last = latestContactDate("ada", ms, NOW);
    expect(last?.getFullYear()).toBe(2026);
    expect(last?.getMonth()).toBe(7);
    expect(last?.getDate()).toBe(1);
    expect(last?.getHours()).toBe(0);
  });
});

describe("hasArrangedContact", () => {
  it("is true for a future-dated moment", () => {
    const ms = [moment({ day: "2026-09-01", personIds: ["ada"] })];
    expect(hasArrangedContact("ada", ms, NOW)).toBe(true);
  });

  it("is false when everything is past", () => {
    const ms = [moment({ day: "2026-08-01", personIds: ["ada"] })];
    expect(hasArrangedContact("ada", ms, NOW)).toBe(false);
  });

  it("is false when there are no moments at all", () => {
    expect(hasArrangedContact("ada", [], NOW)).toBe(false);
  });

  it("ignores an unallocated moment with no day", () => {
    const ms = [moment({ day: null, personIds: ["ada"] })];
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

  // Right-hand branch alone: no habitId to short-circuit on.
  it("reads personIds when habitId is null", () => {
    const ms = [
      moment({ id: "m1", habitId: null }),
      moment({
        id: "m2",
        habitId: null,
        day: dayBefore(NOW, -1),
        personIds: ["ada"],
      }),
    ];
    expect(hasArrangedContact("ada", ms, NOW)).toBe(true);
  });
});

describe("daysSinceLastContact", () => {
  it("counts whole days, null when never", () => {
    const ms = [moment({ day: dayBefore(NOW, 6), personIds: ["ada"] })];
    expect(daysSinceLastContact("ada", ms, NOW)).toBe(6);
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

  it("derives contact from a personIds-only moment without touching habitId", () => {
    const ms = [
      moment({ id: "m1", habitId: null }),
      moment({ id: "m2", habitId: null, day: TODAY, personIds: ["ada"] }),
    ];
    expect(daysSinceLastContact("ada", ms, NOW)).toBe(0);
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

describe("overdueRank", () => {
  it("ranks never-contacted above any ratio", () => {
    expect(overdueRank(null)).toBeGreaterThan(overdueRank(3650));
  });

  it("is finite so two never-contacted people compare to zero, not NaN", () => {
    expect(overdueRank(null) - overdueRank(null)).toBe(0);
  });

  it("passes a real ratio straight through", () => {
    expect(overdueRank(4.29)).toBe(4.29);
  });
});

// ── selectPeopleToReach — the outreach queue ────────────────────────────────

describe("selectPeopleToReach", () => {
  // ada and fay are a deliberately sharp pair: identical -30d contact, same
  // cadence, same category. The ONLY difference is fay's future moment.
  const cai = registryPerson({ key: "cai", category: "family" });
  const dot = registryPerson({ key: "dot", category: "family" });
  const ada = registryPerson({ key: "ada" });
  const bea = registryPerson({ key: "bea" });
  const fay = registryPerson({ key: "fay" });
  const gil = registryPerson({ key: "gil", cadence: null }); // no cadence
  const hob = registryPerson({ key: "hob", status: "paused" });
  const ines = registryPerson({ key: "ines", cadence: "monthly" });

  const PEOPLE = [cai, dot, ada, bea, fay, gil, hob, ines];
  const MOMENTS: Moment[] = [
    moment({ id: "m-ada", day: dayBefore(NOW, 30), personIds: ["ada"] }),
    moment({ id: "m-bea", day: dayBefore(NOW, 2), personIds: ["bea"] }),
    moment({ id: "m-fay-past", day: dayBefore(NOW, 30), personIds: ["fay"] }),
    moment({ id: "m-fay-future", day: dayBefore(NOW, -3), personIds: ["fay"] }),
    moment({ id: "m-gil", day: dayBefore(NOW, 90), personIds: ["gil"] }),
    moment({ id: "m-hob", day: dayBefore(NOW, 90), personIds: ["hob"] }),
    moment({ id: "m-ines", day: dayBefore(NOW, 60), personIds: ["ines"] }),
  ];

  const queue = () => selectPeopleToReach(PEOPLE, MOMENTS, NOW, {});
  const keys = (rows: ReturnType<typeof queue>) => rows.map((r) => r.key);

  it("1. includes someone silent past their cadence, with the elapsed days", () => {
    const row = queue().find((r) => r.key === "ada");
    expect(row?.daysSinceLastContact).toBe(30);
    expect(row?.overdueRatio).toBe(4.29);
    expect(row?.cadence).toBe("weekly");
    expect(row?.category).toBe("friend");
  });

  it("2. excludes someone still inside their cadence", () => {
    expect(keys(queue())).not.toContain("bea");
  });

  it("3. puts a never-contacted person first, with a null day count", () => {
    const first = queue()[0];
    expect(first.key).toBe("cai");
    expect(first.daysSinceLastContact).toBeNull();
    expect(first.overdueRatio).toBeNull();
  });

  it("4. keeps two never-contacted people both present and stably ordered", () => {
    const rows = queue();
    expect(keys(rows).slice(0, 2)).toEqual(["cai", "dot"]);
    // The NaN hazard: if the comparator returned NaN for the null/null pair the
    // rest of the ordering would be corrupted too. Prove the tail survived.
    expect(keys(rows)).toEqual(["cai", "dot", "ada", "ines"]);
  });

  it("5. excludes someone already arranged — a future moment silences the nag", () => {
    // fay and ada have IDENTICAL past contact (-30d) and the same cadence.
    expect(keys(queue())).toContain("ada");
    expect(keys(queue())).not.toContain("fay");
    // ...and it really is only the future moment doing the work.
    const withoutFaysPlan = MOMENTS.filter((m) => m.id !== "m-fay-future");
    expect(
      keys(selectPeopleToReach(PEOPLE, withoutFaysPlan, NOW, {})),
    ).toContain("fay");
  });

  it("6. excludes a person with no cadence — unstated, never wilting", () => {
    expect(keys(queue())).not.toContain("gil");
  });

  it("7. excludes a paused person who would otherwise qualify", () => {
    expect(keys(queue())).not.toContain("hob");
    const resumed = PEOPLE.map((p) =>
      p.key === "hob" ? { ...p, status: "active" as const } : p,
    );
    expect(keys(selectPeopleToReach(resumed, MOMENTS, NOW, {}))).toContain(
      "hob",
    );
  });

  it("8. filters by category", () => {
    expect(
      keys(selectPeopleToReach(PEOPLE, MOMENTS, NOW, { category: "family" })),
    ).toEqual(["cai", "dot"]);
    expect(
      keys(selectPeopleToReach(PEOPLE, MOMENTS, NOW, { category: "friend" })),
    ).toEqual(["ada", "ines"]);
  });

  it("8b. a null-category person matches no category filter but stays in the open queue", () => {
    const juno = registryPerson({ key: "juno", category: null });
    const people = [...PEOPLE, juno];
    expect(
      keys(selectPeopleToReach(people, MOMENTS, NOW, { category: "friend" })),
    ).not.toContain("juno");
    expect(keys(selectPeopleToReach(people, MOMENTS, NOW, {}))).toContain(
      "juno",
    );
  });

  it("9. limit truncates to the MOST overdue, not an arbitrary prefix", () => {
    expect(
      keys(selectPeopleToReach(PEOPLE, MOMENTS, NOW, { limit: 2 })),
    ).toEqual(["cai", "dot"]);
    expect(
      keys(selectPeopleToReach(PEOPLE, MOMENTS, NOW, { limit: 3 })),
    ).toEqual(["cai", "dot", "ada"]);
  });

  it("10. orders the whole set most-overdue-first", () => {
    expect(queue().map((r) => r.overdueRatio)).toEqual([null, null, 4.29, 2]);
  });

  it("11. carries no display name — the registry owns names, fail-soft renders the key", () => {
    const row = queue()[0];
    expect(row).not.toHaveProperty("name");
    expect(row).not.toHaveProperty("areaId");
  });

  // Spec C4: until wake exposes a key-resolve tool, the registry list is
  // empty. That is a normal empty queue, never an error.
  it("12. returns [] for an empty registry and does not throw", () => {
    expect(() => selectPeopleToReach([], MOMENTS, NOW, {})).not.toThrow();
    expect(selectPeopleToReach([], MOMENTS, NOW, {})).toEqual([]);
    expect(selectPeopleToReach([], [], NOW, {})).toEqual([]);
  });

  // ── ranking is relative to cadence, not absolute days ────────────────────

  it("A1. ranks a weekly person at 20 days above a yearly one at 400", () => {
    const yin = registryPerson({ key: "yin", cadence: "yearly" });
    const wes = registryPerson({ key: "wes", cadence: "weekly" });
    const people = [yin, wes]; // yin first, so order is not incidental
    const moments = [
      moment({ id: "m-yin", day: dayBefore(NOW, 400), personIds: ["yin"] }),
      moment({ id: "m-wes", day: dayBefore(NOW, 20), personIds: ["wes"] }),
    ];

    const rows = selectPeopleToReach(people, moments, NOW, {});
    expect(rows.map((r) => r.key)).toEqual(["wes", "yin"]);
    expect(rows.map((r) => r.overdueRatio)).toEqual([2.86, 1.1]);
  });

  it("A2. and the raw-days key would have inverted exactly that ordering", () => {
    const yin = registryPerson({ key: "yin", cadence: "yearly" });
    const wes = registryPerson({ key: "wes", cadence: "weekly" });
    const people = [yin, wes];
    const moments = [
      moment({ id: "m-yin", day: dayBefore(NOW, 400), personIds: ["yin"] }),
      moment({ id: "m-wes", day: dayBefore(NOW, 20), personIds: ["wes"] }),
    ];

    const rows = selectPeopleToReach(people, moments, NOW, {});
    // yin has 20x the elapsed days...
    const byDays = [...rows].sort(
      (a, b) =>
        overdueRank(b.daysSinceLastContact) -
        overdueRank(a.daysSinceLastContact),
    );
    expect(byDays.map((r) => r.key)).toEqual(["yin", "wes"]);
    // ...yet the queue puts them LAST. The two keys disagree, and the ratio wins.
    expect(rows.map((r) => r.key)).toEqual(["wes", "yin"]);
  });
});

/**
 * `far` compares where a person is based against where the season is being
 * lived — `Cycle.placeIds` on the current cycle, passed in as `here` so the
 * function stays pure and the tool handler owns the vault read.
 */
describe("selectPeopleToReach — far", () => {
  const silent = { moments: [] as Moment[], now: NOW };

  it("is true when the person's base is not where the season is", () => {
    const rows = selectPeopleToReach(
      [registryPerson({ key: "ada", basePlace: "avalon" })],
      silent.moments,
      silent.now,
      { here: ["atlantis"] },
    );
    expect(rows[0]?.far).toBe(true);
  });

  it("is false when the person is based where the season is", () => {
    const rows = selectPeopleToReach(
      [registryPerson({ key: "bea", basePlace: "atlantis" })],
      silent.moments,
      silent.now,
      { here: ["atlantis"] },
    );
    expect(rows[0]?.far).toBe(false);
  });

  it("counts a season spanning two cities as near to both", () => {
    const rows = selectPeopleToReach(
      [
        registryPerson({ key: "ada", basePlace: "avalon" }),
        registryPerson({ key: "bea", basePlace: "atlantis" }),
      ],
      silent.moments,
      silent.now,
      { here: ["atlantis", "avalon"] },
    );
    expect(rows.map((r) => r.far)).toEqual([false, false]);
  });

  it("is null when the registry does not know where they are based", () => {
    const rows = selectPeopleToReach(
      [registryPerson({ key: "cai", basePlace: null })],
      silent.moments,
      silent.now,
      { here: ["atlantis"] },
    );
    expect(rows[0]?.far).toBeNull();
  });

  it("is null when the season states no place — an uncheckable constraint", () => {
    const rows = selectPeopleToReach(
      [registryPerson({ key: "ada", basePlace: "avalon" })],
      silent.moments,
      silent.now,
      {},
    );
    expect(rows[0]?.far).toBeNull();
  });

  it("filters to the far when asked", () => {
    const rows = selectPeopleToReach(
      [
        registryPerson({ key: "ada", basePlace: "avalon" }),
        registryPerson({ key: "bea", basePlace: "atlantis" }),
      ],
      silent.moments,
      silent.now,
      { here: ["atlantis"], far: true },
    );
    expect(rows.map((r) => r.key)).toEqual(["ada"]);
  });

  it("filters to the near when asked", () => {
    const rows = selectPeopleToReach(
      [
        registryPerson({ key: "ada", basePlace: "avalon" }),
        registryPerson({ key: "bea", basePlace: "atlantis" }),
      ],
      silent.moments,
      silent.now,
      { here: ["atlantis"], far: false },
    );
    expect(rows.map((r) => r.key)).toEqual(["bea"]);
  });

  it("never excludes someone by a distance it could not check", () => {
    // The same call `practicesForGap` makes one field over: a roster that
    // shrinks in silence is a failure nobody sees.
    const rows = selectPeopleToReach(
      [registryPerson({ key: "cai", basePlace: null })],
      silent.moments,
      silent.now,
      { here: ["atlantis"], far: true },
    );
    expect(rows.map((r) => r.key)).toEqual(["cai"]);
  });

  it("compares keys, not labels — the registry and the cycle both slug", () => {
    const rows = selectPeopleToReach(
      [registryPerson({ key: "ada", basePlace: "new-atlantis" })],
      silent.moments,
      silent.now,
      { here: ["new-atlantis"] },
    );
    expect(rows[0]?.far).toBe(false);
  });
});
