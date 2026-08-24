import type { Moment } from "../entities/Moment";

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
  return fnv1a64(
    `${fields.day}|${fields.startTime}|${fields.durationMin}`,
  );
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
