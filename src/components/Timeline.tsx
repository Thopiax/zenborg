"use client";

import { use$ } from "@legendapp/state/react";
import { CloudMoon, Coffee, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Phase } from "@/domain/value-objects/Phase";
import { visiblePhases$ } from "@/infrastructure/state/store";
import { getDateLabel, getExtendedTimelineDays } from "@/lib/dates";
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
 * Timeline - DayRow-based timeline layout with extended days
 *
 * Layout:
 * - Each day is a horizontal row
 * - Vertical scroll with snap behavior (Today has stronger snap)
 * - Days before viewport have reduced opacity with transition
 * - Today is always front and center on load
 *
 * Design:
 * - Day titles are large and prominent
 * - Phase labels removed (icons only with darker colors)
 * - Progressive slate gradient backgrounds
 * - Smooth scroll snapping to days (Today has magnetic pull)
 */
export function Timeline() {
  const visiblePhases = use$(visiblePhases$);
  const timelineDays = getExtendedTimelineDays(4, 1); // Just Today and Tomorrow
  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Ensure Today is scrolled into view on mount
  useEffect(() => {
    if (todayRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      setTimeout(() => {
        requestAnimationFrame(() => {
          todayRef.current?.scrollIntoView({
            behavior: "instant",
            inline: "start",
            block: "nearest",
          });
          // Fade in after scroll completes
          setIsReady(true);
        });
      }, 100);
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

  const renderDayRow = (day: string, isToday: boolean, isPastDay: boolean) => {
    const { dayOfWeek, monthDay } = formatDateShort(day);
    const label = getDateLabel(day);

    return (
      <div
        ref={isToday ? todayRef : null}
        className={cn(
          "flex flex-col gap-2 px-4 py-6",
          "transition-opacity duration-300",
          isToday
            ? "snap-start snap-always border border-slate-400/10 dark:ring-slate-300 rounded-md shadow-xs"
            : "snap-start",
          isPastDay && "opacity-70"
        )}
      >
        {/* Day Title Section - Above Timeline */}
        <div className={cn("flex flex-row items-baseline gap-2 py-2 px-2")}>
          <h2
            className={cn(
              "text-3xl font-mono font-bold",
              isToday
                ? "text-stone-900 dark:text-stone-100"
                : "text-stone-700 dark:text-stone-300"
            )}
          >
            {label}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg text-stone-500 dark:text-stone-400">
              {dayOfWeek}
            </span>
            <span className="text-base text-stone-400 dark:text-stone-500 font-mono">
              {monthDay}
            </span>
          </div>
        </div>

        {/* Phase Sections - Cycletal Flow */}
        <div className="flex gap-2 flex-1 overflow-x-auto scrollbar-hide">
          {visiblePhases.map((phaseConfig, index) => {
            const PhaseIcon = PHASE_ICONS[phaseConfig.phase];
            return (
              <div
                key={phaseConfig.phase}
                className="flex flex-col min-w-[280px] flex-1 p-2"
              >
                {/* Phase Cell */}
                <TimelineCell
                  day={day}
                  phase={phaseConfig.phase}
                  isHighlighted={isToday}
                  phaseIndex={index}
                />
                {/* Phase Icon at Bottom - More opaque */}
                <div className="flex items-center justify-center px-1 mt-2">
                  <PhaseIcon className="w-5 h-5 text-stone-800 dark:text-stone-100" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Find today's index to determine which days are past
  const todayIndex = timelineDays.findIndex((d) => d.isToday);

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full flex gap-6 overflow-x-auto max-h-[calc(100vh-200px)] snap-x snap-mandatory scroll-smooth py-4 hide-scrollbar scroll-pl-16",
        "transition-opacity duration-300",
        isReady ? "opacity-100" : "opacity-0"
      )}
    >
      {timelineDays.map(({ date, isToday }, index) => (
        <div className="px-2" key={date}>
          {renderDayRow(date, isToday, index < todayIndex)}
        </div>
      ))}
      <div className="w-96 flex-shrink-0" />
    </div>
  );
}
