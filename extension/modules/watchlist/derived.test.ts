import { describe, it, expect } from "vitest";
import { deriveObserveSet } from "./derived";

describe("deriveObserveSet", () => {
  it("returns fence domains", () => {
    const fences = {
      a: {
        id: "a",
        label: "A",
        domains: ["chess.com", "youtube.com"],
        enforcement: { kind: "block" as const, standing: true, enforcement: "browser" as const },
        proceed: { label: "x", action: { type: "wait" as const } },
        deliveryProbability: 1,
      },
    };
    expect(deriveObserveSet(fences, {})).toEqual(
      expect.arrayContaining(["chess.com", "youtube.com"])
    );
  });

  it("returns area-map domains", () => {
    expect(deriveObserveSet({}, { "linkedin.com": "area-1" })).toContain("linkedin.com");
  });

  it("dedupes across both sources", () => {
    const fences = {
      a: {
        id: "a",
        label: "A",
        domains: ["youtube.com"],
        enforcement: { kind: "block" as const, standing: true, enforcement: "browser" as const },
        proceed: { label: "x", action: { type: "wait" as const } },
        deliveryProbability: 1,
      },
    };
    const result = deriveObserveSet(fences, { "youtube.com": "area-1" });
    expect(result.filter((d) => d === "youtube.com")).toHaveLength(1);
  });

  it("returns empty when both sources are empty", () => {
    expect(deriveObserveSet({}, {})).toHaveLength(0);
  });
});
