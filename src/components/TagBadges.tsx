"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagBadgesProps {
  tags: string[];
  onRemoveTag: (tag: string) => void;
  className?: string; // NEW
}

/**
 * TagBadges - Display tags with remove functionality
 *
 * Shows tags as small badges with X button to remove
 */
export function TagBadges({ tags, onRemoveTag, className }: TagBadgesProps) {
  if (tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-mono"
        >
          #{tag}
          <button
            type="button"
            onClick={() => onRemoveTag(tag)}
            className="hover:bg-stone-200 dark:hover:bg-stone-700 rounded p-0.5 transition-colors"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}
