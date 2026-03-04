"use client";

import { useState } from "react";
import { AttitudeChip } from "@/components/AttitudeChip";
import { AttitudeSelector } from "@/components/AttitudeSelector";
import { TagBadges } from "@/components/TagBadges";
import type { Area } from "@/domain/entities/Area";
import type { Attitude } from "@/domain/value-objects/Attitude";

const MAX_VISIBLE_TAGS = 2;

interface AreaColumnSubtoolbarProps {
  area: Area;
  onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
}

/**
 * AreaColumnSubtoolbar — displays tags + attitude below the colored divider
 *
 * Shown only when the area has tags or an attitude set.
 * Tags are collapsed to MAX_VISIBLE_TAGS with a "+N" expand button.
 */
export function AreaColumnSubtoolbar({
  area,
  onUpdateArea,
}: AreaColumnSubtoolbarProps) {
  const [attitudeSelectorOpen, setAttitudeSelectorOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const tags = area.tags || [];
  const hasTags = tags.length > 0;
  const hasAttitude = area.attitude !== null && area.attitude !== undefined;

  if (!hasTags && !hasAttitude) {
    return null;
  }

  const handleAttitudeChange = (attitude: Attitude | null) => {
    onUpdateArea(area.id, { attitude });
    setAttitudeSelectorOpen(false);
  };

  const handleRemoveTag = (tag: string) => {
    const updatedTags = tags.filter((t) => t !== tag);
    onUpdateArea(area.id, { tags: updatedTags });
  };

  const hiddenCount = tags.length - MAX_VISIBLE_TAGS;
  const shouldCollapse = hiddenCount > 0 && !expanded;
  const visibleTags = shouldCollapse ? tags.slice(0, MAX_VISIBLE_TAGS) : tags;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-2">
      {hasAttitude && (
        <AttitudeSelector
          open={attitudeSelectorOpen}
          selectedAttitude={area.attitude}
          onSelectAttitude={handleAttitudeChange}
          onClose={() => setAttitudeSelectorOpen(false)}
          onOpen={() => setAttitudeSelectorOpen(true)}
          trigger={
            <AttitudeChip
              attitude={area.attitude}
              onClick={() => setAttitudeSelectorOpen(true)}
            />
          }
        />
      )}

      {hasTags && (
        <TagBadges tags={visibleTags} onRemoveTag={handleRemoveTag} />
      )}

      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="px-2 py-0.5 rounded-md text-xs font-mono text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          +{hiddenCount}
        </button>
      )}

      {expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="px-2 py-0.5 rounded-md text-xs font-mono text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          less
        </button>
      )}
    </div>
  );
}
