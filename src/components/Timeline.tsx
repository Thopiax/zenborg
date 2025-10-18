"use client";

import { use$ } from "@legendapp/state/react";
import { CloudMoon, Coffee, Moon, Sun } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Phase } from "@/domain/value-objects/Phase";
import { visiblePhases$ } from "@/infrastructure/state/store";
import { getDateLabel, getTimelineDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TimelineCell } from "./TimelineCell";

// Map phases to Lucide icons
const PHASE_ICONS: Record<
  Phase,
  React.ComponentType<{ className?: string }>
> = {
  MORNING: Coffee,
  AFTERNOON: Sun,
  EVENING: Moon,
  NIGHT: CloudMoon,
};

/**
 * Timeline - Minimal, unified timeline layout
 *
 * Responsive behavior:
 * - Mobile (<768px): Horizontal scroll, 3 columns (85vw each), snap to center
 * - Desktop (≥768px): Grid layout, 3 equal columns
 *
 * Design:
 * - Calm, minimal styling matching DrawingBoardColumn
 * - No heavy borders or backgrounds
 * - Typography hierarchy: Day label (Today/Yesterday) → Day of week → Date (small)
 * - Colored dividers under headers instead of borders
 */
export function Timeline() {
  const visiblePhases = use$(visiblePhases$);
  const days = getTimelineDays();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to center Today column on mount (mobile only)
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const todayColumn = container.children[1] as HTMLElement; // Middle column (Today)

      if (todayColumn) {
        const scrollLeft =
          todayColumn.offsetLeft -
          container.clientWidth / 2 +
          todayColumn.clientWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    }
  }, []);

  // Helper to format date as "Mon 12/25"
  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });
    return { dayOfWeek, monthDay };
  };

  const renderDayColumn = (day: string, isToday: boolean) => {
    const { dayOfWeek, monthDay } = formatDateShort(day);
    const label = getDateLabel(day);

    return (
      <div className="flex flex-col snap-center">
        {/* Column Header - Minimal, no border/bg */}
        <div className="flex flex-col gap-1 px-4 py-3">
          <h3
            className={cn(
              "text-sm font-mono",
              isToday
                ? "font-bold text-stone-900 dark:text-stone-100"
                : "font-medium text-stone-700 dark:text-stone-300"
            )}
          >
            {label}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {dayOfWeek}
            </span>
            <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
              {monthDay}
            </span>
          </div>
        </div>

        {/* Colored Divider - matches DrawingBoardColumn */}
        <div
          className={cn(
            "h-[2px] mx-4 mb-3",
            isToday
              ? "bg-stone-400 dark:bg-stone-500"
              : "bg-stone-300 dark:bg-stone-600"
          )}
        />

        {/* Phase Sections */}
        <div className="flex flex-col gap-3 px-4">
          {visiblePhases.map((phaseConfig, index) => {
            const PhaseIcon = PHASE_ICONS[phaseConfig.phase];
            return (
              <div key={phaseConfig.phase} className="flex flex-col gap-2">
                {/* Phase Header */}
                <div className="flex items-center gap-2 px-1">
                  <PhaseIcon className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                  <span className="text-xs font-mono font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wide">
                    {phaseConfig.label}
                  </span>
                </div>
                {/* Phase Cell */}
                <TimelineCell
                  day={day}
                  phase={phaseConfig.phase}
                  isHighlighted={isToday}
                  phaseIndex={index}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Mobile Layout: Horizontal scrollable 3-column view */}
      <div className="md:hidden">
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          <div className="flex-shrink-0 w-[85vw]">
            {renderDayColumn(days.yesterday, false)}
          </div>
          <div className="flex-shrink-0 w-[85vw]">
            {renderDayColumn(days.today, true)}
          </div>
          <div className="flex-shrink-0 w-[85vw]">
            {renderDayColumn(days.tomorrow, false)}
          </div>
        </div>
      </div>

      {/* Desktop Layout: Unified grid (≥768px) */}
      <div className="hidden md:block">
        <div className="grid grid-cols-3 gap-6">
          {renderDayColumn(days.yesterday, false)}
          {renderDayColumn(days.today, true)}
          {renderDayColumn(days.tomorrow, false)}
        </div>
      </div>
    </div>
  );
}
