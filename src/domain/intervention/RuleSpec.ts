import type { RuleId } from "../attention/ids";
import type { Primitive } from "./Primitive";
import type { DistalRef, ProximalOutcomeSpec } from "./ProximalOutcome";

/**
 * The intervention option.
 *
 * Extends keel's RuleSpec rather than replacing it: it already wraps primitives,
 * carries metadata, declares fade policy and passes a validator. Two additions
 * and one generalisation.
 */

export type BehavioralMechanism =
  | "cue-removal"
  | "access-block"
  | "friction"
  | "substitution"
  | "self-monitoring";

export type FadeEligibility = "auto" | "manual" | "never";

/**
 * Lifting scope off browser-only is what lets one rule vocabulary drive the tray,
 * the plugin and the extension.
 */
export type RuleScope =
  | {
      readonly surface: "browser";
      readonly domain: string;
      readonly matches: readonly string[];
    }
  | { readonly surface: "session"; readonly paths: readonly string[] }
  | { readonly surface: "desktop"; readonly apps: readonly string[] };

export interface RuleSpec {
  readonly id: RuleId;
  readonly name: string;
  readonly description: string;
  readonly scope: RuleScope;
  readonly mechanism: BehavioralMechanism;
  readonly fadeEligibility: FadeEligibility;
  /** Required. A rule that cannot name what it should shift will not compile. */
  readonly outcome: ProximalOutcomeSpec;
  /** Required. Points at the season's intention you already declared. */
  readonly serves: DistalRef;
  /**
   * Required. The randomisation probability at the decision point, which is what
   * makes the single-subject design readable rather than anecdotal.
   */
  readonly deliveryProbability: number;
  readonly primitives: readonly Primitive[];
}

/**
 * Structural checks a rule must pass. Returns every problem found, not the first.
 *
 * Reporting one problem at a time turns authoring into a guessing game, and this
 * validator is read by a person composing a rule by hand.
 */
export function validateRuleSpec(rule: RuleSpec): readonly string[] {
  const problems: string[] = [];

  if (rule.primitives.length === 0) {
    problems.push("a rule must carry at least one primitive");
  }

  if (rule.deliveryProbability < 0 || rule.deliveryProbability > 1) {
    problems.push("deliveryProbability must be between 0 and 1");
  }

  if (rule.outcome.windowMs <= 0) {
    problems.push("outcome.windowMs must be positive");
  }

  if (rule.outcome.claim.trim().length === 0) {
    problems.push("outcome.claim must say what the rule should shift");
  }

  if (rule.scope.surface === "browser") {
    if (rule.scope.matches.length === 0) {
      problems.push("scope.matches must be non-empty");
    }
    if (rule.scope.matches.includes("*://*/*")) {
      problems.push("scope.matches must not be global");
    }
  }

  return problems;
}
