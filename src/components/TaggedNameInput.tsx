"use client";

import { useRef } from "react";
import { TagAutocompleteInline } from "@/components/TagAutocompleteInline";
import { TagBadges } from "@/components/TagBadges";
import type { TaggedNameField } from "@/hooks/useTaggedNameField";
import { cn } from "@/lib/utils";

interface TaggedNameInputProps {
  field: TaggedNameField;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Element to use as collision boundary (e.g., dialog container) */
  collisionBoundary?: Element | null | Array<Element | null>;
  /** Max autocomplete suggestions to show */
  maxSuggestions?: number;
  /** Show tag badges below input */
  showTags?: boolean;
  /** Custom tag badge className */
  tagBadgesClassName?: string;
}

/**
 * TaggedNameInput - Reusable input component with inline tag extraction
 *
 * Encapsulates:
 * - Text input with tag detection
 * - Tag autocomplete popover
 * - Tag badges (optional)
 *
 * Usage:
 * ```tsx
 * const field = useTaggedNameField();
 * <TaggedNameInput field={field} placeholder="Morning Run #wellness" />
 * ```
 */
export function TaggedNameInput({
  field,
  placeholder = "Type name...",
  autoFocus = false,
  className,
  collisionBoundary,
  maxSuggestions = 8,
  showTags = true,
  tagBadgesClassName,
}: TaggedNameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full">
      {/* Input with Tag Autocomplete */}
      <TagAutocompleteInline
        open={field.isAutocompleteOpen}
        searchValue={field.searchValue}
        onSelectTag={field.extractTag}
        onRemoveTag={field.removeTag}
        onClose={() => {}} // Handled internally by the hook
        existingTags={field.tags}
        maxSuggestions={maxSuggestions}
        collisionBoundary={collisionBoundary}
        trigger={
          <input
            ref={inputRef}
            type="text"
            value={field.displayValue}
            onChange={(e) =>
              field.setDisplayValue(
                e.target.value.toLowerCase(),
                e.target.selectionStart || 0
              )
            }
            onBlur={() => field.extractRemainingTags()}
            autoFocus={autoFocus}
            autoCapitalize="none"
            placeholder={placeholder}
            className={cn(
              "w-full bg-transparent outline-none",
              "text-stone-900 dark:text-stone-100",
              "placeholder:text-stone-400 dark:placeholder:text-stone-500",
              className
            )}
          />
        }
      />

      {/* Tag Badges */}
      {showTags && field.tags.length > 0 && (
        <TagBadges
          tags={field.tags}
          onRemoveTag={field.removeTag}
          className={cn("mt-3", tagBadgesClassName)}
        />
      )}
    </div>
  );
}
