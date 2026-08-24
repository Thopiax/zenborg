import { describe, expect, it } from "vitest";
import { CALENDAR_GRID_MINUTES, snapToGrid } from "../TimeGrid.ts";

describe("snapToGrid", () => {
  it("exposes the 15 minute constant", () => {
    expect(CALENDAR_GRID_MINUTES).toBe(15);
  });

  it("leaves an exact grid time unchanged", () => {
    expect(snapToGrid("10:30", 60)).toEqual({
      startTime: "10:30",
      durationMin: 60,
    });
  });

  it("snaps 10:07 down to 10:00", () => {
    expect(snapToGrid("10:07", 60).startTime).toBe("10:00");
  });

  it("snaps 10:08 up to 10:15", () => {
    expect(snapToGrid("10:08", 60).startTime).toBe("10:15");
  });

  it("snaps across the hour: 10:53 becomes 11:00", () => {
    expect(snapToGrid("10:53", 60).startTime).toBe("11:00");
  });

  it("clamps 23:55 to 23:45 rather than wrapping the day", () => {
    expect(snapToGrid("23:55", 30).startTime).toBe("23:45");
  });

  it("snaps a 20 minute duration to 15 and a 25 minute one to 30", () => {
    expect(snapToGrid("10:00", 20).durationMin).toBe(15);
    expect(snapToGrid("10:00", 25).durationMin).toBe(30);
  });

  it("never snaps a duration below 15", () => {
    expect(snapToGrid("10:00", 5).durationMin).toBe(15);
  });
});
