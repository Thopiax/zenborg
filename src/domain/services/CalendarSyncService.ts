import { countsAsAllocation, type Moment } from "../entities/Moment.ts";
import type { PhaseConfig } from "../value-objects/Phase";
import { phaseForStartTime } from "../value-objects/Schedule.ts";
import { snapToGrid } from "../value-objects/TimeGrid.ts";

/**
 * Exactly the fields zenborg pushes to (or ingests from) a calendar event.
 * The hash over these is the echo-suppression comparand (spec D4).
 */
export interface EventFields {
  readonly title: string;
  readonly day: string;
  readonly startTime: string;
  readonly durationMin: number;
}

/** Default event length when a timed moment carries no duration. */
export const DEFAULT_EVENT_DURATION_MIN = 60;

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/**
 * FNV-1a 64-bit over UTF-8 bytes, hex encoded. Chosen over a crypto hash
 * because it is synchronous, dependency-free, runs identically in the
 * browser, node and bun, and ports to Swift in ten lines (Slice C mirrors
 * it byte for byte). Collision resistance is irrelevant here: the hash only
 * ever compares an event against zenborg's own last write.
 */
export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * The stable hash spec D4 compares against.
 *
 * Title is deliberately NOT hashed (amended 2026-08-21). Hashing it made a
 * calendar-side rename revert two passes later. Timing is the only thing a
 * drag changes, so timing is the only thing the hash tracks.
 */
export function momentHash(fields: EventFields): string {
  return fnv1a64(`${fields.day}|${fields.startTime}|${fields.durationMin}`);
}

/**
 * The event a moment would publish as. Null for ambient moments (inventing
 * a start time for a moment deliberately without one would be fabricating
 * data, spec D6) and for unallocated moments (an event needs a date).
 */
export function eventFieldsForMoment(moment: Moment): EventFields | null {
  if (moment.day === null || moment.startTime === undefined) return null;
  return {
    title: moment.name,
    day: moment.day,
    startTime: moment.startTime,
    durationMin: moment.durationMin ?? DEFAULT_EVENT_DURATION_MIN,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Reconciliation
// ────────────────────────────────────────────────────────────────────────────

export interface CalendarEventSnapshot {
  readonly eventId: string;
  readonly calendarId: string;
  readonly title: string;
  readonly day: string;
  readonly startTime: string;
  readonly durationMin: number;
  readonly lastModified: string;
}

export interface ReconcileContext {
  readonly zenborgCalendarId: string;
  readonly selectedCalendarIds: readonly string[];
}

export type ReconcileAction =
  | {
      kind: "none";
      reason:
        | "echo"
        | "inSync"
        | "unselectedCalendar"
        | "ambient"
        | "localEdit";
    }
  | {
      kind: "createTentativeMoment";
      name: string;
      day: string;
      startTime: string;
      durationMin: number;
      eventId: string;
      calendarId: string;
    }
  | { kind: "publishEvent"; momentId: string; overwroteEventEdit: boolean }
  | {
      kind: "applyEventToMoment";
      momentId: string;
      day: string;
      startTime: string;
      durationMin: number;
      overwroteMomentEdit: boolean;
    }
  | { kind: "deleteMoment"; momentId: string }
  | { kind: "returnToDrawingBoard"; momentId: string }
  | { kind: "deleteEvent"; eventId: string };

function isZenborgCalendar(
  calendarId: string,
  context: ReconcileContext,
): boolean {
  return calendarId === context.zenborgCalendarId;
}

function isSelectedCalendar(
  calendarId: string,
  context: ReconcileContext,
): boolean {
  return context.selectedCalendarIds.includes(calendarId);
}

function eventFieldsFromSnapshot(event: CalendarEventSnapshot): EventFields {
  return {
    title: event.title,
    day: event.day,
    startTime: event.startTime,
    durationMin: event.durationMin,
  };
}

/**
 * The heart of calendar sync: a pure function over two snapshots.
 *
 * Pairing convention (the caller, Slice C, pairs before calling):
 * - Moments and events are paired by externalRef.eventId.
 * - event = null means CONFIRMED ABSENT, never "not fetched" (amended A2).
 * - The caller must skip out-of-window moments entirely.
 */
export function reconcile(
  moment: Moment | null,
  event: CalendarEventSnapshot | null,
  context: ReconcileContext,
): ReconcileAction {
  // Branch 1: degenerate guard
  if (moment === null && event === null) {
    return { kind: "none", reason: "inSync" };
  }

  // Branch 2-4: no moment, event exists
  if (moment === null && event !== null) {
    if (isZenborgCalendar(event.calendarId, context)) {
      return { kind: "deleteEvent", eventId: event.eventId };
    }
    if (isSelectedCalendar(event.calendarId, context)) {
      const snapped = snapToGrid(event.startTime, event.durationMin);
      return {
        kind: "createTentativeMoment",
        name: event.title,
        day: event.day,
        startTime: snapped.startTime,
        durationMin: snapped.durationMin,
        eventId: event.eventId,
        calendarId: event.calendarId,
      };
    }
    return { kind: "none", reason: "unselectedCalendar" };
  }

  // From here moment is guaranteed non-null
  const m = moment!;

  // Branch 5: ambient moment (no startTime)
  if (m.startTime === undefined) {
    return { kind: "none", reason: "ambient" };
  }

  // Branch 6-7: no event
  if (event === null) {
    if (!m.externalRef) {
      // Branch 6: no externalRef, never synced
      if (
        m.day !== null &&
        m.startTime !== undefined &&
        countsAsAllocation(m)
      ) {
        return {
          kind: "publishEvent",
          momentId: m.id,
          overwroteEventEdit: false,
        };
      }
      return { kind: "none", reason: "inSync" };
    }
    // Branch 7: has externalRef, event was deleted
    if (m.status === "tentative") {
      return { kind: "deleteMoment", momentId: m.id };
    }
    return { kind: "returnToDrawingBoard", momentId: m.id };
  }

  // Both present from here

  // Branch 8: moment is unallocated
  if (m.day === null) {
    return { kind: "deleteEvent", eventId: event.eventId };
  }

  // Branch 9: both present, zenborg calendar
  if (isZenborgCalendar(event.calendarId, context)) {
    const eventHash = momentHash(eventFieldsFromSnapshot(event));
    const momentFields = eventFieldsForMoment(m);
    const currentMomentHash = momentFields ? momentHash(momentFields) : null;
    const lastHash = m.externalRef?.lastWrittenHash;

    const eventChanged = eventHash !== lastHash;
    const momentChanged = currentMomentHash !== lastHash;

    if (!eventChanged && !momentChanged) {
      // Check for zenborg-side rename
      if (m.externalRef && m.name !== m.externalRef.lastWrittenTitle) {
        return {
          kind: "publishEvent",
          momentId: m.id,
          overwroteEventEdit: false,
        };
      }
      return { kind: "none", reason: "echo" };
    }
    if (eventChanged && !momentChanged) {
      const snapped = snapToGrid(event.startTime, event.durationMin);
      return {
        kind: "applyEventToMoment",
        momentId: m.id,
        day: event.day,
        startTime: snapped.startTime,
        durationMin: snapped.durationMin,
        overwroteMomentEdit: false,
      };
    }
    if (!eventChanged && momentChanged) {
      return {
        kind: "publishEvent",
        momentId: m.id,
        overwroteEventEdit: false,
      };
    }
    // Both changed: last write wins
    const eventNewer =
      new Date(event.lastModified).getTime() >= new Date(m.updatedAt).getTime();
    if (eventNewer) {
      const snapped = snapToGrid(event.startTime, event.durationMin);
      return {
        kind: "applyEventToMoment",
        momentId: m.id,
        day: event.day,
        startTime: snapped.startTime,
        durationMin: snapped.durationMin,
        overwroteMomentEdit: true,
      };
    }
    return { kind: "publishEvent", momentId: m.id, overwroteEventEdit: true };
  }

  // Branch 10: both present, foreign (ingested) calendar
  const snapped = snapToGrid(event.startTime, event.durationMin);
  if (
    snapped.startTime === m.startTime &&
    snapped.durationMin === m.durationMin &&
    event.day === m.day
  ) {
    return { kind: "none", reason: "inSync" };
  }

  const eventHash = momentHash(eventFieldsFromSnapshot(event));
  if (eventHash !== m.externalRef?.lastWrittenHash) {
    const momentFields = eventFieldsForMoment(m);
    const currentMomentHash = momentFields ? momentHash(momentFields) : null;
    const momentAlsoDrifted =
      currentMomentHash !== m.externalRef?.lastWrittenHash;
    return {
      kind: "applyEventToMoment",
      momentId: m.id,
      day: event.day,
      startTime: snapped.startTime,
      durationMin: snapped.durationMin,
      overwroteMomentEdit: momentAlsoDrifted,
    };
  }
  return { kind: "none", reason: "localEdit" };
}

/**
 * Apply an event's timing to a moment. Re-derives phase from startTime
 * against PhaseConfig (spec D6). Never renames.
 */
export function applyEventToMoment(
  moment: Moment,
  action: Extract<ReconcileAction, { kind: "applyEventToMoment" }>,
  phaseConfigs: readonly PhaseConfig[],
): Moment {
  return {
    ...moment,
    day: action.day,
    startTime: action.startTime,
    durationMin: action.durationMin,
    phase: phaseForStartTime(action.startTime, phaseConfigs) ?? moment.phase,
    updatedAt: new Date().toISOString(),
  };
}
