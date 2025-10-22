"use client";

import { use$ } from "@legendapp/state/react";
import { ArrowDownAZ, ArrowUpDown } from "lucide-react";
import {
  type DrawingBoardGroupBy,
  type DrawingBoardSortMode,
  drawingBoardGroupBy$,
  drawingBoardSortMode$,
} from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

/**
 * DrawingBoardToolbar - Notion/Linear styled toolbar for grouping and sorting
 *
 * Design:
 * - Monochromatic with subtle stone tones
 * - Segmented control for grouping options
 * - Toggle button for sort mode
 * - Physics-based transitions (fast elastic)
 * - Follows wabi-sabi principles: restraint, clarity
 */
export function DrawingBoardToolbar() {
  const groupBy = use$(drawingBoardGroupBy$);
  const sortMode = use$(drawingBoardSortMode$);

  const groupOptions: { value: DrawingBoardGroupBy; label: string }[] = [
    { value: "none", label: "None" },
    { value: "area", label: "Area" },
    { value: "created", label: "Created" },
    { value: "horizon", label: "Horizon" },
  ];

  const handleGroupByChange = (value: DrawingBoardGroupBy) => {
    drawingBoardGroupBy$.set(value);
  };

  const handleSortModeToggle = () => {
    drawingBoardSortMode$.set(sortMode === "auto" ? "manual" : "auto");
  };

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
      {/* Grouping segmented control */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
          Group
        </span>
        <div className="flex items-center gap-0.5 p-0.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-sm">
          {groupOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleGroupByChange(option.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md",
                "transition-all duration-fast transition-smooth",
                "hover:text-stone-900 dark:hover:text-stone-100",
                groupBy === option.value
                  ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-stone-300 dark:bg-stone-700" />

      {/* Sort mode toggle (only for ungrouped view) */}
      {groupBy === "none" && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
            Sort
          </span>
          <button
            type="button"
            onClick={handleSortModeToggle}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
              "border transition-all duration-fast transition-smooth",
              sortMode === "manual"
                ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-sm"
                : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600"
            )}
            title={
              sortMode === "auto"
                ? "Switch to manual sorting"
                : "Switch to automatic sorting"
            }
          >
            {sortMode === "manual" ? (
              <ArrowUpDown className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownAZ className="w-3.5 h-3.5" />
            )}
            <span>{sortMode === "manual" ? "Manual" : "Auto"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
