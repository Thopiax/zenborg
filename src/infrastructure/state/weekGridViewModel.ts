import type { Moment } from "@zenborg/core/domain/entities/Moment";
import {
  getVisiblePhases,
  type PhaseConfig,
} from "@zenborg/core/domain/value-objects/Phase";
import { CALENDAR_GRID_MINUTES } from "@zenborg/core/domain/value-objects/TimeGrid.ts";

export interface WeekGridBlock {
  readonly momentId: string;
  readonly name: string;
  readonly areaId: string;
  readonly startTime: string;
  readonly durationMin: number;
  readonly gridRowStart: number;
  readonly gridRowSpan: number;
  readonly tentative: boolean;
}

export interface WeekGridDay {
  readonly date: string;
  readonly isToday: boolean;
  readonly blocks: readonly WeekGridBlock[];
  readonly ambient: readonly Moment[];
}

export interface WeekGridViewModel {
  readonly days: readonly WeekGridDay[];
  readonly startHour: number;
  readonly endHour: number;
  readonly hours: readonly number[];
  readonly rowsPerHour: number;
  readonly totalRows: number;
}

const MS_PER_DAY = 86_400_000;
const AMBIENT_LANE_ROWS = 1;

function toUtc(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeBounds(phaseConfigs: readonly PhaseConfig[]): {
  startHour: number;
  endHour: number;
} {
  const visible = getVisiblePhases(phaseConfigs as PhaseConfig[]);
  if (visible.length === 0) return { startHour: 0, endHour: 24 };

  let startHour = 24;
  let endHour = 0;

  for (const config of visible) {
    if (config.startHour < startHour) startHour = config.startHour;
    if (config.endHour <= config.startHour) {
      endHour = 24;
    } else if (config.endHour > endHour) {
      endHour = config.endHour;
    }
  }

  return { startHour, endHour };
}

function parseStartTime(startTime: string): number {
  const [h, m] = startTime.split(":").map(Number);
  return h * 60 + m;
}

export function deriveWeekGridViewModel(input: {
  moments: readonly Moment[];
  phaseConfigs: readonly PhaseConfig[];
  weekStart: string;
  today: string;
}): WeekGridViewModel {
  const { moments, phaseConfigs, weekStart, today } = input;
  const { startHour, endHour } = computeBounds(phaseConfigs);

  const rowsPerHour = 60 / CALENDAR_GRID_MINUTES;
  const totalRows = (endHour - startHour) * rowsPerHour;

  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push(h);
  }

  // Generate seven days from weekStart
  const weekStartMs = toUtc(weekStart);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(fromUtc(weekStartMs + i * MS_PER_DAY));
  }

  // Bucket moments by date
  const momentsByDate = new Map<string, Moment[]>();
  for (const m of moments) {
    if (m.day === null) continue;
    if (!dates.includes(m.day)) continue;
    const bucket = momentsByDate.get(m.day) ?? [];
    bucket.push(m);
    momentsByDate.set(m.day, bucket);
  }

  const days: WeekGridDay[] = dates.map((date) => {
    const dayMoments = momentsByDate.get(date) ?? [];
    const blocks: WeekGridBlock[] = [];
    const ambient: Moment[] = [];

    for (const m of dayMoments) {
      if (!m.startTime) {
        ambient.push(m);
        continue;
      }

      const startMinutes = parseStartTime(m.startTime);
      const durationMin = m.durationMin ?? 60;

      const offsetMin = startMinutes - startHour * 60;
      const gridRowStart =
        clamp(Math.floor(offsetMin / CALENDAR_GRID_MINUTES), 0, totalRows - 1) +
        1 +
        AMBIENT_LANE_ROWS;
      const gridRowSpan = clamp(
        Math.ceil(durationMin / CALENDAR_GRID_MINUTES),
        1,
        totalRows + 1 + AMBIENT_LANE_ROWS - gridRowStart,
      );

      blocks.push({
        momentId: m.id,
        name: m.name,
        areaId: m.areaId,
        startTime: m.startTime,
        durationMin,
        gridRowStart,
        gridRowSpan,
        tentative: m.status === "tentative",
      });
    }

    blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Sort ambient by phase order then moment order
    const phaseOrder = new Map(
      (phaseConfigs as PhaseConfig[]).map((c) => [c.phase, c.order]),
    );
    ambient.sort((a, b) => {
      const pa = a.phase ? (phaseOrder.get(a.phase) ?? 99) : 99;
      const pb = b.phase ? (phaseOrder.get(b.phase) ?? 99) : 99;
      if (pa !== pb) return pa - pb;
      return a.order - b.order;
    });

    return {
      date,
      isToday: date === today,
      blocks,
      ambient,
    };
  });

  return {
    days,
    startHour,
    endHour,
    hours,
    rowsPerHour,
    totalRows,
  };
}
