import type { AreaId, Duration, RuleId } from "../../attention/ids";
import type { GateSpec } from "../Primitive";
import type { DistalRef } from "../ProximalOutcome";
import type { RuleSpec } from "../RuleSpec";

/**
 * Area drift, the first non-browser rule and the calibration case for the model.
 *
 * The cell plants a lane. Drift is leaving it: a sustained span resolving to an
 * area that none of the cell's plantings name. The rule is what the whole design
 * is for, because it is the first one that could never have been written before
 * a rule was required to say what it should achieve.
 *
 * Mechanism: `PreToolUse` gates the agent, and the person is the proceed
 * affordance. The hook denies the cross-area call and states why. Claude cannot
 * override it. Rafa can, in one sentence. That is a real wall where walls hold
 * and a real notice where they do not, and it answers the 2026-06-14 open
 * question about user-chosen walls: yes, pointed at your agent rather than at
 * yourself.
 *
 * "Ambient" describes the boundary's character, not the absence of interruption.
 * A `gate` is friction with an exit, which is a door built into the space rather
 * than an alarm fired into it. The two words were never in conflict.
 *
 * Spec: `kairos/docs/superpowers/specs/2026-08-18-the-garden-absorbs-keel-design.md`,
 * "The first rule: area drift".
 */

export const TEN_MINUTES: Duration = 10 * 60_000;

/**
 * The probability a rule ships at while it is the thing in question.
 *
 * The spec is explicit: `deliveryProbability: 1` is for rules where the
 * intervention is not what is being tested, and anything shipped to find out
 * whether it works ships below 1. Withholding at half the eligible decision
 * points is the comparison condition, and without one the proximal outcome
 * reports a number with nothing to read it against.
 */
export const UNDER_TEST = 0.5;

/**
 * Never delivers, and records every decision point it declined.
 *
 * This is the spec's "ship a logging-only version first", expressed in the model
 * rather than as a separate code path. A rule at probability 0 resolves path to
 * area, reaches the decision point, and is randomised out every time, so the
 * baseline the magnitude cuts need accumulates without anything ever being
 * blocked. One rule, one arming, and the difference between the probe and the
 * live rule is a single number.
 */
export const LOGGING_ONLY = 0;

export interface AreaDriftInput {
  readonly id: RuleId;
  readonly name: string;
  readonly description: string;
  /** The season intention this serves. A pointer, not a second declaration. */
  readonly serves: DistalRef;
  /**
   * Absolute path prefixes the rule watches.
   *
   * Resolution to an area is `area-map.json`'s job, not this rule's. These say
   * where the rule is in force, which is a narrower question than where a path
   * belongs.
   */
  readonly paths: readonly string[];
  /**
   * The areas the cell planted. The whole proximal claim is that attention
   * comes back to one of them, not that the drifting call was prevented.
   */
  readonly returnsTo: readonly AreaId[];
  readonly windowMs?: Duration;
  /** Defaults to `UNDER_TEST`. Pass `LOGGING_ONLY` for the shadow arming. */
  readonly deliveryProbability?: number;
}

export function areaDriftRule(input: AreaDriftInput): RuleSpec {
  const gate: GateSpec = {
    kind: "gate",
    /**
     * On entry: the cross-area call itself. The hook already holds the event, so
     * there is nothing to accumulate and nothing to dwell on — the rule fires
     * where the crossing happens, which is the one moment naming what it is for
     * can still change it.
     */
    trigger: { type: "entry" },
    /**
     * An intention, not a confirmation. A confirmation is a click, and a click
     * costs nothing and teaches nothing. Naming what you are crossing for is the
     * friction, and it is also the only part of the exit worth reading later.
     */
    frictionType: {
      type: "intention",
      prompt: "This is outside what this phase planted. What is it for?",
    },
    /**
     * The exit, required by type. The person proceeds; the agent cannot proceed
     * on their behalf, which is the asymmetry the whole mechanism rests on.
     */
    proceedAffordance: {
      label: "Cross anyway, and say why",
      action: { type: "continue" },
    },
  };

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    scope: { surface: "session", paths: input.paths },
    /**
     * Friction, not access-block. Nothing is made unreachable: the call is
     * interrupted and then proceeds if the person says so. Calling this an
     * access-block would overstate what a gate does and misfile it against the
     * refused-BCT table.
     */
    mechanism: "friction",
    /**
     * Auto. A drift gate that stopped firing because drift stopped should be
     * able to lapse without a decision, which is what invariant 5 forbids
     * scaffolding from doing forever. The wall family sets this to manual; this
     * is not the wall family.
     */
    fadeEligibility: "auto",
    outcome: {
      claim:
        "attention returns to one of the areas this cell planted rather than staying in the one it drifted to",
      measure: { kind: "next_span_in", areaIds: input.returnsTo },
      windowMs: input.windowMs ?? TEN_MINUTES,
    },
    serves: input.serves,
    deliveryProbability: input.deliveryProbability ?? UNDER_TEST,
    primitives: [gate],
  };
}
