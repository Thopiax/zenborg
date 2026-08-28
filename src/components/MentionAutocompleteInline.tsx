"use client";

import { use$ } from "@legendapp/state/react";
import Fuse from "fuse.js";
import { AtSign, Check, MapPin, Plus, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { people$, places$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface MentionItem {
  key: string;
  name: string;
  emoji: string | null;
  type: "person" | "place";
}

interface MentionAutocompleteInlineProps {
  open: boolean;
  searchValue: string;
  onSelectMention: (key: string) => void;
  onRemoveMention: (key: string) => void;
  onClose: () => void;
  trigger: React.ReactNode;
  collisionBoundary?: Element | null | Array<Element | null>;
  existingMentions?: string[];
  maxSuggestions?: number;
}

export function MentionAutocompleteInline({
  open,
  searchValue,
  onSelectMention,
  onRemoveMention,
  onClose,
  trigger,
  collisionBoundary,
  existingMentions = [],
  maxSuggestions = 8,
}: MentionAutocompleteInlineProps) {
  const allPeople = use$(people$);
  const allPlaces = use$(places$);

  const allItems = useMemo((): MentionItem[] => {
    const items: MentionItem[] = [];
    for (const person of Object.values(allPeople)) {
      items.push({
        key: person.key,
        name: person.name,
        emoji: person.emoji,
        type: "person",
      });
    }
    for (const place of Object.values(allPlaces)) {
      items.push({
        key: place.key,
        name: place.name,
        emoji: place.emoji,
        type: "place",
      });
    }
    return items;
  }, [allPeople, allPlaces]);

  const { suggestions, createNewKey } = useMemo(() => {
    const trimmedSearch = searchValue.trim().toLowerCase();

    if (!trimmedSearch) {
      return {
        suggestions: allItems.slice(0, maxSuggestions),
        createNewKey: null,
      };
    }

    const exactMatches: MentionItem[] = [];
    const prefixMatches: MentionItem[] = [];
    const containsMatches: MentionItem[] = [];
    const fuzzyMatches: MentionItem[] = [];

    for (const item of allItems) {
      const lowerName = item.name.toLowerCase();
      const lowerKey = item.key.toLowerCase();

      if (lowerKey === trimmedSearch || lowerName === trimmedSearch) {
        exactMatches.push(item);
      } else if (
        lowerKey.startsWith(trimmedSearch) ||
        lowerName.startsWith(trimmedSearch)
      ) {
        prefixMatches.push(item);
      } else if (
        lowerKey.includes(trimmedSearch) ||
        lowerName.includes(trimmedSearch)
      ) {
        containsMatches.push(item);
      }
    }

    const searched = new Set([
      ...exactMatches,
      ...prefixMatches,
      ...containsMatches,
    ]);
    const remaining = allItems.filter((i) => !searched.has(i));

    if (remaining.length > 0) {
      const fuse = new Fuse(remaining, {
        keys: ["name", "key"],
        threshold: 0.4,
        distance: 100,
      });
      for (const result of fuse.search(trimmedSearch)) {
        fuzzyMatches.push(result.item);
      }
    }

    const allMatches = [
      ...exactMatches,
      ...prefixMatches,
      ...containsMatches,
      ...fuzzyMatches,
    ].slice(0, maxSuggestions);

    const normalized = trimmedSearch
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const exists = allItems.some((i) => i.key === normalized);
    const shouldShowCreate = normalized && !exists && allMatches.length < 3;

    return {
      suggestions: allMatches,
      createNewKey: shouldShowCreate ? normalized : null,
    };
  }, [searchValue, allItems, maxSuggestions]);

  const hasSuggestions = suggestions.length > 0 || createNewKey !== null;
  const shouldShowPopover = open && hasSuggestions;
  const totalItems = suggestions.length + (createNewKey ? 1 : 0);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (totalItems === 0) return;
    setSelectedIndex(0);
  }, [totalItems]);

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

        if (createNewKey && selectedIndex === suggestions.length) {
          onSelectMention(createNewKey);
        } else {
          const selected = suggestions[selectedIndex];
          const isUsed = existingMentions.includes(selected.key);
          if (isUsed) {
            onRemoveMention(selected.key);
          } else {
            onSelectMention(selected.key);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    shouldShowPopover,
    suggestions,
    createNewKey,
    totalItems,
    selectedIndex,
    existingMentions,
    onSelectMention,
    onRemoveMention,
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
        {searchValue.trim() && (
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-medium">
            People & places
          </div>
        )}

        <div className="flex flex-col gap-0.5 max-h-48 overflow-auto">
          {suggestions.map((item, index) => {
            const isUsed = existingMentions.includes(item.key);
            const TypeIcon = item.type === "person" ? User : MapPin;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  isUsed ? onRemoveMention(item.key) : onSelectMention(item.key)
                }
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md",
                  "text-stone-600 dark:text-stone-400",
                  "transition-colors cursor-pointer",
                  "text-left",
                  index === selectedIndex
                    ? "bg-stone-200 dark:bg-stone-700"
                    : "hover:bg-stone-100 dark:hover:bg-stone-800",
                )}
              >
                {isUsed ? (
                  <Check
                    className="w-3 h-3 text-green-600 dark:text-green-500 flex-shrink-0"
                    strokeWidth={2}
                  />
                ) : (
                  <TypeIcon
                    className="w-3 h-3 text-stone-400 dark:text-stone-500 flex-shrink-0"
                    strokeWidth={1.5}
                  />
                )}

                {item.emoji && (
                  <span className="text-xs flex-shrink-0">{item.emoji}</span>
                )}

                <span className="text-xs font-mono flex-1 min-w-0 truncate">
                  {item.name}
                </span>

                <span className="text-[10px] text-stone-400 dark:text-stone-500 flex-shrink-0 uppercase">
                  {item.type === "person" ? "person" : "place"}
                </span>
              </button>
            );
          })}

          {createNewKey && (
            <button
              key={`create-${createNewKey}`}
              type="button"
              onClick={() => onSelectMention(createNewKey)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md",
                "text-stone-600 dark:text-stone-400",
                "transition-colors cursor-pointer",
                "text-left border-t border-stone-200 dark:border-stone-700 mt-0.5 pt-2",
                selectedIndex === suggestions.length
                  ? "bg-stone-200 dark:bg-stone-700"
                  : "hover:bg-stone-100 dark:hover:bg-stone-800",
              )}
            >
              <Plus
                className="w-3 h-3 text-stone-400 dark:text-stone-500 flex-shrink-0"
                strokeWidth={1.5}
              />
              <span className="text-xs font-mono flex-1 min-w-0 truncate">
                Create: @{createNewKey}
              </span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
