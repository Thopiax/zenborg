"use client";

import { useValue } from "@legendapp/state/react";
import { selectedDay$ } from "@/infrastructure/state/ui-store";
import { getTodayISO } from "@/lib/dates";

export function TodayButton() {
  const selectedDay = useValue(selectedDay$);
  const today = getTodayISO();
  const isOff = selectedDay !== null && selectedDay !== today;

  if (!isOff) return null;

  return (
    <button
      type="button"
      onClick={() => selectedDay$.set(today)}
      className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900 hover:opacity-90 active:scale-95 transition-all shadow-sm"
      title="Return to today"
    >
      today
    </button>
  );
}
