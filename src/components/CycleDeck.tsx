"use client";

import { useDroppable } from "@dnd-kit/core";
import { useValue } from "@legendapp/state/react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { CycleService } from "@/application/services/CycleService";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
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
} from "@/infrastructure/state/ui-store";
import { formatCycleSubtitle } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { CycleDeckColumn } from "./CycleDeckColumn";
import { CycleFormDialog } from "./CycleFormDialog";
import { CycleStarter } from "./CycleStarter";

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
  const selectedCycleId = useValue(cycleDeckSelectedCycleId$);

  const toggleCollapsed = () =>
    cycleDeckCollapsed$.set(!cycleDeckCollapsed$.peek());

  const toggleEditMode = () => {
    if (isCollapsed) return;
    const next = !cycleDeckEditMode$.peek();
    cycleDeckEditMode$.set(next);
  };

  // Arrow navigation through cycles
  const cyclesList = cycleService.getCurrentAndFutureCycles();
  const effectiveCycleId = selectedCycleId || activeCycle?.id || null;
  const effectiveCycle =
    cyclesList.find((c) => c.id === effectiveCycleId) || null;
  const currentIndex = effectiveCycle
    ? cyclesList.findIndex((c) => c.id === effectiveCycle.id)
    : -1;

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
  const [editStartDate, setEditStartDate] = useState(
    effectiveCycle?.startDate || "",
  );
  const [editEndDate, setEditEndDate] = useState(effectiveCycle?.endDate || "");

  // Sync inline edit state when navigating to a different cycle
  const effectiveCycleName = effectiveCycle?.name;
  const effectiveCycleStartDate = effectiveCycle?.startDate;
  const effectiveCycleEndDate = effectiveCycle?.endDate;

  useEffect(() => {
    if (effectiveCycleName !== undefined) {
      setEditName(effectiveCycleName);
    }
    if (effectiveCycleStartDate !== undefined) {
      setEditStartDate(effectiveCycleStartDate);
    }
    setEditEndDate(effectiveCycleEndDate || "");
  }, [effectiveCycleName, effectiveCycleStartDate, effectiveCycleEndDate]);

  // Setup droppable for the entire deck (to unallocate moments from timeline)
  // Must be called unconditionally before any early returns to satisfy React hooks rules
  const cycleId = effectiveCycle?.id;
  const { setNodeRef, isOver } = useDroppable({
    id: `cycle-deck-${cycleId || "none"}`,
    data: {
      cycleId,
      targetType: "cycle-deck",
    },
  });

  // No active cycle → show CycleStarter instead
  if (!activeCycle) {
    return <CycleStarter />;
  }

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
    Object.values(areaHabits).flat(),
  );

  // Subtitle for view mode
  const isEffectiveCycleActive = effectiveCycle?.id === activeCycle?.id;
  const deckSubtitle = effectiveCycle
    ? formatCycleSubtitle(
        effectiveCycle.startDate,
        effectiveCycle.endDate,
        isEffectiveCycleActive,
      )
    : "";

  // Header with arrow navigation and action buttons
  const header = (
    <div className="px-6 py-2.5 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between cursor-default select-none">
      {/* Left side: arrow nav or inline editing */}
      <div className="flex items-center gap-2 min-w-0">
        {isEditMode && !isCollapsed ? (
          /* Edit mode: name input + date inputs */
          <div className="flex items-center gap-3 min-w-0">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
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
          /* View mode: ← [name + subtitle] → */
          <>
            {!isCollapsed && (
              <button
                type="button"
                onClick={goToPrev}
                disabled={!hasPrev}
                className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30 disabled:cursor-default transition-colors"
                aria-label="Previous cycle"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold truncate leading-tight">
                {effectiveCycle?.name ?? "Cycle Deck"}
              </h2>
              {deckSubtitle && (
                <p className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate leading-tight">
                  {deckSubtitle}
                </p>
              )}
            </div>
            {!isCollapsed && (
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
            )}
          </>
        )}
      </div>

      {/* Right side: action icon buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isCollapsed && (
          <>
            <button
              type="button"
              onClick={toggleEditMode}
              className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              title={isEditMode ? "Done editing" : "Edit cycle deck"}
            >
              {isEditMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
        {/* Collapse/expand toggle — always visible */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          title={isCollapsed ? "Expand cycle deck" : "Collapse cycle deck"}
        >
          {isCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );

  // Helper to render area columns content
  const renderColumns = (
    areasWithMoments: { area: Area; habits: Record<string, Moment[]> }[],
  ) => (
    <div className="flex gap-4 overflow-x-auto px-6 py-4 snap-x snap-mandatory scroll-smooth">
      {areasWithMoments.map(({ area, habits }) => (
        <CycleDeckColumn
          key={area.id}
          area={area}
          habitMoments={habits}
          isEditMode={isEditMode}
          showAllHabits={isEditMode}
          cycleId={cycleId ?? ""}
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
        .map((h) => h.areaId),
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
              cycleId={effectiveCycleId ?? ""}
            />
          ))}
        </div>
        <CycleFormDialog
          open={createDialogOpen}
          mode="create"
          initialStartDate={cycleService.getDefaultStartDate()}
          onClose={() => setCreateDialogOpen(false)}
          onSave={(name, templateDuration, startDate, endDate) => {
            const result = cycleService.planCycle(
              name,
              templateDuration,
              startDate,
              endDate ?? undefined,
            );
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
                : "border-stone-300 dark:border-stone-600",
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
            const result = cycleService.planCycle(
              name,
              templateDuration,
              startDate,
              endDate ?? undefined,
            );
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
            isOver && "bg-stone-100/50 dark:bg-stone-800/50",
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
          const result = cycleService.planCycle(
            name,
            templateDuration,
            startDate,
            endDate ?? undefined,
          );
          if (!("error" in result)) {
            cycleDeckSelectedCycleId$.set(result.id);
          }
          setCreateDialogOpen(false);
        }}
      />
    </div>
  );
}

