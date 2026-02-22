"use client";

import { useDroppable } from "@dnd-kit/core";
import { use$ } from "@legendapp/state/react";
import { CycleService } from "@/application/services/CycleService";
import { MomentCard } from "@/components/MomentCard";
import { MomentStack } from "@/components/MomentStack";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { areas$, habits$, moments$ } from "@/infrastructure/state/store";
import { groupByArea, groupByAttitude, type MomentGroup } from "@/lib/grouping";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

/**
 * CycleDeckBuilder - Shows budgeted moments grouped in vertical columns
 *
 * Features:
 * - Displays moments in vertical columns (like drawing board)
 * - Groups by area or attitude
 * - Column-based layout with horizontal scroll
 * - Shows moments budgeted for a specific cycle
 * - Supports drag-and-drop to/from library
 *
 * Design:
 * - Inspired by DrawingBoardColumn
 * - Vertical columns with headers, colored dividers, and moment stacks
 * - Horizontal scroll with snap points
 * - Clean, minimal design with proper spacing
 */
interface CycleDeckBuilderProps {
  cycleId: string;
  groupBy?: "area" | "attitude"; // Default: area
  stackMoments?: boolean; // If true, use MomentStack; if false, show individual cards
}

export function CycleDeckBuilder({
  cycleId,
  groupBy = "area",
  stackMoments = true,
}: CycleDeckBuilderProps) {
  const allAreas = use$(areas$);
  const allHabits = use$(habits$);
  const allMoments = use$(moments$);

  // Get budgeted moments for this cycle (reactive)
  const cycleDeckMoments = Object.values(allMoments)
    .filter(
      (m: Moment) =>
        m.cycleId === cycleId &&
        m.cyclePlanId !== null &&
        m.day === null &&
        m.phase === null
    )
    .sort(
      (a: Moment, b: Moment) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  // Group moments based on groupBy setting
  const groups =
    groupBy === "area"
      ? groupByArea(cycleDeckMoments, allHabits, allAreas)
      : groupByAttitude(cycleDeckMoments, allHabits, allAreas);

  // Filter to only show groups that have budgeted moments
  const groupsWithMoments = groups.filter((group) => group.moments.length > 0);

  // Setup droppable for the entire deck area
  const { setNodeRef, isOver } = useDroppable({
    id: `cycle-deck-${cycleId}`,
    data: {
      cycleId,
      targetType: "cycle-deck",
    },
  });

  // Empty state when no moments
  if (cycleDeckMoments.length === 0) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "mx-6 text-center border-2 border-dashed rounded-lg transition-colors h-full flex flex-col items-center justify-center",
          isOver
            ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
            : "border-stone-300 dark:border-stone-600"
        )}
      >
        <p className="text-sm text-stone-500 dark:text-stone-400 font-mono">
          No habits budgeted yet
        </p>
        <p className="text-xs text-stone-400 dark:text-stone-500 font-mono mt-2">
          Drag habits from the library to build your cycle deck
        </p>
      </div>
    );
  }

  // Column-based layout
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative transition-colors rounded-lg",
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
                  Drop to add to cycle deck
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Horizontal scrollable columns */}
      <div className="flex gap-4 overflow-x-auto px-2 py-4 snap-x snap-mandatory scroll-smooth">
        {groupsWithMoments.map((group) => (
          <CycleDeckColumn
            key={group.groupId}
            group={group}
            groupBy={groupBy}
            stackMoments={stackMoments}
          />
        ))}
      </div>

      {/* Bandwidth Indicator */}
      <div className="px-6 py-3 border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900">
        <div className="flex items-center justify-between text-xs font-mono text-stone-500 dark:text-stone-400">
          <span>Total Budgeted</span>
          <span>{cycleDeckMoments.length} habits</span>
        </div>
      </div>
    </div>
  );
}

/**
 * CycleDeckColumn - Single vertical column for a group
 *
 * Design inspired by DrawingBoardColumn:
 * - Header with emoji/icon + name + count
 * - 3px colored divider
 * - Vertical list of moments or stacks
 * - Empty state when no moments
 */
interface CycleDeckColumnProps {
  group: MomentGroup;
  groupBy: "area" | "attitude";
  stackMoments: boolean;
}

function CycleDeckColumn({ group, stackMoments }: CycleDeckColumnProps) {
  const allAreas = use$(areas$);

  // Group moments by habitId for stacking and count controls
  const momentsByHabit: Record<string, Moment[]> = {};
  for (const moment of group.moments) {
    const habitId = moment.habitId || "standalone";
    if (!momentsByHabit[habitId]) {
      momentsByHabit[habitId] = [];
    }
    momentsByHabit[habitId].push(moment);
  }

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
          {group.emoji && (
            <span className="text-base" aria-hidden="true">
              {group.emoji}
            </span>
          )}
          <h3 className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300">
            {group.groupLabel}
          </h3>
          <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
            {group.moments.length}
          </span>
        </div>
      </div>
      <div
        className="h-[3px] mx-4 mb-2"
        style={{
          backgroundColor: group.color || "#d6d3d1", // stone-300 fallback
        }}
      />
      <div className="flex flex-col gap-3 p-4 min-h-[300px]">
        {group.moments.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center min-h-[240px] gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
              <span className="text-2xl" aria-hidden="true">
                {group.emoji || "📝"}
              </span>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-stone-600 dark:text-stone-400">
                No {group.groupLabel} habits yet
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-500">
                Drag from library to add
              </p>
            </div>
          </div>
        ) : stackMoments ? (
          // Stacked view with count controls (group by habitId)
          Object.entries(momentsByHabit)
            .filter(([habitId]) => habitId !== "standalone")
            .map(([habitId, moments]) => {
              const area = allAreas[moments[0].areaId];
              if (!area) return null;

              return (
                <CycleDeckStack
                  key={habitId}
                  habitId={habitId}
                  moments={moments}
                  area={area}
                />
              );
            })
        ) : (
          // Individual cards view
          group.moments.map((moment) => {
            const area = allAreas[moment.areaId];
            if (!area) return null;

            return <MomentCard key={moment.id} moment={moment} area={area} />;
          })
        )}
      </div>
      ;
    </div>
  );
}

/**
 * CycleDeckStack - Moment stack with count controls for cycle planning
 *
 * Passes control handlers to MomentStack to display integrated controls on the badge:
 * - count = 1: [×] x1 [↑] (remove on left, increment on right)
 * - count > 1: [↓] x{count} [↑] (decrement on left, increment on right)
 */
interface CycleDeckStackProps {
  habitId: string;
  moments: Moment[];
  area: Area;
}

function CycleDeckStack({ habitId, moments, area }: CycleDeckStackProps) {
  const cycleService = new CycleService();
  const count = moments.length;
  const cycleId = moments[0]?.cycleId;

  if (!cycleId) return null;

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
      moments={moments}
      area={area}
      onIncrement={handleIncrement}
      onDecrement={handleDecrement}
      onRemove={handleRemove}
    />
  );
}
