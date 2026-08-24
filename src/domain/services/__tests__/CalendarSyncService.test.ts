import { describe, expect, it } from "vitest";
import {
  createMoment,
  isMomentError,
  type Moment,
} from "../../entities/Moment.ts";
import {
  type EventFields,
  eventFieldsForMoment,
  momentHash,
} from "../CalendarSyncService.ts";

function newMoment(overrides: Partial<Moment> = {}): Moment {
  const created = createMoment({ name: "standup", areaId: "area-1" });
  if (isMomentError(created)) throw new Error(created.error);
  return { ...created, ...overrides };
}

const fields: EventFields = {
  title: "standup",
  day: "2026-08-24",
  startTime: "10:30",
  durationMin: 30,
};

describe("momentHash", () => {
  it("pins a literal digest, so a refactor cannot quietly change the algorithm", () => {
    expect(momentHash(fields)).toBe("ff236ccaea7fb964");
  });

  it("ignores title: renaming an event in Calendar.app is not a timing change", () => {
    expect(momentHash({ ...fields, title: "something else entirely" })).toBe(
      momentHash(fields),
    );
  });

  it("is 16 lowercase hex characters", () => {
    expect(momentHash(fields)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes when any timing field changes", () => {
    const base = momentHash(fields);
    expect(momentHash({ ...fields, startTime: "10:45" })).toBe(
      "3aabf0c623137da0",
    );
    expect(momentHash({ ...fields, durationMin: 45 })).toBe(
      "ff2069caea7d7e74",
    );
    expect(momentHash({ ...fields, day: "2026-08-25" })).toBe(
      "98be2a9224c0686d",
    );
    for (const digest of [
      "3aabf0c623137da0",
      "ff2069caea7d7e74",
      "98be2a9224c0686d",
    ]) {
      expect(digest).not.toBe(base);
    }
  });
});

describe("eventFieldsForMoment", () => {
  it("maps an allocated timed moment to event fields", () => {
    const m = newMoment({
      day: "2026-08-24",
      startTime: "10:30",
      durationMin: 30,
    });
    expect(eventFieldsForMoment(m)).toEqual(fields);
  });

  it("returns null for an ambient moment: no start time is never invented", () => {
    expect(eventFieldsForMoment(newMoment({ day: "2026-08-24" }))).toBeNull();
  });

  it("returns null for an unallocated moment", () => {
    expect(
      eventFieldsForMoment(
        newMoment({ startTime: "10:30", durationMin: 30 }),
      ),
    ).toBeNull();
  });

  it("defaults a missing duration to 60 minutes", () => {
    const m = newMoment({ day: "2026-08-24", startTime: "10:30" });
    expect(eventFieldsForMoment(m)?.durationMin).toBe(60);
  });
});
