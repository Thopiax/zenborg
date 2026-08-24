"use client";

import type { Area } from "@/domain/entities/Area";
import type { WeekGridViewModel } from "@/infrastructure/state/weekGridViewModel";
import { WeekGridDayColumn } from "./WeekGridDayColumn";

export interface WeekGridProps {
  vm: WeekGridViewModel;
  areas: Record<string, Area>;
  onAccept: (momentId: string) => void;
  onRename: (momentId: string, name: string) => void;
  onSelect?: (momentId: string) => void;
}

function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${h} ${suffix}`;
}

export function WeekGrid({
  vm,
  areas,
  onAccept,
  onRename,
  onSelect,
}: WeekGridProps) {
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers (sticky) */}
      <div className="flex-shrink-0 grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-stone-200 dark:border-stone-700">
        <div className="w-14" />
        {vm.days.map((day, i) => (
          <div
            key={day.date}
            className={`text-center py-1.5 text-xs font-medium ${
              day.isToday
                ? "text-stone-900 dark:text-stone-100"
                : "text-stone-500 dark:text-stone-400"
            }`}
          >
            <span className="block">{dayLabels[i]}</span>
            <span
              className={`block text-sm ${
                day.isToday
                  ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 w-7 h-7 rounded-full mx-auto flex items-center justify-center"
                  : ""
              }`}
            >
              {Number(day.date.slice(8, 10))}
            </span>
          </div>
        ))}
      </div>

      {/* Scrollable grid area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className="grid grid-cols-[3.5rem_repeat(7,1fr)]"
          style={{
            gridTemplateRows: `1.75rem repeat(${vm.totalRows}, minmax(1.25rem, 1fr))`,
          }}
        >
          {/* Hour gutter (sticky left) */}
          <div
            className="row-start-1 col-start-1"
            style={{ gridRow: `1 / span ${vm.totalRows + 1}` }}
          >
            {/* Empty ambient lane row */}
            <div className="h-7" />
            {vm.hours.map((hour) => (
              <div
                key={hour}
                data-testid="hour-rule"
                className="text-[10px] text-stone-400 dark:text-stone-500 text-right pr-2 relative"
                style={{ height: `${(100 / vm.totalRows) * (60 / 15)}%` }}
              >
                <span className="absolute -top-1.5 right-2">
                  {formatHour(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Horizontal rules layer */}
          <div
            className="col-start-2 col-end-[-1] row-start-1"
            style={{ gridRow: `2 / span ${vm.totalRows}` }}
          >
            <div
              className="h-full divide-y divide-stone-100 dark:divide-stone-800 grid"
              style={{ gridTemplateRows: `repeat(${vm.totalRows}, 1fr)` }}
            >
              {Array.from({ length: vm.totalRows }, (_, i) => (
                <div key={i} />
              ))}
            </div>
          </div>

          {/* Day columns */}
          {vm.days.map((day, i) => (
            <div
              key={day.date}
              className={`col-start-${i + 2} row-start-1 border-l border-stone-100 dark:border-stone-800 ${
                day.isToday ? "bg-stone-50/50 dark:bg-stone-800/30" : ""
              }`}
              style={{
                gridColumn: `${i + 2}`,
                gridRow: `1 / span ${vm.totalRows + 1}`,
              }}
            >
              <WeekGridDayColumn
                day={day}
                vm={vm}
                areas={areas}
                onAccept={onAccept}
                onRename={onRename}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
