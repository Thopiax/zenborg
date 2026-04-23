"use client";

import { useValue } from "@legendapp/state/react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { CycleService } from "@/application/services/CycleService";
import type { Area } from "@/domain/entities/Area";
import { habits$ } from "@/infrastructure/state/store";
import type { VirtualDeckCard as VirtualDeckCardData } from "@/infrastructure/state/virtualDeckCards";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { GhostHabitCard } from "./GhostHabitCard";
import { VirtualDeckCard } from "./VirtualDeckCard";

/**
 * CycleDeckColumn - Single vertical column for an area in the cycle deck.
 *
 * Derive paradigm: displays virtual deck cards computed from CyclePlans.
 * Each budgeted habit renders one VirtualDeckCard per ghost slot
 * (budgetedCount minus allocatedCount).
 *
 * In edit mode, also shows:
 *  - +/- controls per budgeted habit to adjust budget
 *  - GhostHabitCard for unbudgeted habits in this area
 */
interface CycleDeckColumnProps {
  area: Area;
  cards: VirtualDeckCardData[];
  isEditMode: boolean;
  showAllHabits: boolean;
  cycleId: string;
}

export function CycleDeckColumn({
  area,
  cards,
  isEditMode,
  showAllHabits,
  cycleId,
}: CycleDeckColumnProps) {
  const allHabits = useValue(habits$);
  const cycleService = new CycleService();

  const budgetedHabitIds = new Set(cards.map((c) => c.habit.id));

  // In showAllHabits mode, also list unbudgeted habits for this area
  // (rendered as GhostHabitCard after the budgeted cards).
  const unbudgetedHabitIds = showAllHabits
    ? Object.values(allHabits)
        .filter(
          (h) =>
            h.areaId === area.id &&
            !h.isArchived &&
            !budgetedHabitIds.has(h.id),
        )
        .sort((a, b) => a.order - b.order)
        .map((h) => h.id)
    : [];

  const totalGhosts = cards.reduce((sum, c) => sum + c.ghosts, 0);

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
            {totalGhosts}
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
        {cards.map((card) => (
          <div
            key={card.plan.id}
            className="relative"
            data-testid={`deck-card-group-${card.habit.id}`}
          >
            {/* Render one draggable per ghost slot */}
            <div className="flex flex-col gap-2">
              {Array.from({ length: card.ghosts }).map((_, slotIndex) => (
                <VirtualDeckCard
                  key={`${card.plan.id}-slot-${slotIndex}`}
                  cycleId={cycleId}
                  habit={card.habit}
                  area={area}
                  slotIndex={slotIndex}
                />
              ))}
            </div>

            {/* Edit-mode controls: budget + / - / remove */}
            {isEditMode && (
              <div
                data-testid={`deck-card-controls-${card.habit.id}`}
                className="absolute -top-2 -right-2 rounded-md bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-xs font-mono font-medium shadow-sm flex items-center gap-0.5 px-1 py-0.5"
                style={{ zIndex: 2 }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {card.plan.budgetedCount === 1 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleService.removeHabitFromDeck(cycleId, card.habit.id);
                    }}
                    className="p-0.5 rounded hover:bg-red-600 dark:hover:bg-red-400 transition-colors"
                    title="Remove from cycle"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleService.decrementHabitBudget(
                        cycleId,
                        card.habit.id,
                      );
                    }}
                    className="p-0.5 rounded hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
                    title="Decrease count"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                )}

                <span className="px-1">x{card.plan.budgetedCount}</span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleService.incrementHabitBudget(cycleId, card.habit.id);
                  }}
                  className="p-0.5 rounded hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
                  title="Increase count"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Unbudgeted habits as ghost cards (edit mode) */}
        {unbudgetedHabitIds.map((habitId) => (
          <GhostHabitCard
            key={habitId}
            habitId={habitId}
            area={area}
            cycleId={cycleId}
          />
        ))}
      </div>
    </div>
  );
}
