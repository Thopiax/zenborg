import { describe, expect, it } from "vitest";
import {
  type Cadence,
  cadenceDays,
  overdueRatio,
} from "@/domain/value-objects/Cadence";

describe("cadenceDays", () => {
  it("maps the four buckets to their day counts", () => {
    expect(cadenceDays("weekly")).toBe(7);
    expect(cadenceDays("monthly")).toBe(30);
    expect(cadenceDays("quarterly")).toBe(91);
    expect(cadenceDays("yearly")).toBe(365);
  });
});

describe("overdueRatio", () => {
  it("is 1 exactly at the bucket's day count", () => {
    expect(overdueRatio(7, "weekly")).toBe(1);
    expect(overdueRatio(365, "yearly")).toBe(1);
  });

  it("rounds to 2 decimals", () => {
    expect(overdueRatio(30, "weekly")).toBe(4.29); // 30/7 = 4.2857…
    expect(overdueRatio(20, "weekly")).toBe(2.86); // 20/7 = 2.8571…
  });

  // The corrigendum's warning, encoded: ranking by raw days would put the
  // yearly friend at 400 days ahead of the weekly one at 20 days, forever.
  // The ratio inverts that — 2.86x overdue outranks 1.10x overdue.
  it("ranks a weekly person at 20 days above a yearly one at 400", () => {
    const weekly = overdueRatio(20, "weekly");
    const yearly = overdueRatio(400, "yearly");
    expect(weekly).toBe(2.86);
    expect(yearly).toBe(1.1);
    expect(weekly).toBeGreaterThan(yearly);
  });

  it("is below 1 inside the bucket", () => {
    expect(overdueRatio(3, "weekly")).toBe(0.43);
    expect(overdueRatio(10, "monthly")).toBe(0.33);
  });

  it("covers all four buckets", () => {
    const buckets: Cadence[] = ["weekly", "monthly", "quarterly", "yearly"];
    for (const c of buckets) {
      expect(overdueRatio(cadenceDays(c), c)).toBe(1);
    }
  });
});
