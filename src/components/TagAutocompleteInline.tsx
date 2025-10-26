"use client";

import { use$ } from "@legendapp/state/react";
import { Hash } from "lucide-react";
import { useMemo } from "react";
import Fuse from "fuse.js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  allUnifiedTags$,
  unifiedTagUsageCount$,
} from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface TagAutocompleteInlineProps {
  open: boolean;
  searchValue: string;
  onSelectTag: (tag: string) => void;
  onClose: () => void;
  /** The anchor element (positioned at input field) */
  trigger: React.ReactNode;
  /** Element to use as collision boundary (e.g., dialog container) */
  collisionBoundary?: Element | null | Array<Element | null>;
  /** Tags already added (to exclude from suggestions) */
  existingTags?: string[];
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
}

/**
 * TagAutocompleteInline - Popover dropdown for tag selection
 *
 * Features:
 * - Shows below input field using Popover positioning
 * - Fuzzy matching with fuse.js
 * - Shows usage counts
 * - Excludes already-added tags
 * - Subtle, minimal design
 * - Portal rendering (avoids overflow issues)
 *
 * Usage:
 * Provide an invisible trigger element positioned where you want the popover.
 */
export function TagAutocompleteInline({
  open,
  searchValue,
  onSelectTag,
  onClose,
  trigger,
  collisionBoundary,
  existingTags = [],
  maxSuggestions = 8,
}: TagAutocompleteInlineProps) {
  const allExistingTags = use$(allUnifiedTags$);
  const tagCounts = use$(unifiedTagUsageCount$);

  // Filter tags to exclude already-added ones
  const availableTags = useMemo(
    () => allExistingTags.filter((tag) => !existingTags.includes(tag)),
    [allExistingTags, existingTags]
  );

  // Fuzzy search with fuse.js
  const fuse = useMemo(
    () =>
      new Fuse(availableTags, {
        threshold: 0.3, // Lower = more strict matching
        distance: 100,
        includeScore: true,
      }),
    [availableTags]
  );

  // Get filtered suggestions
  const suggestions = useMemo(() => {
    const trimmedSearch = searchValue.trim();

    if (!trimmedSearch) {
      // No search - show popular tags
      return availableTags
        .sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0))
        .slice(0, maxSuggestions);
    }

    // Fuzzy search
    const results = fuse.search(trimmedSearch);
    return results.map((result) => result.item).slice(0, maxSuggestions);
  }, [searchValue, availableTags, tagCounts, fuse, maxSuggestions]);

  const hasSuggestions = suggestions.length > 0;
  const shouldShowPopover = open && hasSuggestions;

  return (
    <Popover
      open={shouldShowPopover}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      modal={false}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {shouldShowPopover && (
        <PopoverContent
          align="start"
          className="w-full max-w-md p-1 border-stone-200/50 dark:border-stone-700/50 shadow-sm bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm"
          collisionBoundary={collisionBoundary}
          side="bottom"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header (only when searching) */}
          {searchValue.trim() && (
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-medium">
              Matching tags
            </div>
          )}

          {/* Suggestions */}
          <div className="flex flex-col gap-0.5 max-h-48 overflow-auto">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(tag)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md",
                  "text-stone-600 dark:text-stone-400",
                  "hover:bg-stone-100 dark:hover:bg-stone-800",
                  "transition-colors cursor-pointer",
                  "text-left"
                )}
              >
                {/* Hash icon */}
                <Hash
                  className="w-3 h-3 text-stone-400 dark:text-stone-500 flex-shrink-0"
                  strokeWidth={1.5}
                />

                {/* Tag name */}
                <span className="text-xs font-mono flex-1 min-w-0 truncate">
                  {tag}
                </span>

                {/* Usage count */}
                <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                  {tagCounts[tag] || 0}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
