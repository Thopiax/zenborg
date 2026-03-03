"use client";

import { useValue } from "@legendapp/state/react";
import { CycleService } from "@/application/services/CycleService";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { habits$ } from "@/infrastructure/state/store";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { GhostHabitCard } from "./GhostHabitCard";
import { MomentStack } from "./MomentStack";

/**
 * CycleDeckColumn - Single vertical column for an area in the cycle deck.
 *
 * Displays budgeted habits as MomentStacks, with optional ghost cards
 * for unbudgeted habits when showAllHabits is enabled.
 */
interface CycleDeckColumnProps {
  area: Area;
  habitMoments: Record<string, Moment[]>;
  isEditMode: boolean;
  showAllHabits: boolean;
  cycleId: string;
}

export function CycleDeckColumn({
  area,
  habitMoments,
  isEditMode,
  showAllHabits,
  cycleId,
}: CycleDeckColumnProps) {
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
    0,
  );

  return (
    <div
      className={cn(
        "flex flex-col snap-start rounded-lg",
        columnWidth.scrollableClassName,
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
      <div className="flex flex-col gap-3 p-4 min-h-[120px] max-h-[400px] overflow-y-auto">
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
