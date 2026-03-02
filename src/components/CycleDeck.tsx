"use client";

import { useDroppable } from "@dnd-kit/core";
import { useValue } from "@legendapp/state/react";
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Pencil, X } from "lucide-react";
import { CycleService } from "@/application/services/CycleService";
import type { Area } from "@/domain/entities/Area";
import {
  currentCycle$,
  deckMomentsByAreaAndHabit$,
  habits$,
} from "@/infrastructure/state/store";
import {
  cycleDeckCollapsed$,
  cycleDeckEditMode$,
  cycleDeckShowAllHabits$,
} from "@/infrastructure/state/ui-store";
import { formatCycleEndDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { columnWidth } from "@/lib/design-tokens";
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

  // Edit mode state
  const isEditMode = useValue(cycleDeckEditMode$);
  const showAllHabits = useValue(cycleDeckShowAllHabits$);
  const toggleEditMode = () => {
    const next = !cycleDeckEditMode$.peek();
    cycleDeckEditMode$.set(next);
    if (!next) {
      cycleDeckShowAllHabits$.set(false);
    }
  };

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
      <div className="flex items-center gap-1">
      {isEditMode && (
        <button
          type="button"
          onClick={() => cycleDeckShowAllHabits$.set(!cycleDeckShowAllHabits$.peek())}
          className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title={showAllHabits ? "Hide unbudgeted habits" : "Show all habits"}
          aria-label={showAllHabits ? "Hide unbudgeted habits" : "Show all habits"}
        >
          {showAllHabits ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={toggleEditMode}
        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        title={isEditMode ? "Done editing" : "Edit cycle deck"}
        aria-label={isEditMode ? "Done editing" : "Edit cycle deck"}
      >
        {isEditMode ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Pencil className="h-3.5 w-3.5" />
        )}
      </button>
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
              <CycleDeckColumn
                key={area.id}
                area={area}
                habitMoments={habits}
                isEditMode={isEditMode}
                showAllHabits={showAllHabits}
                cycleId={cycleId!}
              />
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
  isEditMode: boolean;
  showAllHabits: boolean;
  cycleId: string;
}

function CycleDeckColumn({ area, habitMoments, isEditMode, showAllHabits, cycleId }: CycleDeckColumnProps) {
  const allHabits = useValue(habits$);
  const cycleService = new CycleService();

  // Get budgeted habit IDs sorted by habit.order
  const budgetedHabitIds = Object.keys(habitMoments).sort((a, b) => {
    const habitA = allHabits[a];
    const habitB = allHabits[b];
    return (habitA?.order ?? 999) - (habitB?.order ?? 999);
  });

  // If showAllHabits, include unbudgeted habits for this area
  const allAreaHabitIds = showAllHabits
    ? Object.values(allHabits)
        .filter((h) => h.areaId === area.id && !h.isArchived)
        .sort((a, b) => a.order - b.order)
        .map((h) => h.id)
    : budgetedHabitIds;

  // Merge: all area habits (ordered), with budgeted data where available
  const habitEntries = allAreaHabitIds.map((habitId) => ({
    habitId,
    moments: habitMoments[habitId] || [],
    isBudgeted: !!habitMoments[habitId],
  }));

  const totalMoments = budgetedHabitIds.reduce(
    (sum, id) => sum + habitMoments[id].length,
    0
  );

  return (
    <div
      className={cn(
        "flex flex-col snap-start rounded-lg",
        columnWidth.scrollableClassName
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
        {habitEntries.map(({ habitId, moments, isBudgeted }) => {
          if (!isBudgeted) {
            return (
              <GhostHabitCard
                key={habitId}
                habitId={habitId}
                area={area}
                cycleId={cycleId}
              />
            );
          }

          if (isEditMode) {
            const count = moments.length;
            const handleIncrement = () => {
              cycleService.budgetHabitToCycle(cycleId, habitId, count + 1);
            };
            const handleDecrement = () => {
              if (count <= 1) return;
              cycleService.budgetHabitToCycle(cycleId, habitId, count - 1);
            };
            const handleRemove = () => {
              cycleService.budgetHabitToCycle(cycleId, habitId, 0);
            };

            return (
              <MomentStack
                key={habitId}
                moments={moments}
                area={area}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onRemove={handleRemove}
              />
            );
          }

          return <MomentStack key={habitId} moments={moments} area={area} />;
        })}
      </div>
    </div>
  );
}

/**
 * GhostHabitCard - Dashed card for unbudgeted habits in edit mode
 */
interface GhostHabitCardProps {
  habitId: string;
  area: Area;
  cycleId: string;
}

function GhostHabitCard({ habitId, area, cycleId }: GhostHabitCardProps) {
  const allHabits = useValue(habits$);
  const habit = allHabits[habitId];
  const cycleService = new CycleService();

  if (!habit) return null;

  const handleAdd = () => {
    cycleService.budgetHabitToCycle(cycleId, habitId, 1);
  };

  return (
    <div
      data-testid={`ghost-card-${habitId}`}
      className="relative opacity-40 w-full"
      style={{ paddingTop: "8px" }}
    >
      <div className="relative" style={{ zIndex: 1 }}>
        <div
          className="rounded-lg border-2 border-dashed p-3 min-h-[64px] flex items-center gap-2"
          style={{ borderColor: area.color }}
        >
          {habit.emoji && (
            <span className="text-sm">{habit.emoji}</span>
          )}
          <span className="text-sm font-mono font-medium text-stone-500 dark:text-stone-400 truncate">
            {habit.name}
          </span>
        </div>

        {/* Badge: [x] x0 [+] */}
        <div
          className="absolute -top-2 -right-2 rounded-md bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-xs font-mono font-medium shadow-sm flex items-center gap-0.5 px-1 py-0.5"
          style={{ zIndex: 2 }}
        >
          <button
            type="button"
            className="p-0.5 rounded opacity-30 cursor-default"
            disabled
          >
            <X className="h-3 w-3" />
          </button>
          <span className="px-1">x0</span>
          <button
            type="button"
            onClick={handleAdd}
            className="p-0.5 rounded hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
            title="Add to cycle"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
