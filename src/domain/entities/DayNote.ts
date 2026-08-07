/**
 * DayNote - per-day metadata keyed by ISO date.
 *
 * `title` is a 1-3 word label shown in the Timeline day header. `body` is
 * free markdown for the day — what it's for, what happened, whatever the
 * moments below it don't say on their own. It renders in the same row as
 * that day's phases, which is the tie to the moments: same day, one screen.
 *
 * `body` is optional so notes written before it existed stay valid — a sparse
 * collection, no migration step. Markdown is the storage format even though
 * nothing renders it yet: it stays greppable, diffable, and readable by the
 * other things that read this vault.
 *
 * Primary key is `date` (YYYY-MM-DD) — there is at most one note per day.
 */

import { momentConstraints } from "@/lib/design-tokens";

export interface DayNote {
  date: string;
  title: string;
  /** Free markdown. Absent on notes written before the field existed. */
  body?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDayNoteProps {
  date: string;
  title: string;
  body?: string;
}

export interface UpdateDayNoteProps {
  title: string;
}

export type DayNoteResult = DayNote | { error: string };

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a day-note title.
 * Same 1-3 word rule as moments and habits — declared inline so the entity
 * is self-contained and doesn't reach into the design-tokens helper, which
 * is moment-specific by name.
 */
export function validateDayNoteTitle(title: string): {
  isValid: boolean;
  error?: string;
} {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "Day title cannot be empty" };
  }
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length > momentConstraints.maxWordsInName) {
    return {
      isValid: false,
      error: `Maximum ${momentConstraints.maxWordsInName} words allowed`,
    };
  }
  return { isValid: true };
}

export function createDayNote(props: CreateDayNoteProps): DayNoteResult {
  if (!ISO_DATE_REGEX.test(props.date)) {
    return { error: `Invalid ISO date: ${props.date}` };
  }
  const validation = validateDayNoteTitle(props.title);
  if (!validation.isValid) {
    return { error: validation.error ?? "Invalid title" };
  }
  const now = new Date().toISOString();
  return {
    date: props.date,
    title: props.title.trim(),
    ...(props.body ? { body: props.body } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Set the day's markdown body. Deliberately separate from `updateDayNote`:
 * the body has no word limit and must not drag the title through validation
 * it didn't ask for. An all-whitespace body drops the field rather than
 * storing "" — absent and empty should not be two different states.
 */
export function setDayNoteBody(existing: DayNote, body: string): DayNote {
  const trimmed = body.trim();
  const { body: _dropped, ...rest } = existing;
  return {
    ...rest,
    ...(trimmed ? { body: trimmed } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export function updateDayNote(
  existing: DayNote,
  updates: UpdateDayNoteProps,
): DayNoteResult {
  const validation = validateDayNoteTitle(updates.title);
  if (!validation.isValid) {
    return { error: validation.error ?? "Invalid title" };
  }
  return {
    ...existing,
    title: updates.title.trim(),
    updatedAt: new Date().toISOString(),
  };
}
