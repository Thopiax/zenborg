"use client";

import { useMomentManager } from "@/contexts/MomentManagerContext";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { useSelection } from "@/hooks/useSelection";
import { getTextColorsForBackground, momentCard } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface MomentCardProps {
  moment: Moment;
  area: Area;
}

/**
 * MomentCard - Display card for a moment
 *
 * Design:
 * - Minimalist, calm aesthetic
 * - Full area-colored background with accessible text
 * - Subtle colored ring (area color @ 60% opacity) for selection/focus
 * - 1px ring offset for breathing room
 *
 * Interaction flow:
 * 1. Single click → Opens MomentEditCard modal
 * 2. Cmd/Ctrl + click → Toggle selection (shows ring)
 * 3. Shift + click → Toggle selection (without entering edit mode)
 * 4. Hover → Shows subtle 1px ring
 * 5. Selected → Shows prominent 2px ring in area color
 *
 * Features:
 * - Multi-select for bulk operations
 * - Toggle selection with Shift+click or Cmd/Ctrl+click
 * - Calm, minimalist design with color-matched rings
 * - Full accessibility with ARIA labels
 */
export function MomentCard({ moment, area }: MomentCardProps) {
  const { handleOpenEditModal } = useMomentManager();
  const { isSelected: isSelectedMoment, toggleSelection } = useSelection();

  const isSelected = isSelectedMoment(moment.id);

  const handleClick = (e: React.MouseEvent) => {
    // Shift + click → Toggle selection (without entering edit mode)
    if (e.shiftKey) {
      e.preventDefault();
      toggleSelection(moment.id);
    }
    // Cmd/Ctrl + click → Toggle selection
    else if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleSelection(moment.id);
    }
    // Regular click → Open global edit modal
    else {
      handleOpenEditModal(moment.id);
    }
  };

  // Get accessible text colors based on area color
  const textColors = getTextColorsForBackground(area.color);

  // Descriptive ARIA label for accessibility
  const ariaLabel = isSelected
    ? `${moment.name} in ${area.name} area, selected`
    : `${moment.name} in ${area.name} area, click to edit`;

  return (
    <button
      type="button"
      className={cn(
        "min-w-[200px]",
        "rounded-lg transition-all cursor-pointer w-full",
        "focus:outline-none",
        // Subtle ring for selection/focus - using area color
        isSelected
          ? "ring-2 ring-offset-1"
          : "ring-0 hover:ring-1 hover:ring-offset-1"
      )}
      style={{
        backgroundColor: area.color,
        minHeight: momentCard.minHeight,
        paddingLeft: momentCard.paddingX,
        paddingRight: momentCard.paddingX,
        paddingTop: momentCard.paddingY,
        paddingBottom: momentCard.paddingY,
        // Use area color for ring with opacity for subtlety
        // @ts-expect-error - CSS custom property
        "--tw-ring-color": `${area.color}99`, // 60% opacity
        "--tw-ring-offset-color": "rgb(250, 250, 249)", // stone-50
      }}
      data-moment-id={moment.id}
      onClick={handleClick}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <div className="flex items-center justify-start h-full gap-3">
        <p
          className={cn("text-lg font-semibold font-mono", textColors.primary)}
        >
          {moment.name}
        </p>
      </div>
    </button>
  );
}
