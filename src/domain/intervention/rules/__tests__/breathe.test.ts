import { describe, expect, it } from "vitest";
import { carriesExit, type GateSpec } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import {
  breatheRule,
  DEFAULT_CYCLES,
  FIVE_MINUTES,
  OFFER_AFTER_MS,
} from "../breathe";

const serves = { cycleId: "c-1", areaId: "area-themia" };

const breathe = breatheRule({
  id: "rule-breathe",
  name: "breathe the gap",
  description: "the agent is working; the wait does not need filling",
  serves,
  staysOutOf: ["area-entertainement", "area-playful"],
});

describe("breatheRule", () => {
  it("produces a rule the validator accepts", () => {
    expect(validateRuleSpec(breathe)).toEqual([]);
  });

  it("is the first substitution — everything else in this directory subtracts", () => {
    expect(breathe.mechanism).toBe("substitution");
  });

  it("uses the breath friction type, which had no caller before", () => {
    const gate = breathe.primitives[0] as GateSpec;
    expect(gate.kind).toBe("gate");
    expect(gate.frictionType).toEqual({
      type: "breath",
      cycles: DEFAULT_CYCLES,
    });
  });

  it("stays an offer — the exit is required and it is a plain skip", () => {
    const gate = breathe.primitives[0] as GateSpec;
    expect(carriesExit(gate)).toBe(true);
    expect(gate.proceedAffordance.action).toEqual({ type: "continue" });
    // Waiting is correct behaviour; a breath that could not be waved past would
    // be a wall across a window in which nothing is being done wrong.
    expect(gate.proceedAffordance.label).toBe("Skip");
  });

  it("is scoped to an interval, not a territory", () => {
    expect(breathe.scope).toEqual({ surface: "session", paths: [] });
  });

  it("claims an absence, because a gap has nothing to return to", () => {
    // `next_span_in` would be the wrong claim: the agent holds the work, so
    // there is nowhere for attention to come back to during the wait.
    expect(breathe.outcome.measure).toEqual({
      kind: "no_span_matching",
      areaIds: ["area-entertainement", "area-playful"],
    });
  });

  it("bounds the claim at five minutes, where the drift excess ends", () => {
    // Past 300s the principal's own logs show ordinary baseline drift, so a
    // longer window would stop being a claim about the gap.
    expect(breathe.outcome.windowMs).toBe(FIVE_MINUTES);
  });

  it("delivers by default, and can be withheld for comparison", () => {
    // The offer is not what is in question, so it ships at 1 — a breath withheld
    // at half the gaps is a breath that cannot be leaned on.
    expect(breathe.deliveryProbability).toBe(1);
    const underTest = breatheRule({
      id: "rule-breathe-test",
      name: "breathe the gap",
      description: "run as a comparison instead",
      serves,
      staysOutOf: ["area-entertainement"],
      deliveryProbability: 0.5,
    });
    expect(underTest.deliveryProbability).toBe(0.5);
  });

  it("fades on its own — it is scaffolding", () => {
    expect(breathe.fadeEligibility).toBe("auto");
  });
});

describe("OFFER_AFTER_MS", () => {
  it("lands before the reflex but after the turns too short to drift in", () => {
    // p25 of time-to-first-drift inside a gap is 12s; median is 38s. The offer
    // has to be present before the quarter mark and absent from instant turns.
    expect(OFFER_AFTER_MS).toBeGreaterThan(0);
    expect(OFFER_AFTER_MS).toBeLessThan(12_000);
  });
});
