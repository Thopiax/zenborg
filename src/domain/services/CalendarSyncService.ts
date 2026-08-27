import { countsAsAllocation, type Moment } from "../entities/Moment.ts";
import type { PhaseConfig } from "../value-objects/Phase";
import { phaseForStartTime } from "../value-objects/Schedule.ts";
import { snapToGrid } from "../value-objects/TimeGrid.ts";

/**
 * Exactly the fields zenborg pushes to (or ingests from) a calendar event.
 * The hash over these is the echo-suppression comparand (spec D4).
 *
 * When startTime is null the event is all-day: the moment is ambient
 * (no clock position) and the calendar event spans the whole day.
 */
export interface EventFields {
  readonly title: string;
  readonly day: string;
  readonly startTime: string | null;
  readonly durationMin: number | null;
}

/** Default event length when a timed moment carries no duration. */
export const DEFAULT_EVENT_DURATION_MIN = 60;

/**
 * FNV-1a 64-bit over UTF-8 bytes, hex encoded. Split into high/low 32-bit
 * halves so it runs under ES2017 (no BigInt). The Swift port uses native
 * UInt64; the two produce identical digests byte for byte.
 */
export function fnv1a64(input: string): string {
  // FNV offset basis: 0xcbf29ce484222325
  let h0 = 0x84222325 | 0;
  let h1 = 0xcbf29ce4 | 0;

  const bytes = new TextEncoder().encode(input);
  for (const byte of bytes) {
    // XOR into low half
    h0 = (h0 ^ byte) | 0;

    // Multiply by FNV prime 0x100000001b3 using the identity:
    //   (h1:h0) * 0x1_0000_0001_b3
    // = (h1:h0) * 0x1b3  +  (h1:h0) << 40
    // Split into 16-bit limbs to avoid losing precision.
    const a0 = h0 & 0xffff;
    const a1 = (h0 >>> 16) & 0xffff;
    const a2 = h1 & 0xffff;
    const a3 = (h1 >>> 16) & 0xffff;

    const prime = 0x1b3;
    let c0 = Math.imul(a0, prime);
    let c1 = Math.imul(a1, prime) + (c0 >>> 16);
    let c2 = Math.imul(a2, prime) + (c1 >>> 16);
    let c3 = Math.imul(a3, prime) + (c2 >>> 16);

    // Add the << 40 contribution: shift (h1:h0) left by 40 bits.
    // That is (h0 << 40) which lands at limb positions 2 (bits 8..23)
    // and 3 (bits 24..31 of h0).
    c2 = (c2 & 0xffff) + ((h0 & 0xff) << 8);
    c3 = (c3 & 0xffff) + (c2 >>> 16) + ((h0 >>> 8) & 0xffff);

    h0 = ((c1 & 0xffff) << 16) | (c0 & 0xffff);
    h1 = ((c3 & 0xffff) << 16) | (c2 & 0xffff);
  }

  const hi = (h1 >>> 0).toString(16).padStart(8, "0");
  const lo = (h0 >>> 0).toString(16).padStart(8, "0");
  return hi + lo;
}

/**
 * The stable hash spec D4 compares against.
 *
 * Title is deliberately NOT hashed (amended 2026-08-21). Hashing it made a
 * calendar-side rename revert two passes later. Timing is the only thing a
 * drag changes, so timing is the only thing the hash tracks.
 *
 * All-day events hash as "{day}|allDay" since they have no clock position.
 */
export function momentHash(fields: EventFields): string {
  if (fields.startTime === null) {
    return fnv1a64(`${fields.day}|allDay`);
  }
  return fnv1a64(`${fields.day}|${fields.startTime}|${fields.durationMin}`);
}

/**
 * The event a moment would publish as. Null only for unallocated moments
 * (no day). Ambient moments (no startTime) publish as all-day events.
 */
export type EmojiResolver = (m: Moment) => string | null;

export function eventFieldsForMoment(
  moment: Moment,
  resolveEmoji?: EmojiResolver,
): EventFields | null {
  if (moment.day === null) return null;
  const emoji = resolveEmoji?.(moment);
  const title = emoji ? `${emoji} ${moment.name}` : moment.name;

  if (moment.startTime === undefined) {
    return { title, day: moment.day, startTime: null, durationMin: null };
  }
  return {
    title,
    day: moment.day,
    startTime: moment.startTime,
    durationMin: moment.durationMin ?? DEFAULT_EVENT_DURATION_MIN,
  };
}

export function stripEmojiPrefix(title: string): string {
  const match = title.match(/^(\p{Emoji_Presentation}|\p{Emoji}️?)\s+/u);
  return match ? title.slice(match[0].length) : title;
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
  readonly isAllDay: boolean;
  readonly lastModified: string;
}

export interface ReconcileContext {
  readonly areaCalendarIds: ReadonlySet<string>;
  readonly selectedCalendarIds: readonly string[];
  readonly managedEventIds: ReadonlySet<string>;
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
      startTime: string | null;
      durationMin: number | null;
      eventId: string;
      calendarId: string;
    }
  | {
      kind: "createMomentFromAreaEvent";
      name: string;
      day: string;
      startTime: string | null;
      durationMin: number | null;
      eventId: string;
      calendarId: string;
    }
  | { kind: "publishEvent"; momentId: string; overwroteEventEdit: boolean }
  | {
      kind: "applyEventToMoment";
      momentId: string;
      day: string;
      startTime: string | null;
      durationMin: number | null;
      overwroteMomentEdit: boolean;
    }
  | { kind: "deleteMoment"; momentId: string }
  | { kind: "returnToDrawingBoard"; momentId: string }
  | { kind: "deleteEvent"; eventId: string };

function isAreaCalendar(
  calendarId: string,
  context: ReconcileContext,
): boolean {
  return context.areaCalendarIds.has(calendarId);
}

function isSelectedCalendar(
  calendarId: string,
  context: ReconcileContext,
): boolean {
  return context.selectedCalendarIds.includes(calendarId);
}

function eventFieldsFromSnapshot(event: CalendarEventSnapshot): EventFields {
  if (event.isAllDay) {
    return {
      title: event.title,
      day: event.day,
      startTime: null,
      durationMin: null,
    };
  }
  return {
    title: event.title,
    day: event.day,
    startTime: event.startTime,
    durationMin: event.durationMin,
  };
}

function snappedFieldsFromEvent(
  event: CalendarEventSnapshot,
): { startTime: string | null; durationMin: number | null } {
  if (event.isAllDay) {
    return { startTime: null, durationMin: null };
  }
  return snapToGrid(event.startTime, event.durationMin);
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
    if (isAreaCalendar(event.calendarId, context)) {
      if (context.managedEventIds.has(event.eventId)) {
        return { kind: "deleteEvent", eventId: event.eventId };
      }
      const snapped = snappedFieldsFromEvent(event);
      return {
        kind: "createMomentFromAreaEvent",
        name: stripEmojiPrefix(event.title),
        day: event.day,
        startTime: snapped.startTime,
        durationMin: snapped.durationMin,
        eventId: event.eventId,
        calendarId: event.calendarId,
      };
    }
    if (isSelectedCalendar(event.calendarId, context)) {
      const snapped = snappedFieldsFromEvent(event);
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

  // Branch 5: unallocated ambient with no calendar link: nothing to sync
  if (m.startTime === undefined && m.day === null && !m.externalRef) {
    return { kind: "none", reason: "ambient" };
  }

  // Branch 6-7: no event
  if (event === null) {
    if (!m.externalRef) {
      // Branch 6: no externalRef, never synced
      if (m.day !== null && countsAsAllocation(m)) {
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

  // Branch 9: both present, area calendar
  if (isAreaCalendar(event.calendarId, context)) {
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
      const snapped = snappedFieldsFromEvent(event);
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
      const snapped = snappedFieldsFromEvent(event);
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
  const snapped = snappedFieldsFromEvent(event);
  if (
    snapped.startTime === (m.startTime ?? null) &&
    snapped.durationMin === (m.durationMin ?? null) &&
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
 *
 * When startTime is null, the event is all-day: the moment becomes ambient
 * (startTime and durationMin are removed).
 */
export function applyEventToMoment(
  moment: Moment,
  action: Extract<ReconcileAction, { kind: "applyEventToMoment" }>,
  phaseConfigs: readonly PhaseConfig[],
): Moment {
  if (action.startTime === null) {
    const { startTime: _, durationMin: __, ...rest } = moment;
    return { ...rest, day: action.day, updatedAt: new Date().toISOString() };
  }
  return {
    ...moment,
    day: action.day,
    startTime: action.startTime,
    durationMin: action.durationMin!,
    phase: phaseForStartTime(action.startTime, phaseConfigs) ?? moment.phase,
    updatedAt: new Date().toISOString(),
  };
}
