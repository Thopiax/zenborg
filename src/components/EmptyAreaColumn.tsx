/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { ColorPicker } from "@/components/ColorPicker";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  extractLeadingEmoji,
  suggestEmojiForAreaName,
} from "@/lib/emoji-utils";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface EmptyAreaColumnProps {
  onCreateArea: (name: string, emoji: string, color: string) => void;
}

export function EmptyAreaColumn({ onCreateArea }: EmptyAreaColumnProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [color, setColor] = useState("#3b82f6");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const handleCancel = () => {
    setIsCreating(false);
    setName("");
    setEmoji("⭐");
    setColor("#3b82f6");
  };

  const handleSave = () => {
    if (!name.trim()) {
      handleCancel();
      return;
    }
    onCreateArea(name.trim(), emoji, color);
    handleCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);

    const { emoji: leadingEmoji, remainingText } = extractLeadingEmoji(value);
    if (leadingEmoji && remainingText.length > 0) {
      setEmoji(leadingEmoji);
      setName(remainingText);
      return;
    }

    if (!leadingEmoji && value.trim().length >= 2) {
      const suggested = suggestEmojiForAreaName(value);
      if (suggested) {
        setEmoji(suggested);
      }
    }
  };

  const handleEmojiSelect = (selectedEmoji: string) => {
    setEmoji(selectedEmoji);
    setEmojiPickerOpen(false);
  };

  if (isCreating) {
    return (
      <div
        className={cn(
          "flex flex-col snap-start rounded-lg overflow-hidden",
          "border border-stone-300 dark:border-stone-600",
          columnWidth.scrollableClassName,
        )}
        style={{ backgroundColor: `${color}08` }}
      >
        {/* Header — editing mode */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-xl flex-shrink-0 hover:bg-stone-100 dark:hover:bg-stone-800 rounded w-8 h-8 flex items-center justify-center transition-colors"
                  aria-label="Change emoji"
                >
                  {emoji}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-0" align="start">
                <EmojiPicker
                  className="h-[342px]"
                  onEmojiSelect={({ emoji }) => handleEmojiSelect(emoji)}
                >
                  <EmojiPickerSearch />
                  <EmojiPickerContent />
                  <EmojiPickerFooter />
                </EmojiPicker>
              </PopoverContent>
            </Popover>

            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Area name..."
              className="flex-1 min-w-0 px-2 py-1 text-sm font-mono font-medium bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-600 rounded focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
            />

            <div className="flex-shrink-0">
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>
        </div>

        {/* Colored Divider */}
        <div
          className="h-[3px] mx-4 mb-2"
          style={{ backgroundColor: color }}
        />

        {/* Content */}
        <div className="flex-1 p-4 min-h-[300px] flex flex-col items-center justify-center">
          <p className="text-xs font-mono text-stone-400 dark:text-stone-500 text-center">
            Press Enter to save, Escape to cancel
          </p>
        </div>
      </div>
    );
  }

  // Default: clickable empty column
  return (
    <button
      type="button"
      onClick={() => setIsCreating(true)}
      className={cn(
        "group flex flex-col snap-start rounded-lg overflow-hidden text-left",
        "border border-dashed border-stone-300 dark:border-stone-600",
        "hover:border-stone-400 dark:hover:border-stone-500",
        "bg-stone-50/50 dark:bg-stone-900/30",
        "hover:bg-stone-100/50 dark:hover:bg-stone-800/30",
        "transition-colors duration-200 cursor-pointer",
        columnWidth.scrollableClassName,
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded flex items-center justify-center bg-stone-200/60 dark:bg-stone-700/60 group-hover:bg-stone-300/60 dark:group-hover:bg-stone-600/60 transition-colors flex-shrink-0">
          <Plus className="w-4 h-4 text-stone-500 dark:text-stone-400" />
        </div>
        <span className="text-sm font-mono font-medium text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200 transition-colors">
          New area
        </span>
      </div>

      {/* Divider placeholder */}
      <div className="h-[3px] mx-4 mb-2 bg-stone-200 dark:bg-stone-700" />

      {/* Content */}
      <div className="flex-1 p-4 min-h-[300px] flex flex-col items-center justify-center gap-1">
        <p className="text-xs font-mono text-stone-400 dark:text-stone-500 text-center">
          Click to create a new area
        </p>
      </div>
    </button>
  );
}
