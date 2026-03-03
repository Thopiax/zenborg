"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Habit } from "@/domain/entities/Habit";
import { cn } from "@/lib/utils";
import { HabitAutocompleteInline } from "./HabitAutocompleteInline";

interface MomentFormInlineProps {
  open: boolean;
  onClose: () => void;
  onSpawnHabit: (habit: Habit, day: string, phase: string) => void;
  day: string;
  phase: string;
  /** Element to use as collision boundary (e.g., timeline container) */
  collisionBoundary?: Element | null | Array<Element | null>;
}

/**
 * MomentFormInline - Inline input for creating moments in timeline cells
 *
 * Features:
 * - Minimal inline input (no modal)
 * - HabitAutocompleteInline appears when typing
 * - Selecting habit → spawns spontaneous moment
 * - Escape to close
 * - Auto-focus on open
 *
 * Design:
 * - Stone monochrome input
 * - Appears directly in timeline cell
 * - Subtle, minimal (no heavy borders)
 */
export function MomentFormInline({
  open,
  onClose,
  onSpawnHabit,
  day,
  phase,
  collisionBoundary,
}: MomentFormInlineProps) {
  const [searchValue, setSearchValue] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    setShowAutocomplete(value.trim().length > 0);
  };

  // Handle habit selection
  const handleSelectHabit = (habit: Habit) => {
    onSpawnHabit(habit, day, phase);
    setSearchValue("");
    setShowAutocomplete(false);
  };

  // Handle Escape key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={searchValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Type moment name..."
        className={cn(
          "w-full px-3 py-2 rounded-md",
          "bg-white dark:bg-stone-900",
          "border border-stone-300 dark:border-stone-700",
          "text-sm text-stone-900 dark:text-stone-100",
          "placeholder:text-stone-400 dark:placeholder:text-stone-500",
          "focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500",
          "transition-all",
        )}
      />

      {/* Habit Autocomplete */}
      <HabitAutocompleteInline
        open={showAutocomplete}
        searchValue={searchValue}
        onSelectHabit={handleSelectHabit}
        onClose={() => setShowAutocomplete(false)}
        trigger={<div className="w-full absolute top-0 left-0" />}
        collisionBoundary={collisionBoundary}
      />
    </div>
  );
}
