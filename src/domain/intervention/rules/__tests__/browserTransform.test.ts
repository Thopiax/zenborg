import { describe, expect, it } from "vitest";
import { carriesExit, type TransformSpec } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import { browserTransformRule } from "../browserTransform";

const serves = { cycleId: "c-1", areaId: "area-craft" };

const rule = browserTransformRule({
  id: "rule-transform-linkedin",
  host: "linkedin.com",
  name: "no linkedin feed",
  description: "the scroll with no bottom",
  serves,
  returnsTo: ["area-craft"],
  targets: {
    primary: 'div[componentkey*="FeedType_MAIN_FEED"]',
    fallbacks: ['div[id*="FeedType_MAIN_FEED"]'],
  },
  replacement: { type: "restyle", style: { visibility: "hidden" } },
});

const transform = rule.primitives[0] as TransformSpec;

describe("browserTransformRule", () => {
  it("produces a rule the validator accepts", () => {
    expect(validateRuleSpec(rule)).toEqual([]);
  });

  it("carries exactly one primitive, and it is a transform", () => {
    expect(rule.primitives).toHaveLength(1);
    expect(transform.kind).toBe("transform");
  });

  it("is browser-scoped, which is the whole point — a session scope reaches no browser", () => {
    expect(rule.scope).toEqual({
      surface: "browser",
      domain: "linkedin.com",
      matches: ["*://linkedin.com/*", "*://*.linkedin.com/*"],
    });
  });

  it("carries the selector chain, primary and fallbacks together", () => {
    expect(transform.targets).toEqual({
      primary: 'div[componentkey*="FeedType_MAIN_FEED"]',
      fallbacks: ['div[id*="FeedType_MAIN_FEED"]'],
    });
  });

  it("carries the replacement as given", () => {
    expect(transform.replacement).toEqual({
      type: "restyle",
      style: { visibility: "hidden" },
    });
  });

  it("defaults fallbacks to none when the caller names only a primary", () => {
    const solo = browserTransformRule({
      id: "r",
      host: "example.com",
      name: "n",
      description: "d",
      serves,
      returnsTo: ["area-craft"],
      targets: { primary: ".x" },
    });
    const t = solo.primitives[0] as TransformSpec;
    expect(t.targets).toEqual({ primary: ".x", fallbacks: [] });
  });

  it("defaults the replacement to a plain hide", () => {
    const solo = browserTransformRule({
      id: "r",
      host: "example.com",
      name: "n",
      description: "d",
      serves,
      returnsTo: ["area-craft"],
      targets: { primary: ".x" },
    });
    const t = solo.primitives[0] as TransformSpec;
    expect(t.replacement).toEqual({ type: "hide" });
  });

  it("names cue-removal as its mechanism — conceal, not gate or block", () => {
    expect(rule.mechanism).toBe("cue-removal");
  });

  it("carries no exit, and invariant 6 does not ask it to — a conceal withholds nothing", () => {
    expect(carriesExit(transform)).toBe(false);
  });

  it("fades manually rather than never, so lifting stays a deliberate act", () => {
    expect(rule.fadeEligibility).toBe("manual");
  });

  it("never withholds — a stale selector is a maintenance question, not an experimental one", () => {
    expect(rule.deliveryProbability).toBe(1);
  });

  it("states what it should shift, and where attention should land", () => {
    expect(rule.outcome.measure).toEqual({
      kind: "next_span_in",
      areaIds: ["area-craft"],
    });
    expect(rule.outcome.claim.length).toBeGreaterThan(0);
  });

  it("defaults the outcome window to ten minutes", () => {
    expect(rule.outcome.windowMs).toBe(10 * 60_000);
  });

  it("points its distal at the season intention already written", () => {
    expect(rule.serves).toEqual(serves);
  });
});

describe("an unanswerable measure", () => {
  it("is rejected: a return measure naming no area can never be settled", () => {
    const unanswerable = browserTransformRule({
      id: "r",
      host: "example.com",
      name: "n",
      description: "d",
      serves,
      returnsTo: [],
      targets: { primary: ".x" },
    });
    expect(validateRuleSpec(unanswerable)).toContain(
      "outcome.measure names no area, so it can never be settled",
    );
  });
});
