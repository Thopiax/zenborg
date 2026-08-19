import { describe, expect, it } from "vitest";
import type { GateSpec } from "../../Primitive";
import { carriesExit } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import {
  areaDriftRule,
  LOGGING_ONLY,
  TEN_MINUTES,
  UNDER_TEST,
} from "../areaDrift";

const serves = { cycleId: "c-1", areaId: "area-craft" };

const rule = areaDriftRule({
  id: "rule-area-drift",
  name: "area drift",
  description: "the session left the plot the cell planted",
  serves,
  paths: ["/Users/rafa/Developer/equanimitech"],
  returnsTo: ["area-craft"],
});

const gate = rule.primitives[0] as GateSpec;

describe("areaDriftRule", () => {
  it("produces a rule the validator accepts", () => {
    expect(validateRuleSpec(rule)).toEqual([]);
  });

  it("scopes to the session surface, which is what lifting scope bought", () => {
    expect(rule.scope).toEqual({
      surface: "session",
      paths: ["/Users/rafa/Developer/equanimitech"],
    });
  });

  it("carries exactly one primitive, and it is a gate", () => {
    expect(rule.primitives).toHaveLength(1);
    expect(gate.kind).toBe("gate");
  });

  it("carries an exit, so invariant 6 holds by type", () => {
    expect(carriesExit(gate)).toBe(true);
  });

  it("makes the person the proceed affordance, not a dismissable alert", () => {
    expect(gate.proceedAffordance.action).toEqual({ type: "continue" });
    expect(gate.proceedAffordance.label.length).toBeGreaterThan(0);
  });

  it("asks for an intention rather than a confirmation", () => {
    // A confirmation is a click. The gate is a door, and stating why you are
    // walking through it is the whole of the friction.
    expect(gate.frictionType.type).toBe("intention");
  });

  it("claims the next span returns to a planted area, within ten minutes", () => {
    expect(rule.outcome.measure).toEqual({
      kind: "next_span_in",
      areaIds: ["area-craft"],
    });
    expect(rule.outcome.windowMs).toBe(TEN_MINUTES);
  });

  it("fades on its own, so it cannot become forever scaffolding", () => {
    expect(rule.fadeEligibility).toBe("auto");
  });

  it("ships below 1, because it is shipped to find out whether it works", () => {
    expect(rule.deliveryProbability).toBe(UNDER_TEST);
    expect(UNDER_TEST).toBeGreaterThan(0);
    expect(UNDER_TEST).toBeLessThan(1);
  });

  it("honours an explicit probability, including the logging-only one", () => {
    const probe = areaDriftRule({
      id: "rule-area-drift-probe",
      name: "area drift, logging only",
      description: "resolves path to area and blocks nothing",
      serves,
      paths: ["/Users/rafa/Developer/equanimitech"],
      returnsTo: ["area-craft"],
      deliveryProbability: LOGGING_ONLY,
    });
    expect(probe.deliveryProbability).toBe(0);
    // Still a valid rule: withholding at every decision point is a delivery
    // probability, not a malformed rule.
    expect(validateRuleSpec(probe)).toEqual([]);
  });

  it("refuses a rule naming no area to return to", () => {
    const unmeasurable = areaDriftRule({
      id: "rule-area-drift-empty",
      name: "area drift",
      description: "names nothing to return to",
      serves,
      paths: ["/Users/rafa/Developer/equanimitech"],
      returnsTo: [],
    });
    expect(validateRuleSpec(unmeasurable)).toContain(
      "outcome.measure names no area, so it can never be settled",
    );
  });
});
