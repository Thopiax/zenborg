/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
"use client";

import { MoreVertical, Palette, Smile, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Area } from "@/domain/entities/Area";
import { updateArea } from "@/domain/entities/Area";
import { ColorPicker } from "./ColorPicker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AreaCardProps {
  area: Area;
  canDelete: boolean;
  isNew?: boolean; // True for new area creation mode
  onUpdate: (updates: Partial<Area>) => void;
  onDelete: () => void;
  onSaveNew?: (name: string, color: string, emoji: string) => void; // Called on blur for new areas
}

/**
 * AreaCard - Simplified full-color card with menu
 *
 * Features:
 * - Full background color (area.color)
 * - Inline name editing (click to edit)
 * - Three-dot menu: modify color, change emoji, delete
 * - Color picker in popover
 * - Emoji picker in popover
 * - New area creation mode: disappears on blur if empty
 */
export function AreaCard({
  area,
  canDelete,
  isNew = false,
  onUpdate,
  onDelete,
  onSaveNew
}: AreaCardProps) {
  // Local state for optimistic updates
  const [name, setName] = useState(area.name);
  const [emoji, setEmoji] = useState(area.emoji);
  const [color, setColor] = useState(area.color);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiInput, setShowEmojiInput] = useState(false);

  // Handle save on blur
  const handleSave = () => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    setShowColorPicker(false);
  };

  const handleEmojiChange = (newEmoji: string) => {
    setEmoji(newEmoji);
    // Save emoji
    if (!isNew) {
      onUpdate({ emoji: newEmoji });
    }
  };

  // Helper to determine if text should be light or dark based on background
  const getTextColor = (bgColor: string) => {
    // Simple luminance check
    const hex = bgColor.replace("#", "");
    const r = Number.parseInt(hex.substring(0, 2), 16);
    const g = Number.parseInt(hex.substring(2, 4), 16);
    const b = Number.parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "text-stone-900" : "text-white";
  };

  const textColorClass = getTextColor(color);

  return (
    <div
      className={`group relative p-4 rounded-lg transition-all ${textColorClass}`}
      style={{ backgroundColor: color }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Emoji + Name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0">{emoji}</span>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus={isNew}
            className={`flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 focus:bg-white/30 rounded border-0 outline-none ${textColorClass} placeholder:text-current/50 transition-all font-medium`}
            placeholder="Area name..."
          />
        </div>

        {/* Right: Menu Button */}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`p-1.5 rounded-lg hover:bg-white/20 ${textColorClass} transition-all flex-shrink-0`}
              aria-label="Area options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-0">
            <div className="py-1">
              {/* Modify Color */}
              <button
                type="button"
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowEmojiInput(false);
                }}
                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-stone-100 dark:hover:bg-stone-800 text-left text-stone-900 dark:text-stone-100 transition-colors"
              >
                <Palette className="w-4 h-4" />
                <span>Modify color</span>
              </button>

              {/* Color Picker (shown inline in menu) */}
              {showColorPicker && (
                <div className="px-4 py-2 border-t border-stone-200 dark:border-stone-700">
                  <ColorPicker value={color} onChange={handleColorChange} />
                </div>
              )}

              {/* Change Emoji */}
              <button
                type="button"
                onClick={() => {
                  setShowEmojiInput(!showEmojiInput);
                  setShowColorPicker(false);
                }}
                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-stone-100 dark:hover:bg-stone-800 text-left text-stone-900 dark:text-stone-100 transition-colors"
              >
                <Smile className="w-4 h-4" />
                <span>Change emoji</span>
              </button>

              {/* Emoji Input (shown inline in menu) */}
              {showEmojiInput && (
                <div className="px-4 py-2 border-t border-stone-200 dark:border-stone-700">
                  <input
                    value={emoji}
                    onChange={(e) => handleEmojiChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setShowEmojiInput(false);
                      }
                    }}
                    className="w-full text-center text-2xl px-2 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded outline-none focus:ring-2 focus:ring-stone-400"
                    maxLength={2}
                    placeholder="😀"
                  />
                </div>
              )}

              {/* Delete */}
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  setMenuOpen(false);
                }}
                disabled={!canDelete}
                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-red-500/10 text-left text-red-600 dark:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-t border-stone-200 dark:border-stone-700"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Validation Error (inline, non-blocking) */}
      {validationError && (
        <div className={`mt-2 text-xs ${textColorClass} opacity-90`}>
          {validationError}
        </div>
      )}

      {/* New area indicator */}
      {isNew && (
        <div className={`mt-2 text-xs ${textColorClass} opacity-70`}>
          Press Enter or click away to save (will disappear if empty)
        </div>
      )}
    </div>
  );
}
