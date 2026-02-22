"use client";

import { useDroppable } from "@dnd-kit/core";
import { useValue } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CycleService } from "@/application/services/CycleService";
import type { Area } from "@/domain/entities/Area";
import {
  currentCycle$,
  deckMomentsByAreaAndHabit$,
} from "@/infrastructure/state/store";
import { cycleDeckCollapsed$ } from "@/infrastructure/state/ui-store";
import { formatCycleEndDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { MOMENT_CARD_WIDTH_CLASSNAME } from "./MomentCard";
import { MomentStack } from "./MomentStack";

/**
 * CycleDeck - Container for budgeted moments during active cycle
 *
 * Features:
 * - Displays budgeted moments grouped by area → habit
 * - Renders MomentStack components for each habit
 * - Replaces DrawingBoard when active cycle exists
 * - Collapsible with chevron toggle and `p` hotkey
 * - Read-only (no toolbar) - focus on execution
 *
 * Design:
 * - Stone monochrome base
 * - Area colors for headers
 * - Grouped by area automatically (no grouping options)
 */
export function CycleDeck() {
  const cycleService = new CycleService();
  const deckMoments = useValue(() => deckMomentsByAreaAndHabit$.get());

  // Get the current cycle (the one containing today's date) - reactive!
  const currentCycle = useValue(() => currentCycle$.get());

  // Collapse state — shared with the `p` hotkey in view-commands
  const isCollapsed = useValue(cycleDeckCollapsed$);
  const toggleCollapsed = () => cycleDeckCollapsed$.set(!cycleDeckCollapsed$.peek());

  // Get all budgeted moments for current cycle (using store's computed selector)
  const allDeckMoments = Object.values(deckMoments).flatMap((areaHabits) =>
    Object.values(areaHabits).flat()
  );

  // Setup droppable for the entire deck (to unallocate moments from timeline)
  const cycleId = currentCycle?.id;
  const { setNodeRef, isOver } = useDroppable({
    id: `cycle-deck-${cycleId || "none"}`,
    data: {
      cycleId,
      targetType: "cycle-deck",
    },
  });

  // Get title: cycle name + end date countdown
  const deckTitle = currentCycle
    ? `${currentCycle.name} · ${formatCycleEndDate(currentCycle.endDate)}`
    : "Cycle Deck";

  // Shared header with collapse toggle — used by both empty and populated states
  const header = (
    <div className="px-6 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
      <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold">
        {deckTitle}
      </h2>
      <button
        type="button"
        onClick={toggleCollapsed}
        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        title={isCollapsed ? "Expand cycle deck (p)" : "Collapse cycle deck (p)"}
        aria-label={isCollapsed ? "Expand cycle deck" : "Collapse cycle deck"}
      >
        {isCollapsed ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
    </div>
  );

  // Empty state - no budgeted moments
  if (allDeckMoments.length === 0) {
    return (
      <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
        {header}
        {!isCollapsed && (
          <div
            ref={setNodeRef}
            className={cn(
              "p-8 min-h-[200px] flex flex-col items-center justify-center gap-3 border-2 border-dashed mx-6 my-4 rounded-lg transition-colors",
              isOver
                ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
                : "border-stone-300 dark:border-stone-600"
            )}
          >
            <p className="text-stone-400 text-sm font-mono text-center">
              No budgeted moments in deck
            </p>
            <p className="text-xs text-stone-500 font-mono text-center">
              Drag habits from the library to build your cycle deck
            </p>
          </div>
        )}
      </div>
    );
  }

  // Get areas with moments using application service
  const areasWithMoments = cycleService.getAreasWithDeckMoments(deckMoments);

  return (
    <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
      {header}

      {/* Droppable container for unallocating moments */}
      {!isCollapsed && (
        <div
          ref={setNodeRef}
          className={cn(
            "relative transition-colors",
            isOver && "bg-stone-100/50 dark:bg-stone-800/50"
          )}
        >
          {/* Drop indicator when dragging over */}
          {isOver && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div className="border-4 border-dashed border-stone-400 dark:border-stone-500 rounded-lg absolute inset-4 bg-stone-100/30 dark:bg-stone-800/30">
                <div className="flex items-center justify-center h-full">
                  <div className="bg-stone-800/90 dark:bg-stone-200/90 text-white dark:text-stone-900 px-6 py-3 rounded-lg shadow-lg">
                    <p className="text-sm font-bold font-mono">
                      Drop to unallocate back to cycle deck
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Horizontal scrollable columns (matching CycleDeckBuilder) */}
          <div className="flex gap-4 overflow-x-auto px-6 py-4 snap-x snap-mandatory scroll-smooth">
            {areasWithMoments.map(({ area, habits }) => (
              <CycleDeckColumn key={area.id} area={area} habitMoments={habits} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CycleDeckColumn - Single vertical column for an area
 * Matches the design from CycleDeckBuilder for consistency
 */
interface CycleDeckColumnProps {
  area: Area;
  habitMoments: Record<string, any[]>;
}

function CycleDeckColumn({ area, habitMoments }: CycleDeckColumnProps) {
  const habitIds = Object.keys(habitMoments);
  const totalMoments = habitIds.reduce(
    (sum, id) => sum + habitMoments[id].length,
    0
  );

  return (
    <div
      className={cn(
        "flex flex-col max-w-[320px] snap-start rounded-lg",
        MOMENT_CARD_WIDTH_CLASSNAME
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            {area.emoji}
          </span>
          <h3 className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300">
            {area.name}
          </h3>
          <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
            {totalMoments}
          </span>
        </div>
      </div>

      {/* Colored Divider */}
      <div
        className="h-[3px] mx-4 mb-2"
        style={{ backgroundColor: area.color }}
      />

      {/* Column Content */}
      <div className="flex flex-col gap-3 p-4 min-h-[300px]">
        {habitIds.map((habitId) => {
          const moments = habitMoments[habitId];
          return <MomentStack key={habitId} moments={moments} area={area} />;
        })}
      </div>
    </div>
  );
}
