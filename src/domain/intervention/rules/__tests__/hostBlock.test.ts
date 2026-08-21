import { describe, expect, it } from "vitest";
import { type Delivery, validateDelivery } from "../../Delivery";
import type { CooldownSpec } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import { hostBlockRule, hostBlockSeedRules, seedRuleId } from "../hostBlock";

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

describe("seedRuleId", () => {
  it("derives a stable id from the host, so reinstalling replaces rather than duplicates", () => {
    expect(seedRuleId("youtube.com")).toBe("host-block-youtube-com");
    expect(seedRuleId("lichess.org")).toBe("host-block-lichess-org");
    expect(seedRuleId("YouTube.com")).toBe(seedRuleId("youtube.com"));
  });
});

describe("hostBlockSeedRules", () => {
  const returnsTo = ["area-themia", "area-craft", "area-mindfulness"];
  // Deliberately nobody's hosts. The factory has no list of its own to fall
  // back to, so a fixture here can be as invented as it likes.
  const hosts = ["one.example", "two.example", "three.example"];
  const seed = {
    serves,
    returnsTo,
    hosts,
    resolverProfile: "kairos",
    unlockNote: "edit the resolver profile and wait for propagation",
  };

  it("builds one rule per seed host, in the seed's order", () => {
    const rules = hostBlockSeedRules(seed);
    expect(rules.map((r) => r.scope)).toEqual(
      hosts.map((host) => ({
        surface: "browser",
        domain: host,
        matches: [`*://${host}/*`, `*://*.${host}/*`],
      })),
    );
  });

  it("ids every rule from its host, so the set is distinct and re-derivable", () => {
    const rules = hostBlockSeedRules(seed);
    expect(rules.map((r) => r.id)).toEqual(hosts.map(seedRuleId));
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  });

  it("carries returnsTo into every rule's measure, the whole proximal claim", () => {
    for (const rule of hostBlockSeedRules(seed)) {
      expect(rule.outcome.measure).toEqual({
        kind: "next_span_in",
        areaIds: returnsTo,
      });
    }
  });

  it("produces rules the validator accepts", () => {
    for (const rule of hostBlockSeedRules(seed)) {
      expect(validateRuleSpec(rule)).toEqual([]);
    }
  });

  it("carries an exit on every armed primitive, as a rule-armed delivery", () => {
    for (const rule of hostBlockSeedRules(seed)) {
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
    }
  });

  it("takes an explicit host list, which is the only way a seed is built", () => {
    const rules = hostBlockSeedRules({ ...seed, hosts: ["sole.example"] });
    expect(rules).toHaveLength(1);
    expect(rules[0].scope).toEqual({
      surface: "browser",
      domain: "sole.example",
      matches: ["*://sole.example/*", "*://*.sole.example/*"],
    });
  });

  it("builds nothing from an empty list, rather than reaching for a default", () => {
    expect(hostBlockSeedRules({ ...seed, hosts: [] })).toEqual([]);
  });

  it("passes the outcome window through", () => {
    for (const rule of hostBlockSeedRules({ ...seed, windowMs: 60_000 })) {
      expect(rule.outcome.windowMs).toBe(60_000);
    }
  });

  it("names no area of its own, so the concrete plots stay at the composition edge", () => {
    // A seed built with no return areas is unsettleable, and the validator says
    // so rather than the factory inventing a plot to point at.
    const rules = hostBlockSeedRules({ ...seed, returnsTo: [] });
    for (const rule of rules) {
      expect(validateRuleSpec(rule)).toContain(
        "outcome.measure names no area, so it can never be settled",
      );
    }
  });
});
