import { describe, expect, it } from "vitest";
import { type RuleSpec, validateRuleSpec } from "../RuleSpec";

const rule: RuleSpec = {
  id: "rule-area-drift",
  name: "area drift",
  description: "attention resolved to an unplanted area",
  scope: { surface: "session", paths: ["~/Developer/equanimitech"] },
  mechanism: "friction",
  fadeEligibility: "manual",
  deliveryProbability: 0.5,
  outcome: {
    claim: "attention returns to a planted moment",
    measure: { kind: "next_span_in", areaIds: ["area-equanimitech"] },
    windowMs: 600_000,
  },
  serves: { cycleId: "cycle-1", areaId: "area-equanimitech" },
  primitives: [
    {
      kind: "gate",
      frictionType: { type: "intention", prompt: "what is this for?" },
      proceedAffordance: { label: "proceed", action: { type: "continue" } },
    },
  ],
};

describe("validateRuleSpec", () => {
  it("accepts a well-formed rule", () => {
    expect(validateRuleSpec(rule)).toEqual([]);
  });

  it("rejects a rule with no primitives", () => {
    expect(validateRuleSpec({ ...rule, primitives: [] })).toContain(
      "a rule must carry at least one primitive",
    );
  });

  it("rejects a deliveryProbability outside [0, 1]", () => {
    expect(validateRuleSpec({ ...rule, deliveryProbability: 1.5 })).toContain(
      "deliveryProbability must be between 0 and 1",
    );
    expect(validateRuleSpec({ ...rule, deliveryProbability: -0.1 })).toContain(
      "deliveryProbability must be between 0 and 1",
    );
  });

  it("rejects a non-positive outcome window", () => {
    expect(
      validateRuleSpec({ ...rule, outcome: { ...rule.outcome, windowMs: 0 } }),
    ).toContain("outcome.windowMs must be positive");
  });

  it("rejects an empty outcome claim", () => {
    expect(
      validateRuleSpec({ ...rule, outcome: { ...rule.outcome, claim: "  " } }),
    ).toContain("outcome.claim must say what the rule should shift");
  });

  it("rejects a browser scope with no matches", () => {
    expect(
      validateRuleSpec({
        ...rule,
        scope: { surface: "browser", domain: "linkedin.com", matches: [] },
      }),
    ).toContain("scope.matches must be non-empty");
  });

  it("rejects a global browser match pattern", () => {
    expect(
      validateRuleSpec({
        ...rule,
        scope: {
          surface: "browser",
          domain: "linkedin.com",
          matches: ["*://*/*"],
        },
      }),
    ).toContain("scope.matches must not be global");
  });

  it("accumulates several problems rather than reporting only the first", () => {
    const problems = validateRuleSpec({
      ...rule,
      primitives: [],
      deliveryProbability: 2,
    });
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });
});
