import { describe, expect, it } from "vitest";
import {
  createMoment,
  isMomentError,
  type Moment,
} from "../../entities/Moment.ts";
import {
  type EventFields,
  applyEventToMoment,
  eventFieldsForMoment,
  momentHash,
  reconcile,
} from "../CalendarSyncService.ts";
import vectors from "../../../../calendar-sidecar/fixtures/reconcile-vectors.json";
import { getDefaultPhaseConfigs, Phase } from "../../value-objects/Phase.ts";

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
    expect(momentHash({ ...fields, durationMin: 45 })).toBe("ff2069caea7d7e74");
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
      eventFieldsForMoment(newMoment({ startTime: "10:30", durationMin: 30 })),
    ).toBeNull();
  });

  it("defaults a missing duration to 60 minutes", () => {
    const m = newMoment({ day: "2026-08-24", startTime: "10:30" });
    expect(eventFieldsForMoment(m)?.durationMin).toBe(60);
  });
});

// Filter out documentation-only vectors (no moment/event/context)
const runnableVectors = vectors.filter(
  (v): v is (typeof v) & { context: unknown } => "context" in v,
);

describe("reconcile: the truth table", () => {
  for (const vector of runnableVectors) {
    it(vector.name, () => {
      expect(
        reconcile(
          vector.moment as Moment | null,
          vector.event as Parameters<typeof reconcile>[1],
          vector.context as Parameters<typeof reconcile>[2],
        ),
      ).toEqual(vector.expected);
    });
  }
});

describe("applyEventToMoment", () => {
  const configs = getDefaultPhaseConfigs();

  it("re-derives phase when an event moves from 11:00 to 14:00", () => {
    const m = newMoment({
      day: "2026-08-24",
      phase: Phase.MORNING,
      startTime: "11:00",
      durationMin: 60,
    });
    const next = applyEventToMoment(
      m,
      {
        kind: "applyEventToMoment",
        momentId: m.id,
        day: "2026-08-24",
        startTime: "14:00",
        durationMin: 60,
        overwroteMomentEdit: false,
      },
      configs,
    );
    expect(next.phase).toBe(Phase.AFTERNOON);
    expect(next.startTime).toBe("14:00");
  });

  it("derives NIGHT across the wrap for a 23:30 start", () => {
    const m = newMoment({
      day: "2026-08-24",
      phase: Phase.EVENING,
      startTime: "20:00",
      durationMin: 60,
    });
    const next = applyEventToMoment(
      m,
      {
        kind: "applyEventToMoment",
        momentId: m.id,
        day: "2026-08-24",
        startTime: "23:30",
        durationMin: 60,
        overwroteMomentEdit: false,
      },
      configs,
    );
    expect(next.phase).toBe(Phase.NIGHT);
  });

  it("keeps the existing phase when no config covers the hour", () => {
    const partial = configs.filter((c) => c.phase === Phase.MORNING);
    const m = newMoment({
      day: "2026-08-24",
      phase: Phase.EVENING,
      startTime: "20:00",
      durationMin: 60,
    });
    const next = applyEventToMoment(
      m,
      {
        kind: "applyEventToMoment",
        momentId: m.id,
        day: "2026-08-24",
        startTime: "21:00",
        durationMin: 60,
        overwroteMomentEdit: false,
      },
      partial,
    );
    expect(next.phase).toBe(Phase.EVENING);
  });

  it("never renames the moment", () => {
    const m = newMoment({
      day: "2026-08-24",
      startTime: "10:00",
      durationMin: 30,
    });
    const next = applyEventToMoment(
      m,
      {
        kind: "applyEventToMoment",
        momentId: m.id,
        day: "2026-08-24",
        startTime: "10:30",
        durationMin: 30,
        overwroteMomentEdit: false,
      },
      configs,
    );
    expect(next.name).toBe(m.name);
  });
});
