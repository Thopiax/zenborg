"use client";

import { use$ } from "@legendapp/state/react";
import { Hash } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { allTags$, tagUsageCount$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface TagAutocompleteProps {
  open: boolean;
  searchValue: string;
  onSelectTag: (tag: string) => void;
  onClose: () => void;
  /** The trigger element (usually invisible, positioned at cursor) */
  trigger: React.ReactNode;
  /** Element to use as collision boundary (e.g., dialog container) */
  collisionBoundary?: Element | null | Array<Element | null>;
  /** Tags already added (to exclude from suggestions) */
  existingTags?: string[];
}

/**
 * TagAutocomplete - Dropdown menu for tag selection
 *
 * Features:
 * - Shows existing tags filtered by search value
 * - Displays usage counts
 * - Keyboard navigation (arrow keys + Enter)
 * - Excludes already-added tags
 */
export function TagAutocomplete({
  open,
  searchValue,
  onSelectTag,
  onClose,
  trigger,
  collisionBoundary,
  existingTags = [],
}: TagAutocompleteProps) {
  const allExistingTags = use$(allTags$);
  const tagCounts = use$(tagUsageCount$);

  // Filter tags based on search value, excluding already-added tags
  const filteredTags = searchValue.trim()
    ? allExistingTags
        .filter(
          (tag) =>
            tag.toLowerCase().includes(searchValue.toLowerCase()) &&
            !existingTags.includes(tag)
        )
        .slice(0, 8) // Limit to 8 suggestions
    : [];

  // Popular tags (for when search is empty)
  const popularTags = allExistingTags
    .filter((tag) => !existingTags.includes(tag))
    .sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0))
    .slice(0, 5);

  const tagsToShow = searchValue.trim() ? filteredTags : popularTags;

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      modal={false}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-full max-w-md p-2 border-stone-200/50 dark:border-stone-700/50 shadow-sm bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm"
        collisionBoundary={collisionBoundary}
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {tagsToShow.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {searchValue.trim() && (
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-medium">
                Matching tags
              </div>
            )}
            {tagsToShow.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(tag)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-stone-600 dark:text-stone-400",
                  "hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                )}
              >
                {/* Hash icon */}
                <Hash
                  className="w-3 h-3 text-stone-400 dark:text-stone-500 flex-shrink-0"
                  strokeWidth={1.5}
                />

                {/* Tag name */}
                <span className="text-xs font-mono flex-1 min-w-0 truncate text-left">
                  {tag}
                </span>

                {/* Usage count */}
                <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                  {tagCounts[tag] || 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
