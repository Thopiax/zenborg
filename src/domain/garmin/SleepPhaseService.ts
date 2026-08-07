/**
 * SleepPhaseService — derive proposed phase boundaries from observed sleep.
 *
 * `phaseConfigs.json` holds four bands with integer `startHour`/`endHour`.
 * They were authored assuming a 07:00 wake. Measured sleep says otherwise:
 * an ~8h, high-quality night that is **phase-shifted, not deprived**. Bands
 * that assume a wake you no longer have put MORNING moments in the dark.
 *
 * ## It proposes; it does not apply
 *
 * Silently mutating phase boundaries would make the garden non-reproducible,
 * and is precisely the wrong behaviour for a tool whose whole point is the
 * user's sovereignty over their own attention. Everything here returns a
 * *proposal*. Writing is a separate, explicitly-flagged act at the edge.
 *
 * ## Sleep tells you where the day starts and ends — not how to carve up the middle
 *
 * Only two of the eight boundaries are sleep-determined:
 *
 *   MORNING.startHour  ↔  when you wake   (the day opens)
 *   NIGHT.startHour    ↔  when you fall asleep (the day closes)
 *
 * The AFTERNOON and EVENING boundaries are lifestyle choices. Garmin has no
 * opinion about them and neither does this service. So a proposal is always a
 * **rigid translation** of all four bands by one delta — it preserves the band
 * *widths*, which encode the user's preference, and moves only the anchor,
 * which encodes their physiology.
 *
 * Pure. No filesystem, no network, no clock — `now` is never read.
 */

/** One night, as returned by `mcp__garmin__get_sleep_summary`.
 * `sleep_start` / `sleep_end` are epoch milliseconds. Nights with no data come
 * back as `{}` from that endpoint and must be tolerated, not treated as zero. */
export interface SleepNight {
  readonly sleep_start?: number;
  readonly sleep_end?: number;
  readonly sleep_score?: number;
  readonly sleep_hours?: number;
}

/** A band as stored in `phaseConfigs.json`. Extra fields are preserved by the
 * writer at the edge; the service reasons about these three only. */
export interface PhaseBand {
  readonly id: string;
  readonly phase: "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
  readonly startHour: number;
  readonly endHour: number;
}

export const DEFAULT_DRIFT_THRESHOLD_MINUTES = 45;
export const DEFAULT_MIN_NIGHTS = 7;
export const DEFAULT_WINDOW_NIGHTS = 21;

const HOURS_PER_DAY = 24;

/** Local clock-hour (0–24, fractional) for an epoch-ms instant.
 *
 * Phase boundaries are *local* hours — the vault stores UTC and computes local
 * at render, so the comparison has to happen in the user's own clock. Uses the
 * host timezone unless one is named.
 */
export function localHourOf(epochMs: number, timeZone?: string): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(timeZone !== undefined ? { timeZone } : {}),
  });
  const parts = fmt.formatToParts(new Date(epochMs));
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? "0");
  // "24" is a legal en-GB rendering of midnight; fold it back to 0.
  return (get("hour") % 24) + get("minute") / 60 + get("second") / 3600;
}

export function wrap24(hour: number): number {
  return ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
}

/** Shortest signed distance from `a` to `b` around the clock, in (-12, 12]. */
export function circularDelta(a: number, b: number): number {
  const raw = wrap24(b - a);
  return raw > HOURS_PER_DAY / 2 ? raw - HOURS_PER_DAY : raw;
}

function linearMedian(sorted: readonly number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median of clock-hours, done on the circle.
 *
 * A plain median is wrong here and quietly so. Sleep onset straddles midnight
 * — this dataset contains both 23:53 and 05:44 — and averaging those linearly
 * lands near noon. The fix is to find the rotation of the clock under which
 * the samples are least dispersed, take the ordinary median in that frame, and
 * rotate back.
 *
 * Rotations are tried at each sample (the L1-optimal cut can always be placed
 * there), and the winner minimises total absolute deviation. n is nights, so
 * the O(n²) scan is free. Unlike a hardcoded "cut the day at 18:00" anchor,
 * this keeps working if the user's schedule shifts further.
 */
export function circularMedianHours(hours: readonly number[]): number {
  if (hours.length === 0) return Number.NaN;
  if (hours.length === 1) return wrap24(hours[0]);

  let bestCost = Number.POSITIVE_INFINITY;
  let bestValue = wrap24(hours[0]);
  for (const anchor of hours) {
    const unwrapped = hours
      .map((h) => wrap24(h - anchor))
      .sort((x, y) => x - y);
    const median = linearMedian(unwrapped);
    const cost = unwrapped.reduce((sum, u) => sum + Math.abs(u - median), 0);
    if (cost < bestCost - 1e-9) {
      bestCost = cost;
      bestValue = wrap24(median + anchor);
    }
  }
  return bestValue;
}

export interface SleepSummary {
  readonly nightsUsed: number;
  readonly nightsMissing: number;
  /** Circular median local hour of falling asleep. NaN when no nights. */
  readonly medianOnsetHour: number;
  /** Circular median local hour of waking. NaN when no nights. */
  readonly medianWakeHour: number;
  readonly medianSleepHours: number;
}

export function summarizeNights(
  nights: readonly SleepNight[],
  timeZone?: string,
): SleepSummary {
  // Narrowed to a shape where both instants are present, so the rest of this
  // function needs no assertions: a night without both is not a night.
  const usable = nights.filter(
    (n): n is SleepNight & { sleep_start: number; sleep_end: number } =>
      typeof n.sleep_start === "number" && typeof n.sleep_end === "number",
  );
  const onsets = usable.map((n) => localHourOf(n.sleep_start, timeZone));
  const wakes = usable.map((n) => localHourOf(n.sleep_end, timeZone));
  const durations = usable
    .map((n) => (n.sleep_end - n.sleep_start) / 3_600_000)
    .sort((a, b) => a - b);

  return {
    nightsUsed: usable.length,
    nightsMissing: nights.length - usable.length,
    medianOnsetHour: circularMedianHours(onsets),
    medianWakeHour: circularMedianHours(wakes),
    medianSleepHours:
      durations.length > 0 ? linearMedian(durations) : Number.NaN,
  };
}

/**
 * Round the two anchors *outward* from the waking day.
 *
 * Bands are integer hours, so both medians must be rounded, and the direction
 * is a real choice. Rounding outward (wake down, onset up) can only ever make
 * the waking day longer than observed. That is the harmless direction: an
 * empty band costs nothing, whereas a band that opens after you are up — or
 * closes before you are down — leaves a moment with nowhere to go.
 */
export function anchorsFrom(summary: SleepSummary): {
  wakeAnchor: number;
  onsetAnchor: number;
} {
  return {
    wakeAnchor: wrap24(Math.floor(summary.medianWakeHour)),
    onsetAnchor: wrap24(Math.ceil(summary.medianOnsetHour)),
  };
}

export type DriftVerdict =
  /** Not enough nights to say anything. */
  | {
      readonly kind: "insufficient-data";
      readonly nightsUsed: number;
      readonly minNights: number;
    }
  /** Both anchors inside threshold — the bands still fit. */
  | {
      readonly kind: "aligned";
      readonly wakeDriftMinutes: number;
      readonly onsetDriftMinutes: number;
    }
  /** Both anchors moved together — a clean phase shift. Proposal attached. */
  | {
      readonly kind: "shift";
      readonly wakeDriftMinutes: number;
      readonly onsetDriftMinutes: number;
      readonly shiftHours: number;
      readonly proposal: readonly ProposedBand[];
    }
  /** Anchors moved by different amounts: the sleep *window* changed length,
   *  not just its position. A rigid shift cannot express that, and inventing
   *  band widths is not this service's job. Reported, never auto-resolved. */
  | {
      readonly kind: "stretch";
      readonly wakeDriftMinutes: number;
      readonly onsetDriftMinutes: number;
      readonly detail: string;
    };

export interface ProposedBand {
  readonly id: string;
  readonly phase: PhaseBand["phase"];
  readonly fromStartHour: number;
  readonly fromEndHour: number;
  readonly toStartHour: number;
  readonly toEndHour: number;
}

export interface DriftOptions {
  readonly thresholdMinutes?: number;
  readonly minNights?: number;
}

/**
 * Compare observed sleep against the current bands.
 *
 * ### The 45-minute threshold
 *
 * - Bands are **integer hours**, so drift under 30 min cannot be expressed at
 *   all. A lower threshold would emit proposals that round to no change.
 * - It must sit above the sampling noise of the median. With the observed
 *   night-to-night spread (IQR ≈ 2h, so σ ≈ 1.5h) over ~11 nights, the standard
 *   error of a median is ≈ 1.25·σ/√n ≈ 34 min. At 45 min a trigger is more
 *   likely a real shift than a run of late nights.
 * - It must stay below the ~60 min quantum that actually moves a boundary, or
 *   the tool would only ever fire after the misalignment was already a full
 *   band-hour wide.
 *
 * 45 min is the window between those two constraints: above the noise floor of
 * the estimate, below the resolution of the thing being estimated.
 */
export function detectDrift(
  summary: SleepSummary,
  bands: readonly PhaseBand[],
  options: DriftOptions = {},
): DriftVerdict {
  const thresholdMinutes =
    options.thresholdMinutes ?? DEFAULT_DRIFT_THRESHOLD_MINUTES;
  const minNights = options.minNights ?? DEFAULT_MIN_NIGHTS;

  if (summary.nightsUsed < minNights) {
    return {
      kind: "insufficient-data",
      nightsUsed: summary.nightsUsed,
      minNights,
    };
  }

  const morning = bands.find((b) => b.phase === "MORNING");
  const night = bands.find((b) => b.phase === "NIGHT");
  if (morning === undefined || night === undefined) {
    return {
      kind: "stretch",
      wakeDriftMinutes: 0,
      onsetDriftMinutes: 0,
      detail:
        "phaseConfigs is missing a MORNING or NIGHT band; nothing to anchor against",
    };
  }

  const { wakeAnchor, onsetAnchor } = anchorsFrom(summary);
  const wakeDrift = circularDelta(morning.startHour, wakeAnchor);
  const onsetDrift = circularDelta(night.startHour, onsetAnchor);
  const wakeDriftMinutes = Math.round(wakeDrift * 60);
  const onsetDriftMinutes = Math.round(onsetDrift * 60);

  if (
    Math.abs(wakeDriftMinutes) < thresholdMinutes &&
    Math.abs(onsetDriftMinutes) < thresholdMinutes
  ) {
    return { kind: "aligned", wakeDriftMinutes, onsetDriftMinutes };
  }

  if (Math.abs(wakeDriftMinutes - onsetDriftMinutes) > thresholdMinutes) {
    return {
      kind: "stretch",
      wakeDriftMinutes,
      onsetDriftMinutes,
      detail:
        `wake moved ${formatMinutes(wakeDriftMinutes)} but sleep onset moved ` +
        `${formatMinutes(onsetDriftMinutes)} — the sleep window changed length, ` +
        `not just its position. A rigid shift cannot express that; choose the ` +
        `band widths yourself.`,
    };
  }

  const shiftHours = Math.round((wakeDrift + onsetDrift) / 2);
  if (shiftHours === 0) {
    return { kind: "aligned", wakeDriftMinutes, onsetDriftMinutes };
  }

  return {
    kind: "shift",
    wakeDriftMinutes,
    onsetDriftMinutes,
    shiftHours,
    proposal: shiftBands(bands, shiftHours),
  };
}

/** Translate every band by the same whole number of hours. Widths are
 * preserved exactly — that is the point. */
export function shiftBands(
  bands: readonly PhaseBand[],
  shiftHours: number,
): readonly ProposedBand[] {
  return bands.map((b) => ({
    id: b.id,
    phase: b.phase,
    fromStartHour: b.startHour,
    fromEndHour: b.endHour,
    toStartHour: wrap24(b.startHour + shiftHours),
    toEndHour: wrap24(b.endHour + shiftHours),
  }));
}

export function formatMinutes(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${sign}${h}h${String(m).padStart(2, "0")}` : `${sign}${m}min`;
}

/** Render a fractional hour as HH:MM, for reports. */
export function formatHour(hour: number): string {
  if (Number.isNaN(hour)) return "--:--";
  const wrapped = wrap24(hour);
  const h = Math.floor(wrapped);
  const m = Math.round((wrapped - h) * 60);
  return m === 60
    ? `${String(wrap24(h + 1)).padStart(2, "0")}:00`
    : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
