"use client";

import { Archive } from "lucide-react";
import { useState } from "react";
import type { Habit } from "@/domain/entities/Habit";
import { getAttitudeIcon } from "@/domain/value-objects/Attitude";
import { PhaseIcon } from "@/domain/value-objects/phaseStyles";
import { cn } from "@/lib/utils";

interface PlanHabitItemProps {
  habit: Habit;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (name: string) => void;
  onCancel: () => void;
  onArchive: () => void;
}

/**
 * PlanHabitItem - Inline editable habit in Plan page
 *
 * Features:
 * - Click to enter edit mode
 * - Inline text input (Enter to save, Esc to cancel)
 * - Hover to show archive icon
 */
export function PlanHabitItem({
  habit,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onArchive,
}: PlanHabitItemProps) {
  const [name, setName] = useState(habit.name);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (name.trim()) {
        onSave(name.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setName(habit.name);
      onCancel();
    }
  };

  const handleBlur = () => {
    if (name.trim() && name !== habit.name) {
      onSave(name.trim());
    } else {
      setName(habit.name);
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm">{habit.emoji}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
          className="flex-1 px-2 py-1 text-sm font-mono bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-600 rounded focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md",
        "text-sm font-mono text-stone-900 dark:text-stone-100",
        "hover:bg-stone-100 dark:hover:bg-stone-800",
        "transition-colors"
      )}
    >
      <div className="flex items-center gap-2">
        <span>{habit.emoji}</span>
        <span>{habit.name}</span>
        {/* Quiet display of attitude and phase */}
        {(habit.attitude || habit.phase) && (
          <span className="flex items-center gap-1 text-stone-400 dark:text-stone-500 text-xs ml-1">
            {habit.attitude && (
              <span title={`Attitude: ${habit.attitude}`}>
                {getAttitudeIcon(habit.attitude)}
              </span>
            )}
            {habit.phase && (
              <PhaseIcon
                phase={habit.phase}
                className="w-3 h-3"
              />
            )}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-opacity"
        title="Archive habit"
      >
        <Archive className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
      </button>
    </button>
  );
}
