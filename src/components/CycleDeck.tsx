"use client";

import { useDroppable } from "@dnd-kit/core";
import { useValue } from "@legendapp/state/react";
import { ChevronLeft, ChevronRight, ChevronUp, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CycleService } from "@/application/services/CycleService";
import type { Area } from "@/domain/entities/Area";
import {
  activeCycle$,
  areas$,
  deckMomentsByAreaAndHabit$,
  habits$,
} from "@/infrastructure/state/store";
import {
  cycleDeckCollapsed$,
  cycleDeckEditMode$,
  cycleDeckSelectedCycleId$,
  cycleDeckShowAllHabits$,
} from "@/infrastructure/state/ui-store";
import { formatCycleEndDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { columnWidth } from "@/lib/design-tokens";
import { CycleFormDialog } from "./CycleFormDialog";
import { CycleStarter } from "./CycleStarter";
import { MomentStack } from "./MomentStack";

/**
 * CycleDeck - Container for budgeted moments during active cycle
 *
 * Features:
 * - Arrow navigation (← name →) through current and future cycles
 * - Double-click header to collapse/expand
 * - Inline edit mode: editable name + date inputs, count controls, ghost cards
 * - Labeled text buttons (Edit/Done/Show All)
 * - CycleStarter shown when no cycle is active
 *
 * Design:
 * - Stone monochrome base
 * - Area colors for headers
 * - Grouped by area automatically (no grouping options)
 */
export function CycleDeck() {
  const cycleService = new CycleService();
  const deckMoments = useValue(() => deckMomentsByAreaAndHabit$.get());

  // Get the active cycle (via activeCycleId$) - reactive!
  const activeCycle = useValue(() => activeCycle$.get());

  // Collapse state — shared with the `p` hotkey in view-commands
  const isCollapsed = useValue(cycleDeckCollapsed$);

  // Edit mode state
  const isEditMode = useValue(cycleDeckEditMode$);
  const showAllHabits = useValue(cycleDeckShowAllHabits$);
  const selectedCycleId = useValue(cycleDeckSelectedCycleId$);

  // No active cycle → show CycleStarter instead
  if (!activeCycle) {
    return <CycleStarter />;
  }

  const toggleCollapsed = () => cycleDeckCollapsed$.set(!cycleDeckCollapsed$.peek());
  const toggleEditMode = () => {
    if (isCollapsed) return;
    const next = !cycleDeckEditMode$.peek();
    cycleDeckEditMode$.set(next);
    if (!next) {
      cycleDeckShowAllHabits$.set(false);
    }
  };

  // Arrow navigation through cycles
  const cyclesList = cycleService.getCurrentAndFutureCycles();
  const effectiveCycleId = selectedCycleId || activeCycle?.id || null;
  const effectiveCycle = cyclesList.find((c) => c.id === effectiveCycleId) || null;
  const currentIndex = effectiveCycle ? cyclesList.findIndex((c) => c.id === effectiveCycle.id) : -1;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < cyclesList.length - 1;

  const goToPrev = () => {
    if (hasPrev) cycleDeckSelectedCycleId$.set(cyclesList[currentIndex - 1].id);
  };
  const goToNext = () => {
    if (hasNext) {
      cycleDeckSelectedCycleId$.set(cyclesList[currentIndex + 1].id);
    } else {
      setCreateDialogOpen(true);
    }
  };

  // Create cycle dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Inline editing state for cycle name and dates
  const [editName, setEditName] = useState(effectiveCycle?.name || "");
  const [editStartDate, setEditStartDate] = useState(effectiveCycle?.startDate || "");
  const [editEndDate, setEditEndDate] = useState(effectiveCycle?.endDate || "");

  useEffect(() => {
    if (effectiveCycle) {
      setEditName(effectiveCycle.name);
      setEditStartDate(effectiveCycle.startDate);
      setEditEndDate(effectiveCycle.endDate || "");
    }
  }, [effectiveCycle?.name, effectiveCycle?.startDate, effectiveCycle?.endDate]);

  const handleNameBlur = () => {
    if (!effectiveCycleId || editName.trim() === effectiveCycle?.name) return;
    cycleService.updateCycle(effectiveCycleId, { name: editName.trim() });
  };

  const handleDateBlur = () => {
    if (!effectiveCycleId) return;
    cycleService.updateCycle(effectiveCycleId, {
      startDate: editStartDate,
      endDate: editEndDate || null,
    });
  };

  // Get all budgeted moments for current cycle (using store's computed selector)
  const allDeckMoments = Object.values(deckMoments).flatMap((areaHabits) =>
    Object.values(areaHabits).flat()
  );

  // Setup droppable for the entire deck (to unallocate moments from timeline)
  const cycleId = effectiveCycle?.id;
  const { setNodeRef, isOver } = useDroppable({
    id: `cycle-deck-${cycleId || "none"}`,
    data: {
      cycleId,
      targetType: "cycle-deck",
    },
  });

  // Title for view mode
  const deckTitle = effectiveCycle
    ? `${effectiveCycle.name} · ${formatCycleEndDate(effectiveCycle.endDate)}`
    : "Cycle Deck";

  // Header with arrow navigation and labeled buttons
  const header = (
    <div
      className="px-6 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between cursor-default select-none"
      onDoubleClick={toggleCollapsed}
    >
      {/* Left side: arrow nav or inline editing */}
      <div className="flex items-center gap-2 min-w-0">
        {isEditMode ? (
          /* Edit mode: name input + date inputs */
          <div className="flex items-center gap-3 min-w-0">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold bg-transparent border-b border-stone-300 dark:border-stone-600 focus:border-stone-500 outline-none px-0 py-0 min-w-0"
              aria-label="Cycle name"
            />
            <div className="flex items-center gap-1.5 text-xs font-mono text-stone-500 flex-shrink-0">
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                onBlur={handleDateBlur}
                className="bg-transparent border-b border-stone-300 dark:border-stone-600 focus:border-stone-500 outline-none px-0 py-0 text-xs font-mono text-stone-600 dark:text-stone-400"
                aria-label="Start date"
              />
              <span className="text-stone-400">{"\u2192"}</span>
              <input
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                onBlur={handleDateBlur}
                className="bg-transparent border-b border-stone-300 dark:border-stone-600 focus:border-stone-500 outline-none px-0 py-0 text-xs font-mono text-stone-600 dark:text-stone-400"
                aria-label="End date"
              />
            </div>
          </div>
        ) : (
          /* View mode: ← name · countdown → */
          <>
            <button
              type="button"
              onClick={goToPrev}
              disabled={!hasPrev}
              className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30 disabled:cursor-default transition-colors"
              aria-label="Previous cycle"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold truncate">
              {deckTitle}
            </h2>
            <button
              type="button"
              onClick={goToNext}
              className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
              aria-label={hasNext ? "Next cycle" : "Create new cycle"}
            >
              {hasNext ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </>
        )}
      </div>

      {/* Right side: labeled text buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isCollapsed && (
          <>
            {isEditMode && (
              <button
                type="button"
                onClick={() => cycleDeckShowAllHabits$.set(!cycleDeckShowAllHabits$.peek())}
                className="text-xs font-mono text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
              >
                {showAllHabits ? "Hide All" : "Show All"}
              </button>
            )}
            <button
              type="button"
              onClick={toggleEditMode}
              className="text-xs font-mono text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            >
              {isEditMode ? "Done" : "Edit"}
            </button>
          </>
        )}
      </div>
    </div>
  );

  // Helper to render area columns content
  const renderColumns = (areasWithMoments: { area: Area; habits: Record<string, any[]> }[]) => (
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
  );

  // Empty state — in edit mode, show area columns with ghost cards
  if (allDeckMoments.length === 0 && isEditMode && !isCollapsed) {
    const allHabitsMap = habits$.get();
    const allAreasMap = areas$.get();

    const areaIdsWithHabits = new Set(
      Object.values(allHabitsMap)
        .filter((h) => !h.isArchived)
        .map((h) => h.areaId)
    );

    const areasToShow = Object.values(allAreasMap)
      .filter((a) => areaIdsWithHabits.has(a.id))
      .sort((a, b) => a.order - b.order);

    return (
      <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
        {header}
        <div className="flex gap-4 overflow-x-auto px-6 py-4 snap-x snap-mandatory scroll-smooth">
          {areasToShow.map((area) => (
            <CycleDeckColumn
              key={area.id}
              area={area}
              habitMoments={{}}
              isEditMode={true}
              showAllHabits={true}
              cycleId={effectiveCycleId!}
            />
          ))}
        </div>
        <CycleFormDialog
          open={createDialogOpen}
          mode="create"
          initialStartDate={cycleService.getDefaultStartDate()}
          onClose={() => setCreateDialogOpen(false)}
          onSave={(name, templateDuration, startDate, endDate) => {
            const result = cycleService.planCycle(name, templateDuration, startDate, endDate ?? undefined);
            if (!("error" in result)) {
              cycleDeckSelectedCycleId$.set(result.id);
            }
            setCreateDialogOpen(false);
          }}
        />
      </div>
    );
  }

  // Empty state — read-only mode
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
        <CycleFormDialog
          open={createDialogOpen}
          mode="create"
          initialStartDate={cycleService.getDefaultStartDate()}
          onClose={() => setCreateDialogOpen(false)}
          onSave={(name, templateDuration, startDate, endDate) => {
            const result = cycleService.planCycle(name, templateDuration, startDate, endDate ?? undefined);
            if (!("error" in result)) {
              cycleDeckSelectedCycleId$.set(result.id);
            }
            setCreateDialogOpen(false);
          }}
        />
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
          {renderColumns(areasWithMoments)}
        </div>
      )}

      <CycleFormDialog
        open={createDialogOpen}
        mode="create"
        initialStartDate={cycleService.getDefaultStartDate()}
        onClose={() => setCreateDialogOpen(false)}
        onSave={(name, templateDuration, startDate, endDate) => {
          const result = cycleService.planCycle(name, templateDuration, startDate, endDate ?? undefined);
          if (!("error" in result)) {
            cycleDeckSelectedCycleId$.set(result.id);
          }
          setCreateDialogOpen(false);
        }}
      />
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
