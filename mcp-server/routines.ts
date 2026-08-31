import type { Habit, Moment, Phase, Routine, RoutineEntry } from "./vault.js";

const PHASE_ORDER: readonly Phase[] = [
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "NIGHT",
];

function phaseIndex(p: Phase): number {
  return PHASE_ORDER.indexOf(p);
}

export function isAdjacentBoundary(from: Phase, to: Phase): boolean {
  const fi = phaseIndex(from);
  const ti = phaseIndex(to);
  return (fi + 1) % PHASE_ORDER.length === ti;
}

export function boundaryKey(r: { from: Phase; to: Phase }): string {
  return `${r.from}->${r.to}`;
}

export const VALID_BOUNDARIES = PHASE_ORDER.map((p, i) =>
  boundaryKey({ from: p, to: PHASE_ORDER[(i + 1) % PHASE_ORDER.length] }),
);

export function validateRoutine(
  input: { from: Phase; to: Phase; entries: RoutineEntry[] },
  habits: Record<string, Habit>,
  existingRoutines: Record<string, Routine>,
  excludeId?: string,
): string[] {
  const problems: string[] = [];

  if (!isAdjacentBoundary(input.from, input.to)) {
    problems.push(
      `${input.from}->${input.to} is not an adjacent boundary. Valid: ${VALID_BOUNDARIES.join(", ")}`,
    );
  }

  const key = boundaryKey(input);
  for (const r of Object.values(existingRoutines)) {
    if (r.id !== excludeId && boundaryKey(r) === key) {
      problems.push(
        `Boundary ${key} already has a routine: "${r.name}" (${r.id})`,
      );
    }
  }

  const seenOrders = new Set<number>();
  for (const entry of input.entries) {
    const habit = habits[entry.habitId];
    if (!habit) {
      problems.push(`Habit not found: ${entry.habitId}`);
    } else if (habit.isArchived) {
      problems.push(`Habit "${habit.name}" (${entry.habitId}) is archived`);
    }
    if (seenOrders.has(entry.order)) {
      problems.push(`Duplicate order: ${entry.order}`);
    }
    seenOrders.add(entry.order);
  }

  return problems;
}

export interface PlannedEntry {
  readonly habitId: string;
  readonly phase: Phase;
  readonly order: number;
}

export function planMaterialization(
  routine: Routine,
  existingMoments: Record<string, Moment>,
  habits: Record<string, Habit>,
  day: string,
): PlannedEntry[] {
  const targetPhase = routine.to;
  const sorted = [...routine.entries].sort((a, b) => a.order - b.order);
  const planned: PlannedEntry[] = [];

  for (const entry of sorted) {
    const habit = habits[entry.habitId];
    if (!habit || habit.isArchived) continue;

    const alreadyPlanted = Object.values(existingMoments).some(
      (m) =>
        m.habitId === entry.habitId &&
        m.day === day &&
        m.phase === targetPhase,
    );
    if (alreadyPlanted) continue;

    planned.push({
      habitId: entry.habitId,
      phase: targetPhase,
      order: entry.order,
    });
  }

  return planned;
}

export interface ResolvedBoundary {
  readonly from: Phase;
  readonly to: Phase;
  readonly hour: number;
}

export function resolveBoundaries(
  phaseConfigs: readonly {
    phase: Phase;
    startHour: number;
    order: number;
  }[],
  sleepAnchors?: { wakeAnchor: number; onsetAnchor: number },
): ResolvedBoundary[] {
  const sorted = [...phaseConfigs].sort((a, b) => a.order - b.order);

  return sorted.map((from, i) => {
    const to = sorted[(i + 1) % sorted.length];
    let hour = to.startHour;

    if (sleepAnchors) {
      if (from.phase === "NIGHT" && to.phase === "MORNING") {
        hour = sleepAnchors.wakeAnchor;
      } else if (from.phase === "EVENING" && to.phase === "NIGHT") {
        hour = sleepAnchors.onsetAnchor;
      }
    }

    return { from: from.phase, to: to.phase, hour };
  });
}

function wrap24(h: number): number {
  return ((h % 24) + 24) % 24;
}

export interface BoundaryWindow {
  readonly boundary: string;
  readonly fromHour: number;
  readonly toHour: number;
}

/** Derive ScheduleSpec-compatible time windows around each phase boundary.
 * Default margin: 30 min before, 60 min after the transition hour. */
export function deriveBoundaryWindows(
  boundaries: readonly ResolvedBoundary[],
  options?: { beforeMinutes?: number; afterMinutes?: number },
): BoundaryWindow[] {
  const before = (options?.beforeMinutes ?? 30) / 60;
  const after = (options?.afterMinutes ?? 60) / 60;

  return boundaries.map((b) => ({
    boundary: boundaryKey(b),
    fromHour: wrap24(b.hour - before),
    toHour: wrap24(b.hour + after),
  }));
}

export function conciseRoutine(r: Routine): Record<string, unknown> {
  return {
    id: r.id,
    name: r.name,
    boundary: boundaryKey(r),
    entries: r.entries.length,
  };
}
