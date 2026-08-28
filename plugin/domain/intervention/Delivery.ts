import type { Discrepancy } from "../attention/Discrepancy";
import type { RuleId } from "../attention/ids";
import { carriesExit, type Primitive } from "./Primitive.ts";

/**
 * What was actually armed, and on whose initiative.
 *
 * The union makes well-formedness structural: a rule-armed delivery carries the
 * rule and the discrepancy that produced it; a self-armed one carries neither,
 * because the person armed it directly and there was no discrepancy to answer.
 *
 * `origin` is kept because efficacy reporting needs it. Comparing rule-armed
 * against self-armed deliveries is what makes the falsifier checkable.
 */
export type Delivery =
  | {
      readonly origin: "rule";
      readonly ruleId: RuleId;
      readonly discrepancy: Discrepancy;
      readonly primitives: readonly Primitive[];
    }
  | { readonly origin: "self"; readonly primitives: readonly Primitive[] };

/**
 * Invariant 6: every delivered primitive carries a proceed affordance.
 *
 * Since the restricted category is gone, this carries the whole of the
 * sovereignty guarantee. What protects the person is not who was allowed to arm
 * the thing, it is that every armed thing can be got out of. It binds here, at
 * the foundational layer, because that is the layer the validator works on and
 * anything above it could be desugared around.
 *
 * There are no exceptions. Host blocking was the only candidate and it is
 * expressible as a `cooldown` with resolver enforcement and a standing
 * duration, which carries an `unlockPath` by type.
 */
export function validateDelivery(delivery: Delivery): readonly string[] {
  const problems: string[] = [];

  if (delivery.primitives.length === 0) {
    problems.push("a delivery must carry at least one primitive");
  }

  if (delivery.primitives.some((p) => !carriesExit(p))) {
    problems.push(
      "invariant 6: every delivered primitive must carry a proceed affordance",
    );
  }

  return problems;
}

/**
 * Whether this eligible decision point actually delivers.
 *
 * `draw` is supplied by the caller rather than drawn in here. A domain that
 * reaches for `Math.random` cannot be tested and cannot be replayed, so the
 * adapter owns the randomness and the domain owns the comparison.
 *
 * Randomisation is not hedging, and it is not a dimmer on how much the rule
 * bothers you. A rule shipped to find out whether it works needs eligible
 * decision points at which it deliberately does nothing, or its proximal outcome
 * is a number with nothing to read it against. `deliveryProbability: 1` asserts
 * that the intervention is not what is in question; anything below 1 asserts that
 * it is, and buys the comparison condition that says so.
 *
 * This is what replaced the step 2 baseline as the control on derived rules
 * (`kairos/docs/decisions/2026-08-20-retire-the-baseline-gate-...`). The baseline
 * had to be finished before the rule could exist; this produces its evidence
 * while the rule is live.
 *
 * Both arguments fail safe rather than open. A malformed probability declines,
 * and so does a malformed draw: the failure mode of a broken rule should be that
 * it stops interrupting you, never that it interrupts you unconditionally.
 */
export function shouldDeliver(
  deliveryProbability: number,
  draw: number,
): boolean {
  const p = Number.isFinite(deliveryProbability)
    ? Math.min(1, Math.max(0, deliveryProbability))
    : 0;
  const d = Number.isFinite(draw) ? draw : 1;
  return d < p;
}
