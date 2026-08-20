import type { AreaId, Duration, RuleId } from "../../attention/ids";
import type { CooldownSpec, GateSpec, Primitive } from "../Primitive";
import type { DistalRef } from "../ProximalOutcome";
import type { RuleSpec } from "../RuleSpec";

/**
 * A session fence — the first *declared* rule, and the first that acts.
 *
 * "I'm going to focus only on Themia data this afternoon, and add friction to
 * anything besides that." The principal says it; nothing infers it.
 *
 * ── Why this may act while step 2 is open ───────────────────────────────
 *
 * `areaDrift` is derived: it reads what the cell planted, resolves a span to an
 * area, and concludes that attention wandered. That conclusion can be wrong in
 * the way migration step 2 exists to catch, which is why the baseline gates it.
 *
 * A fence concludes nothing. It compares a path against a list the principal
 * typed. There is no inference to be wrong, so there is no baseline to wait for,
 * which is the whole argument of the decision that opened the `fences`
 * collection early: `kairos/docs/decisions/2026-08-20-open-fences-to-declared-
 * rules-before-step-5.md`, stamped 2026-08-20.
 *
 * The guard that keeps step 2 intact lives in that decision and is worth
 * repeating where it could be violated: **nothing sourced from `discrepancy` may
 * be written into `fences`** until the baseline closes. A rule built by this
 * factory takes its paths from an argument, never from a derivation.
 *
 * ── What `scope.paths` means here, and how it differs from areaDrift ────
 *
 * In `areaDrift`, `paths` is the territory the rule *watches*. Here it is the
 * territory the fence *encloses* — what is inside. That is the plain reading of
 * the word, and the inversion is deliberate rather than accidental: a drift rule
 * is defined by where it looks, a fence by what it contains.
 *
 * Where the fence is *in force* is not a rule fact and is deliberately absent.
 * That "my repos live under ~/Developer" is a property of a machine, not of a
 * commitment, and a rule that asserted it would be wrong on the next laptop.
 * The reader supplies it.
 *
 * ── The ladder is the primitive array, in order ─────────────────────────
 *
 * `RuleSpec.primitives` is an ordered list and escalation is read off that
 * order: rung 1 is the first crossing, rung 2 the second, and the last rung
 * repeats for every crossing after it. keel carried an `allowEscalation` flag
 * for this; a flag says escalation happens without saying into what, and an
 * ordered list says both. No type changes to carry it.
 *
 * The count resets when the fence comes down, not on a clock — a clock lets the
 * tally launder itself by waiting, which is the one thing a commitment must not
 * reward.
 */

export const TEN_SECONDS = 10;
export const THIRTY_SECONDS = 30;

/** A fence is asked for, not tested. `areaDrift` ships at `UNDER_TEST` because
 * the open question there is whether the intervention works at all; here the
 * principal has already decided he wants it, so withholding it at half the
 * decision points would be withholding something he asked for in order to
 * measure something he did not ask about. */
export const ALWAYS = 1;

export interface SessionFenceInput {
  readonly id: RuleId;
  /** What the principal called the stream. Shown back at every rung. */
  readonly label: string;
  readonly description: string;
  /** The season intention this serves. A pointer, not a second declaration. */
  readonly serves: DistalRef;
  /** Absolute path prefixes **inside** the fence. Everything else is outside. */
  readonly paths: readonly string[];
  /**
   * The areas the fence encloses. The proximal claim is that attention comes
   * back to one of them — the same claim `areaDrift` makes, because a fence that
   * only ever interrupts and never returns anyone has not worked.
   */
  readonly encloses: readonly AreaId[];
  readonly windowMs?: Duration;
}

export const TEN_MINUTES: Duration = 10 * 60_000;

/**
 * The rungs, in order.
 *
 * Rung 1 is a confirmation, and `areaDrift` argues against exactly that: "a
 * confirmation is a click, and a click costs nothing and teaches nothing." The
 * disagreement is real and is resolved by who is being addressed. `areaDrift`
 * fires on a boundary the principal did not draw today, so the first contact has
 * to carry its own justification. A fence fires on one he drew minutes ago and
 * can still recite; asking him to re-justify it on the first crossing charges
 * for the commitment rather than for leaving it. The rungs that follow do charge,
 * because a crossing repeated is a commitment no longer being recited.
 */
function rungs(label: string): readonly Primitive[] {
  const proceed = (labelText: string): GateSpec["proceedAffordance"] => ({
    label: labelText,
    action: { type: "continue" },
  });

  const first: GateSpec = {
    kind: "gate",
    frictionType: { type: "confirmation" },
    proceedAffordance: proceed("Cross anyway"),
    abortAffordance: { label: `Stay inside "${label}"` },
  };

  const second: GateSpec = {
    kind: "gate",
    frictionType: { type: "delay", seconds: TEN_SECONDS },
    proceedAffordance: proceed("Cross anyway"),
    abortAffordance: { label: `Stay inside "${label}"` },
  };

  /**
   * A cooldown, where the first two rungs are gates — the only primitive that
   * can hold a wait and ask for a reason at once, which is what the third
   * crossing is meant to cost. A gate's `frictionType` is one variant, so
   * expressing "sit thirty seconds *and* say what changed" as a gate would have
   * meant dropping half of it.
   *
   * `unlock_with_intention` is the exit, and a required field: this is teeth,
   * and invariant 6 is what keeps teeth from being a punishment. It is still not
   * a wall — the key is a command in the same session — and the honest name for
   * what it buys is the pause before the sentence, not prevention.
   */
  const third: CooldownSpec = {
    kind: "cooldown",
    duration: { type: "seconds", seconds: THIRTY_SECONDS },
    unlockPath: {
      type: "unlock_with_intention",
      prompt: `That is outside "${label}", again. What changed?`,
    },
  };

  return [first, second, third];
}

export function sessionFenceRule(input: SessionFenceInput): RuleSpec {
  return {
    id: input.id,
    name: input.label,
    description: input.description,
    scope: { surface: "session", paths: input.paths },
    /**
     * Friction, not access-block. Nothing is made unreachable — every rung
     * carries `proceedAffordance`, so the call proceeds if the person says so.
     */
    mechanism: "friction",
    /**
     * Manual, where `areaDrift` is auto. An auto-fading rule is one that should
     * be allowed to stop mattering without a decision. A fence is declared for
     * an afternoon and is meant to end when the principal takes it down; a fence
     * that quietly lapsed while he still believed it was up would be worse than
     * no fence, because he would have stopped watching for the boundary himself.
     */
    fadeEligibility: "manual",
    outcome: {
      claim: `attention returns inside "${input.label}" rather than staying where it crossed to`,
      measure: { kind: "next_span_in", areaIds: input.encloses },
      windowMs: input.windowMs ?? TEN_MINUTES,
    },
    serves: input.serves,
    deliveryProbability: ALWAYS,
    primitives: rungs(input.label),
  };
}

/**
 * The rung a crossing lands on. `crossings` is how many happened *before* this
 * one, so the first crossing passes 0.
 *
 * The last rung repeats rather than escalating further. There is nothing above
 * "name what changed" that is still a gate, and the next step up would be a wall
 * — which this rule cannot build, because its exit is a command in the same
 * session. A wall holds when the key is not in the room, and here it always is.
 */
export function rungFor(
  rule: RuleSpec,
  crossings: number,
): Primitive | undefined {
  const ladder = rule.primitives;
  if (ladder.length === 0) return undefined;
  const n = Number.isFinite(crossings) ? Math.max(0, Math.floor(crossings)) : 0;
  return ladder[Math.min(n, ladder.length - 1)];
}
