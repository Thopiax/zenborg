import { describe, expect, it } from "vitest";
import { type Discrepancy, isAbsence, isDrift } from "../Discrepancy";

const drift: Discrepancy = {
  kind: "drift",
  magnitude: 7,
  plantedMomentIds: ["m1", "m2"],
  observedAreaId: "area-themia",
  since: 1_700_000_000_000,
};

describe("Discrepancy", () => {
  it("carries the four kinds the spec names", () => {
    const kinds: Discrepancy["kind"][] = [
      "drift",
      "absence",
      "overrun",
      "fragmentation",
    ];
    expect(kinds).toHaveLength(4);
  });

  it("allows an absent observedAreaId, since absence observes no area", () => {
    const absence: Discrepancy = {
      kind: "absence",
      magnitude: 1,
      plantedMomentIds: ["m1"],
      since: 1_700_000_000_000,
    };
    expect(absence.observedAreaId).toBeUndefined();
  });

  it("carries magnitude as a raw number, uncut", () => {
    expect(typeof drift.magnitude).toBe("number");
  });
});

describe("isDrift", () => {
  it("is true for a drift discrepancy with a non-empty planting", () => {
    expect(isDrift(drift)).toBe(true);
  });

  it("is false for other kinds", () => {
    expect(isDrift({ ...drift, kind: "overrun" })).toBe(false);
  });

  it("is false for a drift with an empty planting, which cannot exist", () => {
    expect(isDrift({ ...drift, plantedMomentIds: [] })).toBe(false);
  });
});

describe("isAbsence", () => {
  const absence: Discrepancy = {
    kind: "absence",
    magnitude: 4,
    plantedMomentIds: [],
    observedAreaId: "area-themia",
    since: 1_700_000_000_000,
  };

  it("is true for attention observed against an empty cell", () => {
    expect(isAbsence(absence)).toBe(true);
  });

  it("is false for a drift", () => {
    expect(isAbsence(drift)).toBe(false);
  });

  it("is false for an absence that somehow carries plantings, which is malformed", () => {
    expect(isAbsence({ ...absence, plantedMomentIds: ["m1"] })).toBe(false);
  });

  it("is the mirror of isDrift: neither holds for the other's shape", () => {
    expect(isDrift(absence)).toBe(false);
    expect(isAbsence(drift)).toBe(false);
  });
});
