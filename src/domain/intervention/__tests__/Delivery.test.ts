import { describe, expect, it } from "vitest";
import type { Discrepancy } from "../../attention/Discrepancy";
import { type Delivery, shouldDeliver, validateDelivery } from "../Delivery";
import type { CooldownSpec, GateSpec, InterceptSpec } from "../Primitive";

const gate: GateSpec = {
  kind: "gate",
  frictionType: { type: "confirmation" },
  proceedAffordance: { label: "proceed", action: { type: "continue" } },
};

const intercept: InterceptSpec = {
  kind: "intercept",
  events: ["scroll"],
  behavior: { type: "suppress" },
};

const discrepancy: Discrepancy = {
  kind: "drift",
  magnitude: 3,
  plantedMomentIds: ["m1"],
  observedAreaId: "area-themia",
  since: 1_700_000_000_000,
};

describe("validateDelivery", () => {
  it("accepts a rule-armed delivery whose primitives all carry an exit", () => {
    const delivery: Delivery = {
      origin: "rule",
      ruleId: "rule-area-drift",
      discrepancy,
      primitives: [gate],
    };
    expect(validateDelivery(delivery)).toEqual([]);
  });

  it("accepts a rule-armed cooldown, because teeth are permitted now", () => {
    const delivery: Delivery = {
      origin: "rule",
      ruleId: "rule-area-drift",
      discrepancy,
      primitives: [
        {
          kind: "cooldown",
          duration: { type: "seconds", seconds: 900 },
          unlockPath: { type: "wait" },
        },
      ],
    };
    expect(validateDelivery(delivery)).toEqual([]);
  });

  it("rejects a rule-armed delivery carrying a primitive with no exit", () => {
    const delivery: Delivery = {
      origin: "rule",
      ruleId: "rule-area-drift",
      discrepancy,
      primitives: [intercept],
    };
    expect(validateDelivery(delivery)).toContain(
      "invariant 6: every delivered primitive must carry a proceed affordance",
    );
  });

  it("rejects a self-armed delivery with no exit, since sovereignty is the exit", () => {
    const delivery: Delivery = { origin: "self", primitives: [intercept] };
    expect(validateDelivery(delivery)).toContain(
      "invariant 6: every delivered primitive must carry a proceed affordance",
    );
  });

  it("accepts host blocking, because it is a cooldown and carries its exit", () => {
    const hostBlock: CooldownSpec = {
      kind: "cooldown",
      enforcement: { at: "resolver", profile: "kairos" },
      duration: { type: "standing" },
      unlockPath: {
        type: "out_of_band",
        note: "edit the profile and wait for propagation",
      },
    };
    const delivery: Delivery = {
      origin: "rule",
      ruleId: "rule-host-block",
      discrepancy,
      primitives: [hostBlock],
    };
    expect(validateDelivery(delivery)).toEqual([]);
  });

  it("holds invariant 6 with no exception for any rule id", () => {
    const delivery: Delivery = {
      origin: "rule",
      ruleId: "rule-host-block",
      discrepancy,
      primitives: [intercept],
    };
    expect(validateDelivery(delivery)).toContain(
      "invariant 6: every delivered primitive must carry a proceed affordance",
    );
  });

  it("rejects a delivery carrying no primitives", () => {
    const delivery: Delivery = { origin: "self", primitives: [] };
    expect(validateDelivery(delivery)).toContain(
      "a delivery must carry at least one primitive",
    );
  });

  it("reports one problem even when several primitives lack an exit", () => {
    const delivery: Delivery = {
      origin: "self",
      primitives: [intercept, intercept],
    };
    expect(
      validateDelivery(delivery).filter((p) => p.startsWith("invariant 6")),
    ).toHaveLength(1);
  });
});

describe("shouldDeliver", () => {
  it("delivers always at 1 and never at 0", () => {
    for (const draw of [0, 0.25, 0.5, 0.99]) {
      expect(shouldDeliver(1, draw)).toBe(true);
      expect(shouldDeliver(0, draw)).toBe(false);
    }
  });

  it("splits the decision points at UNDER_TEST", () => {
    // The comparison condition: roughly half the eligible points do nothing.
    expect(shouldDeliver(0.5, 0.0)).toBe(true);
    expect(shouldDeliver(0.5, 0.49)).toBe(true);
    expect(shouldDeliver(0.5, 0.5)).toBe(false);
    expect(shouldDeliver(0.5, 0.99)).toBe(false);
  });

  it("fails safe, never open — a broken rule stops interrupting you", () => {
    // A malformed probability must not become "always deliver".
    expect(shouldDeliver(Number.NaN, 0)).toBe(false);
    expect(shouldDeliver(undefined as unknown as number, 0)).toBe(false);
    // Nor may a malformed draw.
    expect(shouldDeliver(1, Number.NaN)).toBe(false);
    // Out-of-range probabilities clamp rather than throw.
    expect(shouldDeliver(5, 0.9)).toBe(true);
    expect(shouldDeliver(-5, 0)).toBe(false);
  });
});
