import { describe, expect, it } from "vitest";
import {
  CultivarSchema,
  type Cultivar,
  findCultivar,
  nextInRotation,
  normalizeCultivars,
  validateRotationAgainstHabit,
} from "../cultivar-schema";

describe("CultivarSchema", () => {
  it("parses a valid cultivar with tag only", () => {
    const result = CultivarSchema.safeParse({ tag: "recovery" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tag).toBe("recovery");
      expect(result.data.params).toBeUndefined();
    }
  });

  it("parses a valid cultivar with params", () => {
    const result = CultivarSchema.safeParse({
      tag: "long-run",
      params: { durationMin: 90, pace: "easy" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.params).toEqual({ durationMin: 90, pace: "easy" });
    }
  });

  it("rejects invalid tag format", () => {
    const result = CultivarSchema.safeParse({ tag: "INVALID TAG!" });
    expect(result.success).toBe(false);
  });

  it("rejects tag exceeding 20 chars", () => {
    const result = CultivarSchema.safeParse({
      tag: "a".repeat(21),
    });
    expect(result.success).toBe(false);
  });
});

describe("normalizeCultivars", () => {
  it("normalizes tags, deduplicates, drops invalid", () => {
    const input = [
      { tag: "Recovery", params: { durationMin: 30 } },
      { tag: "recovery" },
      { tag: "" },
      { tag: "speed", params: {} },
    ];
    const result = normalizeCultivars(input);
    expect(result).toEqual([
      { tag: "recovery", params: { durationMin: 30 } },
      { tag: "speed" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeCultivars([])).toEqual([]);
  });
});

describe("findCultivar", () => {
  const cultivars: Cultivar[] = [
    { tag: "recovery", params: { durationMin: 30 } },
    { tag: "speed" },
  ];

  it("finds by exact tag", () => {
    expect(findCultivar(cultivars, "recovery")).toEqual(cultivars[0]);
  });

  it("returns undefined for missing tag", () => {
    expect(findCultivar(cultivars, "tempo")).toBeUndefined();
  });
});

describe("nextInRotation", () => {
  const rotation = ["recovery", "long", "speed"];

  it("returns first element at count 0", () => {
    expect(nextInRotation(rotation, 0)).toBe("recovery");
  });

  it("cycles through via modulo", () => {
    expect(nextInRotation(rotation, 1)).toBe("long");
    expect(nextInRotation(rotation, 2)).toBe("speed");
    expect(nextInRotation(rotation, 3)).toBe("recovery");
    expect(nextInRotation(rotation, 7)).toBe("long");
  });
});

describe("validateRotationAgainstHabit", () => {
  const cultivars: Cultivar[] = [
    { tag: "recovery" },
    { tag: "long" },
    { tag: "speed" },
  ];

  it("returns null for valid rotation (subset)", () => {
    expect(
      validateRotationAgainstHabit(["recovery", "long"], cultivars),
    ).toBeNull();
  });

  it("returns error for tag not in cultivars", () => {
    const error = validateRotationAgainstHabit(["tempo"], cultivars);
    expect(error).toContain("tempo");
  });

  it("returns null for empty rotation", () => {
    expect(validateRotationAgainstHabit([], cultivars)).toBeNull();
  });
});
