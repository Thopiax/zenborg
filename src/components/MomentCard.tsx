"use client";

import { use$ } from "@legendapp/state/react";
import { Calendar, Clock } from "lucide-react";
import { useMomentManager } from "@/contexts/MomentManagerContext";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { useSelection } from "@/hooks/useSelection";
import { metricLogs$, moments$, phaseConfigs$ } from "@/infrastructure/state/store";
import { getAttitudeFeedback } from "@/lib/attitude-feedback";
import {
  animation,
  getTextColorsForBackground,
  momentCard,
  shadows,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { getAttitudeLabel } from "@/domain/value-objects/Attitude";

interface MomentCardProps {
  moment: Moment;
  area: Area;
  /** Optional array of all moment IDs in the current context (for shift-click range selection) */
  contextMomentIds?: string[];
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
 * 3. Shift + click → Range selection from last selected to current (if contextMomentIds provided)
 * 4. Hover → Shows subtle 1px ring
 * 5. Selected → Shows prominent 2px ring in area color
 *
 * Features:
 * - Multi-select for bulk operations
 * - Range selection with Shift+click (within same column/context)
 * - Toggle selection with Cmd/Ctrl+click
 * - Calm, minimalist design with color-matched rings
 * - Full accessibility with ARIA labels
 */
export function MomentCard({
  moment,
  area,
  contextMomentIds,
}: MomentCardProps) {
  const { handleOpenEditModal } = useMomentManager();
  const {
    isSelected: isSelectedMoment,
    toggleSelection,
    selectRange,
  } = useSelection();
  const allPhaseConfigs = use$(phaseConfigs$);
  const allMoments = use$(moments$);
  const allMetricLogs = use$(metricLogs$);

  const isSelected = isSelectedMoment(moment.id);

  // Get attitude feedback if moment has an attitude
  const attitudeFeedback = moment.attitude
    ? getAttitudeFeedback(
        moment,
        Object.values(allMoments),
        Object.values(allMetricLogs)
      )
    : null;

  const handleClick = (e: React.MouseEvent) => {
    // Shift + click → Range selection (if contextMomentIds provided)
    if (e.shiftKey) {
      e.preventDefault();
      if (contextMomentIds && contextMomentIds.length > 0) {
        selectRange(moment.id, contextMomentIds);
      } else {
        toggleSelection(moment.id);
      }
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

  // Get phase config for displaying emoji
  const phaseConfig = moment.phase
    ? Object.values(allPhaseConfigs).find((pc) => pc.phase === moment.phase)
    : null;

  // Descriptive ARIA label for accessibility
  const ariaLabel = isSelected
    ? `${moment.name} in ${area.name} area, selected`
    : `${moment.name} in ${area.name} area, click to edit`;

  return (
    <button
      type="button"
      className={cn(
        "min-w-[200px]",
        "rounded-lg cursor-pointer w-full",
        "focus:outline-none relative",
        // Elastic transitions for natural, organic feel (using design system classes)
        "transition-all duration-medium transition-elastic",
        // Subtle ring for selection/focus - using area color
        "ring-offset-transparent",
        isSelected
          ? "ring-2 ring-offset-2"
          : "ring-0 hover:ring-2 hover:ring-offset-2",
        // Subtle lift on hover for depth
        "hover:-translate-y-0.5"
      )}
      style={{
        backgroundColor: area.color,
        // Use design tokens for sizing
        minHeight: momentCard.minHeight,
        paddingLeft: momentCard.paddingX,
        paddingRight: momentCard.paddingX,
        paddingTop: momentCard.paddingY,
        paddingBottom: momentCard.paddingY,
        // Use area color for ring with opacity for subtlety
        // @ts-expect-error - CSS custom property
        "--tw-ring-color": `${area.color}99`, // 60% opacity
      }}
      data-moment-id={moment.id}
      onClick={handleClick}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <div className="flex flex-col gap-2 h-full">
        {/* Moment name */}
        <p
          className={cn(
            "text-lg font-semibold font-mono line-clamp-1",
            textColors.primary
          )}
        >
          {moment.name}
        </p>

        {/* Attitude indicator and feedback */}
        {moment.attitude && (
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                "text-xs font-medium opacity-90",
                textColors.secondary
              )}
            >
              • {getAttitudeLabel(moment.attitude)}
            </span>
            {attitudeFeedback && (
              <span
                className={cn(
                  "text-xs opacity-80 font-mono",
                  textColors.secondary
                )}
              >
                {attitudeFeedback}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {moment.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {moment.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded font-mono opacity-80",
                  textColors.secondary
                )}
                style={{
                  backgroundColor: `${area.color}33`, // 20% opacity of area color
                }}
              >
                #{tag}
              </span>
            ))}
            {moment.tags.length > 3 && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded font-mono opacity-60",
                  textColors.secondary
                )}
              >
                +{moment.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
