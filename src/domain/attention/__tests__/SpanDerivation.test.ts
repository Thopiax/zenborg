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
