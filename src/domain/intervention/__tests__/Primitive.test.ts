import { describe, expect, it } from "vitest";
import {
  type CooldownSpec,
  carriesExit,
  type GateSpec,
  type InterceptSpec,
  type Primitive,
  type TransformSpec,
} from "../Primitive";

const gate: GateSpec = {
  kind: "gate",
  trigger: { type: "entry" },
  frictionType: { type: "intention", prompt: "what is this for?" },
  proceedAffordance: { label: "continue", action: { type: "continue" } },
};

const cooldown: CooldownSpec = {
  kind: "cooldown",
  duration: { type: "seconds", seconds: 900 },
  unlockPath: { type: "wait" },
};

const intercept: InterceptSpec = {
  kind: "intercept",
  events: ["scroll"],
  behavior: { type: "suppress" },
};

const transform: TransformSpec = {
  kind: "transform",
  replacement: { type: "hide" },
};

describe("carriesExit", () => {
  it("is true for gate, whose proceedAffordance is a required field", () => {
    expect(carriesExit(gate)).toBe(true);
  });

  it("is true for cooldown, whose unlockPath is a required field", () => {
    expect(carriesExit(cooldown)).toBe(true);
  });

  it("is false for intercept, which offers no surface at all", () => {
    expect(carriesExit(intercept)).toBe(false);
  });

  it("is false for transform, which renders without offering a way out", () => {
    expect(carriesExit(transform)).toBe(false);
  });

  it("reads through a schedule to the primitive it wraps", () => {
    const scheduled: Primitive = {
      kind: "schedule",
      window: { fromHour: 9, toHour: 17 },
      wraps: gate,
      outsideWindow: "inactive",
    };
    expect(carriesExit(scheduled)).toBe(true);
  });

  it("reads a schedule wrapping an intercept as carrying no exit", () => {
    const scheduled: Primitive = {
      kind: "schedule",
      window: { fromHour: 9, toHour: 17 },
      wraps: intercept,
      outsideWindow: "inactive",
    };
    expect(carriesExit(scheduled)).toBe(false);
  });

  it("is false for observe and actuate", () => {
    expect(
      carriesExit({ kind: "observe", signal: "s", persistedKey: "k" }),
    ).toBe(false);
    expect(
      carriesExit({ kind: "actuate", action: { type: "pause_media" } }),
    ).toBe(false);
  });
});
