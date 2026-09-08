import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import type { ThirstScore } from "./ThirstService";
import { routeOracle, type OracleAction } from "./OracleRouter";

/**
 * A time block on the day's timeline — either a calendar event or a planted moment.
 */
export interface TimeBlock {
  readonly startMin: number; // minutes from midnight
  readonly endMin: number;
  readonly label: string;
}

/**
 * A gap the forecast engine found between time blocks.
 */
interface DetectedGap {
  readonly startMin: number;
  readonly endMin: number;
  readonly durationMin: number;
}

/**
 * A proposed gap fill — what the calendar would show as a tentative event.
 */
export interface GapFill {
  readonly habitId: string;
  readonly habitName: string;
  readonly startTime: string; // "HH:MM"
  readonly durationMin: number;
  readonly gapType: "forecast";
  readonly action: OracleAction;
  readonly thirst: number;
}

/**
 * Find gaps between time blocks on a day's timeline.
 *
 * Operates on a flat list of occupied blocks. Returns gaps ≥ minGapMin
 * between the day's start and end hours.
 */
export function findGaps(
  blocks: readonly TimeBlock[],
  dayStartMin: number = 7 * 60,
  dayEndMin: number = 22 * 60,
  minGapMin: number = 5,
): readonly DetectedGap[] {
  const sorted = [...blocks]
    .filter((b) => b.endMin > dayStartMin && b.startMin < dayEndMin)
    .sort((a, b) => a.startMin - b.startMin);

  const gaps: DetectedGap[] = [];
  let cursor = dayStartMin;

  for (const block of sorted) {
    const gapStart = Math.max(cursor, dayStartMin);
    const gapEnd = Math.min(block.startMin, dayEndMin);
    if (gapEnd - gapStart >= minGapMin) {
      gaps.push({ startMin: gapStart, endMin: gapEnd, durationMin: gapEnd - gapStart });
    }
    cursor = Math.max(cursor, block.endMin);
  }

  // Trailing gap after last block
  const trailingStart = Math.max(cursor, dayStartMin);
  if (dayEndMin - trailingStart >= minGapMin) {
    gaps.push({
      startMin: trailingStart,
      endMin: dayEndMin,
      durationMin: dayEndMin - trailingStart,
    });
  }

  return gaps;
}

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Forecast gap fills for the day.
 *
 * Takes today's time blocks (calendar + moments), thirst-ranked gap habits,
 * and returns one proposal per detected gap, thirstiest habit that fits.
 */
export function forecastGaps(
  blocks: readonly TimeBlock[],
  rankedHabits: ReadonlyArray<{ habit: Habit; thirst: ThirstScore }>,
  opts?: { dayStartMin?: number; dayEndMin?: number; minGapMin?: number },
): readonly GapFill[] {
  const gaps = findGaps(
    blocks,
    opts?.dayStartMin,
    opts?.dayEndMin,
    opts?.minGapMin,
  );

  const used = new Set<string>();
  const fills: GapFill[] = [];

  for (const gap of gaps) {
    const gapMs = gap.durationMin * 60_000;
    const match = rankedHabits.find(({ habit }) => {
      if (used.has(habit.id)) return false;
      if (habit.isArchived) return false;
      const dur = habit.durationMin;
      if (dur && dur > gap.durationMin) return false;
      return true;
    });
    if (!match) continue;

    used.add(match.habit.id);
    fills.push({
      habitId: match.habit.id,
      habitName: match.habit.name,
      startTime: minToHHMM(gap.startMin),
      durationMin: match.habit.durationMin ?? Math.min(gap.durationMin, 15),
      gapType: "forecast",
      action: routeOracle(match.habit),
      thirst: match.thirst.score,
    });
  }

  return fills;
}

/**
 * Convert planted moments for a day into TimeBlocks.
 */
export function momentsToBlocks(moments: readonly Moment[]): readonly TimeBlock[] {
  const blocks: TimeBlock[] = [];
  for (const m of moments) {
    if (!m.startTime || !m.durationMin) continue;
    const [h, min] = m.startTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(min)) continue;
    const startMin = h * 60 + min;
    blocks.push({ startMin, endMin: startMin + m.durationMin, label: m.name });
  }
  return blocks;
}
