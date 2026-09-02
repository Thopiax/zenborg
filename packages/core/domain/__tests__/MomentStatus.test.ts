import { describe, expect, it } from "vitest";
import {
  acceptMoment,
  countsAsAllocation,
  createMoment,
  isMomentError,
  type Moment,
} from "../entities/Moment.ts";

function newMoment(overrides: Partial<Moment> = {}): Moment {
  const created = createMoment({ name: "singing", areaId: "area-1" });
  if (isMomentError(created)) throw new Error(created.error);
  return { ...created, ...overrides };
}

describe("Moment status", () => {
  it("createMoment leaves status absent, which means accepted", () => {
    const m = newMoment();
    expect("status" in m).toBe(false);
  });

  describe("countsAsAllocation", () => {
    it("counts a moment with no status (every pre-existing vault moment)", () => {
      expect(countsAsAllocation(newMoment())).toBe(true);
    });

    it("counts an explicitly accepted moment", () => {
      expect(countsAsAllocation(newMoment({ status: "accepted" }))).toBe(true);
    });

    it("does not count a tentative moment", () => {
      expect(countsAsAllocation(newMoment({ status: "tentative" }))).toBe(
        false,
      );
    });
  });

  describe("acceptMoment", () => {
    it("turns a tentative moment into an accepted one", () => {
      const accepted = acceptMoment(newMoment({ status: "tentative" }));
      expect(accepted.status).toBe("accepted");
      expect(countsAsAllocation(accepted)).toBe(true);
    });

    it("preserves externalRef so the calendar link survives acceptance", () => {
      const ref = {
        source: "eventkit" as const,
        eventId: "ek-1",
        calendarId: "cal-1",
        lastWrittenHash: "0000000000000000",
        lastWrittenTitle: "singing",
        lastSyncedAt: "2026-08-21T10:00:00.000Z",
      };
      const accepted = acceptMoment(
        newMoment({ status: "tentative", externalRef: ref }),
      );
      expect(accepted.externalRef).toEqual(ref);
    });

    it("is a no-op on an already accepted moment", () => {
      const m = newMoment();
      expect(acceptMoment(m)).toBe(m);
    });
  });
});
