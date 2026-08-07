import { describe, it, expect } from "vitest";
import { HabitHealthService } from "../HabitHealthService";
import { Attitude } from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import type { Habit } from "@/domain/entities/Habit";
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Moment } from "@/domain/entities/Moment";
import type { Rhythm } from "@/domain/value-objects/Rhythm";

const service = new HabitHealthService();

const ISO = (d: Date) => d.toISOString();
const DAY = (d: Date) => d.toISOString().slice(0, 10);

const baseHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: overrides.id ?? "habit-1",
  name: "test habit",
  areaId: "area-1",
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  createdAt: ISO(new Date("2026-01-01")),
  updatedAt: ISO(new Date("2026-01-01")),
  ...overrides,
});

const allocatedMoment = (
  habitId: string,
  day: Date,
  overrides: Partial<Moment> = {}
): Moment => ({
  id: `moment-${day.toISOString()}`,
  name: "m",
  areaId: "area-1",
  habitId,
  cycleId: null,
  cyclePlanId: null,
  phase: Phase.MORNING,
  day: DAY(day),
  order: 0,
  tags: null,
  createdAt: ISO(day),
  updatedAt: ISO(day),
  ...overrides,
});

describe("HabitHealthService.resolveRhythm", () => {
  it("returns cyclePlan override when present", () => {
    const habit = baseHabit({
      rhythm: { period: "weekly", count: 3 },
    });
    const plan: CyclePlan = {
      id: "p1",
      cycleId: "c1",
      habitId: habit.id,
      budgetedCount: 0,
      rhythmOverride: { period: "weekly", count: 5 },
      createdAt: ISO(new Date()),
      updatedAt: ISO(new Date()),
    };
    expect(service.resolveRhythm(habit, plan)).toEqual({
      period: "weekly",
      count: 5,
    });
  });

  it("falls back to habit rhythm when no plan override", () => {
    const habit = baseHabit({ rhythm: { period: "monthly", count: 2 } });
    expect(service.resolveRhythm(habit, null)).toEqual({
      period: "monthly",
      count: 2,
    });
  });

  it("returns null when neither source has rhythm", () => {
    expect(service.resolveRhythm(baseHabit(), null)).toBeNull();
  });
});

describe("HabitHealthService.computeHealth — attitude dispatch", () => {
  it("returns 'unstated' for a habit with no attitude", () => {
    const habit = baseHabit();
    expect(service.computeHealth(habit, null, [], new Date())).toBe("unstated");
  });

  it("returns 'evergreen' for BEING regardless of history", () => {
    const habit = baseHabit({ attitude: Attitude.BEING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("evergreen");
  });
});

describe("HabitHealthService — BEGINNING", () => {
  it("is 'seedling' when allocation count < 5", () => {
    const habit = baseHabit({ attitude: Attitude.BEGINNING });
    const now = new Date("2026-04-20");
    const moments = [
      allocatedMoment(habit.id, new Date("2026-04-18")),
      allocatedMoment(habit.id, new Date("2026-04-19")),
    ];
    expect(service.computeHealth(habit, null, moments, now)).toBe("seedling");
  });

  it("is 'budding' when allocation count >= 5", () => {
    const habit = baseHabit({ attitude: Attitude.BEGINNING });
    const now = new Date("2026-04-20");
    const moments = [0, 1, 2, 3, 4].map((i) =>
      allocatedMoment(habit.id, new Date(`2026-04-1${i}`))
    );
    expect(service.computeHealth(habit, null, moments, now)).toBe("budding");
  });
});

describe("HabitHealthService — RETURNING", () => {
  it("is 'unstated' when RETURNING has no rhythm", () => {
    const habit = baseHabit({ attitude: Attitude.RETURNING });
    const now = new Date("2026-04-20");
    expect(service.computeHealth(habit, null, [], now)).toBe("unstated");
  });

  it("is 'wilting' when no allocations exist and rhythm is set", () => {
    const habit = baseHabit({
      attitude: Attitude.RETURNING,
      rhythm: { period: "monthly", count: 2 },
    });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("wilting");
  });

  it("is 'blooming' when last allocation is within RETURNING's extended threshold", () => {
    // monthly count=2 → KEEPING threshold = 15 days; RETURNING = 22.5 days.
    const rhythm: Rhythm = { period: "monthly", count: 2 };
    const habit = baseHabit({
      attitude: Attitude.RETURNING,
      rhythm,
    });
    const now = new Date("2026-04-20");
    const last = new Date("2026-04-01"); // 19 days ago — past KEEPING threshold, within RETURNING
    expect(
      service.computeHealth(habit, null, [allocatedMoment(habit.id, last)], now)
    ).toBe("blooming");
  });

  it("is more forgiving than KEEPING for the same gap", () => {
    const rhythm: Rhythm = { period: "monthly", count: 2 }; // KEEPING=15d, RETURNING=22.5d
    const now = new Date("2026-04-20");
    const last = new Date("2026-04-01"); // 19 days ago
    const moments = [allocatedMoment("habit-1", last)];

    const keeping = baseHabit({ id: "habit-1", attitude: Attitude.KEEPING, rhythm });
    const returning = baseHabit({
      id: "habit-1",
      attitude: Attitude.RETURNING,
      rhythm,
    });

    expect(service.computeHealth(keeping, null, moments, now)).toBe("wilting");
    expect(service.computeHealth(returning, null, moments, now)).toBe("blooming");
  });

  it("is 'wilting' when last allocation is past RETURNING's extended threshold", () => {
    const rhythm: Rhythm = { period: "monthly", count: 2 }; // RETURNING threshold = 22.5 days
    const habit = baseHabit({ attitude: Attitude.RETURNING, rhythm });
    const now = new Date("2026-04-30");
    const last = new Date("2026-04-01"); // 29 days ago — past RETURNING threshold
    expect(
      service.computeHealth(habit, null, [allocatedMoment(habit.id, last)], now)
    ).toBe("wilting");
  });
});

describe("HabitHealthService — KEEPING", () => {
  it("is 'unstated' when KEEPING has no rhythm", () => {
    const habit = baseHabit({ attitude: Attitude.KEEPING });
    const now = new Date("2026-04-20");
    expect(service.computeHealth(habit, null, [], now)).toBe("unstated");
  });

  it("is 'blooming' when last allocation is within silence threshold", () => {
    const rhythm: Rhythm = { period: "monthly", count: 2 }; // threshold = 15 days
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm,
    });
    const now = new Date("2026-04-20");
    const last = new Date("2026-04-10"); // 10 days ago
    expect(
      service.computeHealth(habit, null, [allocatedMoment(habit.id, last)], now)
    ).toBe("blooming");
  });

  it("is 'wilting' when last allocation is past silence threshold", () => {
    const rhythm: Rhythm = { period: "monthly", count: 2 }; // threshold = 15 days
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm,
    });
    const now = new Date("2026-04-20");
    const last = new Date("2026-04-01"); // 19 days ago
    expect(
      service.computeHealth(habit, null, [allocatedMoment(habit.id, last)], now)
    ).toBe("wilting");
  });

  it("is 'wilting' when no allocations exist and rhythm is set", () => {
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm: { period: "quarterly", count: 1 },
    });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("wilting");
  });
});

describe("HabitHealthService — BUILDING", () => {
  it("is 'unstated' when BUILDING has no rhythm", () => {
    const habit = baseHabit({ attitude: Attitude.BUILDING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("unstated");
  });

  it("is 'budding' when habit was updated less than 3 periods ago", () => {
    const now = new Date("2026-04-20");
    const habit = baseHabit({
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
      updatedAt: ISO(new Date("2026-04-14")), // less than 21 days (3 weeks)
    });
    expect(service.computeHealth(habit, null, [], now)).toBe("budding");
  });

  it("is 'blooming' when on-pace within the current period", () => {
    const now = new Date("2026-04-20");
    const habit = baseHabit({
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
      updatedAt: ISO(new Date("2026-01-01")), // well past budding window
    });
    // 2 allocations in last 7 days is on-pace
    const moments = [
      allocatedMoment(habit.id, new Date("2026-04-14")),
      allocatedMoment(habit.id, new Date("2026-04-16")),
    ];
    expect(service.computeHealth(habit, null, moments, now)).toBe("blooming");
  });

  it("is 'wilting' when below pace beyond tolerance", () => {
    const now = new Date("2026-04-27"); // end of week
    const habit = baseHabit({
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 5 },
      updatedAt: ISO(new Date("2026-01-01")),
    });
    // 1 allocation in last 7 days when 5 expected, tolerance max(1, floor(5*0.2))=1
    const moments = [allocatedMoment(habit.id, new Date("2026-04-21"))];
    expect(service.computeHealth(habit, null, moments, now)).toBe("wilting");
  });
});

describe("HabitHealthService — PUSHING", () => {
  it("reuses BUILDING pace logic (wilt on underpace)", () => {
    const now = new Date("2026-04-27");
    const habit = baseHabit({
      attitude: Attitude.PUSHING,
      rhythm: { period: "weekly", count: 3 },
      updatedAt: ISO(new Date("2026-01-01")),
    });
    // 0 allocations in last 7 days, expect wilting
    expect(service.computeHealth(habit, null, [], now)).toBe("wilting");
  });

  it("is 'unstated' when PUSHING has no rhythm (migration safety)", () => {
    const habit = baseHabit({ attitude: Attitude.PUSHING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("unstated");
  });
});

describe("HabitHealthService — migration safety (pre-rhythm habits)", () => {
  it("BEGINNING habit without rhythm never reports wilting", () => {
    const habit = baseHabit({ attitude: Attitude.BEGINNING });
    const result = service.computeHealth(habit, null, [], new Date());
    expect(result).not.toBe("wilting");
  });

  it("KEEPING habit without rhythm stays unstated (not wilting)", () => {
    const habit = baseHabit({ attitude: Attitude.KEEPING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("unstated");
  });

  it("RETURNING habit without rhythm stays unstated (not wilting)", () => {
    const habit = baseHabit({ attitude: Attitude.RETURNING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("unstated");
  });

  it("BUILDING habit without rhythm stays unstated (not wilting)", () => {
    const habit = baseHabit({ attitude: Attitude.BUILDING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("unstated");
  });
});

describe("HabitHealthService — moments attached via personIds", () => {
  const NOW = new Date("2026-08-07T12:00:00.000Z");
  const WEEKLY: Rhythm = { period: "weekly", count: 1 }; // 7-day threshold
  const TWO_DAYS_AGO = new Date("2026-08-05T12:00:00.000Z");

  /** A moment planted against nobody's habit — the composed-moment shape. */
  const unplanted = (day: Date, overrides: Partial<Moment> = {}): Moment =>
    allocatedMoment("", day, { habitId: null, ...overrides });

  it("counts a moment that names the habit in personIds toward its health", () => {
    // People ARE habit records. One dinner with three friends is ONE moment
    // carrying three ids — it must reach every one of their health reads.
    const yaya = baseHabit({
      id: "p-yaya",
      name: "Yaya",
      attitude: Attitude.KEEPING,
      rhythm: WEEKLY,
    });
    const groupDinner = unplanted(TWO_DAYS_AGO, {
      id: "m-group-dinner",
      personIds: ["p-abuelo", "p-yaya", "p-mari"],
    });

    expect(service.computeHealth(yaya, null, [], NOW)).toBe("wilting");
    expect(service.computeHealth(yaya, null, [groupDinner], NOW)).toBe(
      "blooming"
    );
  });

  it("counts personIds moments for RETURNING as well as KEEPING", () => {
    const mari = baseHabit({
      id: "p-mari",
      name: "Mari",
      attitude: Attitude.RETURNING,
      rhythm: WEEKLY,
    });
    const groupDinner = unplanted(TWO_DAYS_AGO, {
      id: "m-group-dinner",
      personIds: ["p-mari"],
    });

    expect(service.computeHealth(mari, null, [], NOW)).toBe("wilting");
    expect(service.computeHealth(mari, null, [groupDinner], NOW)).toBe(
      "blooming"
    );
  });

  it("leaves an ordinary habit's health untouched by unrelated personIds", () => {
    // No-regression pin: `personIds` can never hold an ordinary habit's own id,
    // so the widened filter is provably inert for every non-person record.
    const meditation = baseHabit({
      id: "h-meditation",
      name: "meditation",
      attitude: Attitude.KEEPING,
      rhythm: WEEKLY,
    });
    const ownMoment = allocatedMoment("h-meditation", TWO_DAYS_AGO, {
      id: "m-own",
    });
    const otherPeople = unplanted(TWO_DAYS_AGO, {
      id: "m-other",
      personIds: ["p-yaya", "p-abuelo", "p-mari"],
    });

    expect(service.computeHealth(meditation, null, [otherPeople], NOW)).toBe(
      "wilting"
    );
    expect(
      service.computeHealth(meditation, null, [ownMoment, otherPeople], NOW)
    ).toBe("blooming");
  });

  it("does not throw on a moment carrying no personIds at all", () => {
    // `habitId: null` and no `personIds` — the optional chain is genuinely
    // exercised here, not short-circuited by a habitId match.
    const yaya = baseHabit({
      id: "p-yaya",
      attitude: Attitude.KEEPING,
      rhythm: WEEKLY,
    });
    const orphan = unplanted(TWO_DAYS_AGO, { id: "m-orphan" });
    expect(orphan.personIds).toBeUndefined();
    expect(orphan.habitId).toBeNull();

    expect(() => service.computeHealth(yaya, null, [orphan], NOW)).not.toThrow();
    expect(service.computeHealth(yaya, null, [orphan], NOW)).toBe("wilting");
  });

  it("counts personIds moments toward BEGINNING's 5-moment budding gate", () => {
    const yanik = baseHabit({
      id: "p-yanik",
      name: "Yanik",
      attitude: Attitude.BEGINNING,
    });
    const five = [1, 2, 3, 4, 5].map((n) =>
      unplanted(TWO_DAYS_AGO, { id: `m-${n}`, personIds: ["p-yanik"] })
    );

    expect(service.computeHealth(yanik, null, five.slice(0, 4), NOW)).toBe(
      "seedling"
    );
    expect(service.computeHealth(yanik, null, five, NOW)).toBe("budding");
  });
});
