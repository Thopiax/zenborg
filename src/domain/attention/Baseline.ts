/**
 * When migration step 2 is finished.
 *
 * Step 2 is the step the spec calls the one to protect, and the only one whose
 * exit criterion is a measurement rather than a decision: it ends when the
 * discrepancy series is stable, not when it has gone on long enough to feel
 * sufficient. Stable means two things at once, and the second is the one people
 * skip. Enough observations to cut magnitude from data rather than guess it,
 * *and* no visible trend across the final fortnight. The taxonomy's roughly
 * twenty-one days is the data-sufficiency floor, not the criterion; a series
 * still trending on day 21 is not a baseline.
 *
 * A series that never stabilises is a finding rather than a delay. It says the
 * modelled signal is not the real one, which is the spec's third falsifier.
 *
 * Pure, and deliberately not a service: it reads a series of counts and returns
 * a verdict, with no history lookup and no judgment about a person.
 */

/** One day's discrepancy count. `day` is a local calendar date, `YYYY-MM-DD`. */
export interface DailyCount {
  readonly day: string;
  readonly count: number;
}

export interface BaselineConfig {
  /** Observations needed before the trend question is even asked. */
  readonly floorDays: number;
  /** How much of the tail the trend is read off. */
  readonly trendDays: number;
  /**
   * How much total drift across the trend window still counts as flat,
   * as a fraction of that window's mean rate.
   *
   * A parameter rather than a constant on purpose. It is a cut, and the spec is
   * emphatic that cuts belong in the open where they can be argued with. The
   * default says: a fortnight that ends within a tenth of where it started is
   * not trending. Nothing downstream depends on the number; raising it ends
   * step 2 sooner and lowers the confidence the baseline was earned.
   */
  readonly tolerance: number;
}

export const DEFAULT_BASELINE_CONFIG: BaselineConfig = Object.freeze({
  floorDays: 21,
  trendDays: 14,
  tolerance: 0.1,
});

interface BaselineMeasurement {
  /** Distinct days observed. */
  readonly observedDays: number;
  /** Least-squares slope over the trend window, in discrepancies per day. */
  readonly slopePerDay: number;
  /** What that slope implies across the whole trend window. */
  readonly driftAcrossWindow: number;
  /** The drift the tolerance admits, in the same units. */
  readonly tolerated: number;
}

export type BaselineVerdict = BaselineMeasurement &
  (
    | { readonly stable: true }
    | {
        readonly stable: false;
        readonly reason: "insufficient_days" | "still_trending";
      }
  );

/** Latest wins on a repeated day, so a re-run of one day corrects rather than doubles. */
function byDay(series: readonly DailyCount[]): DailyCount[] {
  const collapsed = new Map<string, number>();
  for (const entry of series) {
    collapsed.set(entry.day, entry.count);
  }
  return [...collapsed]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** Ordinary least squares against the day index. Zero for fewer than two points. */
function slopeOf(counts: readonly number[]): number {
  const n = counts.length;
  if (n < 2) return 0;

  const meanIndex = (n - 1) / 2;
  const meanCount = counts.reduce((sum, c) => sum + c, 0) / n;

  let covariance = 0;
  let variance = 0;
  for (const [index, count] of counts.entries()) {
    const dx = index - meanIndex;
    covariance += dx * (count - meanCount);
    variance += dx * dx;
  }

  return variance === 0 ? 0 : covariance / variance;
}

/**
 * Read a discrepancy series and say whether step 2 can close.
 *
 * Fail soft: an empty or short series is `insufficient_days`, never an error.
 */
export function assessBaseline(
  series: readonly DailyCount[],
  config: Partial<BaselineConfig> = {},
): BaselineVerdict {
  const { floorDays, trendDays, tolerance } = {
    ...DEFAULT_BASELINE_CONFIG,
    ...config,
  };

  const days = byDay(series);
  const observedDays = days.length;

  const window = days.slice(-trendDays);
  const counts = window.map((d) => d.count);
  const slopePerDay = slopeOf(counts);
  const intervals = Math.max(0, counts.length - 1);
  const driftAcrossWindow = Math.abs(slopePerDay) * intervals;

  const mean =
    counts.length === 0
      ? 0
      : counts.reduce((sum, c) => sum + c, 0) / counts.length;
  const tolerated = Math.abs(mean) * tolerance;

  const measurement: BaselineMeasurement = {
    observedDays,
    slopePerDay,
    driftAcrossWindow,
    tolerated,
  };

  if (observedDays < floorDays) {
    return { ...measurement, stable: false, reason: "insufficient_days" };
  }

  if (driftAcrossWindow > tolerated) {
    return { ...measurement, stable: false, reason: "still_trending" };
  }

  return { ...measurement, stable: true };
}
