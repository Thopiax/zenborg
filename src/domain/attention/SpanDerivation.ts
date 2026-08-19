import type { ActivityEvent } from "./ActivityEvent";
import type { AreaId, Duration } from "./ids";
import type { Span } from "./Span";

/**
 * Turns a stream of observations into resolved intervals of attention.
 *
 * The taxonomy is explicit that "writers never claim bouts": a span is derived,
 * never recorded, so this is where one comes from. Pure, and the resolver is
 * injected so span logic can be tested without an area map.
 *
 * A span closes on either of two things: attention moves to another area, or the
 * person stops producing observations for longer than `idleGapMs`.
 */

export interface SpanDerivationConfig {
  /**
   * How long a silence must run before it ends a span.
   *
   * This is a derivation parameter, not a magnitude cut. It has to exist for a
   * span to exist at all, whereas magnitude classes are deliberately deferred to
   * step 3. Shadow mode is what calibrates this value; until it has run, any
   * number here is a guess and should be treated as one.
   */
  readonly idleGapMs: Duration;
}

export type AreaResolver = (event: ActivityEvent) => AreaId | undefined;

interface OpenSpan {
  areaId: AreaId;
  start: number;
  end: number;
  lastTs: number;
  sourceEventIds: string[];
}

/** The furthest instant an event attests to. Unmeasured events attest to their own timestamp. */
function reachOf(event: ActivityEvent): number {
  return event.ts + (event.durationMs ?? 0);
}

function seal(open: OpenSpan): Span {
  return {
    areaId: open.areaId,
    start: open.start,
    end: Math.max(open.start, open.end),
    sourceEventIds: open.sourceEventIds,
  };
}

/**
 * Derive spans from events.
 *
 * Events that resolve to no area are skipped rather than treated as a boundary.
 * A tool call in an unmapped directory is not evidence that attention moved, it
 * is an absence of evidence, and letting it split a span would manufacture
 * fragmentation that never happened.
 *
 * The idle gap is measured between consecutive timestamps, not from a measured
 * end. A long measured interval means the person was occupied for it, not that
 * they were silent through it.
 */
export function deriveSpans(
  events: readonly ActivityEvent[],
  resolve: AreaResolver,
  config: SpanDerivationConfig,
): readonly Span[] {
  const ordered = [...events].sort((a, b) => a.ts - b.ts);
  const spans: Span[] = [];
  let open: OpenSpan | undefined;

  for (const event of ordered) {
    const areaId = resolve(event);
    if (areaId === undefined) continue;

    const broken =
      open !== undefined &&
      (open.areaId !== areaId || event.ts - open.lastTs > config.idleGapMs);

    if (open !== undefined && broken) {
      spans.push(seal(open));
      open = undefined;
    }

    if (open === undefined) {
      open = {
        areaId,
        start: event.ts,
        end: reachOf(event),
        lastTs: event.ts,
        sourceEventIds: [event.id],
      };
      continue;
    }

    open.end = Math.max(open.end, reachOf(event));
    open.lastTs = event.ts;
    open.sourceEventIds.push(event.id);
  }

  if (open !== undefined) spans.push(seal(open));
  return spans;
}
