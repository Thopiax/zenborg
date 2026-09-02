import { describe, expect, it } from "vitest";
import {
  assessBaseline,
  type DailyCount,
  DEFAULT_BASELINE_CONFIG,
} from "../Baseline";

/** Day `n` of the series, rolling over months correctly. */
const dayAt = (offset: number): string =>
  new Date(Date.UTC(2026, 6, 1) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** A flat series of `days` days, every day carrying `count`. */
const flat = (days: number, count: number, from = 0): DailyCount[] =>
  Array.from({ length: days }, (_, i) => ({ day: dayAt(from + i), count }));

/** A series rising by `step` per day, starting at `start`. */
const rising = (
  days: number,
  start: number,
  step: number,
  from = 0,
): DailyCount[] =>
  Array.from({ length: days }, (_, i) => ({
    day: dayAt(from + i),
    count: start + i * step,
  }));

describe("assessBaseline", () => {
  it("defaults to the taxonomy's floor and a fortnight of trend", () => {
    expect(DEFAULT_BASELINE_CONFIG.floorDays).toBe(21);
    expect(DEFAULT_BASELINE_CONFIG.trendDays).toBe(14);
  });

  it("is not stable on an empty series", () => {
    const verdict = assessBaseline([]);
    expect(verdict.stable).toBe(false);
    expect(verdict.stable === false && verdict.reason).toBe(
      "insufficient_days",
    );
  });

  it("is not stable below the floor, however flat it looks", () => {
    const verdict = assessBaseline(flat(20, 4));
    expect(verdict.stable).toBe(false);
    expect(verdict.stable === false && verdict.reason).toBe(
      "insufficient_days",
    );
    expect(verdict.observedDays).toBe(20);
  });

  it("reaching the floor is not on its own the criterion", () => {
    // 21 days is the data-sufficiency floor. A series still climbing on day 21
    // is not a baseline, which is exactly the confusion the spec calls out.
    const verdict = assessBaseline(rising(21, 1, 1));
    expect(verdict.stable).toBe(false);
    expect(verdict.stable === false && verdict.reason).toBe("still_trending");
  });

  it("is stable when the floor is met and the final fortnight is flat", () => {
    const verdict = assessBaseline(flat(21, 4));
    expect(verdict.stable).toBe(true);
    expect(verdict.slopePerDay).toBe(0);
  });

  it("reads the trend off the final fortnight, not the whole series", () => {
    // A noisy opening fortnight followed by a settled one is a settled baseline.
    // Judging the whole series would keep a stabilised process open forever.
    const series = [...rising(10, 0, 3), ...flat(14, 30, 10)];
    const verdict = assessBaseline(series);
    expect(verdict.stable).toBe(true);
  });

  it("tolerates noise that does not add up to a trend", () => {
    const series = flat(21, 10);
    series[18] = { ...series[18], count: 11 };
    series[19] = { ...series[19], count: 9 };
    const verdict = assessBaseline(series);
    expect(verdict.stable).toBe(true);
  });

  it("reports the slope and the drift it implies across the window", () => {
    const verdict = assessBaseline(rising(21, 10, 2));
    expect(verdict.slopePerDay).toBeCloseTo(2, 10);
    // 13 intervals across a 14-day window.
    expect(verdict.driftAcrossWindow).toBeCloseTo(26, 10);
    expect(verdict.stable).toBe(false);
  });

  it("counts a falling series as trending too", () => {
    const verdict = assessBaseline(rising(21, 40, -2));
    expect(verdict.stable).toBe(false);
    expect(verdict.slopePerDay).toBeLessThan(0);
  });

  it("calls an all-zero series flat rather than dividing by its mean", () => {
    const verdict = assessBaseline(flat(21, 0));
    expect(verdict.stable).toBe(true);
    expect(verdict.driftAcrossWindow).toBe(0);
  });

  it("takes the tolerance as a parameter, so the cut is never hidden", () => {
    const series = rising(21, 100, 1);
    expect(assessBaseline(series).stable).toBe(false);
    expect(assessBaseline(series, { tolerance: 0.5 }).stable).toBe(true);
  });

  it("sorts by day, so an out-of-order series reads the same", () => {
    const ordered = rising(21, 10, 2);
    const shuffled = [...ordered].reverse();
    expect(assessBaseline(shuffled).slopePerDay).toBeCloseTo(
      assessBaseline(ordered).slopePerDay,
      10,
    );
  });

  it("collapses repeated days rather than double counting one", () => {
    const series = [...flat(21, 4), { day: dayAt(20), count: 40 }];
    const verdict = assessBaseline(series);
    // The repeat replaces rather than appends: 21 days observed, not 22.
    expect(verdict.observedDays).toBe(21);
  });
});
