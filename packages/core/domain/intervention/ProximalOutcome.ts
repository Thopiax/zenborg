import type { AreaId, CycleId, Duration } from "../attention/ids";

/**
 * What a rule claims it should shift, and how that claim is read off the log.
 *
 * Every measure must be answerable from the activity log alone, inside `window`.
 * A measure needing data the log does not carry is not a measure, and admitting
 * one returns this layer to the unevaluable state the whole design exists to fix.
 */

export type MetricKey = string;
export type EventKind = string;

export type Measure =
  | { readonly kind: "next_span_in"; readonly areaIds: readonly AreaId[] }
  | { readonly kind: "no_span_matching"; readonly areaIds: readonly AreaId[] }
  | {
      readonly kind: "event_count";
      readonly of: EventKind;
      readonly cmp: "lt" | "gt";
      readonly value: number;
    }
  | {
      readonly kind: "metric_threshold";
      readonly metric: MetricKey;
      readonly cmp: "lte" | "gte";
      readonly value: number;
    };

export interface ProximalOutcomeSpec {
  /** Plain language: "attention returns to a planted moment". */
  readonly claim: string;
  /** How the claim is read off the activity log. */
  readonly measure: Measure;
  /** Within how long, in milliseconds. */
  readonly windowMs: Duration;
}

/**
 * A pointer at the season's intention, not a second place to declare one.
 *
 * Cycle planning already names one intention per plot. A rule points at what you
 * already wrote.
 */
export interface DistalRef {
  readonly cycleId: CycleId;
  readonly areaId: AreaId;
}
