import type { Area } from "@/domain/entities/Area";
import type { Cycle } from "@/domain/entities/Cycle";
import type { Moment } from "@/domain/entities/Moment";
import { Phase, type PhaseConfig, getVisiblePhases } from "@/domain/value-objects/Phase";

export type HeatmapTense = "past" | "active" | "future";
export type HeatmapCellState = "planted" | "fallow" | "unplanted";

export interface HeatmapCell {
  areaId: string | null;
  state: HeatmapCellState;
  tense: HeatmapTense;
}

export interface HeatmapDay {
  date: string;
  cycleId: string | null;
  tense: HeatmapTense;
  cells: Record<Phase, HeatmapCell>;
}

export interface HeatmapBand {
  cycleId: string;
  name: string;
  startIndex: number;
  endIndex: number;
  tense: HeatmapTense;
}

export interface HeatmapSegment {
  startIndex: number;
  endIndex: number;
  band: HeatmapBand | null;
}

export interface HeatmapViewModel {
  days: HeatmapDay[];
  bands: HeatmapBand[];
  segments: HeatmapSegment[];
  rows: Phase[];
  todayIndex: number;
}

export interface DeriveInput {
  cycles: Cycle[];
  moments: Moment[];
  areas: Area[];
  phaseConfigs: PhaseConfig[];
  today: string;
}

const MS_PER_DAY = 86_400_000;

function toUtc(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10))
  );
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const startMs = toUtc(start);
  const endMs = toUtc(end);
  for (let ms = startMs; ms <= endMs; ms += MS_PER_DAY) {
    out.push(fromUtc(ms));
  }
  return out;
}

function tenseOf(date: string, today: string): HeatmapTense {
  if (date < today) return "past";
  if (date === today) return "active";
  return "future";
}

function effectiveEnd(cycle: Cycle, today: string): string {
  if (cycle.endDate) return cycle.endDate;
  return today >= cycle.startDate ? today : cycle.startDate;
}

function findCycleForDate(
  date: string,
  cycles: Cycle[],
  today: string
): Cycle | null {
  for (const cycle of cycles) {
    if (date >= cycle.startDate && date <= effectiveEnd(cycle, today)) {
      return cycle;
    }
  }
  return null;
}

function dominantAreaId(
  moments: Moment[]
): string | null {
  if (moments.length === 0) return null;

  const tally = new Map<string, { count: number; lastUpdatedAt: string }>();
  for (const m of moments) {
    const prev = tally.get(m.areaId);
    if (!prev) {
      tally.set(m.areaId, { count: 1, lastUpdatedAt: m.updatedAt });
    } else {
      prev.count += 1;
      if (m.updatedAt > prev.lastUpdatedAt) prev.lastUpdatedAt = m.updatedAt;
    }
  }

  let bestId: string | null = null;
  let bestCount = -1;
  let bestUpdatedAt = "";
  for (const [areaId, entry] of tally) {
    if (
      entry.count > bestCount ||
      (entry.count === bestCount && entry.lastUpdatedAt > bestUpdatedAt)
    ) {
      bestId = areaId;
      bestCount = entry.count;
      bestUpdatedAt = entry.lastUpdatedAt;
    }
  }
  return bestId;
}

function buildCell(
  date: string,
  phase: Phase,
  moments: Moment[],
  today: string
): HeatmapCell {
  const tense = tenseOf(date, today);
  const matches = moments.filter(
    (m) => m.day === date && m.phase === phase
  );

  if (matches.length === 0) {
    return {
      areaId: null,
      state: tense === "future" ? "unplanted" : "fallow",
      tense,
    };
  }

  return {
    areaId: dominantAreaId(matches),
    state: "planted",
    tense,
  };
}

function buildBands(days: HeatmapDay[], cycles: Cycle[]): HeatmapBand[] {
  const cycleById = new Map(cycles.map((c) => [c.id, c]));
  const bands: HeatmapBand[] = [];

  let runStart = -1;
  let runCycleId: string | null = null;

  const flush = (endIndex: number) => {
    if (runCycleId === null || runStart < 0) return;
    const cycle = cycleById.get(runCycleId);
    if (!cycle) return;
    const startTense = days[runStart].tense;
    const endTense = days[endIndex].tense;
    const tense: HeatmapTense =
      startTense === "future"
        ? "future"
        : endTense === "past"
          ? "past"
          : "active";
    bands.push({
      cycleId: runCycleId,
      name: cycle.name,
      startIndex: runStart,
      endIndex,
      tense,
    });
  };

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day.cycleId !== runCycleId) {
      flush(i - 1);
      runStart = i;
      runCycleId = day.cycleId;
    }
  }
  flush(days.length - 1);

  return bands;
}

function determineRange(
  cycles: Cycle[],
  today: string
): { start: string; end: string } {
  if (cycles.length === 0) {
    return { start: today, end: today };
  }
  let start = cycles[0].startDate;
  let end = effectiveEnd(cycles[0], today);
  for (const c of cycles) {
    if (c.startDate < start) start = c.startDate;
    const cEnd = effectiveEnd(c, today);
    if (cEnd > end) end = cEnd;
  }
  if (today < start) start = today;
  if (today > end) end = today;
  return { start, end };
}

export function deriveBandedHeatmapViewModel(
  input: DeriveInput
): HeatmapViewModel {
  const { cycles, moments, phaseConfigs, today } = input;

  const rows = getVisiblePhases(phaseConfigs).map((p) => p.phase);
  const { start, end } = determineRange(cycles, today);
  const dateList = eachDay(start, end);

  const days: HeatmapDay[] = dateList.map((date) => {
    const cycle = findCycleForDate(date, cycles, today);
    const cells = {} as Record<Phase, HeatmapCell>;
    for (const phase of rows) {
      cells[phase] = buildCell(date, phase, moments, today);
    }
    return {
      date,
      cycleId: cycle?.id ?? null,
      tense: tenseOf(date, today),
      cells,
    };
  });

  const todayIndex = dateList.indexOf(today);
  const bands = buildBands(days, cycles);
  const segments = buildSegments(days, bands);

  return { days, bands, segments, rows, todayIndex };
}

function buildSegments(
  days: HeatmapDay[],
  bands: HeatmapBand[]
): HeatmapSegment[] {
  const bandByCycleId = new Map(bands.map((b) => [b.cycleId, b]));
  const out: HeatmapSegment[] = [];
  let runStart = 0;
  let runCycleId: string | null = days[0]?.cycleId ?? null;

  const flush = (endIndex: number) => {
    out.push({
      startIndex: runStart,
      endIndex,
      band: runCycleId ? bandByCycleId.get(runCycleId) ?? null : null,
    });
  };

  for (let i = 1; i < days.length; i++) {
    if (days[i].cycleId !== runCycleId) {
      flush(i - 1);
      runStart = i;
      runCycleId = days[i].cycleId;
    }
  }
  if (days.length > 0) flush(days.length - 1);

  return out;
}
