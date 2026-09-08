import { describe, expect, it } from "vitest";
import type { Habit } from "@/domain/entities/Habit";
import {
  DEFAULT_ORACLE_CONFIG,
  routeGapPractice,
  routeOracle,
  buildProposals,
  type OracleConfig,
  type RoutableHabit,
} from "../OracleRouter";

// ── Typed oracle routing (routeOracle) ──────────────────────────────

const baseHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: "h-1",
  name: "test",
  areaId: "a-1",
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("routeOracle", () => {
  it("routes link habits to link action", () => {
    const h = baseHabit({ link: "https://envoituresimone.com/lesson", tags: ["gap"] });
    const action = routeOracle(h);
    expect(action).toEqual({
      kind: "link",
      url: "https://envoituresimone.com/lesson",
      appName: "envoituresimone",
    });
  });

  it("link takes priority over tag routes", () => {
    const h = baseHabit({
      link: "https://duolingo.com",
      tags: ["gap", "learning"],
    });
    expect(routeOracle(h).kind).toBe("link");
  });

  it("routes wellness tag to garmin", () => {
    const h = baseHabit({ tags: ["gap", "wellness", "gap-2m"], durationMin: 3 });
    const action = routeOracle(h);
    expect(action).toEqual({ kind: "garmin", workoutType: "breathwork", durationMin: 3 });
  });

  it("routes breathwork tag to garmin", () => {
    const h = baseHabit({ tags: ["gap", "breathwork", "gap-2m"] });
    expect(routeOracle(h).kind).toBe("garmin");
  });

  it("routes learning tag to lull-n-learn", () => {
    const h = baseHabit({ tags: ["gap", "learning", "french"] });
    const action = routeOracle(h);
    expect(action).toEqual({ kind: "lull-n-learn", mode: "study", tag: "french" });
  });

  it("learning with long duration picks read mode", () => {
    const h = baseHabit({ tags: ["gap", "learning"], durationMin: 10 });
    const action = routeOracle(h);
    expect(action).toEqual({ kind: "lull-n-learn", mode: "read", tag: undefined });
  });

  it("sized gap with no oracle route falls back to timer", () => {
    const h = baseHabit({ name: "stretch", tags: ["gap", "gap-30s"] });
    expect(routeOracle(h)).toEqual({ kind: "timer", durationMs: 30_000, habitName: "stretch" });
  });

  it("unsized, unrouted habit gets whisper-only", () => {
    const h = baseHabit({ tags: ["gap"] });
    expect(routeOracle(h)).toEqual({ kind: "whisper-only" });
  });
});

describe("buildProposals", () => {
  it("limits output and preserves rank order", () => {
    const habits = [
      { habit: baseHabit({ id: "h1", name: "a", tags: ["gap"] }), thirst: { habitId: "h1", score: 3, daysSinceLast: 7, planDeficit: 0 } },
      { habit: baseHabit({ id: "h2", name: "b", tags: ["gap"] }), thirst: { habitId: "h2", score: 2, daysSinceLast: 5, planDeficit: 0 } },
      { habit: baseHabit({ id: "h3", name: "c", tags: ["gap"] }), thirst: { habitId: "h3", score: 1, daysSinceLast: 2, planDeficit: 0 } },
    ];
    const proposals = buildProposals(habits, "declared", 2);
    expect(proposals).toHaveLength(2);
    expect(proposals[0].habitId).toBe("h1");
    expect(proposals[1].habitId).toBe("h2");
    expect(proposals[0].gapType).toBe("declared");
  });
});

// ── Config-driven routing (routeGapPractice) ────────────────────────

const config = DEFAULT_ORACLE_CONFIG;

describe("routeGapPractice", () => {
  it("link field wins over everything", () => {
    const habit: RoutableHabit = {
      tags: ["gap", "wellness"],
      link: "https://example.com/breathwork",
    };
    const route = routeGapPractice(habit, config);
    expect(route).toEqual({
      type: "link",
      target: "https://example.com/breathwork",
    });
  });

  it("trims whitespace-only link and falls through", () => {
    const habit: RoutableHabit = { tags: ["gap", "wellness"], link: "  " };
    expect(routeGapPractice(habit, config).type).toBe("garmin");
  });

  it("routes wellness tag to garmin", () => {
    const habit: RoutableHabit = { tags: ["gap", "wellness"] };
    expect(routeGapPractice(habit, config)).toEqual({
      type: "garmin",
      target: undefined,
    });
  });

  it("routes learning tag to lull-n-learn", () => {
    const habit: RoutableHabit = { tags: ["gap", "learning"] };
    expect(routeGapPractice(habit, config).type).toBe("lull-n-learn");
  });

  it("falls back to timer for unknown tags", () => {
    const habit: RoutableHabit = { tags: ["gap", "stretching"] };
    expect(routeGapPractice(habit, config).type).toBe("timer");
  });

  it("handles null/empty tags gracefully", () => {
    expect(routeGapPractice({ tags: null }, config).type).toBe("timer");
    expect(routeGapPractice({ tags: [] }, config).type).toBe("timer");
    expect(routeGapPractice({}, config).type).toBe("timer");
  });

  it("skips oracle not in oracles registry", () => {
    const sparse: OracleConfig = {
      oracles: {},
      routes: { "gap.wellness": ["garmin"] },
    };
    const habit: RoutableHabit = { tags: ["gap", "wellness"] };
    expect(routeGapPractice(habit, sparse).type).toBe("timer");
  });

  it("tries oracles in route order, picks first available", () => {
    const ordered: OracleConfig = {
      oracles: {
        "lull-n-learn": { check: "exists", action: "fetch" },
      },
      routes: { "gap.learning": ["garmin", "lull-n-learn"] },
    };
    const habit: RoutableHabit = { tags: ["gap", "learning"] };
    expect(routeGapPractice(habit, ordered).type).toBe("lull-n-learn");
  });
});
