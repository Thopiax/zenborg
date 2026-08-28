"use client";

import { use$ } from "@legendapp/state/react";
import { MapPin, User, X } from "lucide-react";
import { displayName } from "@/domain/entities/Person";
import { people$, places$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface MentionBadgesProps {
  personIds?: string[];
  placeIds?: string[];
  onRemovePerson?: (key: string) => void;
  onRemovePlace?: (key: string) => void;
  className?: string;
}

export function MentionBadges({
  personIds = [],
  placeIds = [],
  onRemovePerson,
  onRemovePlace,
  className,
}: MentionBadgesProps) {
  const allPeople = use$(people$);
  const allPlaces = use$(places$);

  if (personIds.length === 0 && placeIds.length === 0) return null;

  const resolvedPeople = personIds.map((key) => {
    const person = Object.values(allPeople).find((p) => p.key === key);
    return { key, name: person ? displayName(person) : key, emoji: person?.emoji };
  });

  const resolvedPlaces = placeIds.map((key) => {
    const place = Object.values(allPlaces).find((p) => p.key === key);
    return { key, name: place?.name ?? key, emoji: place?.emoji };
  });

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {resolvedPeople.map(({ key, name, emoji }) => (
        <span
          key={`person-${key}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs"
        >
          {emoji ? (
            <span className="text-xs">{emoji}</span>
          ) : (
            <User className="w-2.5 h-2.5" strokeWidth={1.5} />
          )}
          <span className="font-mono">{name}</span>
          {onRemovePerson && (
            <button
              type="button"
              onClick={() => onRemovePerson(key)}
              className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
      {resolvedPlaces.map(({ key, name, emoji }) => (
        <span
          key={`place-${key}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs"
        >
          {emoji ? (
            <span className="text-xs">{emoji}</span>
          ) : (
            <MapPin className="w-2.5 h-2.5" strokeWidth={1.5} />
          )}
          <span className="font-mono">{name}</span>
          {onRemovePlace && (
            <button
              type="button"
              onClick={() => onRemovePlace(key)}
              className="ml-0.5 hover:text-emerald-900 dark:hover:text-emerald-100"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
