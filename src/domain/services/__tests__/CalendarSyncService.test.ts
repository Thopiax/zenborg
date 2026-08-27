import { describe, expect, it } from "vitest";
import {
  createMoment,
  isMomentError,
  type Moment,
} from "../../entities/Moment.ts";
import fc from "fast-check";
import {
  type CalendarEventSnapshot,
  type EventFields,
  type ReconcileContext,
  applyEventToMoment,
  eventFieldsForMoment,
  fnv1a64,
  momentHash,
  reconcile,
  stripEmojiPrefix,
} from "../CalendarSyncService.ts";
import vectors from "../../../../calendar-sidecar/fixtures/reconcile-vectors.json";
import { getDefaultPhaseConfigs, Phase } from "../../value-objects/Phase.ts";
import {
  CALENDAR_GRID_MINUTES,
  snapToGrid,
} from "../../value-objects/TimeGrid.ts";

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

  it("pins the all-day digest", () => {
    const allDayFields: EventFields = {
      title: "meditate",
      day: "2026-08-24",
      startTime: null,
      durationMin: null,
    };
    expect(momentHash(allDayFields)).toBe(
      fnv1a64("2026-08-24|allDay"),
    );
  });

  it("all-day hash differs from any timed hash on the same day", () => {
    const allDay: EventFields = {
      title: "x",
      day: "2026-08-24",
      startTime: null,
      durationMin: null,
    };
    const timed: EventFields = {
      title: "x",
      day: "2026-08-24",
      startTime: "00:00",
      durationMin: 1440,
    };
    expect(momentHash(allDay)).not.toBe(momentHash(timed));
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

  it("returns all-day fields for an allocated ambient moment", () => {
    const m = newMoment({ day: "2026-08-24" });
    const result = eventFieldsForMoment(m);
    expect(result).not.toBeNull();
    expect(result!.startTime).toBeNull();
    expect(result!.durationMin).toBeNull();
    expect(result!.day).toBe("2026-08-24");
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

  it("prefixes title with emoji when resolveEmoji returns one", () => {
    const m = newMoment({
      day: "2026-08-24",
      startTime: "10:30",
      durationMin: 30,
    });
    const result = eventFieldsForMoment(m, () => "🧘");
    expect(result?.title).toBe("🧘 standup");
  });

  it("uses bare name when resolveEmoji returns null", () => {
    const m = newMoment({
      day: "2026-08-24",
      startTime: "10:30",
      durationMin: 30,
    });
    const result = eventFieldsForMoment(m, () => null);
    expect(result?.title).toBe("standup");
  });

  it("uses bare name when no resolveEmoji is provided", () => {
    const m = newMoment({
      day: "2026-08-24",
      startTime: "10:30",
      durationMin: 30,
    });
    expect(eventFieldsForMoment(m)?.title).toBe("standup");
  });
});

describe("stripEmojiPrefix", () => {
  it("strips a leading emoji and space", () => {
    expect(stripEmojiPrefix("🧘 Meditate")).toBe("Meditate");
  });

  it("returns the string unchanged when no emoji prefix", () => {
    expect(stripEmojiPrefix("standup")).toBe("standup");
  });

  it("strips compound emoji", () => {
    expect(stripEmojiPrefix("💪 Workout")).toBe("Workout");
  });

  it("does not strip emoji in the middle of a title", () => {
    expect(stripEmojiPrefix("My 🧘 moment")).toBe("My 🧘 moment");
  });
});

// Filter out documentation-only vectors (no moment/event/context)
const runnableVectors = vectors.filter(
  (v): v is typeof v & { context: unknown } => "context" in v,
);

function contextFromVector(raw: Record<string, unknown>): ReconcileContext {
  return {
    areaCalendarIds: new Set(raw.areaCalendarIds as string[]),
    selectedCalendarIds: raw.selectedCalendarIds as string[],
    managedEventIds: new Set(
      (raw.managedEventIds as string[] | undefined) ?? [],
    ),
  };
}

function eventFromVector(
  raw: Record<string, unknown> | null,
): CalendarEventSnapshot | null {
  if (raw === null) return null;
  return {
    eventId: raw.eventId as string,
    calendarId: raw.calendarId as string,
    title: raw.title as string,
    day: raw.day as string,
    startTime: raw.startTime as string,
    durationMin: raw.durationMin as number,
    isAllDay: (raw.isAllDay as boolean | undefined) ?? false,
    lastModified: raw.lastModified as string,
  };
}

describe("reconcile: the truth table", () => {
  for (const vector of runnableVectors) {
    it(vector.name, () => {
      expect(
        reconcile(
          vector.moment as Moment | null,
          eventFromVector(
            vector.event as Record<string, unknown> | null,
          ),
          contextFromVector(vector.context as Record<string, unknown>),
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

  it("makes a timed moment ambient when startTime is null (all-day transition)", () => {
    const m = newMoment({
      day: "2026-08-24",
      phase: Phase.MORNING,
      startTime: "10:30",
      durationMin: 30,
    });
    const next = applyEventToMoment(
      m,
      {
        kind: "applyEventToMoment",
        momentId: m.id,
        day: "2026-08-24",
        startTime: null,
        durationMin: null,
        overwroteMomentEdit: false,
      },
      configs,
    );
    expect(next.startTime).toBeUndefined();
    expect(next.durationMin).toBeUndefined();
    expect(next.day).toBe("2026-08-24");
    expect(next.name).toBe(m.name);
  });
});

describe("properties", () => {
  const anyTime = fc
    .record({
      h: fc.integer({ min: 0, max: 23 }),
      m: fc.integer({ min: 0, max: 59 }),
    })
    .map(
      ({ h, m }) =>
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    );

  const isoDay = fc
    .record({
      y: fc.integer({ min: 2026, max: 2027 }),
      m: fc.integer({ min: 1, max: 12 }),
      d: fc.integer({ min: 1, max: 28 }),
    })
    .map(
      ({ y, m, d }) =>
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );

  it("publish then ingest is identity, from ARBITRARY times not pre-aligned ones", () => {
    fc.assert(
      fc.property(
        anyTime,
        fc.integer({ min: 1, max: 300 }),
        isoDay,
        (raw, rawDur, day) => {
          const settled = snapToGrid(raw, rawDur);
          const m = newMoment({ ...settled, day, phase: null });
          const f = eventFieldsForMoment(m);
          expect(f).not.toBeNull();
          expect(f!.startTime).not.toBeNull();
          const reingested = snapToGrid(f!.startTime!, f!.durationMin!);
          expect(reingested).toEqual(settled);
          expect(f!.day).toBe(day);
        },
      ),
    );
  });

  it("the hash ignores title across arbitrary titles", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const base = { day: "2026-08-24", startTime: "10:30", durationMin: 30 };
        expect(momentHash({ ...base, title: a })).toBe(
          momentHash({ ...base, title: b }),
        );
      }),
    );
  });

  it("snapToGrid is idempotent and always lands on the grid", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 1, max: 300 }),
        (h, m, dur) => {
          const raw = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const once = snapToGrid(raw, dur);
          expect(snapToGrid(once.startTime, once.durationMin)).toEqual(once);
          const [, mm] = once.startTime.split(":").map(Number);
          expect(mm % CALENDAR_GRID_MINUTES).toBe(0);
          expect(once.durationMin % CALENDAR_GRID_MINUTES).toBe(0);
        },
      ),
    );
  });
});
