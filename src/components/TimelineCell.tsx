/** biome-ignore-all lint/a11y/useSemanticElements: a grid cell that is also a drop target, which no single semantic element covers */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: pointer handlers implement dragging; keyboard access lives on the wrapping control */
/** biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: the role is set dynamically on the same element, which the rule does not follow */
"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { use$ } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import type { Area } from "@/domain/entities/Area";
import {
  countsAsAllocation,
  DAY_VIEW_PHASE_CAPACITY,
  type Moment,
  momentInvolvesHabit,
} from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import { PhaseIcon } from "@/domain/value-objects/phaseStyles";
import { habitHealthService } from "@/domain/services/HabitHealthService";
import { useActiveMoment } from "@/hooks/useActiveMoment";
import {
  selectionState$,
  toggleSelection as toggleSelectionAction,
  selectRange as selectRangeAction,
} from "@/infrastructure/state/selection";
import {
  areas$,
  cyclePlans$,
  habits$,
  moments$,
  activeCycleId$,
} from "@/infrastructure/state/store";
import {
  isDuplicateMode$,
  openMomentFormCreate,
  openMomentFormEdit,
} from "@/infrastructure/state/ui-store";
import {
  ariaLabels,
  momentCard,
  momentConstraints,
  phaseBackgrounds,
  timelineCell,
  zIndex,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import type { DropTargetType } from "@/types/dnd";
import { MomentCard } from "./MomentCard";

interface TimelineCellProps {
  day: string;
  phase: Phase;
  isHighlighted?: boolean;
  isActivePhase?: boolean;
  dayLabel?: string;
  phaseLabel?: string;
  phaseIndex?: number;
}

export const MAX_MOMENTS_PER_CELL = DAY_VIEW_PHASE_CAPACITY;

export function TimelineCell({
  day,
  phase,
  isActivePhase,
  dayLabel,
  phaseLabel,
  phaseIndex = 0,
}: TimelineCellProps) {
  const allMoments = use$(moments$);
  const allAreas = use$(areas$);

  const cellMoments: Moment[] = useMemo(
    () =>
      Object.values(allMoments)
        .filter((m) => m.day === day && m.phase === phase)
        .sort((a, b) => a.order - b.order),
    [allMoments, day, phase],
  );

  const contextMomentIds = useMemo(
    () => cellMoments.map((m) => m.id),
    [cellMoments],
  );

  const { setNodeRef, isOver } = useDroppable({
    id: `timeline-${day}-${phase}`,
    data: {
      targetType: "timeline-cell" as DropTargetType,
      targetDay: day,
      targetPhase: phase,
    },
  });

  const handleEmptyCellClick = () => {
    openMomentFormCreate({
      day,
      phaseStr: phase,
      phase: phase as Phase,
    });
  };

  const cellLabel =
    dayLabel && phaseLabel
      ? ariaLabels.timelineCell(
          dayLabel,
          phaseLabel,
          cellMoments.length,
          momentConstraints.maxMomentsPerCell,
        )
      : `${day} ${phase}, ${cellMoments.length} of ${momentConstraints.maxMomentsPerCell} moments`;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-[240px] h-full relative",
        "rounded-md",
        "transition-colors transition-shadow duration-150 ease-out",
        "focus-within:outline-none",
        phaseBackgrounds[phaseIndex],
        isActivePhase && "ring-1 ring-stone-400/50",
        isOver && "ring-2 ring-slate-400 dark:ring-slate-300",
      )}
      data-cell={`${day}-${phase}`}
      aria-label={cellLabel}
      aria-live="off"
      aria-atomic="true"
    >
      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center pointer-events-none z-0">
        <PhaseIcon
          phase={phase}
          className={cn(
            "text-stone-800 dark:text-stone-100 w-4 h-4 md:w-5 md:h-5",
            isActivePhase ? "opacity-80" : "opacity-50",
          )}
        />
      </div>

      <div
        className="overflow-y-auto overscroll-contain relative z-[1] p-2 pb-8 md:p-2.5 md:pb-8"
        style={{ maxHeight: timelineCell.viewportHeight }}
      >
        {cellMoments.length > 0 && (
          <SortableContext
            items={contextMomentIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col" style={{ gap: momentCard.gap }}>
              {cellMoments.map((moment) => {
                const area = allAreas[moment.areaId];
                if (!area) return null;

                return (
                  <SortableMomentCard
                    key={moment.id}
                    moment={moment}
                    area={area}
                    contextMomentIds={contextMomentIds}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleEmptyCellClick}
              className="flex-1 flex items-center justify-center min-h-[48px] rounded-md cursor-pointer group"
              aria-label={`add moment to ${phaseLabel || phase}`}
            >
              <span className="text-slate-800 dark:text-slate-100 text-2xl opacity-70 md:opacity-0 group-hover:opacity-70 transition-opacity">
                +
              </span>
            </button>
          </SortableContext>
        )}

        {cellMoments.length === 0 && (
          <button
            type="button"
            onClick={handleEmptyCellClick}
            className="flex items-center justify-center h-full w-full min-h-[120px] rounded-md cursor-pointer group"
            aria-label={`add moment to ${phaseLabel || phase}`}
          >
            <span className="text-slate-800 dark:text-slate-100 text-3xl opacity-70 md:opacity-0 group-hover:opacity-70 transition-opacity">
              +
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

interface SortableMomentCardProps {
  moment: Moment;
  area: Area;
  contextMomentIds: string[];
}

function SortableMomentCard({
  moment,
  area,
  contextMomentIds,
}: SortableMomentCardProps) {
  const isDuplicateMode = use$(isDuplicateMode$);
  const selectedMomentIds = use$(selectionState$.selectedMomentIds);
  const { activeMomentId, toggleActive } = useActiveMoment();

  const isSelected = selectedMomentIds.includes(moment.id);
  const isActive = activeMomentId === moment.id;

  const health = useMemo(() => {
    const habitId = moment.habitId;
    if (!habitId) return "unstated" as const;
    const habit = habits$[habitId].peek();
    if (!habit) return "unstated" as const;
    const allMoments = moments$.peek();
    const allPlans = cyclePlans$.peek();
    const cycleId = activeCycleId$.peek();
    const plan = cycleId
      ? (Object.values(allPlans).find(
          (p) => p.cycleId === cycleId && p.habitId === habitId,
        ) ?? null)
      : null;
    return habitHealthService.computeHealth(
      habit,
      plan,
      Object.values(allMoments),
      new Date(),
    );
  }, [moment.habitId]);

  const isPartOfMultiSelection =
    isSelected && selectedMomentIds.length > 1;
  const shouldDisableSortable = isDuplicateMode || isPartOfMultiSelection;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: moment.id,
    data: {
      momentId: moment.id,
      sourceType: "timeline" as const,
      sourceDay: moment.day ?? undefined,
      sourcePhase: moment.phase ?? undefined,
      sourceOrder: moment.order,
    },
    disabled: shouldDisableSortable,
    transition: shouldDisableSortable ? null : undefined,
  });

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        if (contextMomentIds.length > 0) {
          selectRangeAction(moment.id, contextMomentIds);
        } else {
          toggleSelectionAction(moment.id);
        }
      } else if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        toggleSelectionAction(moment.id);
      } else if (e.altKey) {
        e.preventDefault();
        void toggleActive(moment.id);
      } else {
        openMomentFormEdit(moment.id, moment);
      }
    },
    [moment, contextMomentIds, toggleActive],
  );

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    transition: transition ?? undefined,
    opacity: isDragging && !shouldDisableSortable ? 0 : 1,
    touchAction: "none" as const,
    cursor: isDragging ? "grabbing" : "grab",
    zIndex: isDragging ? zIndex.dragOverlay : 1,
    willChange: isDragging ? "transform" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MomentCard
        moment={moment}
        area={area}
        isSelected={isSelected}
        isActive={isActive}
        health={health}
        onClick={handleClick}
      />
    </div>
  );
}
