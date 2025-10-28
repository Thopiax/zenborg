"use client";

import { use$ } from "@legendapp/state/react";
import { X } from "lucide-react";
import { useState } from "react";
import { normalizeTag } from "@/domain/entities/Moment";
import { allTags$, tagUsageCount$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

/**
 * TagInput - Component for adding and removing tags
 *
 * Features:
 * - Add tags with Enter key
 * - Remove tags with X button
 * - Autocomplete from existing tags
 * - Tag validation and normalization
 * - Show popular tags
 *
 * Philosophy: Organic tag creation, no preset tags
 */
export function TagInput({
  tags,
  onTagsChange,
  placeholder = "Add tag...",
  maxTags = 10,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const allExistingTags = use$(allTags$);
  const tagCounts = use$(tagUsageCount$);

  // Filter suggestions based on input
  const suggestions = inputValue.trim()
    ? allExistingTags
        .filter(
          (tag) =>
            tag.toLowerCase().includes(inputValue.toLowerCase()) &&
            !tags.includes(tag)
        )
        .slice(0, 5)
    : [];

  // Popular tags (sorted by usage count, excluding already added tags)
  const popularTags = allExistingTags
    .filter((tag) => !tags.includes(tag))
    .sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0))
    .slice(0, 5);

  const handleAddTag = (tag: string) => {
    if (tags.length >= maxTags) return;

    const normalized = normalizeTag(tag);
    if (normalized && !tags.includes(normalized)) {
      onTagsChange([...tags, normalized]);
      setInputValue("");
      setShowSuggestions(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        handleAddTag(inputValue.trim());
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag on backspace if input is empty
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="space-y-3">
      {/* Current tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm font-mono"
            >
              #{tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="hover:bg-stone-200 dark:hover:bg-stone-700 rounded p-0.5 transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input field */}
      {tags.length < maxTags && (
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(inputValue.length > 0)}
            onBlur={() => {
              // Delay to allow clicking on suggestions
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-600"
          />

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md shadow-lg max-h-48 overflow-auto">
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className="w-full px-3 py-2 text-left text-sm font-mono hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-between"
                >
                  <span>#{tag}</span>
                  <span className="text-xs text-stone-400 dark:text-stone-500">
                    {tagCounts[tag]} moments
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Popular tags */}
      {!showSuggestions && popularTags.length > 0 && tags.length < maxTags && (
        <div className="space-y-2">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Popular tags:
          </p>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddTag(tag)}
                className="px-2 py-1 text-xs rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-mono hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                #{tag} ({tagCounts[tag]})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hint text */}
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {tags.length >= maxTags
          ? `Maximum ${maxTags} tags`
          : "Press Enter to add tag. Use lowercase, letters, numbers, and hyphens."}
      </p>
    </div>
  );
}
