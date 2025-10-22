"use client";

import * as React from "react";
import { Search } from "lucide-react";
import Fuse from "fuse.js";
import emojiData from "emojibase-data/en/compact.json";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Emoji {
  hexcode: string;
  label: string;
  tags?: string[];
  emoji: string;
  group?: number;
  order?: number;
}

interface EmojiPickerProps {
  onEmojiSelect: (data: { emoji: string }) => void;
  className?: string;
  children?: React.ReactNode;
}

const EMOJI_GROUPS = [
  { id: 0, name: "Smileys & Emotion", emoji: "😀" },
  { id: 1, name: "People & Body", emoji: "👋" },
  { id: 2, name: "Animals & Nature", emoji: "🐵" },
  { id: 3, name: "Food & Drink", emoji: "🍇" },
  { id: 4, name: "Travel & Places", emoji: "🚀" },
  { id: 5, name: "Activities", emoji: "⚽" },
  { id: 6, name: "Objects", emoji: "💡" },
  { id: 7, name: "Symbols", emoji: "❤️" },
  { id: 8, name: "Flags", emoji: "🏁" },
];

// Process emoji data
const processedEmojis: Emoji[] = emojiData.map((e: any) => ({
  hexcode: e.hexcode,
  label: e.label || "",
  tags: e.tags || [],
  emoji: e.emoji || String.fromCodePoint(...e.hexcode.split("-").map((h: string) => Number.parseInt(h, 16))),
  group: e.group,
  order: e.order,
}));

const EmojiPickerContext = React.createContext<{
  onEmojiSelect: (data: { emoji: string }) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedGroup: number | null;
  setSelectedGroup: (group: number | null) => void;
}>({
  onEmojiSelect: () => {},
  searchQuery: "",
  setSearchQuery: () => {},
  selectedGroup: null,
  setSelectedGroup: () => {},
});

export function EmojiPicker({ onEmojiSelect, className, children }: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedGroup, setSelectedGroup] = React.useState<number | null>(null);

  return (
    <EmojiPickerContext.Provider
      value={{
        onEmojiSelect,
        searchQuery,
        setSearchQuery,
        selectedGroup,
        setSelectedGroup,
      }}
    >
      <div className={cn("flex flex-col", className)}>{children}</div>
    </EmojiPickerContext.Provider>
  );
}

export function EmojiPickerSearch() {
  const { searchQuery, setSearchQuery } = React.useContext(EmojiPickerContext);

  return (
    <div className="relative p-2 border-b border-stone-200 dark:border-stone-700">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
      <Input
        type="text"
        placeholder="Search emojis..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-10 h-9 bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700"
      />
    </div>
  );
}

export function EmojiPickerContent() {
  const { onEmojiSelect, searchQuery, selectedGroup } = React.useContext(EmojiPickerContext);

  const filteredEmojis = React.useMemo(() => {
    let emojis = processedEmojis;

    // Filter by group if selected
    if (selectedGroup !== null) {
      emojis = emojis.filter((e) => e.group === selectedGroup);
    }

    // Filter by search query
    if (searchQuery) {
      const fuse = new Fuse(emojis, {
        keys: ["label", "tags"],
        threshold: 0.3,
      });
      return fuse.search(searchQuery).map((result) => result.item);
    }

    return emojis;
  }, [searchQuery, selectedGroup]);

  // Group emojis by their group for better organization
  const groupedEmojis = React.useMemo(() => {
    const groups: { [key: number]: Emoji[] } = {};
    filteredEmojis.forEach((emoji) => {
      const group = emoji.group ?? 0;
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(emoji);
    });
    return groups;
  }, [filteredEmojis]);

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="p-2">
        {!searchQuery && selectedGroup === null ? (
          // Show grouped emojis when no search/filter
          Object.entries(groupedEmojis)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([groupId, emojis]) => {
              const groupInfo = EMOJI_GROUPS.find((g) => g.id === Number(groupId));
              return (
                <div key={groupId} className="mb-4">
                  <div className="text-xs font-medium text-stone-500 dark:text-stone-400 px-1 mb-2">
                    {groupInfo?.name || `Group ${groupId}`}
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {emojis.slice(0, 40).map((emoji) => (
                      <button
                        key={emoji.hexcode}
                        type="button"
                        onClick={() => onEmojiSelect({ emoji: emoji.emoji })}
                        className="w-10 h-10 flex items-center justify-center text-xl hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
                        title={emoji.label}
                      >
                        {emoji.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
        ) : (
          // Show flat grid when searching/filtering
          <div className="grid grid-cols-8 gap-1">
            {filteredEmojis.slice(0, 200).map((emoji) => (
              <button
                key={emoji.hexcode}
                type="button"
                onClick={() => onEmojiSelect({ emoji: emoji.emoji })}
                className="w-10 h-10 flex items-center justify-center text-xl hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
                title={emoji.label}
              >
                {emoji.emoji}
              </button>
            ))}
          </div>
        )}
        {filteredEmojis.length === 0 && (
          <div className="text-center py-8 text-stone-500 dark:text-stone-400 text-sm">
            No emojis found
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

export function EmojiPickerFooter() {
  const { selectedGroup, setSelectedGroup } = React.useContext(EmojiPickerContext);

  return (
    <div className="p-2 border-t border-stone-200 dark:border-stone-700 flex items-center gap-1 overflow-x-auto">
      <button
        type="button"
        onClick={() => setSelectedGroup(null)}
        className={cn(
          "w-8 h-8 flex items-center justify-center text-lg hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors flex-shrink-0",
          selectedGroup === null && "bg-stone-100 dark:bg-stone-800"
        )}
        title="All"
      >
        🔍
      </button>
      {EMOJI_GROUPS.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => setSelectedGroup(group.id)}
          className={cn(
            "w-8 h-8 flex items-center justify-center text-lg hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors flex-shrink-0",
            selectedGroup === group.id && "bg-stone-100 dark:bg-stone-800"
          )}
          title={group.name}
        >
          {group.emoji}
        </button>
      ))}
    </div>
  );
}
