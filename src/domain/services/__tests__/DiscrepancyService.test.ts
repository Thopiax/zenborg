import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "../../attention/ActivityEvent";
import type { Span } from "../../attention/Span";
import { detectDrift, type DriftInput } from "../DiscrepancyService";

const SPAN_START = 1_700_000_000_000;
const SPAN_END = SPAN_START + 600_000;

const span: Span = {
  areaId: "area-themia",
  start: SPAN_START,
  end: SPAN_END,
  sourceEventIds: ["e1"],
};

function event(kind: string, ts: number, id = "x"): ActivityEvent {
  return { id, surface: "agent", kind, ts, sessionId: "s1", payload: {} };
}

function input(overrides: Partial<DriftInput> = {}): DriftInput {
  return {
    plantedMomentIds: ["m1"],
    plantedAreaIds: ["area-equanimitech"],
    span,
    events: [],
    ...overrides,
  };
}

describe("detectDrift", () => {
  it("returns null when the cell is empty, since nothing was planted", () => {
    expect(detectDrift(input({ plantedMomentIds: [], plantedAreaIds: [] }))).toBeNull();
  });

  it("returns null when the span resolves to a planted area", () => {
    expect(detectDrift(input({ plantedAreaIds: ["area-themia"] }))).toBeNull();
  });

  it("returns null when the span resolves to any one of several planted areas", () => {
    const result = detectDrift(
      input({ plantedAreaIds: ["area-equanimitech", "area-themia"] })
    );
    expect(result).toBeNull();
  });

  it("returns a drift when the span names an area none of the plantings do", () => {
    const result = detectDrift(input());
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("drift");
    expect(result?.observedAreaId).toBe("area-themia");
    expect(result?.plantedMomentIds).toEqual(["m1"]);
    expect(result?.since).toBe(SPAN_START);
  });

  it("counts human-actor events inside the span as magnitude", () => {
    const result = detectDrift(
      input({
        events: [
          event("prompt", SPAN_START + 1, "a"),
          event("prompt", SPAN_START + 2, "b"),
          event("tool_dispatched", SPAN_START + 3, "c"),
        ],
      })
    );
    expect(result?.magnitude).toBe(2);
  });

  it("ignores human events outside the span", () => {
    const result = detectDrift(
      input({
        events: [
          event("prompt", SPAN_START - 1, "a"),
          event("prompt", SPAN_END, "b"),
          event("prompt", SPAN_START + 1, "c"),
        ],
      })
    );
    expect(result?.magnitude).toBe(1);
  });

  it("yields magnitude 0 rather than null when no human event fired", () => {
    const result = detectDrift(
      input({ events: [event("tool_dispatched", SPAN_START + 1)] })
    );
    expect(result?.magnitude).toBe(0);
  });

  it("fails soft on a planting with no resolvable areas", () => {
    const result = detectDrift(input({ plantedAreaIds: [] }));
    expect(result?.kind).toBe("drift");
  });
});
