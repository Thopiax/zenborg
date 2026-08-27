"use client";

import { use$ } from "@legendapp/state/react";
import { people$, places$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface MentionSummaryProps {
  personIds?: readonly string[];
  placeIds?: readonly string[];
  className?: string;
  visible?: number;
}

export function MentionSummary({
  personIds,
  placeIds,
  className,
  visible = 1,
}: MentionSummaryProps) {
  const allPeople = use$(people$);
  const allPlaces = use$(places$);

  const allIds = [...(personIds || []), ...(placeIds || [])];
  if (allIds.length === 0) return null;

  const resolve = (key: string): string => {
    const person = Object.values(allPeople).find((p) => p.key === key);
    if (person) return person.emoji ? `${person.emoji} ${person.name}` : person.name;
    const place = Object.values(allPlaces).find((p) => p.key === key);
    if (place) return place.emoji ? `${place.emoji} ${place.name}` : place.name;
    return key;
  };

  const shown = allIds.slice(0, Math.max(visible, 0));
  const hidden = allIds.length - shown.length;

  return (
    <span
      data-mention-summary
      className={cn(
        "flex items-center gap-1 text-xs font-mono opacity-50",
        className,
      )}
      title={allIds.map((id) => `@${resolve(id)}`).join(" ")}
    >
      {shown.map((id) => (
        <span key={id} className="truncate max-w-[12ch]">
          @{resolve(id)}
        </span>
      ))}
      {hidden > 0 && <span className="tabular-nums">+{hidden}</span>}
    </span>
  );
}
