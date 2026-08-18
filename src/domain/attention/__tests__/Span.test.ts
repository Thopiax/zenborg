import { describe, expect, it } from "vitest";
import { spanDuration, spanOverlaps, type Span } from "../Span";

const span: Span = {
  areaId: "area-equanimitech",
  start: 1_700_000_000_000,
  end: 1_700_000_600_000,
  sourceEventIds: ["e1", "e2"],
};

describe("spanDuration", () => {
  it("returns the elapsed milliseconds", () => {
    expect(spanDuration(span)).toBe(600_000);
  });

  it("returns 0 for a zero-length span rather than a negative", () => {
    expect(spanDuration({ ...span, end: span.start })).toBe(0);
  });

  it("clamps an inverted span to 0 instead of throwing", () => {
    expect(spanDuration({ ...span, end: span.start - 1000 })).toBe(0);
  });
});

describe("spanOverlaps", () => {
  it("is true when the window contains the span", () => {
    expect(spanOverlaps(span, span.start - 1, span.end + 1)).toBe(true);
  });

  it("is true when the window partially covers the span", () => {
    expect(spanOverlaps(span, span.end - 1, span.end + 1000)).toBe(true);
  });

  it("is false when the window ends exactly at the span start", () => {
    expect(spanOverlaps(span, span.start - 1000, span.start)).toBe(false);
  });

  it("is false when the window begins exactly at the span end", () => {
    expect(spanOverlaps(span, span.end, span.end + 1000)).toBe(false);
  });

  it("is false when the window is disjoint", () => {
    expect(spanOverlaps(span, 0, 1000)).toBe(false);
  });
});
