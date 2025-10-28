/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
"use client";

import { Archive } from "lucide-react";
import { useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { AttitudeChip } from "@/components/AttitudeChip";
import { AttitudeSelector } from "@/components/AttitudeSelector";
import { ColorPicker } from "@/components/ColorPicker";
import { HabitQuickInput } from "@/components/HabitQuickInput";
import { PlanHabitsList } from "@/components/PlanHabitsList";
import { TagAutocompleteInline } from "@/components/TagAutocompleteInline";
import { TagBadges } from "@/components/TagBadges";
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
import type { Habit } from "@/domain/entities/Habit";
import type { Attitude } from "@/domain/value-objects/Attitude";
import { useTagExtraction } from "@/hooks/useTagExtraction";
import { cn } from "@/lib/utils";

interface PlanAreaCardProps {
  area: Area;
  habits: Habit[];
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
  onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
  onArchiveArea: (areaId: string) => void;
  onQuickCreateHabit: (name: string, areaId: string) => void;
}

/**
 * PlanAreaCard - Container for habits within an area (Plan page)
 *
 * Features:
 * - Editable area header (emoji, name, color)
 * - List of habits
 * - "+ New habit" button
 * - Empty state with glassmorphism
 */
export function PlanAreaCard({
  area,
  habits,
  onEditHabit,
  onArchiveHabit,
  onUpdateArea,
  onArchiveArea,
  onQuickCreateHabit,
}: PlanAreaCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(area.name);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [attitudeSelectorOpen, setAttitudeSelectorOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Tag extraction for area name
  const {
    isTagAutocompleteOpen,
    currentTagSearch,
    handleNameChange: handleNameChangeWithTags,
    handleNameBlur: handleNameBlurWithTags,
    addTag,
    extractRemainingTags,
    setIsTagAutocompleteOpen,
  } = useTagExtraction({
    inputRef: nameInputRef,
    onTagsChange: (tags) => onUpdateArea(area.id, { tags }),
    onNameChange: (name) => setEditedName(name),
  });

  const handleSaveName = () => {
    // Extract any remaining tags before saving
    extractRemainingTags(editedName, area.tags || []);

    // Get clean name after tag extraction
    const cleanName = editedName
      .replace(/#([a-z0-9-]+)/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanName && cleanName !== area.name) {
      onUpdateArea(area.id, { name: cleanName });
    } else {
      setEditedName(area.name);
    }
    setIsEditingName(false);
  };

  // Enter to save name when editing (but not when autocomplete is open)
  useHotkeys(
    "enter",
    () => {
      handleSaveName();
    },
    {
      enableOnFormTags: true,
      enabled: isEditingName && !isTagAutocompleteOpen,
    },
    [editedName, area.tags, isTagAutocompleteOpen]
  );

  // Escape to cancel name editing
  useHotkeys(
    "escape",
    () => {
      setEditedName(area.name);
      setIsEditingName(false);
    },
    { enableOnFormTags: true, enabled: isEditingName },
    [area.name]
  );

  const handleEmojiSelect = (selectedEmoji: string) => {
    onUpdateArea(area.id, { emoji: selectedEmoji });
    setEmojiPickerOpen(false);
  };

  const handleColorChange = (newColor: string) => {
    onUpdateArea(area.id, { color: newColor });
  };

  const handleAttitudeChange = (attitude: Attitude | null) => {
    onUpdateArea(area.id, { attitude });
    setAttitudeSelectorOpen(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateArea(area.id, {
      tags: (area.tags || []).filter((t) => t !== tagToRemove),
    });
  };

  return (
    <div
      className="flex flex-col border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden max-h-[500px]"
      style={{
        backgroundColor: `${area.color}08`, // 5% opacity background
      }}
    >
      {/* Area Header */}
      <div className="group relative px-4 py-4 border-b border-stone-200 dark:border-stone-700 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-start gap-2">
          {/* Collapse indicator - hidden for now */}
          {/* <span className="text-stone-400 dark:text-stone-500 text-xs mt-1 flex-shrink-0">
            {isCollapsed ? "▶" : "▼"}
          </span> */}

          {/* Content Section: Tags then Name with Emoji */}
          <div className="flex-1 flex flex-col gap-2">
            {/* Tags Row - Always rendered to maintain consistent height */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-[24px]">
              {/* Attitude Selector */}
              {area.attitude && (
                <AttitudeSelector
                  open={attitudeSelectorOpen}
                  selectedAttitude={area.attitude}
                  onSelectAttitude={handleAttitudeChange}
                  onClose={() => setAttitudeSelectorOpen(false)}
                  onOpen={() => setAttitudeSelectorOpen(true)}
                  trigger={
                    <AttitudeChip
                      attitude={area.attitude}
                      onClick={() => setAttitudeSelectorOpen(true)}
                    />
                  }
                />
              )}

              {/* Tag Badges */}
              {area.tags && area.tags.length > 0 && (
                <TagBadges tags={area.tags} onRemoveTag={handleRemoveTag} />
              )}
            </div>

            {/* Emoji + Name Row */}
            <div className="flex items-baseline">
              {/* Emoji Picker */}
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xl flex-shrink-0 hover:bg-stone-100 dark:hover:bg-stone-800 rounded w-10 h-10 flex items-center justify-center transition-colors"
                    aria-label="Change emoji"
                  >
                    {area.emoji}
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

              {/* Area Name - Editable with tag extraction */}
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <TagAutocompleteInline
                    open={isTagAutocompleteOpen}
                    searchValue={currentTagSearch}
                    onSelectTag={(tag) =>
                      addTag(tag, editedName, area.tags || [])
                    }
                    onRemoveTag={handleRemoveTag}
                    onClose={() => setIsTagAutocompleteOpen(false)}
                    existingTags={area.tags || []}
                    maxSuggestions={5}
                    trigger={
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={editedName}
                        onChange={(e) =>
                          handleNameChangeWithTags(
                            e.target.value,
                            editedName,
                            area.tags || []
                          )
                        }
                        onBlur={() => {
                          handleNameBlurWithTags(editedName, area.tags || []);
                          handleSaveName();
                        }}
                        autoFocus
                        className="w-full px-2 py-1 text-xl font-medium bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-600 rounded focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
                      />
                    }
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="w-full text-left px-2 py-1 text-xl font-medium text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
                  >
                    {area.name}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Always expanded for now */}
      {/* Actions Row - ColorPicker and Archive */}
      <div className="group px-4 py-2 flex items-center justify-between bg-stone-50 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700">
        {/* Color Picker - Always visible on small screens, hover only on lg+ */}
        <div className="flex items-center justify-center opacity-100 transition-opacity">
          <ColorPicker value={area.color} onChange={handleColorChange} />
        </div>

        {/* Archive Button - Only show for non-default areas */}
        {!area.isDefault ? (
          <button
            type="button"
            onClick={() => onArchiveArea(area.id)}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors opacity-100"
            title="Archive area"
          >
            <Archive className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
          </button>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* Habits List */}
      <div className="flex-1 p-4 overflow-y-auto shadow-inner mb-2">
        <PlanHabitsList
          habits={habits}
          areaId={area.id}
          areaColor={area.color}
          onEditHabit={onEditHabit}
          onArchiveHabit={onArchiveHabit}
        />
      </div>

      {/* Quick Habit Input */}
      <div className="flex-shrink-0">
        <HabitQuickInput
          areaId={area.id}
          areaColor={area.color}
          onCreateHabit={onQuickCreateHabit}
        />
      </div>
    </div>
  );
}
