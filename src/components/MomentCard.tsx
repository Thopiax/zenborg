"use client";

import { memo } from "react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import type { Health } from "@/domain/value-objects/Health";
import { getTextColorsForBackground, momentCard } from "@/lib/design-tokens";
import { healthEmojiClass } from "@/lib/health-style";
import { cn } from "@/lib/utils";
import { TagSummary } from "./TagSummary";

export interface MomentCardProps {
  moment: Moment;
  area: Area;
  isSelected?: boolean;
  isActive?: boolean;
  health?: Health;
  onClick?: (e: React.MouseEvent) => void;
}

export const MomentCard = memo(function MomentCard({
  moment,
  area,
  isSelected = false,
  isActive = false,
  health = "unstated",
  onClick,
}: MomentCardProps) {
  const textColors = getTextColorsForBackground(area.color);

  const activeSuffix = isActive ? ", active moment" : "";
  const ariaLabel = isSelected
    ? `${moment.name} in ${area.name} area, selected${activeSuffix}`
    : `${moment.name} in ${area.name} area${activeSuffix}, click to edit`;

  return (
    <button
      type="button"
      className={cn(
        "rounded-lg cursor-pointer w-full",
        "focus:outline-none relative",
        "transition-[translate,box-shadow,border-color] duration-150 ease-out",
        "outline-none",
        "hover:-translate-y-0.5",
        isActive && "border-l-[3px] border-l-stone-900 dark:border-l-stone-100",
      )}
      style={{
        backgroundColor: area.color,
        minHeight: momentCard.minHeight,
        paddingLeft: momentCard.paddingX,
        paddingRight: momentCard.paddingX,
        paddingTop: momentCard.paddingY,
        paddingBottom: momentCard.paddingY,
        boxShadow: isSelected
          ? `inset 0 0 0 2px rgba(255,255,255,0.5)`
          : undefined,
      }}
      data-moment-id={moment.id}
      onClick={onClick}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <div className="flex flex-row items-baseline gap-2 h-full">
        {moment.emoji && (
          <span
            className={cn(
              "mr-2 text-lg",
              textColors.primary,
              healthEmojiClass(health),
            )}
          >
            {moment.emoji}
          </span>
        )}
        <p
          className={cn(
            "text-lg font-semibold font-mono truncate min-w-0",
            textColors.primary,
          )}
        >
          {moment.name}
        </p>
        <TagSummary
          tags={moment.tags}
          className={cn("flex-shrink-0", textColors.primary)}
        />
        {moment.startTime && (
          <span
            className={cn(
              "ml-1 text-xs font-mono flex-shrink-0",
              textColors.secondary,
            )}
          >
            {moment.startTime}
          </span>
        )}
        {isActive && (
          <span
            className={cn("ml-auto text-sm flex-shrink-0", textColors.primary)}
            title="Active moment"
          >
            ◎
          </span>
        )}
      </div>
    </button>
  );
});
