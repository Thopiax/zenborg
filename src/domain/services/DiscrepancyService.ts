import {
  type ActivityEvent,
  isHumanActor,
} from "../attention/ActivityEvent.ts";
import type { Discrepancy, Magnitude } from "../attention/Discrepancy";
import type { AreaId, MomentId } from "../attention/ids";
import type { Span } from "../attention/Span.ts";

/**
 * Derives discrepancies from what was planted and what was observed.
 *
 * Sits beside AttitudeService and belongs to the same species: a domain service
 * that reads history and returns a judgment about the person's relationship to
 * something. Pure: no ports, no clock, no I/O.
 */

export interface DriftInput {
  /** Every moment planted in the (day, phase) cell. A set, not a moment. */
  readonly plantedMomentIds: readonly MomentId[];
  /** The areas those moments name, already resolved by the caller. */
  readonly plantedAreaIds: readonly AreaId[];
  /** The observed interval of attention. */
  readonly span: Span;
  /** Activity events to read magnitude from. May include events outside the span. */
  readonly events: readonly ActivityEvent[];
}

/**
 * Count the human-actor events that formed the span.
 *
 * Human kinds only. One human prompt can emit eighty tool calls, so agent-actor
 * counts are machine throughput rather than human exertion, and their baseline
 * moves whenever the model or harness changes.
 *
 * Membership is read off `sourceEventIds` rather than off the clock. Testing
 * overlap instead used to work only by accident: a span is half-open, so a span
 * built from one undurated event spans `[T, T)` and contains nothing, not even
 * the event that made it. Agent events used to pad the end and hide that. With
 * span formation filtered to human actors the padding is gone, and a lone
 * prompt would have scored 0. The span already records exactly what built it,
 * so the provenance anchor answers the question the clock cannot.
 */
function magnitudeOf(span: Span, events: readonly ActivityEvent[]): Magnitude {
  const formed = new Set(span.sourceEventIds);
  let count = 0;
  for (const event of events) {
    if (!isHumanActor(event)) continue;
    if (!formed.has(event.id)) continue;
    count += 1;
  }
  return count;
}

/**
 * Detect drift: a span resolving to an area that none of the cell's plantings name.
 *
 * Returns null when there is no drift to report. An empty cell yields null,
 * because nothing planted is not a discrepancy against everything, it is the
 * absence of a plan to be discrepant with.
 */
export function detectDrift(input: DriftInput): Discrepancy | null {
  const { plantedMomentIds, plantedAreaIds, span, events } = input;

  if (plantedMomentIds.length === 0) return null;
  if (plantedAreaIds.includes(span.areaId)) return null;

  return {
    kind: "drift",
    magnitude: magnitudeOf(span, events),
    plantedMomentIds,
    observedAreaId: span.areaId,
    since: span.start,
  };
}

/**
 * Detect absence: attention observed against a cell that planted nothing.
 *
 * `detectDrift` returns null for an empty cell, and that is right for drift:
 * nothing planted is not a discrepancy against everything. But it is also not
 * nothing. Working without an intention is the case worth surfacing on its own
 * terms, and `absence` is the kind the taxonomy already reserved for it.
 *
 * The two are mutually exclusive by construction. Drift needs a non-empty
 * planting to be discrepant with; absence needs an empty one.
 *
 * No threshold is applied. A brief unplanted stretch is still an absence, and
 * its magnitude is recorded raw, because the cut belongs to step 3 and choosing
 * one here would be guessing at exactly the number shadow mode exists to
 * measure.
 */
export function detectAbsence(input: DriftInput): Discrepancy | null {
  const { plantedMomentIds, span, events } = input;

  if (plantedMomentIds.length > 0) return null;

  return {
    kind: "absence",
    magnitude: magnitudeOf(span, events),
    plantedMomentIds: [],
    observedAreaId: span.areaId,
    since: span.start,
  };
}
