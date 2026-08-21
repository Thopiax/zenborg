import { type ActivityEvent, isHumanActor } from "./ActivityEvent.ts";
import type { AreaId, Duration, Instant } from "./ids";
import type { Span } from "./Span";

/**
 * Turns a stream of observations into resolved intervals of attention.
 *
 * The taxonomy is explicit that "writers never claim bouts": a span is derived,
 * never recorded, so this is where one comes from. Pure, and the resolver is
 * injected so span logic can be tested without an area map.
 *
 * Only the person's own events build a span. `magnitudeOf` had always counted
 * human kinds only, on the grounds that one prompt can emit eighty tool calls,
 * but span formation used to take every event. Shadow mode over 90 days of the
 * real log showed what that cost: two thirds of the events were the agent, they
 * formed 83% of the drift records, and the median record scored a magnitude of
 * 0. A span is a claim about where the person was, so it is built from what the
 * person did, and the two halves of the model now agree.
 *
 * A span closes on three things: attention moves to another area, the person
 * stops producing observations for longer than `idleGapMs`, or the plan says
 * one stretch ended and another began.
 *
 * That third one is not decoration. A therapy session in the afternoon ends the
 * morning's work whether or not the log went quiet across it, and a threshold
 * measured in minutes of silence cannot know that. Only the plan does.
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

  /**
   * Instants at which a span must close, whatever the log looks like.
   *
   * These come from the garden: phase-band edges, and the start and end of any
   * moment planted with a clock time. The plan already knows the day has parts,
   * and deriving attention without reading it produces spans that straddle a
   * boundary and then get judged against whichever cell happened to be first.
   *
   * A boundary never creates a span and never extends one. It only cuts.
   */
  readonly boundaries?: readonly Instant[];
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

function seal(open: OpenSpan, cutAt?: Instant): Span {
  const end = cutAt === undefined ? open.end : Math.min(open.end, cutAt);
  return {
    areaId: open.areaId,
    start: open.start,
    end: Math.max(open.start, end),
    sourceEventIds: open.sourceEventIds,
  };
}

/**
 * The first planned boundary strictly inside `(after, upTo]`, if any.
 *
 * Strictly after the span's start, so a boundary landing on the very instant a
 * span opened does not close it before it has held anything.
 */
function nextBoundary(
  boundaries: readonly Instant[],
  after: Instant,
  upTo: Instant,
): Instant | undefined {
  let best: Instant | undefined;
  for (const boundary of boundaries) {
    if (boundary <= after || boundary > upTo) continue;
    if (best === undefined || boundary < best) best = boundary;
  }
  return best;
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
 *
 * A planned boundary cuts before either of those is consulted, and the closed
 * span ends at the boundary rather than at its last observation, so no span
 * claims time on the far side of something the plan says ended it.
 */
export function deriveSpans(
  events: readonly ActivityEvent[],
  resolve: AreaResolver,
  config: SpanDerivationConfig,
): readonly Span[] {
  const ordered = [...events].sort((a, b) => a.ts - b.ts);
  const boundaries = config.boundaries ?? [];
  const spans: Span[] = [];
  let open: OpenSpan | undefined;

  for (const event of ordered) {
    // The agent's own throughput is not the person's attention, and its
    // baseline moves whenever the model or harness changes. An agent event
    // neither opens a span, extends one, nor cuts one.
    if (!isHumanActor(event)) continue;

    const areaId = resolve(event);
    if (areaId === undefined) continue;

    if (open !== undefined) {
      const cut = nextBoundary(boundaries, open.start, event.ts);
      if (cut !== undefined) {
        spans.push(seal(open, cut));
        open = undefined;
      } else if (
        open.areaId !== areaId ||
        event.ts - open.lastTs > config.idleGapMs
      ) {
        spans.push(seal(open));
        open = undefined;
      }
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
