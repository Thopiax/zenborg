import type { Discrepancy } from "../attention/Discrepancy";
import type { RuleId } from "../attention/ids";
import { carriesExit, type Primitive } from "./Primitive";

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
