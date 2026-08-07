import { describe, expect, it } from "vitest";
import {
  allocateMoment,
  countMomentsInPhase,
  createMoment,
  DAY_VIEW_PHASE_CAPACITY,
  hasDayViewCapacity,
  isMomentError,
  type Moment,
  updateMomentTiming,
} from "../entities/Moment";
import { Phase } from "../value-objects/Phase";
import { timingFromSchedule, Weekday } from "../value-objects/Schedule";

function newMoment(overrides: Partial<Moment> = {}): Moment {
  const created = createMoment({ name: "singing", areaId: "area-1" });
  if (isMomentError(created)) throw new Error(created.error);
  return { ...created, ...overrides };
}

describe("Moment timing", () => {
  describe("createMoment", () => {
    it("leaves ambient moments with no timing keys", () => {
      const moment = createMoment({ name: "singing", areaId: "area-1" });

      if (isMomentError(moment)) throw new Error(moment.error);
      expect("startTime" in moment).toBe(false);
      expect("durationMin" in moment).toBe(false);
    });

    it("stores an inherited start time and duration", () => {
      const moment = createMoment({
        name: "singing",
        areaId: "area-1",
        startTime: "14:00",
        durationMin: 60,
      });

      if (isMomentError(moment)) throw new Error(moment.error);
      expect(moment.startTime).toBe("14:00");
      expect(moment.durationMin).toBe(60);
    });

    it("rejects a malformed start time", () => {
      const moment = createMoment({
        name: "singing",
        areaId: "area-1",
        startTime: "2pm",
      });

      expect(moment).toEqual({
        error: "Moment startTime must be HH:MM (24h), got: 2pm",
      });
    });

    it("rejects a non-positive duration", () => {
      const moment = createMoment({
        name: "singing",
        areaId: "area-1",
        durationMin: -30,
      });

      expect(moment).toEqual({
        error: "Moment durationMin must be a positive whole number of minutes",
      });
    });
  });

  describe("timingFromSchedule", () => {
    it("hands a habit's schedule timing to the moment it spawns", () => {
      expect(
        timingFromSchedule({
          weekdays: [Weekday.MON],
          startTime: "12:00",
          durationMin: 90,
        }),
      ).toEqual({ startTime: "12:00", durationMin: 90 });
    });
  });

  describe("updateMomentTiming", () => {
    it("overrides the inherited start time on a single instance", () => {
      const moment = newMoment({ startTime: "12:00", durationMin: 90 });

      const updated = updateMomentTiming(moment, { startTime: "12:15" });

      if (isMomentError(updated)) throw new Error(updated.error);
      expect(updated.startTime).toBe("12:15");
      expect(updated.durationMin).toBe(90);
    });

    it("clears timing with null", () => {
      const moment = newMoment({ startTime: "12:00", durationMin: 90 });

      const updated = updateMomentTiming(moment, {
        startTime: null,
        durationMin: null,
      });

      if (isMomentError(updated)) throw new Error(updated.error);
      expect(updated.startTime).toBeUndefined();
      expect(updated.durationMin).toBeUndefined();
    });

    it("rejects a malformed start time", () => {
      const moment = newMoment();

      expect(updateMomentTiming(moment, { startTime: "24:00" })).toEqual({
        error: "Moment startTime must be HH:MM (24h), got: 24:00",
      });
    });
  });
});

describe("Day-view phase capacity", () => {
  const day = "2026-08-10";

  function allocated(order: number): Moment {
    return newMoment({ day, phase: Phase.MORNING, order });
  }

  it("is three — the day view's grid, not a data-layer limit", () => {
    expect(DAY_VIEW_PHASE_CAPACITY).toBe(3);
  });

  describe("countMomentsInPhase", () => {
    it("counts only the moments in the given (day, phase)", () => {
      const elsewhere = newMoment({ day, phase: Phase.EVENING, order: 0 });

      expect(
        countMomentsInPhase(
          [allocated(0), allocated(1), elsewhere],
          day,
          Phase.MORNING,
        ),
      ).toBe(2);
    });

    it("can exclude a moment being moved", () => {
      const moving = allocated(0);

      expect(
        countMomentsInPhase(
          [moving, allocated(1)],
          day,
          Phase.MORNING,
          moving.id,
        ),
      ).toBe(1);
    });
  });

  describe("hasDayViewCapacity", () => {
    it("is true below capacity", () => {
      expect(hasDayViewCapacity([allocated(0)], day, Phase.MORNING)).toBe(true);
    });

    it("is false at capacity", () => {
      expect(
        hasDayViewCapacity(
          [allocated(0), allocated(1), allocated(2)],
          day,
          Phase.MORNING,
        ),
      ).toBe(false);
    });
  });

  describe("allocateMoment", () => {
    it("accepts an order beyond the day-view capacity — zoomed-in time-blocking", () => {
      const moment = newMoment();

      const result = allocateMoment(moment, {
        day,
        phase: Phase.MORNING,
        order: 4,
      });

      expect(result.order).toBe(4);
    });

    it("still rejects a negative order", () => {
      const moment = newMoment();

      expect(() =>
        allocateMoment(moment, { day, phase: Phase.MORNING, order: -1 }),
      ).toThrow("Order must be non-negative");
    });
  });
});
