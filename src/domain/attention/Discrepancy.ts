import type { AreaId, Instant, MomentId } from "./ids";

/**
 * The spine of the model: the gap between what was planted and what was observed.
 *
 * Everything downstream reads a discrepancy. Nothing downstream re-derives one.
 */

export type DiscrepancyKind = "drift" | "absence" | "overrun" | "fragmentation";

/**
 * The raw observation, uncut.
 *
 * Deliberately not a class or a band. There is no basis for choosing where a cut
 * goes until shadow mode has recorded real values, and the cut lands at no more
 * than three classes when it does, per the taxonomy's ceiling on derived facts.
 * Do not add a MagnitudeClass here.
 */
export type Magnitude = number;

export interface Discrepancy {
  readonly kind: DiscrepancyKind;
  readonly magnitude: Magnitude;
  /**
   * Every moment planted in the (day, phase) cell. A set, not a moment.
   *
   * A cell holds however many moments are planted in it. `DAY_VIEW_PHASE_CAPACITY`
   * is 3, but that is what the coarse day view shows, and the write paths
   * deliberately do not enforce it. The domain carries no cardinality bound.
   */
  readonly plantedMomentIds: readonly MomentId[];
  /** The area attention actually resolved to. Absent when nothing was observed. */
  readonly observedAreaId?: AreaId;
  readonly since: Instant;
}

/**
 * True for a well-formed drift.
 *
 * An empty planting is not a discrepancy against everything, it is the absence of
 * a plan to be discrepant with, so a drift with no plantings is malformed rather
 * than merely uninteresting.
 */
export function isDrift(discrepancy: Discrepancy): boolean {
  return discrepancy.kind === "drift" && discrepancy.plantedMomentIds.length > 0;
}
