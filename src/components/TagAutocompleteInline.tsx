"use client";

import { use$ } from "@legendapp/state/react";
import Fuse from "fuse.js";
import { Check, Hash, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizeTag } from "@/domain/entities/Moment";
import {
  allUnifiedTags$,
  unifiedTagUsageCount$,
} from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface TagAutocompleteInlineProps {
  open: boolean;
  searchValue: string;
  onSelectTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClose: () => void;
  /** The anchor element (positioned at input field) */
  trigger: React.ReactNode;
  /** Element to use as collision boundary (e.g., dialog container) */
  collisionBoundary?: Element | null | Array<Element | null>;
  /** Tags already added (shown with checkmark, clicking removes) */
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
  onRemoveTag,
  onClose,
  trigger,
  collisionBoundary,
  existingTags = [],
  maxSuggestions = 8,
}: TagAutocompleteInlineProps) {
  const allExistingTags = use$(allUnifiedTags$);
  const tagCounts = use$(unifiedTagUsageCount$);

  // Don't filter - show all tags (existing ones will have checkmark)
  const availableTags = allExistingTags;

  // Get filtered suggestions with optional "Create new" option
  const { suggestions, createNewTag } = useMemo(() => {
    const trimmedSearch = searchValue.trim();

    if (!trimmedSearch) {
      // No search - show popular tags
      return {
        suggestions: availableTags
          .sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0))
          .slice(0, maxSuggestions),
        createNewTag: null,
      };
    }

    const lowerSearch = trimmedSearch.toLowerCase();

    // Categorize matches by quality
    const exactMatches: string[] = [];
    const prefixMatches: string[] = [];
    const containsMatches: string[] = [];
    const fuzzyMatches: string[] = [];

    // First pass: exact, prefix, and contains matches
    for (const tag of availableTags) {
      const lowerTag = tag.toLowerCase();

      if (lowerTag === lowerSearch) {
        exactMatches.push(tag);
      } else if (lowerTag.startsWith(lowerSearch)) {
        prefixMatches.push(tag);
      } else if (lowerTag.includes(lowerSearch)) {
        containsMatches.push(tag);
      }
    }

    // Second pass: fuzzy matches for remaining tags
    const searchedTags = new Set([
      ...exactMatches,
      ...prefixMatches,
      ...containsMatches,
    ]);
    const remainingTags = availableTags.filter((tag) => !searchedTags.has(tag));

    if (remainingTags.length > 0) {
      const fuseSubset = new Fuse(remainingTags, {
        threshold: 0.4,
        distance: 100,
        includeScore: true,
      });
      const fuzzyResults = fuseSubset.search(trimmedSearch);
      fuzzyMatches.push(...fuzzyResults.map((result) => result.item));
    }

    // Combine all matches in priority order
    const allMatches = [
      ...exactMatches,
      ...prefixMatches,
      ...containsMatches,
      ...fuzzyMatches,
    ];
    const matches = allMatches.slice(0, maxSuggestions);

    // Check if we should show "Create new" option
    const normalized = normalizeTag(trimmedSearch);
    const shouldShowCreateNew =
      normalized &&
      !availableTags.includes(normalized) &&
      matches.length < 3;

    return {
      suggestions: matches,
      createNewTag: shouldShowCreateNew ? normalized : null,
    };
  }, [searchValue, availableTags, tagCounts, maxSuggestions]);

  const hasSuggestions = suggestions.length > 0 || createNewTag !== null;
  const shouldShowPopover = open && hasSuggestions;

  // Total items includes suggestions + optional createNewTag
  const totalItems = suggestions.length + (createNewTag ? 1 : 0);

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!shouldShowPopover) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();

        // If selecting the "Create new" item (last item)
        if (createNewTag && selectedIndex === suggestions.length) {
          onSelectTag(createNewTag);
        } else {
          const selectedTag = suggestions[selectedIndex];
          const isUsed = existingTags.includes(selectedTag);
          if (isUsed) {
            onRemoveTag(selectedTag);
          } else {
            onSelectTag(selectedTag);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    shouldShowPopover,
    suggestions,
    createNewTag,
    totalItems,
    selectedIndex,
    existingTags,
    onSelectTag,
    onRemoveTag,
  ]);

  return (
    <Popover
      open={shouldShowPopover}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      modal={false}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
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
          {suggestions.map((tag, index) => {
            const isUsed = existingTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => (isUsed ? onRemoveTag(tag) : onSelectTag(tag))}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md",
                  "text-stone-600 dark:text-stone-400",
                  "transition-colors cursor-pointer",
                  "text-left",
                  index === selectedIndex
                    ? "bg-stone-200 dark:bg-stone-700"
                    : "hover:bg-stone-100 dark:hover:bg-stone-800"
                )}
              >
                {/* Checkmark or Hash icon */}
                {isUsed ? (
                  <Check
                    className="w-3 h-3 text-green-600 dark:text-green-500 flex-shrink-0"
                    strokeWidth={2}
                  />
                ) : (
                  <Hash
                    className="w-3 h-3 text-stone-400 dark:text-stone-500 flex-shrink-0"
                    strokeWidth={1.5}
                  />
                )}

                {/* Tag name */}
                <span className="text-xs font-mono flex-1 min-w-0 truncate">
                  {tag}
                </span>

                {/* Usage count */}
                <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                  {tagCounts[tag] || 0}
                </span>
              </button>
            );
          })}

          {/* Create new tag option */}
          {createNewTag && (
            <button
              key={`create-${createNewTag}`}
              type="button"
              onClick={() => onSelectTag(createNewTag)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md",
                "text-stone-600 dark:text-stone-400",
                "transition-colors cursor-pointer",
                "text-left border-t border-stone-200 dark:border-stone-700 mt-0.5 pt-2",
                selectedIndex === suggestions.length
                  ? "bg-stone-200 dark:bg-stone-700"
                  : "hover:bg-stone-100 dark:hover:bg-stone-800"
              )}
            >
              {/* Plus icon */}
              <Plus
                className="w-3 h-3 text-stone-400 dark:text-stone-500 flex-shrink-0"
                strokeWidth={1.5}
              />

              {/* Tag name with "Create" prefix */}
              <span className="text-xs font-mono flex-1 min-w-0 truncate">
                Create: {createNewTag}
              </span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
