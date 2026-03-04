"use client";

import { use$ } from "@legendapp/state/react";
import Fuse from "fuse.js";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Habit } from "@/domain/entities/Habit";
import { areas$, habits$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface HabitAutocompleteInlineProps {
  open: boolean;
  searchValue: string;
  onSelectHabit: (habit: Habit) => void;
  onClose: () => void;
  /** The anchor element (positioned at input field) */
  trigger: React.ReactNode;
  /** Element to use as collision boundary (e.g., dialog container) */
  collisionBoundary?: Element | null | Array<Element | null>;
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
}

/**
 * HabitAutocompleteInline - Popover dropdown for habit selection
 *
 * Features:
 * - Shows below input field using Popover positioning
 * - Fuzzy matching with fuse.js
 * - Shows area information (emoji + name)
 * - Create standalone moment option when no matches
 * - Subtle, minimal design
 * - Portal rendering (avoids overflow issues)
 * - Keyboard navigation (up/down/enter/escape)
 *
 * Usage:
 * When user types moment name, shows matching habits to create spontaneous moments,
 * or allows creating standalone moments.
 */
export function HabitAutocompleteInline({
  open,
  searchValue,
  onSelectHabit,
  onClose,
  trigger,
  collisionBoundary,
  maxSuggestions = 8,
}: HabitAutocompleteInlineProps) {
  const allHabits = use$(habits$);
  const allAreas = use$(areas$);

  const habitsArray = Object.values(allHabits);

  // Get filtered suggestions with optional "Create standalone" option
  const suggestions = useMemo(() => {
    const trimmedSearch = searchValue.trim();

    if (!trimmedSearch) {
      // No search - show all habits (sorted by creation date, newest first)
      return habitsArray
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, maxSuggestions);
    }

    const lowerSearch = trimmedSearch.toLowerCase();

    // Categorize matches by quality
    const exactMatches: Habit[] = [];
    const prefixMatches: Habit[] = [];
    const containsMatches: Habit[] = [];
    const fuzzyMatches: Habit[] = [];

    // First pass: exact, prefix, and contains matches
    for (const habit of habitsArray) {
      const lowerName = habit.name.toLowerCase();

      if (lowerName === lowerSearch) {
        exactMatches.push(habit);
      } else if (lowerName.startsWith(lowerSearch)) {
        prefixMatches.push(habit);
      } else if (lowerName.includes(lowerSearch)) {
        containsMatches.push(habit);
      }
    }

    // Second pass: fuzzy matches for remaining habits
    const searchedHabits = new Set([
      ...exactMatches.map((h) => h.id),
      ...prefixMatches.map((h) => h.id),
      ...containsMatches.map((h) => h.id),
    ]);
    const remainingHabits = habitsArray.filter(
      (habit) => !searchedHabits.has(habit.id),
    );

    if (remainingHabits.length > 0) {
      const fuseSubset = new Fuse(remainingHabits, {
        keys: ["name"],
        threshold: 0.4,
        distance: 100,
        includeScore: true,
      });
      const fuzzyResults = fuseSubset.search(trimmedSearch);
      fuzzyMatches.push(...fuzzyResults.map((result) => result.item));
    }

    // Combine all matches in priority order
    const allMatches = [
      ...exactMatches,
      ...prefixMatches,
      ...containsMatches,
      ...fuzzyMatches,
    ];
    const matches = allMatches.slice(0, maxSuggestions);

    return matches;
  }, [searchValue, habitsArray, maxSuggestions]);

  const hasSuggestions = suggestions.length > 0;
  const shouldShowPopover = open && hasSuggestions;

  // Total items includes suggestions + optional createStandalone
  const totalItems = suggestions.length;

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected index when suggestions change
  // biome-ignore lint/correctness/useExhaustiveDependencies: <should only reset when suggestions change, not on every render>
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  const handleSelectHabit = useCallback(
    (habit: Habit) => {
      onSelectHabit(habit);
      onClose();
    },
    [onSelectHabit, onClose],
  );

  // Handle keyboard navigation
  useEffect(() => {
    if (!shouldShowPopover) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();

        const selectedHabit = suggestions[selectedIndex];
        if (!selectedHabit) return;
        handleSelectHabit(selectedHabit);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    shouldShowPopover,
    suggestions,
    totalItems,
    selectedIndex,
    handleSelectHabit,
    onClose,
  ]);

  return (
    <Popover
      open={shouldShowPopover && totalItems > 0}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      modal={false}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-full max-w-md p-1 border-stone-200/50 dark:border-stone-700/50 shadow-sm bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm"
        collisionBoundary={collisionBoundary}
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header (only when searching) */}
        {searchValue.trim() && (
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-medium">
            Matching habits
          </div>
        )}

        {/* Suggestions */}
        <div className="flex flex-col gap-0.5 max-h-48 overflow-auto">
          {suggestions.map((habit, index) => {
            const area = allAreas[habit.areaId];
            if (!area) return null;

            return (
              <button
                key={habit.id}
                type="button"
                onClick={() => handleSelectHabit(habit)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md",
                  "text-stone-600 dark:text-stone-400",
                  "transition-colors cursor-pointer",
                  "text-left",
                  index === selectedIndex
                    ? "bg-stone-200 dark:bg-stone-700"
                    : "hover:bg-stone-100 dark:hover:bg-stone-800",
                )}
              >
                {/* Habit emoji */}
                <span className="text-sm flex-shrink-0">{habit.emoji}</span>

                {/* Habit name */}
                <span className="text-xs font-mono flex-1 min-w-0 truncate font-medium">
                  {habit.name}
                </span>

                {/* Area */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs">{area.emoji}</span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: area.color }}
                  >
                    {area.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
