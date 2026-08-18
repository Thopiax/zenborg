import { describe, expect, it } from "vitest";
import type { Discrepancy } from "../../attention/Discrepancy";
import {
  type Delivery,
  GRANDFATHERED_EXCEPTIONS,
  validateDelivery,
} from "../Delivery";
import type { GateSpec, InterceptSpec } from "../Primitive";

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
          durationSeconds: 900,
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

  it("permits the grandfathered exception by rule id", () => {
    const delivery: Delivery = {
      origin: "rule",
      ruleId: GRANDFATHERED_EXCEPTIONS[0],
      discrepancy,
      primitives: [intercept],
    };
    expect(validateDelivery(delivery)).toEqual([]);
  });

  it("holds exactly one grandfathered exception", () => {
    expect(GRANDFATHERED_EXCEPTIONS).toHaveLength(1);
  });

  it("does not extend the exception to a self-armed delivery, which has no rule id", () => {
    const delivery: Delivery = { origin: "self", primitives: [intercept] };
    expect(validateDelivery(delivery).length).toBeGreaterThan(0);
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
