"use client";

import { ArchiveRestore, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Habit } from "@zenborg/core/domain/entities/Habit";
import { cn } from "@/lib/utils";

interface AreaRestingHabitsProps {
  habits: Habit[];
  onUnarchive: (habitId: string) => void;
  onDelete?: (habitId: string) => void;
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
  onDelete,
}: AreaRestingHabitsProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

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
            <li key={habit.id} className="flex flex-col">
              {confirmingDeleteId === habit.id ? (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
                  <span className="text-xs font-mono text-red-700 dark:text-red-300 flex-1 truncate">
                    Delete {habit.name}?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete?.(habit.id);
                      setConfirmingDeleteId(null);
                    }}
                    className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-mono bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-mono text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    "group flex items-center gap-2 px-2 py-1 rounded",
                    "text-stone-500 dark:text-stone-400",
                  )}
                >
                  <span className="text-sm flex-shrink-0">{habit.emoji}</span>
                  <span className="text-xs font-mono truncate flex-1">
                    {habit.name}
                  </span>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(habit.id)}
                      className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity text-red-500 dark:text-red-400"
                      aria-label="Delete habit permanently"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onUnarchive(habit.id)}
                    className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Restore habit"
                    title="Restore"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
