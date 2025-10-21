"use client";

import { use$ } from "@legendapp/state/react";
import { useEffect, useRef, useState } from "react";
import { PHASE_ICONS, PhaseIcon } from "@/domain/value-objects/phaseStyles";
import { visiblePhases$ } from "@/infrastructure/state/store";
import { getDateLabel, getExtendedTimelineDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TimelineCell } from "./TimelineCell";

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
      }, 200);
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
          "flex flex-col h-full",
          // Minimal padding
          "scroll-ml-2 md:scroll-ml-6",
          "gap-1.5 px-2 py-2 md:px-4 md:py-4",
          // Smooth opacity transitions for past days
          "transition-opacity duration-medium transition-smooth",
          isToday
            ? "snap-start snap-always border border-slate-400/30 dark:ring-slate-300 rounded-md shadow-sm"
            : "snap-start",
          isPastDay && "opacity-70"
        )}
      >
        {/* Day Title Section - Above Timeline */}
        <div className="flex flex-row items-baseline gap-2 px-1 py-0.5">
          <h2
            className={cn(
              "font-mono font-bold text-2xl md:text-3xl",
              isToday
                ? "text-stone-900 dark:text-stone-100"
                : "text-stone-700 dark:text-stone-300"
            )}
          >
            {label}
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-stone-500 dark:text-stone-400 text-base md:text-lg">
              {dayOfWeek}
            </span>
            <span className="text-stone-400 dark:text-stone-500 font-mono text-sm md:text-base">
              {monthDay}
            </span>
          </div>
        </div>

        {/* Phase Sections - Horizontal Flow */}
        <div className="flex gap-1.5 md:gap-2 flex-1 overflow-x-auto scrollbar-hide h-full">
          {visiblePhases.map((phaseConfig, index) => {
            return (
              <div
                key={phaseConfig.phase}
                className="flex flex-col flex-1 min-w-[200px] md:min-w-[240px] relative"
              >
                {/* Phase Cell - Height based on 3 cards (64px each) + 2 gaps (12px each) + padding */}
                <div className="flex-1 p-0.5 md:p-1 h-full">
                  <TimelineCell
                    day={day}
                    phase={phaseConfig.phase}
                    isHighlighted={isToday}
                    phaseIndex={index}
                  />
                </div>
                {/* Phase Icon at Bottom - More opaque */}
                <div className="absolute left-0 right-0 bottom-0 inset-x-0 flex py-6 items-center justify-center px-1 mt-1 flex-shrink-0 z-0">
                  <PhaseIcon
                    phase={phaseConfig.phase}
                    className="opacity-50 text-stone-800 dark:text-stone-100 w-4 h-4 md:w-5 md:h-5"
                  />
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
        "w-full h-full flex overflow-x-scroll snap-x snap-mandatory scroll-smooth scrollbar-hide",
        // Minimal gap and padding on left/top, safe area padding on right
        "gap-3 md:gap-4 px-2 md:px-4 py-2 md:py-4",
        // Smooth fade-in on load
        "transition-opacity duration-slow transition-smooth",
        isReady ? "opacity-100" : "opacity-0"
      )}
      style={{
        // Enable momentum scrolling on iOS/Safari
        WebkitOverflowScrolling: "touch",
        // Ensure right padding includes safe area (bottom in landscape)
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {timelineDays.map(({ date, isToday }, index) => (
        <div className="flex-shrink-0" key={date}>
          {renderDayRow(date, isToday, index < todayIndex)}
        </div>
      ))}
      <div className="w-16 flex-shrink-0" />
    </div>
  );
}
