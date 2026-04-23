"use client";

import { ArchiveRestore } from "lucide-react";
import { useState } from "react";
import type { Habit } from "@/domain/entities/Habit";
import { cn } from "@/lib/utils";

interface AreaRestingHabitsProps {
  habits: Habit[];
  onUnarchive: (habitId: string) => void;
}

/**
 * AreaRestingHabits — collapsed footer showing archived habits within an area.
 *
 * Surfaces dormant habits in their home area without a separate archive page,
 * reinforcing that archiving is rest, not deletion.
 */
export function AreaRestingHabits({
  habits,
  onUnarchive,
}: AreaRestingHabitsProps) {
  const [expanded, setExpanded] = useState(false);

  if (habits.length === 0) return null;

  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-stone-200/70 dark:border-stone-700/70">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-mono text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
      >
        <span>{habits.length} resting</span>
        <span className="opacity-60">{expanded ? "hide" : "show"}</span>
      </button>

      {expanded && (
        <ul className="mt-2 flex flex-col gap-1">
          {habits.map((habit) => (
            <li
              key={habit.id}
              className={cn(
                "group flex items-center gap-2 px-2 py-1 rounded",
                "text-stone-500 dark:text-stone-400",
              )}
            >
              <span className="text-sm flex-shrink-0">{habit.emoji}</span>
              <span className="text-xs font-mono truncate flex-1">
                {habit.name}
              </span>
              <button
                type="button"
                onClick={() => onUnarchive(habit.id)}
                className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Restore habit"
                title="Restore"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
