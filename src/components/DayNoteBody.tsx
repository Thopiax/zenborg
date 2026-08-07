"use client";

/**
 * DayNoteBody — the day's markdown note, sitting between its title and its
 * phases. That placement is the tie to the moments: the note and the day's
 * moments are the same row, read in one glance.
 *
 * Click to edit, Escape to cancel, blur or Cmd/Ctrl+Enter to commit. Plain
 * Enter inserts a newline — this is a paragraph, not a title.
 *
 * The body is stored as markdown but rendered as its own source: zenborg has
 * no markdown parser, and pulling one in to italicise a day note would be a
 * dependency for decoration. The format is chosen for what reads the vault
 * later, not for what this component draws today.
 */

import { use$ } from "@legendapp/state/react";
import { useEffect, useRef, useState } from "react";
import { DayNoteService } from "@/application/services/DayNoteService";
import { dayNotes$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

const dayNoteService = new DayNoteService();

interface DayNoteBodyProps {
  day: string;
  isActiveDay: boolean;
}

export function DayNoteBody({ day, isActiveDay }: DayNoteBodyProps) {
  const note = use$(dayNotes$[day]);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      ref.current?.focus();
    }
  }, [isEditing]);

  // A body needs a titled day to hang on — the service rejects it otherwise,
  // so don't offer the affordance until the day has a name.
  if (!note) {
    return null;
  }

  const startEdit = () => {
    setDraft(note.body ?? "");
    setError(null);
    setIsEditing(true);
  };

  const commit = () => {
    const result = dayNoteService.setBody(day, draft);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    setIsEditing(false);
    setError(null);
  };

  if (isEditing) {
    return (
      <div className="flex w-full flex-col">
        <textarea
          aria-label={`Note for ${note.title}`}
          className={cn(
            "w-full resize-y bg-transparent px-0 py-1 font-mono text-sm outline-none",
            "min-h-16 border-stone-300 border-b dark:border-stone-600",
            "text-stone-800 dark:text-stone-200",
          )}
          onBlur={commit}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setIsEditing(false);
              setError(null);
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="What's this day for? (markdown)"
          ref={ref}
          value={draft}
        />
        {error && <span className="mt-0.5 text-red-500 text-xs">{error}</span>}
      </div>
    );
  }

  return (
    <button
      className={cn(
        "w-full cursor-text whitespace-pre-wrap text-left font-mono text-sm transition-colors",
        note.body
          ? isActiveDay
            ? "text-stone-700 dark:text-stone-300"
            : "text-stone-500 dark:text-stone-400"
          : "text-stone-400 dark:text-stone-600",
      )}
      onClick={startEdit}
      type="button"
    >
      {note.body || "add a note"}
    </button>
  );
}
