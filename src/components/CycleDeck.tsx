"use client";

import { useDroppable } from "@dnd-kit/core";
import { useValue } from "@legendapp/state/react";
import { Check, ChevronDown, ChevronUp, Flag, Pencil, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { CycleService } from "@/application/services/CycleService";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import {
  activeCycle$,
  areas$,
  cycles$,
  deckMomentsByAreaAndHabit$,
  habits$,
  storeHydrated$,
} from "@/infrastructure/state/store";
import {
  cycleDeckCollapsed$,
  cycleDeckEditMode$,
  cycleDeckSelectedCycleId$,
} from "@/infrastructure/state/ui-store";
import { formatCycleSubtitle, fromISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { CycleCalendarDialog } from "./CycleCalendarDialog";
import { CycleDeckColumn } from "./CycleDeckColumn";
import { CycleStrip } from "./CycleStrip";

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

  // Resolve which cycle the detail pane below the strip is rendering.
  // Selection state (ui-store) trumps the active cycle so scrolling the
  // strip can surface any past/future cycle.
  const allCyclesMap = useValue(() => cycles$.get());
  const effectiveCycleId = selectedCycleId || activeCycle?.id || null;
  const effectiveCycle = effectiveCycleId
    ? allCyclesMap[effectiveCycleId] || null
    : null;

  // Create cycle dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // End cycle popover state
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);
  const [endDateInput, setEndDateInput] = useState("");
  const [endCycleError, setEndCycleError] = useState<string | null>(null);

  const resetEndCycleState = () => {
    setEndPopoverOpen(false);
    setEndDateInput("");
    setEndCycleError(null);
  };

  const handleEndCycle = (explicitEndDate?: string) => {
    if (!effectiveCycleId) return;
    const result = cycleService.endCycle(effectiveCycleId, explicitEndDate);
    if ("error" in result) {
      setEndCycleError(result.error);
      return;
    }
    resetEndCycleState();
  };

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

  // Wait for store hydration before deciding what to render
  const isHydrated = useValue(storeHydrated$);

  // No active cycle → show only the strip (with "+ Plan new cycle") and a
  // quiet hint. No floating "Cycle Deck" container over an empty space.
  if (!activeCycle) {
    if (!isHydrated) return null;
    return (
      <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
        <CycleStrip onCreateCycle={() => setCreateDialogOpen(true)} />
        <div className="px-6 py-4 text-center text-xs font-mono text-stone-400 dark:text-stone-500">
          No active cycle. Plan one above to start budgeting moments.
        </div>
        <CycleCalendarDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
        />
      </div>
    );
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
          /* View mode: name + subtitle (strip above handles nav) */
          <div className="min-w-0">
            <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold truncate leading-tight">
              {effectiveCycle?.name ?? "Pick a cycle"}
            </h2>
            {deckSubtitle && (
              <p className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate leading-tight">
                {deckSubtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right side: action icon buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isCollapsed && effectiveCycle && canActivate(effectiveCycle, activeCycle?.id ?? null) && (
          <button
            type="button"
            onClick={() => cycleService.activateCycle(effectiveCycle.id)}
            className="px-2 py-1 rounded text-xs font-mono font-medium bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 hover:opacity-90 active:scale-95 flex items-center gap-1 transition-all"
            title="Make this the active cycle"
          >
            <Play className="h-3 w-3" />
            Start
          </button>
        )}
        {!isCollapsed && effectiveCycle && (
          <Popover
            open={endPopoverOpen}
            onOpenChange={(open) => {
              if (open) {
                setEndCycleError(null);
                setEndDateInput(effectiveCycle.endDate ?? "");
              }
              setEndPopoverOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                title={effectiveCycle.endDate ? "Adjust end date" : "End this cycle"}
                aria-label={effectiveCycle.endDate ? "Adjust end date" : "End this cycle"}
              >
                <Flag className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 p-3 flex flex-col gap-3 font-mono"
            >
              <div>
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  {effectiveCycle.endDate ? "Cycle end date" : "End cycle"}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  {effectiveCycle.endDate
                    ? `Adjust when “${effectiveCycle.name}” ended.`
                    : `Close “${effectiveCycle.name}”. Defaults to today, capped before the next cycle.`}
                </p>
              </div>
              {!effectiveCycle.endDate && (
                <button
                  type="button"
                  onClick={() => handleEndCycle()}
                  className="w-full px-3 py-2 rounded-md bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 text-xs font-medium hover:opacity-90 active:scale-95 transition-all"
                >
                  End today
                </button>
              )}
              <div className="flex flex-col gap-2">
                <input
                  type="date"
                  value={endDateInput}
                  min={effectiveCycle.startDate}
                  onChange={(e) => {
                    setEndDateInput(e.target.value);
                    setEndCycleError(null);
                  }}
                  className="w-full px-2 py-1.5 border border-stone-300 dark:border-stone-600 rounded-md bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400"
                  aria-label="End date"
                />
                <button
                  type="button"
                  disabled={!endDateInput}
                  onClick={() => handleEndCycle(endDateInput)}
                  className="w-full px-3 py-1.5 rounded-md text-xs font-medium border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {effectiveCycle.endDate ? "Save end date" : "End on this date"}
                </button>
              </div>
              {endCycleError && (
                <p
                  className="text-xs text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {endCycleError}
                </p>
              )}
            </PopoverContent>
          </Popover>
        )}
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
        {!isCollapsed && (
          <CycleStrip onCreateCycle={() => setCreateDialogOpen(true)} />
        )}
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
        <CycleCalendarDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
        />
      </div>
    );
  }

  // Empty state — read-only mode
  if (allDeckMoments.length === 0) {
    return (
      <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
        {!isCollapsed && (
          <CycleStrip onCreateCycle={() => setCreateDialogOpen(true)} />
        )}
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
        <CycleCalendarDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
        />
      </div>
    );
  }

  // Get areas with moments using application service
  const areasWithMoments = cycleService.getAreasWithDeckMoments(deckMoments);

  // In edit mode, include all areas that have habits (not just budgeted ones)
  const allAreasForEdit = (() => {
    if (!isEditMode) return areasWithMoments;

    const allHabitsMap = habits$.get();
    const allAreasMap = areas$.get();
    const budgetedAreaIds = new Set(areasWithMoments.map(({ area }) => area.id));

    const areasWithHabits = Object.values(allAreasMap)
      .filter(
        (a) =>
          !budgetedAreaIds.has(a.id) &&
          Object.values(allHabitsMap).some(
            (h) => h.areaId === a.id && !h.isArchived,
          ),
      )
      .sort((a, b) => a.order - b.order)
      .map((area) => ({ area, habits: {} as Record<string, Moment[]> }));

    return [...areasWithMoments, ...areasWithHabits].sort(
      (a, b) => a.area.order - b.area.order,
    );
  })();

  return (
    <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
      {!isCollapsed && (
        <CycleStrip onCreateCycle={() => setCreateDialogOpen(true)} />
      )}
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
          {renderColumns(isEditMode ? allAreasForEdit : areasWithMoments)}
        </div>
      )}

      <CycleCalendarDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </div>
  );
}

function canActivate(
  cycle: { id: string; endDate: string | null },
  activeId: string | null,
): boolean {
  if (cycle.id === activeId) return false;
  if (cycle.endDate === null) return true; // ongoing
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = fromISODate(cycle.endDate);
  end.setHours(0, 0, 0, 0);
  return end >= today;
}

