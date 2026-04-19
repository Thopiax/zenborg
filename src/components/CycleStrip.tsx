"use client";

import { useValue } from "@legendapp/state/react";
import { Plus } from "lucide-react";
import { forwardRef, useEffect, useRef } from "react";
import type { Cycle } from "@/domain/entities/Cycle";
import { activeCycle$, cycles$ } from "@/infrastructure/state/store";
import { cycleDeckSelectedCycleId$ } from "@/infrastructure/state/ui-store";
import {
  formatCycleDateRange,
  formatCycleSubtitle,
  fromISODate,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

interface CycleStripProps {
  onCreateCycle?: () => void;
  onSelectCycle?: (cycleId: string) => void;
}

/**
 * CycleStrip - horizontal week-view cards for cycles.
 *
 * Active cycle is anchored leftmost. Past cycles sit off-screen left
 * (scroll back to reveal); future cycles extend right. Tapping a card
 * selects it in ui-store so the detail pane below can react.
 */
export function CycleStrip({ onCreateCycle, onSelectCycle }: CycleStripProps) {
  const allCycles = useValue(() => cycles$.get());
  const activeCycle = useValue(() => activeCycle$.get());
  const selectedCycleId = useValue(cycleDeckSelectedCycleId$);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLButtonElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cycles = Object.values(allCycles);
  const active = activeCycle;

  const past = cycles
    .filter((c) => {
      if (c.id === active?.id) return false;
      if (!c.endDate) return false;
      const end = fromISODate(c.endDate);
      end.setHours(0, 0, 0, 0);
      return end < today;
    })
    .sort(
      (a, b) =>
        fromISODate(a.startDate).getTime() - fromISODate(b.startDate).getTime()
    );

  const future = cycles
    .filter((c) => {
      if (c.id === active?.id) return false;
      if (!c.endDate) return true;
      const end = fromISODate(c.endDate);
      end.setHours(0, 0, 0, 0);
      return end >= today;
    })
    .sort(
      (a, b) =>
        fromISODate(a.startDate).getTime() - fromISODate(b.startDate).getTime()
    );

  const ordered: Cycle[] = [...past, ...(active ? [active] : []), ...future];

  useEffect(() => {
    if (activeCardRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        left: activeCardRef.current.offsetLeft - 16,
        behavior: "instant" as ScrollBehavior,
      });
    }
  }, [active?.id]);

  const effectiveSelectedId = selectedCycleId ?? active?.id ?? null;

  const handleSelect = (cycleId: string) => {
    cycleDeckSelectedCycleId$.set(cycleId);
    onSelectCycle?.(cycleId);
  };

  return (
    <div
      ref={scrollRef}
      className="w-full overflow-x-auto snap-x scroll-smooth border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900"
    >
      <div className="flex gap-3 px-4 py-3 min-w-max">
        {ordered.map((cycle) => {
          const isActive = cycle.id === active?.id;
          const isSelected = cycle.id === effectiveSelectedId;
          const isPast = Boolean(
            cycle.endDate &&
              (() => {
                const e = fromISODate(cycle.endDate);
                e.setHours(0, 0, 0, 0);
                return e < today;
              })()
          );
          return (
            <CycleCard
              key={cycle.id}
              ref={isActive ? activeCardRef : undefined}
              cycle={cycle}
              isActive={isActive}
              isSelected={isSelected}
              isPast={isPast}
              onClick={() => handleSelect(cycle.id)}
            />
          );
        })}
        {onCreateCycle && (
          <button
            type="button"
            onClick={onCreateCycle}
            className="flex-shrink-0 w-48 h-[104px] snap-start rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-700 text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center gap-2 font-mono text-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Plan new cycle
          </button>
        )}
      </div>
    </div>
  );
}

interface CycleCardProps {
  cycle: Cycle;
  isActive: boolean;
  isSelected: boolean;
  isPast: boolean;
  onClick: () => void;
}

const CycleCard = forwardRef<HTMLButtonElement, CycleCardProps>(
  ({ cycle, isActive, isSelected, isPast, onClick }, ref) => {
    const subtitle = formatCycleSubtitle(
      cycle.startDate,
      cycle.endDate,
      isActive
    );
    const range = formatCycleDateRange(cycle.startDate, cycle.endDate);

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-pressed={isSelected}
        className={cn(
          "flex-shrink-0 w-48 h-[104px] snap-start rounded-lg px-3 py-2 text-left font-mono transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400",
          isActive &&
            "bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 shadow-sm",
          !isActive && isPast &&
            "bg-stone-100 dark:bg-stone-800/50 text-stone-500 dark:text-stone-500 border border-stone-200 dark:border-stone-700 opacity-70 hover:opacity-100",
          !isActive && !isPast &&
            "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500",
          isSelected && !isActive && "ring-2 ring-stone-400 dark:ring-stone-500"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold truncate">{cycle.name}</span>
          {isActive && (
            <span className="text-[10px] uppercase tracking-wider opacity-70 flex-shrink-0">
              now
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] opacity-70 truncate">{range}</div>
        <div className="mt-1 text-[11px] opacity-60 truncate">{subtitle}</div>
        {cycle.intention ? (
          <div
            className={cn(
              "mt-2 text-[11px] leading-tight line-clamp-2",
              isActive ? "opacity-80" : "opacity-70"
            )}
          >
            {cycle.intention}
          </div>
        ) : (
          <div className="mt-2 text-[11px] italic opacity-40">
            No intention yet
          </div>
        )}
      </button>
    );
  }
);
CycleCard.displayName = "CycleCard";
