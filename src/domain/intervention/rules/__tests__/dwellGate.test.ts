import { describe, expect, it } from "vitest";
import { type Delivery, validateDelivery } from "../../Delivery";
import { carriesExit, type GateSpec } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import {
  ALWAYS,
  dwellGateRule,
  dwellGateRuleId,
  LINKEDIN_EVERY_MINUTES,
  LINKEDIN_HOST,
  linkedinDwellGate,
  TEN_MINUTES,
} from "../dwellGate";

const serves = { cycleId: "c-1", areaId: "area-mindfulness" };

const rule = linkedinDwellGate({
  serves,
  returnsTo: ["area-themia", "area-craft"],
});

const gate = rule.primitives[0] as GateSpec;

describe("linkedinDwellGate", () => {
  it("produces a rule the validator accepts", () => {
    expect(validateRuleSpec(rule)).toEqual([]);
  });

  it("carries exactly one primitive, and it is a gate", () => {
    expect(rule.primitives).toHaveLength(1);
    expect(gate.kind).toBe("gate");
  });

  it("fires on dwell, which is the whole point: there is no entry event to hang on", () => {
    // The site is an SPA you are already inside. A gate triggered on entry
    // would fire once, at a moment that is not the moment the scroll begins to
    // cost anything.
    expect(gate.trigger).toEqual({
      type: "dwell",
      everyMinutes: LINKEDIN_EVERY_MINUTES,
    });
  });

  it("scopes to the host and its subdomains, never globally", () => {
    expect(rule.scope).toEqual({
      surface: "browser",
      domain: LINKEDIN_HOST,
      matches: [`*://${LINKEDIN_HOST}/*`, `*://*.${LINKEDIN_HOST}/*`],
    });
  });

  it("is friction, not access-block: nothing is made unreachable", () => {
    // The whole diagnosis of the 2026-08-19 pain doc. A standing access-block
    // on a running SPA is a wall the page keeps knocking on.
    expect(rule.mechanism).toBe("friction");
  });

  it("asks for an intention rather than a confirmation", () => {
    expect(gate.frictionType.type).toBe("intention");
  });

  it("carries an exit, so invariant 6 holds by type", () => {
    expect(carriesExit(gate)).toBe(true);
    expect(gate.proceedAffordance.action).toEqual({ type: "continue" });
    expect(gate.proceedAffordance.label.length).toBeGreaterThan(0);
  });

  it("satisfies invariant 6 as a rule-set delivery", () => {
    const delivery: Delivery = {
      origin: "rule",
      ruleId: rule.id,
      discrepancy: {
        kind: "drift",
        magnitude: 1,
        plantedMomentIds: ["m-1"],
        observedAreaId: "area-leisure",
        since: 1_700_000_000_000,
      },
      primitives: rule.primitives,
    };
    expect(validateDelivery(delivery)).toEqual([]);
  });

  it("names an abort, because closing the tab is the answer the cue is asking for", () => {
    expect(gate.abortAffordance?.label.length).toBeGreaterThan(0);
  });

  it("claims the next span returns to a planted area, within ten minutes", () => {
    expect(rule.outcome.claim.trim().length).toBeGreaterThan(0);
    expect(rule.outcome.measure).toEqual({
      kind: "next_span_in",
      areaIds: ["area-themia", "area-craft"],
    });
    expect(rule.outcome.windowMs).toBe(TEN_MINUTES);
  });

  it("fades on its own, because a cue into a stretch that stopped happening should lapse", () => {
    expect(rule.fadeEligibility).toBe("auto");
  });

  it("never withholds, because the cue was asked for rather than tested", () => {
    expect(rule.deliveryProbability).toBe(ALWAYS);
    expect(ALWAYS).toBe(1);
  });

  it("derives its id from the host, so a reinstall replaces rather than doubles", () => {
    expect(rule.id).toBe(dwellGateRuleId(LINKEDIN_HOST));
    expect(dwellGateRuleId("linkedin.com")).toBe("dwell-gate-linkedin-com");
  });

  it("refuses a rule naming no area to return to", () => {
    const unmeasurable = linkedinDwellGate({ serves, returnsTo: [] });
    expect(validateRuleSpec(unmeasurable)).toContain(
      "outcome.measure names no area, so it can never be settled",
    );
  });

  it("takes a longer beat as a second rule, not a new field", () => {
    // The pain doc's escalation path: keel's evaluateGates runs every gate on
    // the domain, so a 20-minute cue and a 60-minute beat are two rules.
    const beat = linkedinDwellGate({
      serves,
      returnsTo: ["area-themia"],
      id: "dwell-gate-linkedin-com-hourly",
      everyMinutes: 60,
    });
    expect(beat.id).toBe("dwell-gate-linkedin-com-hourly");
    expect((beat.primitives[0] as GateSpec).trigger).toEqual({
      type: "dwell",
      everyMinutes: 60,
    });
    expect(validateRuleSpec(beat)).toEqual([]);
  });
});

describe("dwellGateRule", () => {
  it("refuses an interval that is not a positive number of minutes", () => {
    // A dwell of zero is a gate that never stops firing, which is a wall
    // wearing a gate's clothes.
    const broken = dwellGateRule({
      id: "dwell-gate-broken",
      host: "example.com",
      name: "broken",
      description: "fires forever",
      serves,
      returnsTo: ["area-craft"],
      everyMinutes: 0,
      prompt: "Still what you came for?",
      proceedLabel: "Keep going",
      abortLabel: "Close the tab",
    });
    expect(validateRuleSpec(broken)).toContain(
      "gate.trigger.everyMinutes must be positive",
    );
  });
});
