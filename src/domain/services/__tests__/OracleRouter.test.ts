import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORACLE_CONFIG,
  routeGapPractice,
  type OracleConfig,
  type RoutableHabit,
} from "../OracleRouter";

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

  it("routes breathwork tag to garmin", () => {
    const habit: RoutableHabit = { tags: ["gap", "breathwork"] };
    expect(routeGapPractice(habit, config).type).toBe("garmin");
  });

  it("routes learning tag to lull-n-learn", () => {
    const habit: RoutableHabit = { tags: ["gap", "learning"] };
    expect(routeGapPractice(habit, config).type).toBe("lull-n-learn");
  });

  it("falls back to timer for unknown tags", () => {
    const habit: RoutableHabit = { tags: ["gap", "stretching"] };
    expect(routeGapPractice(habit, config).type).toBe("timer");
  });

  it("timer carries durationMin as target ms", () => {
    const habit: RoutableHabit = { tags: ["gap"], durationMin: 2 };
    const route = routeGapPractice(habit, config);
    expect(route).toEqual({ type: "timer", target: "120000" });
  });

  it("timer with no duration has no target", () => {
    const habit: RoutableHabit = { tags: ["gap"] };
    expect(routeGapPractice(habit, config)).toEqual({ type: "timer" });
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
