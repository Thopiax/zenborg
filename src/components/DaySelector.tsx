"use client";

import { getDateLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface DaySelectorProps {
  currentDay: string; // ISO date
  onDayChange: (day: string) => void;
  days: { yesterday: string; today: string; tomorrow: string };
}

/**
 * DaySelector - Mobile-only component for day navigation
 *
 * Features:
 * - Displays yesterday/today/tomorrow buttons
 * - Swipe left/right support (future enhancement)
 * - Highlights current selection
 */
export function DaySelector({
  currentDay,
  onDayChange,
  days,
}: DaySelectorProps) {
  const dayOptions = [
    { value: days.yesterday, label: "Yesterday" },
    { value: days.today, label: "Today" },
    { value: days.tomorrow, label: "Tomorrow" },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {dayOptions.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onDayChange(value)}
          className={cn(
            "px-4 py-2 rounded-lg transition-all",
            "border",
            currentDay === value
              ? "border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold"
              : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 font-medium hover:border-stone-300 dark:hover:border-stone-600"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
