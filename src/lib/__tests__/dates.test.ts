import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCycleSubtitle } from "@/lib/dates";

describe("formatCycleSubtitle", () => {
  beforeEach(() => {
    // Anchor "now" at a mid-afternoon moment so the partial day is non-zero —
    // this is exactly the case that used to truncate via formatDistanceToNowStrict.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 3, 17, 59, 0)); // 2026-06-03, local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts full calendar days left, inclusive of today", () => {
    // 2026-06-03 → 2026-06-10: 7 calendar days ahead + today = 8.
    expect(formatCycleSubtitle("2026-06-01", "2026-06-10", true)).toBe(
      "8 days left",
    );
  });

  it('says "ends today" on the last day', () => {
    expect(formatCycleSubtitle("2026-06-01", "2026-06-03", true)).toBe(
      "ends today",
    );
  });

  it('says "ends tomorrow" the day before the end', () => {
    expect(formatCycleSubtitle("2026-06-01", "2026-06-04", true)).toBe(
      "ends tomorrow",
    );
  });

  it("reports an ongoing cycle with no end date", () => {
    expect(formatCycleSubtitle("2026-06-01", null, true)).toBe("ongoing");
  });

  it("reports a future cycle by start distance", () => {
    expect(formatCycleSubtitle("2026-06-04", "2026-06-20", false)).toBe(
      "starts tomorrow",
    );
  });
});
