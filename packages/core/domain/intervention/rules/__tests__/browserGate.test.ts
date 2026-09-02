import { describe, expect, it } from "vitest";
import { carriesExit, type GateSpec } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import { browserDwellGateRule, LINKEDIN_FEED_GATE } from "../browserGate";

const serves = { cycleId: "c-1", areaId: "area-craft" };

const rule = browserDwellGateRule({
  id: "rule-gate-linkedin",
  host: "linkedin.com",
  name: "linkedin feed",
  description: "the scroll that eats a morning",
  serves,
  returnsTo: ["area-craft"],
  everyMinutes: 5,
  prompt: "Still what you came for?",
});

const gate = rule.primitives[0] as GateSpec;

describe("browserDwellGateRule", () => {
  it("produces a rule the validator accepts", () => {
    expect(validateRuleSpec(rule)).toEqual([]);
  });

  it("is browser-scoped, which is the whole point — a session scope reaches no browser", () => {
    expect(rule.scope).toEqual({
      surface: "browser",
      domain: "linkedin.com",
      matches: ["*://linkedin.com/*", "*://*.linkedin.com/*"],
    });
  });

  it("carries a dwell trigger, so the extension knows when it fires", () => {
    expect(gate.trigger).toEqual({ type: "dwell", everyMinutes: 5 });
  });

  it("carries an exit — invariant 6, by type rather than by check", () => {
    expect(carriesExit(gate)).toBe(true);
    expect(gate.proceedAffordance.action).toEqual({ type: "continue" });
  });

  it("names an abort as well as a proceed, because a gate with only one door is a wall", () => {
    expect(gate.abortAffordance?.label).toBeTruthy();
  });

  it("asks rather than blocks — friction, not access-block", () => {
    expect(rule.mechanism).toBe("friction");
  });

  it("states what it should shift, and where attention should land", () => {
    expect(rule.outcome.measure).toEqual({
      kind: "next_span_in",
      areaIds: ["area-craft"],
    });
    expect(rule.outcome.claim.length).toBeGreaterThan(0);
  });

  it("refuses a non-positive dwell interval by clamping to a minute, never to zero", () => {
    const zero = browserDwellGateRule({
      id: "r",
      host: "example.com",
      name: "x",
      description: "x",
      serves,
      returnsTo: ["area-craft"],
      everyMinutes: 0,
      prompt: "why",
    });
    const g = zero.primitives[0] as GateSpec;
    expect(g.trigger).toEqual({ type: "dwell", everyMinutes: 1 });
  });
});

describe("LINKEDIN_FEED_GATE", () => {
  it("is the pain b59b01f named: LinkedIn on a gate rather than on a block", () => {
    expect(LINKEDIN_FEED_GATE.host).toBe("linkedin.com");
    expect(LINKEDIN_FEED_GATE.everyMinutes).toBeGreaterThan(0);
  });
});
