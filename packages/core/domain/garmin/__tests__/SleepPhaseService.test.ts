import { describe, expect, it } from "vitest";
import {
  anchorsFrom,
  circularDelta,
  circularMedianHours,
  detectDrift,
  formatHour,
  localHourOf,
  type PhaseBand,
  type SleepNight,
  shiftBands,
  summarizeNights,
  wrap24,
} from "@zenborg/core/domain/garmin/SleepPhaseService";

const TZ = "Europe/Paris";

/** The 11 real nights pulled from Garmin on 2026-08-07 (epoch ms). */
const REAL_NIGHTS: SleepNight[] = [
  { sleep_start: 1786059670000, sleep_end: 1786086910000, sleep_score: 85 },
  { sleep_start: 1785978649000, sleep_end: 1786008649000, sleep_score: 88 },
  { sleep_start: 1785889445000, sleep_end: 1785919505000, sleep_score: 87 },
  { sleep_start: 1785807120000, sleep_end: 1785829440000, sleep_score: 77 },
  { sleep_start: 1785710306000, sleep_end: 1785742397000, sleep_score: 98 },
  { sleep_start: 1785642269000, sleep_end: 1785662969000, sleep_score: 74 },
  { sleep_start: 1785544987000, sleep_end: 1785577447000, sleep_score: 77 },
  { sleep_start: 1785364238000, sleep_end: 1785395719000, sleep_score: 95 },
  { sleep_start: 1785281568000, sleep_end: 1785308472000, sleep_score: 81 },
  { sleep_start: 1785189202000, sleep_end: 1785216322000, sleep_score: 89 },
  { sleep_start: 1785112098000, sleep_end: 1785140718000, sleep_score: 92 },
];

/** The bands as authored for a 07:00 wake — the "before" state. */
const LEGACY_BANDS: PhaseBand[] = [
  { id: "m", phase: "MORNING", startHour: 7, endHour: 13 },
  { id: "a", phase: "AFTERNOON", startHour: 13, endHour: 19 },
  { id: "e", phase: "EVENING", startHour: 19, endHour: 1 },
  { id: "n", phase: "NIGHT", startHour: 1, endHour: 7 },
];

describe("circularMedianHours", () => {
  it("matches the plain median when nothing straddles midnight", () => {
    expect(circularMedianHours([9, 10, 11])).toBeCloseTo(10, 6);
  });

  it("does not land near noon when onsets straddle midnight", () => {
    // 23:53 and 00:38 are 45 minutes apart, not 23 hours apart.
    const median = circularMedianHours([23.883, 0.633, 1.5]);
    expect(median).toBeCloseTo(0.633, 3);
  });

  it("is unmoved by which side of midnight the samples sit on", () => {
    const before = circularMedianHours([22, 23, 0, 1, 2]);
    // Same shape, rotated 6h later.
    const after = circularMedianHours([4, 5, 6, 7, 8]);
    expect(wrap24(after - before)).toBeCloseTo(6, 6);
  });

  it("returns NaN for no samples", () => {
    expect(circularMedianHours([])).toBeNaN();
  });
});

describe("circularDelta", () => {
  it("takes the short way round midnight", () => {
    expect(circularDelta(23, 1)).toBeCloseTo(2, 6);
    expect(circularDelta(1, 23)).toBeCloseTo(-2, 6);
  });

  it("is zero for identical hours", () => {
    expect(circularDelta(9, 9)).toBe(0);
  });
});

describe("localHourOf", () => {
  it("reads a known instant in the user's zone, seconds included", () => {
    // 1785710306000 = 2026-08-03 00:38:26 Europe/Paris.
    expect(localHourOf(1785710306000, TZ)).toBeCloseTo(38 / 60 + 26 / 3600, 4);
  });

  it("reads the same instant differently in another zone", () => {
    // Paris is UTC+2 in August; the same instant is 22:38 UTC the day before.
    expect(localHourOf(1785710306000, "UTC")).toBeCloseTo(
      22 + 38 / 60 + 26 / 3600,
      4,
    );
  });
});

describe("summarizeNights", () => {
  it("summarizes the real 11-night sample", () => {
    const s = summarizeNights(REAL_NIGHTS, TZ);
    expect(s.nightsUsed).toBe(11);
    expect(s.nightsMissing).toBe(0);
    // Onset median ~02:24, wake median ~09:44.
    expect(formatHour(s.medianOnsetHour)).toBe("02:24");
    expect(formatHour(s.medianWakeHour)).toBe("09:44");
    expect(s.medianSleepHours).toBeGreaterThan(7.5);
    expect(s.medianSleepHours).toBeLessThan(8.1);
  });

  it("tolerates nights Garmin has no data for", () => {
    // The endpoint returns `{}` for missing nights; that is absence, not zero.
    const s = summarizeNights([...REAL_NIGHTS, {}, {}, {}], TZ);
    expect(s.nightsUsed).toBe(11);
    expect(s.nightsMissing).toBe(3);
  });
});

describe("anchorsFrom", () => {
  it("rounds outward from the waking day", () => {
    const s = summarizeNights(REAL_NIGHTS, TZ);
    const { wakeAnchor, onsetAnchor } = anchorsFrom(s);
    // wake 09:44 floors to 09; onset 02:24 ceils to 03.
    expect(wakeAnchor).toBe(9);
    expect(onsetAnchor).toBe(3);
  });

  it("reproduces the boundaries the user chose by hand", () => {
    // The user realigned MORNING to start 09 and NIGHT to start 03 manually.
    // The outward-rounding rule derives exactly those from the sleep data,
    // which is the check that the rule encodes his judgement rather than
    // merely fitting numbers.
    const { wakeAnchor, onsetAnchor } = anchorsFrom(
      summarizeNights(REAL_NIGHTS, TZ),
    );
    expect([wakeAnchor, onsetAnchor]).toEqual([9, 3]);
  });
});

describe("detectDrift", () => {
  it("refuses to speak below the minimum night count", () => {
    const s = summarizeNights(REAL_NIGHTS.slice(0, 3), TZ);
    const v = detectDrift(s, LEGACY_BANDS);
    expect(v.kind).toBe("insufficient-data");
  });

  it("proposes a rigid +2h shift against the legacy 07:00-wake bands", () => {
    const s = summarizeNights(REAL_NIGHTS, TZ);
    const v = detectDrift(s, LEGACY_BANDS);
    expect(v.kind).toBe("shift");
    if (v.kind !== "shift") return;
    expect(v.shiftHours).toBe(2);
    const byPhase = Object.fromEntries(v.proposal.map((p) => [p.phase, p]));
    expect(byPhase.MORNING.toStartHour).toBe(9);
    expect(byPhase.NIGHT.toStartHour).toBe(3);
    // Widths are preserved exactly — only the anchor moves.
    for (const p of v.proposal) {
      const wasWidth = wrap24(p.fromEndHour - p.fromStartHour);
      const nowWidth = wrap24(p.toEndHour - p.toStartHour);
      expect(nowWidth).toBe(wasWidth);
    }
  });

  it("reports aligned once the bands have been realigned", () => {
    const realigned: PhaseBand[] = [
      { id: "m", phase: "MORNING", startHour: 9, endHour: 13 },
      { id: "a", phase: "AFTERNOON", startHour: 13, endHour: 20 },
      { id: "e", phase: "EVENING", startHour: 20, endHour: 3 },
      { id: "n", phase: "NIGHT", startHour: 3, endHour: 9 },
    ];
    const v = detectDrift(summarizeNights(REAL_NIGHTS, TZ), realigned);
    expect(v.kind).toBe("aligned");
  });

  it("calls it a stretch when the sleep window changes length", () => {
    // Wake holds at 09:xx while onset slides two hours later: the window got
    // shorter. No single translation expresses that, so nothing is proposed.
    const bands: PhaseBand[] = [
      { id: "m", phase: "MORNING", startHour: 9, endHour: 13 },
      { id: "a", phase: "AFTERNOON", startHour: 13, endHour: 20 },
      { id: "e", phase: "EVENING", startHour: 20, endHour: 6 },
      { id: "n", phase: "NIGHT", startHour: 6, endHour: 9 },
    ];
    const v = detectDrift(summarizeNights(REAL_NIGHTS, TZ), bands);
    expect(v.kind).toBe("stretch");
    if (v.kind !== "stretch") return;
    expect(v.detail).toContain("changed length");
  });

  it("does not fire on sub-threshold drift", () => {
    // 30 minutes of drift is below the 45-minute threshold and below the
    // 1-hour resolution of the bands themselves.
    const s = summarizeNights(REAL_NIGHTS, TZ);
    const nudged: PhaseBand[] = LEGACY_BANDS.map((b) => ({
      ...b,
      startHour: wrap24(b.startHour + 2),
      endHour: wrap24(b.endHour + 2),
    }));
    const v = detectDrift(s, nudged);
    expect(v.kind).toBe("aligned");
  });

  it("honours a custom threshold", () => {
    const s = summarizeNights(REAL_NIGHTS, TZ);
    const v = detectDrift(s, LEGACY_BANDS, { thresholdMinutes: 240 });
    expect(v.kind).toBe("aligned");
  });
});

describe("shiftBands", () => {
  it("wraps around midnight rather than producing hour 25", () => {
    const shifted = shiftBands(
      [{ id: "e", phase: "EVENING", startHour: 20, endHour: 3 }],
      6,
    );
    expect(shifted[0].toStartHour).toBe(2);
    expect(shifted[0].toEndHour).toBe(9);
  });
});
