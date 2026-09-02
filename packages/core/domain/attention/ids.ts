/**
 * Shared aliases for the attention and intervention models.
 *
 * These are plain aliases, not branded types. zenborg's existing entities use
 * `readonly id: string`, and the spec writes `MomentId` / `AreaId` / `CycleId`.
 * Aliasing keeps the spec's vocabulary readable without forcing a cast at every
 * boundary with `Moment`, `Area` and `Cycle`.
 */
export type MomentId = string;
export type AreaId = string;
export type CycleId = string;
export type HabitId = string;
export type RuleId = string;

/** Epoch milliseconds, UTC. The substrate stores no local time. */
export type Instant = number;

/** A length of time in milliseconds. */
export type Duration = number;
