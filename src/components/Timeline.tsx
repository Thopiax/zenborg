"use client";

import { use$ } from "@legendapp/state/react";
import { CloudMoon, Coffee, Moon, Sun } from "lucide-react";
import { useState } from "react";
import type { Phase } from "@/domain/value-objects/Phase";
import { visiblePhases$ } from "@/infrastructure/state/store";
import { getDateLabel, getTimelineDays } from "@/lib/dates";
import { DaySelector } from "./DaySelector";
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
 * Timeline - Responsive timeline grid
 *
 * Desktop (≥768px):
 * - 3-column grid: Yesterday | Today | Tomorrow
 * - Each column shows all visible phases (Morning, Afternoon, Evening)
 * - Phase indicators: colored left border (4px) on first cell of each row
 * - Creates 3x3 (or 3x4 if Night is visible) grid
 *
 * Mobile (<768px):
 * - Single-day column view
 * - DaySelector to switch between days
 * - Shows all visible phases vertically with horizontal icon labels
 * - Same greyscale background tints as desktop
 */
export function Timeline() {
  const visiblePhases = use$(visiblePhases$);
  const days = getTimelineDays();
  const [selectedMobileDay, setSelectedMobileDay] = useState(days.today);

  return (
    <div className="w-full">
      {/* Mobile Layout: Single-day column with greyscale phase labels */}
      <div className="md:hidden space-y-4">
        <DaySelector
          currentDay={selectedMobileDay}
          onDayChange={setSelectedMobileDay}
          days={days}
        />

        {visiblePhases.map((phaseConfig, index) => {
          const PhaseIcon = PHASE_ICONS[phaseConfig.phase];
          return (
            <div key={phaseConfig.phase} className="space-y-2">
              {/* Horizontal phase label for mobile */}
              <div className="flex items-center gap-3 px-2">
                <PhaseIcon className="w-5 h-5 text-stone-500 dark:text-stone-400" />
                <span className="text-sm font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                  {phaseConfig.label}
                </span>
              </div>
              <TimelineCell
                day={selectedMobileDay}
                phase={phaseConfig.phase}
                isHighlighted={selectedMobileDay === days.today}
                phaseIndex={index}
              />
            </div>
          );
        })}
      </div>

      {/* Desktop Layout: 3x3 Grid (phases indicated by row background tint) */}
      <div className="hidden md:block">
        <div className="space-y-6">
          {/* Day headers row - aligned with grid columns including label column */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-4">
            {/* Empty space for phase label column */}
            <div className="w-12" />

            <div className="text-center">
              <h3 className="text-lg font-medium text-stone-700 dark:text-stone-300">
                {getDateLabel(days.yesterday)}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                {days.yesterday}
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                {getDateLabel(days.today)}
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 font-mono font-semibold">
                {days.today}
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-stone-700 dark:text-stone-300">
                {getDateLabel(days.tomorrow)}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                {days.tomorrow}
              </p>
            </div>
          </div>

          {/* Phase rows (greyscale background tints with vertical labels) */}
          {visiblePhases.map((phaseConfig, index) => {
            const PhaseIcon = PHASE_ICONS[phaseConfig.phase];
            return (
              <div
                key={phaseConfig.phase}
                className="grid grid-cols-[auto_1fr_1fr_1fr] gap-4"
              >
                {/* Vertical phase label on left */}
                <div className="flex items-center justify-center w-12">
                  <div className="flex flex-col items-center gap-2 -rotate-90 origin-center whitespace-nowrap">
                    <PhaseIcon className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                    <span className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                      {phaseConfig.label}
                    </span>
                  </div>
                </div>

                {/* Yesterday */}
                <TimelineCell
                  day={days.yesterday}
                  phase={phaseConfig.phase}
                  isHighlighted={false}
                  phaseIndex={index}
                />
                {/* Today - emphasized with font weight */}
                <TimelineCell
                  day={days.today}
                  phase={phaseConfig.phase}
                  isHighlighted={true}
                  phaseIndex={index}
                />
                {/* Tomorrow */}
                <TimelineCell
                  day={days.tomorrow}
                  phase={phaseConfig.phase}
                  isHighlighted={false}
                  phaseIndex={index}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
