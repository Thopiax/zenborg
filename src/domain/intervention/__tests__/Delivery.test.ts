import { describe, expect, it } from "vitest";
import type { Discrepancy } from "../../attention/Discrepancy";
import { type Delivery, validateDelivery } from "../Delivery";
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
