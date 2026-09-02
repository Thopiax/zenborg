"use client";

import type { Area } from "@zenborg/core/domain/entities/Area";
import type {
  WeekGridBlock,
  WeekGridDay,
  WeekGridViewModel,
} from "@/infrastructure/state/weekGridViewModel";
import { WeekMomentBlock } from "./WeekMomentBlock";

interface WeekGridDayColumnProps {
  day: WeekGridDay;
  vm: WeekGridViewModel;
  areas: Record<string, Area>;
  onAccept: (momentId: string) => void;
  onRename: (momentId: string, name: string) => void;
  onSelect?: (momentId: string) => void;
}

export function WeekGridDayColumn({
  day,
  vm,
  areas,
  onAccept,
  onRename,
  onSelect,
}: WeekGridDayColumnProps) {
  return (
    <li
      data-testid="week-day-column"
      className="relative col-span-1"
      style={{
        gridRow: `1 / span ${vm.totalRows + 2}`,
      }}
    >
      <ol
        className="grid h-full"
        style={{
          gridTemplateRows: `1.75rem repeat(${vm.totalRows}, minmax(0, 1fr))`,
        }}
      >
        {/* Ambient lane (row 1) */}
        <li className="flex items-center gap-1 px-1 overflow-hidden border-b border-stone-200 dark:border-stone-700">
          {day.ambient.map((m) => {
            const area = areas[m.areaId];
            return (
              <span
                key={m.id}
                className="inline-flex items-center gap-0.5 text-[10px] text-stone-500 dark:text-stone-400 truncate"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: area?.color ?? "#a8a29e" }}
                />
                {m.name}
              </span>
            );
          })}
        </li>

        {/* Timed blocks placed by grid row */}
        {day.blocks.map((block: WeekGridBlock) => (
          <WeekMomentBlock
            key={block.momentId}
            block={block}
            areaColor={areas[block.areaId]?.color ?? "#a8a29e"}
            onAccept={onAccept}
            onRename={onRename}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </li>
  );
}
