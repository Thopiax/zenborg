import { describe, expect, it } from "vitest";
import { generateCycleName } from "../CycleDateService";

describe("generateCycleName", () => {
  it("should generate week name with ISO week number", () => {
    // 2026-03-02 is in ISO week 10
    const date = new Date(2026, 2, 2);
    expect(generateCycleName("week", date)).toBe("Week 10");
  });

  it("should generate 2-week name with week range", () => {
    // 2026-03-02 (week 10) to 2026-03-15 (week 11)
    const date = new Date(2026, 2, 2);
    const result = generateCycleName("2-week", date);
    expect(result).toMatch(/^Weeks 10\u201311$/);
  });

  it("should generate month name with full month and year", () => {
    const date = new Date(2026, 2, 1); // March 1, 2026
    expect(generateCycleName("month", date)).toBe("March 2026");
  });

  it("should generate quarter name", () => {
    // Q1
    expect(generateCycleName("quarter", new Date(2026, 0, 1))).toBe("Q1 2026");
    // Q2
    expect(generateCycleName("quarter", new Date(2026, 3, 1))).toBe("Q2 2026");
    // Q3
    expect(generateCycleName("quarter", new Date(2026, 6, 1))).toBe("Q3 2026");
    // Q4
    expect(generateCycleName("quarter", new Date(2026, 9, 1))).toBe("Q4 2026");
  });

  it("should handle week at year boundary", () => {
    // Dec 29, 2025 is in ISO week 1 of 2026
    const date = new Date(2025, 11, 29);
    const result = generateCycleName("week", date);
    expect(result).toBe("Week 1");
  });
});
