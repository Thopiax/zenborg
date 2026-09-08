"use client";

import { use$ } from "@legendapp/state/react";
import { useMemo, useRef } from "react";
import { MentionAutocompleteInline } from "@/components/MentionAutocompleteInline";
import { MentionBadges } from "@/components/MentionBadges";
import { TagAutocompleteInline } from "@/components/TagAutocompleteInline";
import { TagBadges } from "@/components/TagBadges";
import { classifyMentionIds } from "@/domain/services/MentionService";
import type { TaggedNameField } from "@/hooks/useTaggedNameField";
import { places$ } from "@/infrastructure/state/store";
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
  /** Show mention badges below input */
  showMentions?: boolean;
  /** Override mention selection — called instead of storing mention key.
   *  Text cleanup still happens; the key is NOT added to mentionIds. */
  onMentionSelect?: (key: string) => void;
  /** Include areas in @mention search */
  includeAreas?: boolean;
  /** Custom tag badge className */
  tagBadgesClassName?: string;
  /** Fires on user-initiated input (onChange), NOT on programmatic value changes */
  onUserInput?: (value: string) => void;
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
  showMentions = true,
  onMentionSelect,
  includeAreas = false,
  tagBadgesClassName,
  onUserInput,
}: TaggedNameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const allPlaces = use$(places$);

  const placeKeys = useMemo(
    () => new Set(Object.values(allPlaces).map((p) => p.key)),
    [allPlaces],
  );
  const { personIds, placeIds } = useMemo(
    () => classifyMentionIds(field.mentionIds, placeKeys),
    [field.mentionIds, placeKeys],
  );

  const inputElement = (
    <input
      ref={inputRef}
      type="text"
      value={field.displayValue}
      onChange={(e) => {
        field.setDisplayValue(e.target.value, e.target.selectionStart || 0);
        onUserInput?.(e.target.value);
      }}
      onBlur={() => field.extractRemainingTags()}
      autoCapitalize="none"
      placeholder={placeholder}
      className={cn(
        "w-full bg-transparent outline-none",
        "text-stone-900 dark:text-stone-100",
        "placeholder:text-stone-400 dark:placeholder:text-stone-500",
        className,
      )}
    />
  );

  return (
    <div className="w-full">
      {/* Input with Tag Autocomplete (active when typing #) */}
      <TagAutocompleteInline
        open={field.isAutocompleteOpen && !field.isMentionOpen}
        searchValue={field.searchValue}
        onSelectTag={field.extractTag}
        onRemoveTag={field.removeTag}
        onClose={() => {}}
        existingTags={field.tags}
        maxSuggestions={maxSuggestions}
        collisionBoundary={collisionBoundary}
        trigger={
          <MentionAutocompleteInline
            open={field.isMentionOpen}
            searchValue={field.mentionSearch}
            onSelectMention={onMentionSelect
              ? (key) => {
                  field.selectMention(key);
                  field.removeMention(key);
                  onMentionSelect(key);
                }
              : field.selectMention
            }
            onRemoveMention={field.removeMention}
            onClose={() => {}}
            existingMentions={field.mentionIds}
            maxSuggestions={maxSuggestions}
            collisionBoundary={collisionBoundary}
            includeAreas={includeAreas}
            trigger={inputElement}
          />
        }
      />

      {/* Mention Badges */}
      {showMentions && field.mentionIds.length > 0 && (
        <MentionBadges
          personIds={personIds}
          placeIds={placeIds}
          onRemovePerson={field.removeMention}
          onRemovePlace={field.removeMention}
          className={cn("mt-3", tagBadgesClassName)}
        />
      )}

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
