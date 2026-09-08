import { describe, expect, it } from "vitest";
import { proposeGap, type GapProposal } from "./thirst.js";
import type { CyclePlan, Habit, Moment } from "./vault.js";

const h = (overrides: Partial<Habit>): Habit => ({
  id: overrides.id ?? "h1",
  name: overrides.name ?? "breathwork",
  areaId: "area-1",
  attitude: overrides.attitude ?? "KEEPING",
  phase: null,
  tags: overrides.tags ?? ["gap", "gap-2m"],
  emoji: null,
  isArchived: false,
  order: 0,
  ...(overrides.rhythm ? { rhythm: overrides.rhythm } : { rhythm: { period: "weekly" as const, count: 3 } }),
  ...(overrides.link ? { link: overrides.link } : {}),
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const m = (habitId: string, day: string): Moment => ({
  id: `m-${day}-${habitId}`,
  name: "m",
  areaId: "area-1",
  habitId,
  cycleId: null,
  cyclePlanId: null,
  phase: "MORNING",
  day,
  order: 0,
  tags: null,
  createdAt: `${day}T08:00:00Z`,
  updatedAt: `${day}T08:00:00Z`,
});

const now = new Date("2026-09-08T12:00:00");

describe("proposeGap", () => {
  it("returns empty for no gap habits", () => {
    const habits = { h1: h({ tags: ["wellness"] }) };
    expect(proposeGap(habits, [], {}, {}, now)).toEqual([]);
  });

  it("returns gap habits sorted by thirst", () => {
    const habits = {
      fresh: h({ id: "fresh", name: "fresh habit", tags: ["gap", "gap-30s"], attitude: "KEEPING", rhythm: { period: "weekly", count: 3 } }),
      stale: h({ id: "stale", name: "stale habit", tags: ["gap", "gap-2m"], attitude: "BEGINNING", rhythm: { period: "weekly", count: 3 } }),
    };
    // "fresh" was watered yesterday, "stale" never
    const moments = [m("fresh", "2026-09-07")];
    const proposals = proposeGap(habits, moments, {}, {}, now);
    expect(proposals.length).toBe(2);
    expect(proposals[0].habitId).toBe("stale"); // never watered = thirstier
    expect(proposals[0].thirst).toBeGreaterThan(proposals[1].thirst);
  });

  it("filters by duration", () => {
    const habits = {
      short: h({ id: "short", name: "look out", tags: ["gap", "gap-30s"] }),
      long: h({ id: "long", name: "stretch", tags: ["gap", "gap-5m"] }),
    };
    // 60s window → only 30s fits
    const proposals = proposeGap(habits, [], {}, {}, now, 60_000);
    expect(proposals.length).toBe(1);
    expect(proposals[0].name).toBe("look out");
  });

  it("filters by place", () => {
    const habits = {
      here: h({ id: "here", name: "pull up", tags: ["gap", "gap-2m", "place-harbor-city"] }),
      everywhere: h({ id: "everywhere", name: "breathwork", tags: ["gap", "gap-2m"] }),
    };
    const proposals = proposeGap(habits, [], {}, {}, now, undefined, "river-city");
    expect(proposals.map((p) => p.name)).toEqual(["breathwork"]);
  });

  it("includes link when present", () => {
    const habits = {
      h1: h({ link: "https://example.com/practice" }),
    };
    const proposals = proposeGap(habits, [], {}, {}, now);
    expect(proposals[0].link).toBe("https://example.com/practice");
  });

  it("respects maxResults", () => {
    const habits: Record<string, Habit> = {};
    for (let i = 0; i < 10; i++) {
      habits[`h${i}`] = h({ id: `h${i}`, name: `habit ${i}` });
    }
    const proposals = proposeGap(habits, [], {}, {}, now, undefined, undefined, 2);
    expect(proposals.length).toBe(2);
  });
});
