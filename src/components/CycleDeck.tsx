"use client";

import { use$ } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useState } from "react";
import type { Area } from "@/domain/entities/Area";
import {
  activeCycle$,
  areas$,
  deckMomentsByAreaAndHabit$,
} from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";
import { MomentStack } from "./MomentStack";

/**
 * CycleDeck - Container for budgeted moments during active cycle
 *
 * Features:
 * - Displays budgeted moments grouped by area → habit
 * - Renders MomentStack components for each habit
 * - Replaces DrawingBoard when active cycle exists
 * - Collapsible per area for organization
 * - Read-only (no toolbar) - focus on execution
 *
 * Design:
 * - Stone monochrome base
 * - Area colors for headers
 * - Grouped by area automatically (no grouping options)
 */
export function CycleDeck() {
  const deckMoments = use$(deckMomentsByAreaAndHabit$);
  const allAreas = use$(areas$);
  const activeCycle = use$(activeCycle$);

  // Get areas that have budgeted moments
  const areasWithMoments = Object.keys(deckMoments)
    .map((areaId) => allAreas[areaId])
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  // Empty state - no budgeted moments
  if (areasWithMoments.length === 0) {
    return (
      <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
        <div className="px-6 py-3 border-b border-stone-200 dark:border-stone-700">
          <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 uppercase tracking-wider font-semibold">
            Cycle Deck
          </h2>
        </div>
        <div className="p-8 min-h-[200px] flex flex-col items-center justify-center gap-3">
          <p className="text-stone-400 text-sm font-mono text-center">
            No budgeted moments in deck
          </p>
          <p className="text-xs text-stone-500 font-mono text-center">
            Drag habits from the library to build your cycle deck
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
      {/* Header */}
      <div className="px-6 py-3 border-b border-stone-200 dark:border-stone-700">
        <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 uppercase tracking-wider font-semibold">
          Cycle Deck
        </h2>
      </div>

      {/* Areas with budgeted moments */}
      <div className="p-6 space-y-6">
        {areasWithMoments.map((area) => {
          const habitMoments = deckMoments[area.id];
          const habitIds = Object.keys(habitMoments);

          return (
            <CycleDeckAreaSection
              key={area.id}
              area={area}
              habitMoments={habitMoments}
              habitIds={habitIds}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * CycleDeckAreaSection - Collapsible section for one area's moments
 */
interface CycleDeckAreaSectionProps {
  area: Area;
  habitMoments: Record<string, any[]>;
  habitIds: string[];
}

function CycleDeckAreaSection({
  area,
  habitMoments,
  habitIds,
}: CycleDeckAreaSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div>
      {/* Area Header - Collapsible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 mb-3 w-full hover:opacity-80 transition-opacity"
      >
        <span className="text-lg">{area.emoji}</span>
        <h3 className="text-sm font-mono font-medium text-stone-900 dark:text-stone-100 flex-1 text-left">
          {area.name}
        </h3>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-stone-500" />
        ) : (
          <ChevronUp className="h-4 w-4 text-stone-500" />
        )}
      </button>

      {/* Habit Stacks - Animated collapse */}
      <div
        className={cn(
          "grid transition-all duration-medium transition-elastic overflow-hidden",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3">
            {habitIds.map((habitId) => {
              const moments = habitMoments[habitId];
              return (
                <MomentStack key={habitId} moments={moments} area={area} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
