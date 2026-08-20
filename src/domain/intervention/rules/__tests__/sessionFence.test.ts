import { describe, expect, it } from "vitest";
import type { CooldownSpec, GateSpec } from "../../Primitive";
import { carriesExit } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import {
  ALWAYS,
  rungFor,
  sessionFenceRule,
  TEN_SECONDS,
  THIRTY_SECONDS,
} from "../sessionFence";

const serves = { cycleId: "c-1", areaId: "area-themia" };

const fence = sessionFenceRule({
  id: "fence-themia-data",
  label: "Themia data",
  description: "only Themia data this afternoon",
  serves,
  paths: ["/Users/rafa/Developer/themia"],
  encloses: ["area-themia"],
});

describe("sessionFenceRule", () => {
  it("produces a rule the validator accepts", () => {
    expect(validateRuleSpec(fence)).toEqual([]);
  });

  it("scopes to the session surface, enclosing rather than watching", () => {
    expect(fence.scope).toEqual({
      surface: "session",
      paths: ["/Users/rafa/Developer/themia"],
    });
  });

  it("always delivers, because the principal asked for it", () => {
    // areaDrift ships at UNDER_TEST because whether it works is the open
    // question. Here it is not: withholding at half the decision points would
    // withhold something asked for in order to measure something that was not.
    expect(fence.deliveryProbability).toBe(ALWAYS);
    expect(fence.deliveryProbability).toBe(1);
  });

  it("does not auto-fade, so it cannot lapse while still believed in", () => {
    expect(fence.fadeEligibility).toBe("manual");
  });

  it("claims a return, not merely an interruption", () => {
    // A fence that only ever interrupts and never returns anyone has not worked.
    expect(fence.outcome.measure).toEqual({
      kind: "next_span_in",
      areaIds: ["area-themia"],
    });
    expect(fence.outcome.windowMs).toBeGreaterThan(0);
  });

  it("is friction — nothing is made unreachable", () => {
    expect(fence.mechanism).toBe("friction");
  });

  it("gives every rung an exit, which invariant 6 requires by type", () => {
    expect(fence.primitives.length).toBeGreaterThan(0);
    for (const rung of fence.primitives) {
      expect(carriesExit(rung)).toBe(true);
    }
  });

  it("escalates in order: a click, then a wait, then a wait AND a reason", () => {
    const [first, second, third] = fence.primitives;
    expect((first as GateSpec).frictionType).toEqual({ type: "confirmation" });
    expect((second as GateSpec).frictionType).toEqual({
      type: "delay",
      seconds: TEN_SECONDS,
    });
    // The third rung is a cooldown, not a gate: it is the only primitive that
    // can hold a wait and ask for a reason at once. A gate's frictionType is a
    // single variant, so expressing it as one would have dropped half.
    expect(third.kind).toBe("cooldown");
    const cooldown = third as CooldownSpec;
    expect(cooldown.duration).toEqual({
      type: "seconds",
      seconds: THIRTY_SECONDS,
    });
    expect(cooldown.unlockPath.type).toBe("unlock_with_intention");
  });

  it("arms teeth but never a wall — no standing cooldown, always an unlock", () => {
    for (const rung of fence.primitives) {
      if (rung.kind !== "cooldown") continue;
      // `standing` never lapses; that is the drogue blocklist, not a fence
      // whose key is a command in the same session.
      expect((rung as CooldownSpec).duration.type).toBe("seconds");
      expect((rung as CooldownSpec).unlockPath).toBeDefined();
    }
  });

  it("names the stream back at every rung, so the commitment is legible", () => {
    for (const rung of fence.primitives as GateSpec[]) {
      const text = JSON.stringify(rung);
      expect(text).toContain("Themia data");
    }
  });
});

describe("rungFor", () => {
  it("puts the first crossing on the first rung", () => {
    expect(rungFor(fence, 0)).toBe(fence.primitives[0]);
  });

  it("walks the ladder with each further crossing", () => {
    expect(rungFor(fence, 1)).toBe(fence.primitives[1]);
    expect(rungFor(fence, 2)).toBe(fence.primitives[2]);
  });

  it("repeats the last rung rather than escalating past it", () => {
    // There is nothing above "name what changed" that is still a gate, and the
    // step beyond it is a wall this rule cannot build: its exit is a command in
    // the same session, and a wall holds only when the key is not in the room.
    const last = fence.primitives[fence.primitives.length - 1];
    expect(rungFor(fence, 3)).toBe(last);
    expect(rungFor(fence, 99)).toBe(last);
  });

  it("degrades junk to the gentlest rung, never the harshest", () => {
    expect(rungFor(fence, Number.NaN)).toBe(fence.primitives[0]);
    expect(rungFor(fence, -5)).toBe(fence.primitives[0]);
    expect(rungFor(fence, 1.7)).toBe(fence.primitives[1]);
  });

  it("returns nothing for a rule carrying no rungs", () => {
    expect(rungFor({ ...fence, primitives: [] }, 0)).toBeUndefined();
  });
});
