import { describe, expect, it } from "vitest";
import { type Delivery, validateDelivery } from "../../Delivery";
import type { CooldownSpec } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import { DROGUE_SEED_HOSTS, hostBlockRule } from "../hostBlock";

const serves = { cycleId: "c-1", areaId: "area-craft" };

const rule = hostBlockRule({
  id: "rule-block-chess",
  host: "chess.com",
  name: "chess",
  description: "the reach that costs an evening",
  serves,
  returnsTo: ["area-craft"],
  resolverProfile: "kairos",
  unlockNote: "edit the resolver profile and wait for propagation",
});

const cooldown = rule.primitives[0] as CooldownSpec;

describe("hostBlockRule", () => {
  it("produces a rule the validator accepts", () => {
    expect(validateRuleSpec(rule)).toEqual([]);
  });

  it("carries exactly one primitive, and it is a cooldown", () => {
    expect(rule.primitives).toHaveLength(1);
    expect(cooldown.kind).toBe("cooldown");
  });

  it("enforces at the resolver, which is the only reach that covers a phone", () => {
    expect(cooldown.enforcement).toEqual({ at: "resolver", profile: "kairos" });
  });

  it("stands rather than lapsing, which is what the drogue blocklist always was", () => {
    expect(cooldown.duration).toEqual({ type: "standing" });
  });

  it("exits out of band, so the key is not in the room at the moment of wanting", () => {
    expect(cooldown.unlockPath).toEqual({
      type: "out_of_band",
      note: "edit the resolver profile and wait for propagation",
    });
  });

  it("satisfies invariant 6 with no exception, as a rule-armed delivery", () => {
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

  it("scopes to the host and its subdomains, never globally", () => {
    expect(rule.scope).toEqual({
      surface: "browser",
      domain: "chess.com",
      matches: ["*://chess.com/*", "*://*.chess.com/*"],
    });
  });

  it("names access-block as its mechanism", () => {
    expect(rule.mechanism).toBe("access-block");
  });

  it("never withholds, because the block is not the thing under test", () => {
    expect(rule.deliveryProbability).toBe(1);
  });

  it("fades manually rather than never, so lifting stays a deliberate act", () => {
    expect(rule.fadeEligibility).toBe("manual");
  });

  it("claims attention returns to what was planted, and measures it that way", () => {
    expect(rule.outcome.measure).toEqual({
      kind: "next_span_in",
      areaIds: ["area-craft"],
    });
    expect(rule.outcome.claim.length).toBeGreaterThan(0);
  });

  it("defaults the outcome window to ten minutes", () => {
    expect(rule.outcome.windowMs).toBe(10 * 60_000);
  });

  it("takes an explicit window when one is given", () => {
    const custom = hostBlockRule({
      id: "r",
      host: "h.com",
      name: "n",
      description: "d",
      serves,
      returnsTo: ["area-craft"],
      resolverProfile: "p",
      unlockNote: "u",
      windowMs: 60_000,
    });
    expect(custom.outcome.windowMs).toBe(60_000);
  });

  it("points its distal at the season intention already written", () => {
    expect(rule.serves).toEqual(serves);
  });
});

describe("an unanswerable measure", () => {
  it("is rejected: a return measure naming no area can never be settled", () => {
    const unanswerable = hostBlockRule({
      id: "r",
      host: "h.com",
      name: "n",
      description: "d",
      serves,
      returnsTo: [],
      resolverProfile: "p",
      unlockNote: "u",
    });
    expect(validateRuleSpec(unanswerable)).toContain(
      "outcome.measure names no area, so it can never be settled",
    );
  });
});

describe("DROGUE_SEED_HOSTS", () => {
  it("carries the three that have actually been running", () => {
    expect(DROGUE_SEED_HOSTS).toEqual([
      "linkedin.com",
      "youtube.com",
      "chess.com",
    ]);
  });

  it("builds one valid rule per host, with distinct ids", () => {
    const rules = DROGUE_SEED_HOSTS.map((host, i) =>
      hostBlockRule({
        id: `rule-block-${i}`,
        host,
        name: host,
        description: host,
        serves,
        returnsTo: ["area-craft"],
        resolverProfile: "kairos",
        unlockNote: "out of band",
      }),
    );
    for (const r of rules) expect(validateRuleSpec(r)).toEqual([]);
    expect(new Set(rules.map((r) => r.id)).size).toBe(3);
  });
});
