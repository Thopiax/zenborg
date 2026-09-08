import { describe, expect, it } from "vitest";
import type { Habit } from "@/domain/entities/Habit";
import { findGaps, forecastGaps, momentsToBlocks, type TimeBlock } from "../GapForecast";
import type { Moment } from "@/domain/entities/Moment";
import { Phase } from "@/domain/value-objects/Phase";

const baseHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: "h-1",
  name: "breathwork",
  areaId: "a-1",
  attitude: null,
  phase: null,
  tags: ["gap", "gap-2m"],
  emoji: null,
  isArchived: false,
  order: 0,
  durationMin: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("findGaps", () => {
  it("finds gap between two blocks", () => {
    const blocks: TimeBlock[] = [
      { startMin: 480, endMin: 540, label: "standup" },    // 8:00-9:00
      { startMin: 600, endMin: 720, label: "deep work" },  // 10:00-12:00
    ];
    const gaps = findGaps(blocks, 480, 720);
    expect(gaps).toEqual([
      { startMin: 540, endMin: 600, durationMin: 60 },
    ]);
  });

  it("finds trailing gap after last block", () => {
    const blocks: TimeBlock[] = [
      { startMin: 480, endMin: 540, label: "standup" },
    ];
    const gaps = findGaps(blocks, 480, 720, 5);
    expect(gaps).toEqual([
      { startMin: 540, endMin: 720, durationMin: 180 },
    ]);
  });

  it("finds leading gap before first block", () => {
    const blocks: TimeBlock[] = [
      { startMin: 540, endMin: 600, label: "standup" },
    ];
    const gaps = findGaps(blocks, 480, 600, 5);
    expect(gaps).toEqual([
      { startMin: 480, endMin: 540, durationMin: 60 },
    ]);
  });

  it("filters out gaps smaller than minimum", () => {
    const blocks: TimeBlock[] = [
      { startMin: 480, endMin: 483, label: "a" },
      { startMin: 485, endMin: 540, label: "b" },
    ];
    const gaps = findGaps(blocks, 480, 540, 5);
    expect(gaps).toEqual([]);
  });

  it("returns full day as one gap when no blocks", () => {
    const gaps = findGaps([], 480, 720, 5);
    expect(gaps).toEqual([
      { startMin: 480, endMin: 720, durationMin: 240 },
    ]);
  });
});

describe("forecastGaps", () => {
  it("proposes one habit per gap, thirstiest first", () => {
    const blocks: TimeBlock[] = [
      { startMin: 480, endMin: 540, label: "standup" },
      { startMin: 600, endMin: 720, label: "deep work" },
    ];
    const h1 = baseHabit({ id: "h1", name: "breathwork", durationMin: 2 });
    const h2 = baseHabit({ id: "h2", name: "stretch", durationMin: 5 });
    const ranked = [
      { habit: h1, thirst: { habitId: "h1", score: 2.5, daysSinceLast: 5, planDeficit: 0 } },
      { habit: h2, thirst: { habitId: "h2", score: 1.5, daysSinceLast: 3, planDeficit: 0 } },
    ];
    const fills = forecastGaps(blocks, ranked, { dayStartMin: 480, dayEndMin: 720 });
    expect(fills).toHaveLength(1);
    expect(fills[0].habitId).toBe("h1");
    expect(fills[0].startTime).toBe("09:00");
    expect(fills[0].gapType).toBe("forecast");
  });

  it("does not reuse the same habit in two gaps", () => {
    const blocks: TimeBlock[] = [
      { startMin: 480, endMin: 500, label: "a" },
      { startMin: 520, endMin: 540, label: "b" },
      { startMin: 560, endMin: 600, label: "c" },
    ];
    const h1 = baseHabit({ id: "h1", name: "breathwork", durationMin: 2 });
    const ranked = [
      { habit: h1, thirst: { habitId: "h1", score: 2.5, daysSinceLast: 5, planDeficit: 0 } },
    ];
    const fills = forecastGaps(blocks, ranked, { dayStartMin: 480, dayEndMin: 600 });
    expect(fills).toHaveLength(1); // only one habit, only one fill
  });

  it("skips habits that are too long for the gap", () => {
    const blocks: TimeBlock[] = [
      { startMin: 480, endMin: 490, label: "a" },
      { startMin: 495, endMin: 540, label: "b" },
    ];
    const ranked = [
      { habit: baseHabit({ id: "h1", durationMin: 10 }), thirst: { habitId: "h1", score: 3, daysSinceLast: 7, planDeficit: 0 } },
      { habit: baseHabit({ id: "h2", durationMin: 2 }), thirst: { habitId: "h2", score: 2, daysSinceLast: 5, planDeficit: 0 } },
    ];
    const fills = forecastGaps(blocks, ranked, { dayStartMin: 480, dayEndMin: 540 });
    expect(fills).toHaveLength(1);
    expect(fills[0].habitId).toBe("h2"); // h1 too long for 5-min gap
  });
});

describe("momentsToBlocks", () => {
  it("converts timed moments to blocks", () => {
    const moments: Moment[] = [
      {
        id: "m1", name: "standup", areaId: "a", habitId: null,
        cycleId: null, cyclePlanId: null, phase: Phase.MORNING,
        day: "2026-09-08", order: 0, tags: null,
        startTime: "09:00", durationMin: 30,
        createdAt: "", updatedAt: "",
      },
    ];
    const blocks = momentsToBlocks(moments);
    expect(blocks).toEqual([
      { startMin: 540, endMin: 570, label: "standup" },
    ]);
  });

  it("skips moments without startTime or duration", () => {
    const moments: Moment[] = [
      {
        id: "m1", name: "ambient", areaId: "a", habitId: null,
        cycleId: null, cyclePlanId: null, phase: Phase.MORNING,
        day: "2026-09-08", order: 0, tags: null,
        createdAt: "", updatedAt: "",
      },
    ];
    expect(momentsToBlocks(moments)).toEqual([]);
  });
});
