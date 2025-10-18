/** biome-ignore-all lint/a11y/useSemanticElements: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: <explanation> */
"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { use$ } from "@legendapp/state/react";
import { useEffect, useState } from "react";
import { useMomentManager } from "@/contexts/MomentManagerContext";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import { selectionState$ } from "@/infrastructure/state/selection";
import { areas$, moments$ } from "@/infrastructure/state/store";
import { isDuplicateMode$ } from "@/infrastructure/state/ui-store";
import {
  ariaLabels,
  momentCard,
  momentConstraints,
  phaseBackgrounds,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import type { DropTargetType } from "@/types/dnd";
import { EmptyMomentCard } from "./EmptyMomentCard";
import { MomentCard } from "./MomentCard";

interface TimelineCellProps {
  day: string; // ISO date
  phase: Phase;
  isHighlighted?: boolean; // True for "Today" column
  dayLabel?: string; // "Yesterday", "Today", "Tomorrow"
  phaseLabel?: string; // "Morning", "Afternoon", etc.
  phaseIndex?: number; // Phase row index for alternating greyscale tints (0, 1, 2)
}

/**
 * TimelineCell - Grid cell that holds 0-3 moments
 *
 * Design Philosophy:
 * - Clean, minimalist design with subtle backgrounds
 * - Moment cards have full area-colored backgrounds
 * - Proper vertical spacing to fit exactly 3 cards
 * - Full ARIA support for screen readers
 * - Mode-specific focus ring (violet for cell navigation)
 * - Theme-aware (light/dark)
 *
 * Layout:
 * - Min height: 240px (3 cards × 64px + 2 gaps × 12px + padding)
 * - Card gap: 12px between cards
 * - Cell padding: 16px
 *
 * Features:
 * - Displays up to 3 moments for a given (day, phase) combination
 * - Enforces max-3-per-cell constraint visually
 * - Shows empty state when no moments with helpful hints
 * - Focusable for keyboard navigation
 * - ARIA live region for full state announcements
 */
export function TimelineCell({
  day,
  phase,
  isHighlighted = false,
  dayLabel,
  phaseLabel,
  phaseIndex = 0,
}: TimelineCellProps) {
  const allMoments = use$(moments$);
  const allAreas = use$(areas$);
  const { handleOpenCreateModal } = useMomentManager();
  const [isModHovering, setIsModHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Get moments for this cell
  const cellMoments: Moment[] = Object.values(allMoments)
    .filter((m) => m.day === day && m.phase === phase)
    .sort((a, b) => a.order - b.order);

  const isFull = cellMoments.length >= 3;

  // Droppable configuration
  const { setNodeRef, isOver } = useDroppable({
    id: `timeline-${day}-${phase}`,
    data: {
      targetType: "timeline-cell" as DropTargetType,
      targetDay: day,
      targetPhase: phase,
    },
  });

  // Check if current drop would be valid
  const wouldAcceptDrop = !isFull; // Simple check for now, validation happens in DnDProvider

  // Handle mod+hover for creating moments
  const handleMouseEnter = (e: React.MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && !isFull) {
      setIsModHovering(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const isModPressed = e.metaKey || e.ctrlKey;
    if (isModPressed && !isFull && !isModHovering) {
      setIsModHovering(true);
    } else if (!isModPressed && isModHovering) {
      setIsModHovering(false);
    }
  };

  const handleMouseLeave = () => {
    setIsModHovering(false);
  };

  const handlePlaceholderClick = () => {
    // Open create modal with pre-filled day and phase
    handleOpenCreateModal(day, phase);
  };

  // Generate accessible label
  const cellLabel =
    dayLabel && phaseLabel
      ? ariaLabels.timelineCell(
          dayLabel,
          phaseLabel,
          cellMoments.length,
          momentConstraints.maxMomentsPerCell
        )
      : `${day} ${phase}, ${cellMoments.length} of ${momentConstraints.maxMomentsPerCell} moments`;

  // Determine if we should show placeholders:
  // - Mobile: always show placeholders if not full
  // - Desktop: only show on mod+hover
  const shouldShowPlaceholder = isModHovering || (isMobile && !isFull);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[192px] p-3 rounded-md",
        "transition-all",
        "focus-within:outline-none shadow-inner",
        // Phase-based gradient background
        "md:min-h-[256px] md:p-4",
        phaseBackgrounds[phaseIndex],
        // Drag hover states
        isOver &&
          wouldAcceptDrop &&
          "ring-2 ring-slate-400 dark:ring-slate-300",
        isOver && !wouldAcceptDrop && "ring-2 ring-red-400 dark:ring-red-500"
      )}
      data-cell={`${day}-${phase}`}
      aria-label={cellLabel}
      aria-live={isFull ? "polite" : "off"}
      aria-atomic="true"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {cellMoments.length > 0 ? (
        <SortableContext
          items={cellMoments.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col" style={{ gap: momentCard.gap }}>
            {cellMoments.map((moment) => {
              // Get area from the extracted values (use$ already unwrapped it)
              const area = allAreas[moment.areaId];
              if (!area) return null;

              return (
                <SortableMomentCard
                  key={moment.id}
                  moment={moment}
                  area={area}
                  contextMomentIds={cellMoments.map((m) => m.id)}
                />
              );
            })}
            {/* Show placeholder if conditions met and not full */}
            {shouldShowPlaceholder && !isFull && (
              <EmptyMomentCard
                onClick={handlePlaceholderClick}
                label={`Add to ${phaseLabel || phase}`}
              />
            )}
          </div>
        </SortableContext>
      ) : (
        <div className="flex items-center justify-center h-full min-h-[192px]">
          {/* Empty state - show placeholder based on conditions */}
          {shouldShowPlaceholder ? (
            <EmptyMomentCard
              onClick={handlePlaceholderClick}
              label={`Add to ${phaseLabel || phase}`}
            />
          ) : null}
        </div>
      )}

      {isFull && (
        <output
          className="text-xs text-stone-500 dark:text-stone-500 font-mono mt-3 flex items-center gap-2"
          aria-live="polite"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500"
            aria-hidden="true"
          />
          <span>
            Full ({cellMoments.length}/{momentConstraints.maxMomentsPerCell})
          </span>
        </output>
      )}
    </div>
  );
}

/**
 * SortableMomentCard - Wrapper that combines sortable and draggable behavior
 *
 * This component wraps MomentCard with useSortable to enable:
 * - Reordering within the same cell (sortable)
 * - Dragging to other cells or drawing board (draggable)
 */
interface SortableMomentCardProps {
  moment: Moment;
  area: Area;
  contextMomentIds?: string[];
}

function SortableMomentCard({
  moment,
  area,
  contextMomentIds,
}: SortableMomentCardProps) {
  const isDuplicateMode = use$(isDuplicateMode$);
  const selectedMomentIds = use$(selectionState$.selectedMomentIds);

  // Disable sortable behavior if:
  // 1. In duplicate mode, OR
  // 2. This moment is part of a multi-selection (prevents reorder conflicts)
  const isPartOfMultiSelection =
    selectedMomentIds.includes(moment.id) && selectedMomentIds.length > 1;
  const shouldDisableSortable = isDuplicateMode || isPartOfMultiSelection;

  // Always use useSortable, disable sorting behavior when needed
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

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    // Kanban style: original disappears on move, stays visible on duplicate/multi-select
    opacity: isDragging && !shouldDisableSortable ? 0 : 1,
    // Prevent browser scroll/pan interference during touch drag
    touchAction: "none",
    // Cursor feedback for trackpad/mouse users (iPad with trackpad)
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MomentCard
        moment={moment}
        area={area}
        contextMomentIds={contextMomentIds}
      />
    </div>
  );
}
