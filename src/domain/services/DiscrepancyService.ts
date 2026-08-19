import {
  type ActivityEvent,
  isHumanActor,
} from "../attention/ActivityEvent.ts";
import type { Discrepancy, Magnitude } from "../attention/Discrepancy";
import type { AreaId, MomentId } from "../attention/ids";
import { type Span, spanOverlaps } from "../attention/Span.ts";

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
 * Count the human-actor events falling inside the span.
 *
 * Human kinds only. One human prompt can emit eighty tool calls, so agent-actor
 * counts are machine throughput rather than human exertion, and their baseline
 * moves whenever the model or harness changes.
 */
function magnitudeOf(span: Span, events: readonly ActivityEvent[]): Magnitude {
  let count = 0;
  for (const event of events) {
    if (!isHumanActor(event)) continue;
    if (!spanOverlaps(span, event.ts, event.ts + 1)) continue;
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
