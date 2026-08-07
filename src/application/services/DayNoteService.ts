import {
  createDayNote,
  type DayNote,
  type DayNoteResult,
  setDayNoteBody,
  updateDayNote,
} from "@/domain/entities/DayNote";
import { dayNotes$ } from "@/infrastructure/state/store";

/**
 * Application Service for Day Notes
 *
 * Per-day metadata keyed by ISO date (YYYY-MM-DD). The note collection is
 * sparse — most days have no entry. Setting a title creates the note;
 * clearing it removes the entry entirely.
 */
export class DayNoteService {
  /**
   * Set the title for a day. Creates the note if absent, updates if present.
   */
  setTitle(date: string, title: string): DayNoteResult {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      return { error: "Day title cannot be empty" };
    }

    const existing = dayNotes$[date].get();

    const result = existing
      ? updateDayNote(existing, { title: trimmed })
      : createDayNote({ date, title: trimmed });

    if ("error" in result) {
      return result;
    }

    dayNotes$[date].set(result);
    return result;
  }

  /**
   * Set the day's markdown body.
   *
   * A body needs a note to hang on, and a note needs a title, so writing a
   * body to an untitled day would either invent a title or silently drop the
   * text. It errors instead — the caller decides what the day is called.
   */
  setBody(date: string, body: string): DayNoteResult {
    const existing = dayNotes$[date].get();
    if (!existing) {
      return { error: "Name the day before writing its note" };
    }
    const updated = setDayNoteBody(existing, body);
    dayNotes$[date].set(updated);
    return updated;
  }

  /**
   * Read a day's markdown body (null if absent).
   */
  getBody(date: string): string | null {
    return dayNotes$[date].get()?.body || null;
  }

  /**
   * Remove the day's note entirely.
   */
  clearTitle(date: string): void {
    dayNotes$[date].delete();
  }

  /**
   * Read a day's note (null if absent).
   */
  getNote(date: string): DayNote | null {
    return dayNotes$[date].get() || null;
  }

  /**
   * Read a day's title (null if absent).
   */
  getTitle(date: string): string | null {
    return dayNotes$[date].title.get() || null;
  }
}
