import { describe, expect, it } from "vitest";
import {
  composeReflection,
  parseReflection,
} from "@zenborg/core/domain/value-objects/Reflection";

/**
 * `Cycle.reflection` is ONE string. L0 and L1 are a rendering convention —
 * split on the first blank line — not two stored fields. These tests pin the
 * convention so no one is tempted to add `reflectionL0` to the vault.
 */
describe("parseReflection", () => {
  it("splits on the first blank line", () => {
    const parsed = parseReflection("The season held Lisbon.\n\nAnd the rest.");

    expect(parsed).toEqual({
      l0: "The season held Lisbon.",
      l1: "And the rest.",
    });
  });

  it("keeps everything after the first blank line in L1, blank lines included", () => {
    const parsed = parseReflection("Headline.\n\nFirst body.\n\nSecond body.");

    expect(parsed?.l0).toBe("Headline.");
    expect(parsed?.l1).toBe("First body.\n\nSecond body.");
  });

  it("treats a whitespace-only line as blank", () => {
    const parsed = parseReflection("Headline.\n   \nBody.");

    expect(parsed).toEqual({ l0: "Headline.", l1: "Body." });
  });

  it("keeps a single newline inside L0 — only a BLANK line separates", () => {
    const parsed = parseReflection("One line.\nStill L0.\n\nBody.");

    expect(parsed).toEqual({ l0: "One line.\nStill L0.", l1: "Body." });
  });

  it("returns an empty L1 when there is no blank line", () => {
    expect(parseReflection("Just the headline.")).toEqual({
      l0: "Just the headline.",
      l1: "",
    });
  });

  it("returns null for a season with no reflection", () => {
    expect(parseReflection(null)).toBeNull();
  });

  it("returns null for whitespace only — an empty reflection is no reflection", () => {
    expect(parseReflection("   \n\n  ")).toBeNull();
  });

  it("trims the surrounding whitespace of both rungs", () => {
    expect(parseReflection("\n  Headline.  \n\n  Body.  \n")).toEqual({
      l0: "Headline.",
      l1: "Body.",
    });
  });
});

describe("composeReflection", () => {
  it("joins the two rungs with a blank line — the shape parseReflection reads", () => {
    expect(composeReflection("Headline.", "Body.")).toBe("Headline.\n\nBody.");
  });

  it("round-trips through parseReflection", () => {
    const composed = composeReflection("Headline.", "Body.\n\nMore body.");

    expect(parseReflection(composed)).toEqual({
      l0: "Headline.",
      l1: "Body.\n\nMore body.",
    });
  });

  it("drops the separator when only one rung carries text", () => {
    expect(composeReflection("Headline.", "")).toBe("Headline.");
    expect(composeReflection("", "Body.")).toBe("Body.");
  });

  it("returns null when neither rung carries text — never an empty string", () => {
    expect(composeReflection("", "")).toBeNull();
    expect(composeReflection("  ", "\n")).toBeNull();
  });
});
