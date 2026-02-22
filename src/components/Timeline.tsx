"use client";

import { use$ } from "@legendapp/state/react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type { Phase } from "@/domain/value-objects/Phase";
import { visiblePhases$ } from "@/infrastructure/state/store";
import {
  fromISODate,
  getDateLabel,
  getExtendedTimelineDays,
} from "@/lib/dates";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { TimelineCell } from "./TimelineCell";

/**
 * DayRow - A single day row in the timeline
 */
interface DayRowProps {
  day: string;
  isToday: boolean;
  isActiveDay: boolean;
  isPastDay: boolean;
  visiblePhases: Array<{ phase: Phase }>;
}

const DayRow = forwardRef<HTMLDivElement, DayRowProps>(
  ({ day, isActiveDay, isPastDay, visiblePhases }, ref) => {
    const { dayOfWeek, monthDay } = formatDateShort(day);
    const label = getDateLabel(day);

    useEffect(() => {
      console.log(`Rendering DayRow for ${day} (${label})`);
      console.debug("visiblePhases:", visiblePhases);
    }, [day, label, visiblePhases]);

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col h-full",
          // Minimal padding
          "scroll-ml-2 md:scroll-ml-6",
          "gap-1.5 px-2 py-2 md:px-4 md:py-4",
          // Smooth opacity transitions for past days
          "transition-opacity duration-medium transition-smooth",
          isActiveDay
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
              isActiveDay
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
                className={cn("flex flex-col", columnWidth.scrollableClassName)}
              >
                {/* Phase Cell - Height based on 3 cards (64px each) + 2 gaps (12px each) + padding */}
                <div className="flex-1 p-0.5 md:p-1 h-full">
                  <TimelineCell
                    day={day}
                    phase={phaseConfig.phase}
                    isHighlighted={isActiveDay}
                    phaseIndex={index}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

DayRow.displayName = "DayRow";

// Helper to format date as "Mon 12/25"
const formatDateShort = (dateStr: string) => {
  const date = fromISODate(dateStr);
  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
  });
  return { dayOfWeek, monthDay };
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
  const timelineDays = getExtendedTimelineDays(1, 1); // Yesterday, Today, Tomorrow
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDayRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Scroll to active day
  const scrollToActiveDay = useCallback(() => {
    if (activeDayRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        activeDayRef.current?.scrollIntoView({
          behavior: "instant",
          inline: "start",
          block: "nearest",
        });

        // Fade in after scroll completes
        setIsReady(true);
      });
    }
  }, []);

  // Ensure active day is scrolled into view on mount
  useEffect(() => {
    const timeout = setTimeout(scrollToActiveDay, 200);
    return () => clearTimeout(timeout);
  }, [scrollToActiveDay]);

  // Re-scroll to active day when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      console.log("Window focused - re-scrolling to active day");
      scrollToActiveDay();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [scrollToActiveDay]);

  // Find active day's index to determine which days are past
  const activeDayIndex = timelineDays.findIndex((d) => d.isActiveDay);

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
      {timelineDays.map(({ date, isToday, isActiveDay }, index) => (
        <DayRow
          key={date}
          ref={isActiveDay ? activeDayRef : null}
          day={date}
          isToday={isToday}
          isActiveDay={isActiveDay}
          isPastDay={index < activeDayIndex}
          visiblePhases={visiblePhases}
        />
      ))}
      <div className="w-16 flex-shrink-0" />
    </div>
  );
}
