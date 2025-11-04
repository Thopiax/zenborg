/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
"use client";

import { Archive, GripVertical, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import type { Area } from "@/domain/entities/Area";
import {
  extractLeadingEmoji,
  suggestEmojiForAreaName,
} from "@/lib/emoji-utils";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./ColorPicker";

interface AreaCardProps {
  area: Area;
  canDelete: boolean;
  isNew?: boolean; // True for new area creation mode
  isArchived?: boolean; // True for archived areas
  onUpdate: (updates: Partial<Area>) => void;
  onDelete: () => void;
  onArchive?: () => void; // Archive action for active areas
  onUnarchive?: () => void; // Unarchive action for archived areas
  onSaveNew?: (name: string, color: string, emoji: string) => void; // Called on blur for new areas
  dragHandleProps?: any; // Props for drag handle
}

/**
 * AreaCard - Flat design with inline controls
 *
 * Features:
 * - Inline emoji picker (popover)
 * - Inline name editing
 * - Inline color picker (always visible)
 * - Inline action icons (archive/restore/delete)
 * - Drag and drop support
 */
export function AreaCard({
  area,
  canDelete,
  isNew = false,
  isArchived = false,
  onUpdate,
  onDelete,
  onArchive,
  onUnarchive,
  onSaveNew,
  dragHandleProps,
}: AreaCardProps) {
  // Local state for optimistic updates
  const [name, setName] = useState(area.name);
  const [emoji, setEmoji] = useState(area.emoji);
  const [color, setColor] = useState(area.color);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [manualEmojiOverride, setManualEmojiOverride] = useState(false);
  const lastProcessedName = useRef<string>("");

  // Extract leading emoji (always) and auto-suggest (new areas only)
  // biome-ignore lint/correctness/useExhaustiveDependencies: <avoid infinite loop>
  useEffect(() => {
    if (manualEmojiOverride) return;
    if (name === lastProcessedName.current) return; // Prevent infinite loop

    lastProcessedName.current = name;

    // Check if name starts with an emoji (works for both new and existing areas)
    const { emoji: leadingEmoji, remainingText } = extractLeadingEmoji(name);

    if (leadingEmoji && remainingText.length > 0) {
      // User typed/pasted an emoji with text after it - extract it
      setEmoji(leadingEmoji);
      setName(remainingText);
      if (isNew) {
        onUpdate({ emoji: leadingEmoji, name: remainingText });
      } else {
        onUpdate({ emoji: leadingEmoji });
      }
      return;
    }

    // Auto-suggest emoji based on name (only for new areas)
    if (isNew && !leadingEmoji && name.trim().length >= 2) {
      const suggested = suggestEmojiForAreaName(name);
      if (suggested) {
        setEmoji(suggested);
        onUpdate({ emoji: suggested });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, isNew, manualEmojiOverride]);

  // Handle save on blur
  const handleSave = () => {
    // Don't save if emoji picker is open (prevents premature cancellation)
    if (emojiPickerOpen) {
      return;
    }

    // For new areas, trigger creation or cancellation
    if (isNew && onSaveNew) {
      if (!name.trim()) {
        // Cancel creation if empty
        onDelete();
        return;
      }
      // Create the area
      onSaveNew(name.trim(), color, emoji);
      return;
    }

    // For existing areas, check if there are changes
    if (name === area.name && emoji === area.emoji) {
      return;
    }

    // Validate name
    if (!name.trim()) {
      setValidationError("Name cannot be empty");
      // Revert to original
      setName(area.name);
      return;
    }

    // Save changes
    onUpdate({ name: name.trim(), emoji });
    setValidationError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur(); // Trigger save
    } else if (e.key === "Escape") {
      // Revert changes
      setName(area.name);
      setEmoji(area.emoji);
      setValidationError(null);
      e.currentTarget.blur();
    }
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    if (isNew) {
      // Update draft state
      onUpdate({ color: newColor });
    } else {
      // Save immediately for existing areas
      onUpdate({ color: newColor });
    }
  };

  const handleEmojiSelect = (selectedEmoji: string) => {
    setEmoji(selectedEmoji);
    setEmojiPickerOpen(false);
    setManualEmojiOverride(true); // Prevent auto-suggestion after manual selection
    // Save emoji
    onUpdate({ emoji: selectedEmoji });
  };

  return (
    <div
      className={cn(
        "group relative p-3 rounded-lg border",
        isArchived
          ? "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900"
          : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950",
        "transition-all hover:border-stone-300 dark:hover:border-stone-600"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        {!isArchived && !isNew && (
          <button
            type="button"
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors flex-shrink-0"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4 text-stone-400 dark:text-stone-500" />
          </button>
        )}

        {/* Emoji Picker */}
        <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-2xl flex-shrink-0 hover:bg-stone-100 dark:hover:bg-stone-800 rounded w-10 h-10 flex items-center justify-center transition-colors"
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

        {/* Name Input */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus={isNew}
          className="flex-1 px-2 py-1 bg-transparent hover:bg-stone-50 dark:hover:bg-stone-900 focus:bg-stone-50 dark:focus:bg-stone-900 rounded border-0 outline-none text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 transition-all font-mono font-medium"
          placeholder="Area name..."
          disabled={isArchived}
        />

        {/* Color Picker (inline) */}
        <div className="flex-shrink-0">
          <ColorPicker value={color} onChange={handleColorChange} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Active areas: only show archive button */}
          {!isArchived && !isNew && onArchive && (
            <button
              type="button"
              onClick={onArchive}
              className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Archive area"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}

          {/* Archived areas: show restore and delete buttons */}
          {isArchived && (
            <>
              {onUnarchive && (
                <button
                  type="button"
                  onClick={onUnarchive}
                  className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                  title="Restore area"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                  title="Delete permanently"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {/* New areas: show cancel button */}
          {isNew && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              title="Cancel"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
          {validationError}
        </div>
      )}

      {/* New area indicator */}
      {isNew && (
        <div className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Type a name to auto-suggest emoji, or start with an emoji (e.g., "🏃
          Running") to use it directly. Press Enter or click away to save.
        </div>
      )}
    </div>
  );
}
