import type { Phase } from "../value-objects/Phase";

export interface RoutineEntry {
  readonly habitId: string;
  readonly order: number;
}

export interface Routine {
  readonly id: string;
  readonly name: string;
  readonly from: Phase;
  readonly to: Phase;
  readonly entries: readonly RoutineEntry[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function sortedEntries(routine: Routine): readonly RoutineEntry[] {
  return [...routine.entries].sort((a, b) => a.order - b.order);
}

export interface CreateRoutineProps {
  name: string;
  from: Phase;
  to: Phase;
  entries: RoutineEntry[];
}

export function createRoutine(props: CreateRoutineProps): Routine {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: props.name.trim(),
    from: props.from,
    to: props.to,
    entries: props.entries,
    createdAt: now,
    updatedAt: now,
  };
}
