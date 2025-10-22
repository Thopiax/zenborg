"use client";

import { use$ } from "@legendapp/state/react";
import { Settings2 } from "lucide-react";
import {
  type DrawingBoardGroupBy,
  drawingBoardGroupBy$,
} from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

interface DrawingBoardToolbarProps {
  onManageAreas?: () => void;
}

/**
 * DrawingBoardToolbar - Notion/Linear styled toolbar for grouping
 *
 * Design:
 * - Monochromatic with subtle stone tones
 * - Segmented control for grouping options
 * - Area management access when grouped by area
 * - Physics-based transitions (fast smooth)
 * - Follows wabi-sabi principles: restraint, clarity
 */
export function DrawingBoardToolbar({
  onManageAreas,
}: DrawingBoardToolbarProps) {
  const groupBy = use$(drawingBoardGroupBy$);

  const groupOptions: { value: DrawingBoardGroupBy; label: string }[] = [
    { value: "none", label: "None" },
    { value: "area", label: "Area" },
    // { value: "created", label: "Created" },
    { value: "horizon", label: "Horizon" },
  ];

  const handleGroupByChange = (value: DrawingBoardGroupBy) => {
    drawingBoardGroupBy$.set(value);
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
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

      {/* Area management button (only when grouping by area) */}
      {groupBy === "area" && onManageAreas && (
        <button
          type="button"
          onClick={onManageAreas}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 hover:text-stone-900 dark:hover:text-stone-100 transition-all duration-fast transition-smooth"
          title="Manage areas"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Manage Areas</span>
        </button>
      )}
    </div>
  );
}
