import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "../ActivityEvent";
import type { AreaId } from "../ids";
import { deriveSpans } from "../SpanDerivation";

const T = 1_700_000_000_000;
const MINUTE = 60_000;

function ev(
  id: string,
  ts: number,
  area: string | undefined,
  extra: Partial<ActivityEvent> = {},
): ActivityEvent {
  return {
    id,
    surface: "agent",
    kind: "prompt",
    ts,
    sessionId: "s1",
    payload: area === undefined ? {} : { area },
    ...extra,
  };
}

/** Synthetic resolver: the fixture states the area outright, so span logic is isolated. */
const resolve = (e: ActivityEvent): AreaId | undefined =>
  typeof e.payload.area === "string" ? e.payload.area : undefined;

const config = { idleGapMs: 15 * MINUTE };

describe("deriveSpans", () => {
  it("returns nothing for no events", () => {
    expect(deriveSpans([], resolve, config)).toEqual([]);
  });

  it("returns nothing when no event resolves to an area", () => {
    expect(deriveSpans([ev("a", T, undefined)], resolve, config)).toEqual([]);
  });

  it("makes one span from one event, with zero elapsed time", () => {
    const spans = deriveSpans([ev("a", T, "area-craft")], resolve, config);
    expect(spans).toEqual([
      { areaId: "area-craft", start: T, end: T, sourceEventIds: ["a"] },
    ]);
  });

  it("joins consecutive events on one area into a single span", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + MINUTE, "area-craft")],
      resolve,
      config,
    );
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      areaId: "area-craft",
      start: T,
      end: T + MINUTE,
      sourceEventIds: ["a", "b"],
    });
  });

  it("splits when the gap exceeds the idle threshold, even on the same area", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + 16 * MINUTE, "area-craft")],
      resolve,
      config,
    );
    expect(spans).toHaveLength(2);
    expect(spans.map((s) => s.sourceEventIds)).toEqual([["a"], ["b"]]);
  });

  it("does not split exactly at the idle threshold", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + 15 * MINUTE, "area-craft")],
      resolve,
      config,
    );
    expect(spans).toHaveLength(1);
  });

  it("splits when the area changes, however close the events are", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + 1000, "area-themia")],
      resolve,
      config,
    );
    expect(spans.map((s) => s.areaId)).toEqual(["area-craft", "area-themia"]);
  });

  it("returns to an area as a new span rather than reopening the old one", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft"),
        ev("b", T + 1000, "area-themia"),
        ev("c", T + 2000, "area-craft"),
      ],
      resolve,
      config,
    );
    expect(spans.map((s) => s.areaId)).toEqual([
      "area-craft",
      "area-themia",
      "area-craft",
    ]);
  });

  it("skips unresolvable events without splitting the span around them", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft"),
        ev("noise", T + MINUTE, undefined),
        ev("b", T + 2 * MINUTE, "area-craft"),
      ],
      resolve,
      config,
    );
    expect(spans).toHaveLength(1);
    expect(spans[0].sourceEventIds).toEqual(["a", "b"]);
  });

  it("sorts events by time rather than trusting arrival order", () => {
    const spans = deriveSpans(
      [ev("b", T + MINUTE, "area-craft"), ev("a", T, "area-craft")],
      resolve,
      config,
    );
    expect(spans).toHaveLength(1);
    expect(spans[0].sourceEventIds).toEqual(["a", "b"]);
    expect(spans[0].start).toBe(T);
  });

  it("extends the end by a measured duration", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft", { durationMs: 5 * MINUTE })],
      resolve,
      config,
    );
    expect(spans[0].end).toBe(T + 5 * MINUTE);
  });

  it("takes the furthest measured end, not merely the last event's timestamp", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft", { durationMs: 10 * MINUTE }),
        ev("b", T + MINUTE, "area-craft"),
      ],
      resolve,
      config,
    );
    expect(spans[0].end).toBe(T + 10 * MINUTE);
  });

  it("measures the idle gap from the previous event's timestamp, not its measured end", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft", { durationMs: 60 * MINUTE }),
        ev("b", T + 16 * MINUTE, "area-craft"),
      ],
      resolve,
      config,
    );
    expect(spans).toHaveLength(2);
  });

  it("keeps events sharing one timestamp in a single span", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T, "area-craft")],
      resolve,
      config,
    );
    expect(spans).toHaveLength(1);
    expect(spans[0].sourceEventIds).toHaveLength(2);
  });

  it("never produces a span whose end precedes its start", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + MINUTE, "area-craft")],
      resolve,
      config,
    );
    for (const span of spans)
      expect(span.end).toBeGreaterThanOrEqual(span.start);
  });
});

describe("deriveSpans across plan boundaries", () => {
  const withBoundaries = (boundaries: readonly number[]) => ({
    ...config,
    boundaries,
  });

  it("closes a span at a planned boundary even when the person never went quiet", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + 2 * MINUTE, "area-craft")],
      resolve,
      withBoundaries([T + MINUTE]),
    );
    expect(spans).toHaveLength(2);
    expect(spans.map((s) => s.sourceEventIds)).toEqual([["a"], ["b"]]);
  });

  it("does not stretch the closed span forward to reach the boundary", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + 2 * MINUTE, "area-craft")],
      resolve,
      withBoundaries([T + MINUTE]),
    );
    // A boundary only ever pulls an end back. Claiming time up to the boundary
    // would invent attention nobody observed, which is invariant 3's rule.
    expect(spans[0].end).toBe(T);
  });

  it("does not let a measured duration reach past a boundary", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft", { durationMs: 10 * MINUTE }),
        ev("b", T + 12 * MINUTE, "area-craft"),
      ],
      resolve,
      withBoundaries([T + MINUTE]),
    );
    expect(spans[0].end).toBe(T + MINUTE);
  });

  it("starts the next span at its first observation, not at the boundary", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + 2 * MINUTE, "area-craft")],
      resolve,
      withBoundaries([T + MINUTE]),
    );
    expect(spans[1].start).toBe(T + 2 * MINUTE);
  });

  it("closes at the first boundary crossed when several fall in one silence", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft", { durationMs: 10 * MINUTE }),
        ev("b", T + 5 * MINUTE, "area-craft"),
      ],
      resolve,
      withBoundaries([T + MINUTE, T + 3 * MINUTE]),
    );
    expect(spans).toHaveLength(2);
    expect(spans[0].end).toBe(T + MINUTE);
  });

  it("treats a boundary landing exactly on an event as starting that event's span", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + MINUTE, "area-craft")],
      resolve,
      withBoundaries([T + MINUTE]),
    );
    expect(spans).toHaveLength(2);
    expect(spans[1].start).toBe(T + MINUTE);
  });

  it("ignores a boundary before anything was observed", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + MINUTE, "area-craft")],
      resolve,
      withBoundaries([T - 5 * MINUTE]),
    );
    expect(spans).toHaveLength(1);
  });

  it("ignores a boundary after the last observation, and never extends a span to reach it", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + MINUTE, "area-craft")],
      resolve,
      withBoundaries([T + 30 * MINUTE]),
    );
    expect(spans).toHaveLength(1);
    expect(spans[0].end).toBe(T + MINUTE);
  });

  it("produces nothing from boundaries alone", () => {
    expect(deriveSpans([], resolve, withBoundaries([T, T + MINUTE]))).toEqual(
      [],
    );
  });

  it("orders boundaries defensively rather than trusting the caller", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft", { durationMs: 10 * MINUTE }),
        ev("b", T + 5 * MINUTE, "area-craft"),
      ],
      resolve,
      withBoundaries([T + 3 * MINUTE, T + MINUTE]),
    );
    expect(spans[0].end).toBe(T + MINUTE);
  });

  it("never produces a span whose end precedes its start, even on a boundary", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft"), ev("b", T + 2 * MINUTE, "area-craft")],
      resolve,
      withBoundaries([T]),
    );
    for (const span of spans)
      expect(span.end).toBeGreaterThanOrEqual(span.start);
  });
});

describe("deriveSpans, human actors only", () => {
  /**
   * Shadow mode over 90 days of the real log: two thirds of every event was the
   * agent, those two thirds formed 83% of the drift records, and the median
   * record scored a magnitude of 0. `magnitudeOf` had always filtered to human
   * kinds; span formation had not. The model was disagreeing with itself, and
   * the disagreement was the loudest signal in the data.
   */

  const agentEvent = (id: string, ts: number, area: string) =>
    ev(id, ts, area, { kind: "tool_dispatched" });

  it("does not open a span on an agent-actor event", () => {
    expect(
      deriveSpans([agentEvent("a", T, "area-craft")], resolve, config),
    ).toEqual([]);
  });

  it("does not open a span on a joint-actor event", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-craft", { kind: "session_start" })],
      resolve,
      config,
    );
    expect(spans).toEqual([]);
  });

  it("does not let agent events extend a span", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft"),
        agentEvent("b", T + MINUTE, "area-craft"),
        ev("c", T + 2 * MINUTE, "area-craft"),
      ],
      resolve,
      config,
    );
    expect(spans).toHaveLength(1);
    expect(spans[0].sourceEventIds).toEqual(["a", "c"]);
  });

  it("does not let an agent event on another area cut a span", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft"),
        agentEvent("b", T + MINUTE, "area-admin"),
        ev("c", T + 2 * MINUTE, "area-craft"),
      ],
      resolve,
      config,
    );
    expect(spans).toHaveLength(1);
    expect(spans[0].areaId).toBe("area-craft");
  });

  it("does not let agent events bridge a silence longer than the idle gap", () => {
    const spans = deriveSpans(
      [
        ev("a", T, "area-craft"),
        agentEvent("b", T + 10 * MINUTE, "area-craft"),
        ev("c", T + 20 * MINUTE, "area-craft"),
      ],
      resolve,
      config,
    );
    expect(spans).toHaveLength(2);
  });

  it("keeps every browser event, since no browser kind is the agent's", () => {
    const spans = deriveSpans(
      [ev("a", T, "area-weeds", { surface: "browser", kind: "navigation" })],
      resolve,
      config,
    );
    expect(spans).toHaveLength(1);
  });
});
