import type { AreaId, Duration, Instant } from "./ids";

/**
 * A resolved interval of attention on one area.
 *
 * Derived from the activity log, never written by a writer: the taxonomy is
 * explicit that "writers never claim bouts". `sourceEventIds` is the provenance
 * anchor, per the log's contract that every derived fact cites the events it was
 * computed from.
 *
 * Half-open: `[start, end)`. Two adjacent spans never both claim one instant.
 */
export interface Span {
  readonly areaId: AreaId;
  readonly start: Instant;
  readonly end: Instant;
  readonly sourceEventIds: readonly string[];
}

/** Elapsed milliseconds. Clamped at 0; an inverted span is bad data, not an error. */
export function spanDuration(span: Span): Duration {
  return Math.max(0, span.end - span.start);
}

/** True when the span intersects the half-open window `[from, to)`. */
export function spanOverlaps(span: Span, from: Instant, to: Instant): boolean {
  return span.start < to && span.end > from;
}
