"use client";

import { use$ } from "@legendapp/state/react";
import { Clock, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { AreaSelector } from "@/components/AreaSelector";
import { AttitudeSelector } from "@/components/AttitudeSelector";
import { PhaseSelector } from "@/components/PhaseSelector";
import { TagAutocompleteInline } from "@/components/TagAutocompleteInline";
import { TagBadges } from "@/components/TagBadges";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { Attitude } from "@/domain/value-objects/Attitude";
import type { Phase } from "@/domain/value-objects/Phase";
import { PhaseIcon } from "@/domain/value-objects/phaseStyles";
import { useTagExtraction } from "@/hooks/useTagExtraction";
import { areas$, phaseConfigs$ } from "@/infrastructure/state/store";
import {
  extractLeadingEmoji,
  suggestEmojiForAreaName,
} from "@/lib/emoji-utils";

interface HabitFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  habitId?: string;
  initialName?: string;
  initialAreaId?: string;
  initialEmoji?: string;
  initialAttitude?: Attitude | null;
  initialPhase?: Phase | null;
  initialTags?: string[];
  onClose: () => void;
  onSave: (
    name: string,
    areaId: string,
    emoji: string,
    attitude: Attitude | null,
    phase: Phase | null,
    tags: string[]
  ) => void;
  onDelete?: () => void;
}

/**
 * HabitFormDialog - Dialog for creating/editing habits
 *
 * Matches MomentFormDialog UX:
 * - Large prominent name input (4xl font)
 * - Inline tag extraction from name (#tag)
 * - Area selection (A key)
 * - Emoji picker with auto-suggestion
 * - Enter to save, Escape to cancel
 */
export function HabitFormDialog({
  open,
  mode,
  habitId,
  initialName = "",
  initialAreaId = "",
  initialEmoji = "⭐",
  initialAttitude = null,
  initialPhase = null,
  initialTags = [],
  onClose,
  onSave,
  onDelete,
}: HabitFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [areaId, setAreaId] = useState(initialAreaId);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [attitude, setAttitude] = useState<Attitude | null>(initialAttitude);
  const [phase, setPhase] = useState<Phase | null>(initialPhase);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [areaSelectorOpen, setAreaSelectorOpen] = useState(false);
  const [attitudeSelectorOpen, setAttitudeSelectorOpen] = useState(false);
  const [phaseSelectorOpen, setPhaseSelectorOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const areaSelectorRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastProcessedName = useRef<string>("");
  const [manualEmojiOverride, setManualEmojiOverride] = useState(false);

  const allAreas = use$(areas$);
  const allPhaseConfigs = use$(phaseConfigs$);
  const selectedArea = areaId ? allAreas[areaId] : null;

  // Tag extraction hook
  const {
    isTagAutocompleteOpen,
    currentTagSearch,
    handleNameChange: handleNameChangeWithTags,
    handleNameBlur: handleNameBlurWithTags,
    addTag,
    extractRemainingTags,
    setIsTagAutocompleteOpen,
    setCurrentTagSearch,
  } = useTagExtraction({
    inputRef: nameInputRef,
    onTagsChange: setTags,
    onNameChange: setName,
  });

  // Disable form hotkeys when area selector or emoji picker is open
  const formHotkeysEnabled =
    !areaSelectorOpen &&
    !emojiPickerOpen &&
    !isTagAutocompleteOpen &&
    !attitudeSelectorOpen &&
    !phaseSelectorOpen;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setName(initialName);
      setAreaId(initialAreaId);
      setEmoji(initialEmoji);
      setAttitude(initialAttitude);
      setPhase(initialPhase);
      setTags(initialTags);
      setValidationError(null);
      setManualEmojiOverride(false);
      setIsTagAutocompleteOpen(false);
      setCurrentTagSearch("");
      lastProcessedName.current = "";
    }
  }, [
    open,
    initialName,
    initialAreaId,
    initialEmoji,
    initialAttitude,
    initialPhase,
    initialTags,
    setIsTagAutocompleteOpen,
    setCurrentTagSearch,
  ]);

  // Auto-focus name input when dialog opens
  useEffect(() => {
    if (open && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [open]);

  // Extract leading emoji from name
  useEffect(() => {
    if (manualEmojiOverride) return;
    if (name === lastProcessedName.current) return;

    lastProcessedName.current = name;

    const { emoji: leadingEmoji, remainingText } = extractLeadingEmoji(name);

    if (leadingEmoji && remainingText.length > 0) {
      setEmoji(leadingEmoji);
      setName(remainingText);
      return;
    }

    // Auto-suggest emoji for new habits
    if (mode === "create" && !leadingEmoji && name.trim().length >= 2) {
      const suggested = suggestEmojiForAreaName(name);
      if (suggested) {
        setEmoji(suggested);
      }
    }
  }, [name, mode, manualEmojiOverride]);

  // Handlers
  const handleSave = () => {
    // Extract any remaining #tags before validation
    extractRemainingTags(name, tags);

    // Get clean name after tag extraction
    const cleanName = name
      .replace(/#([a-z0-9-]+)/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanName) {
      setValidationError("Habit name cannot be empty");
      return;
    }

    if (!areaId) {
      setValidationError("Please select an area");
      return;
    }

    onSave(cleanName, areaId, emoji, attitude, phase, tags);
    handleClose();
  };

  const handleClose = () => {
    setIsTagAutocompleteOpen(false);
    setCurrentTagSearch("");
    onClose();
  };

  const handleEmojiSelect = (selectedEmoji: string) => {
    setEmoji(selectedEmoji);
    setEmojiPickerOpen(false);
    setManualEmojiOverride(true);
  };

  const handleSelectArea = (selectedAreaId: string) => {
    setAreaId(selectedAreaId);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Keyboard shortcuts
  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      handleSave();
    },
    { enableOnFormTags: true, enabled: formHotkeysEnabled && open }
  );

  useHotkeys(
    "escape",
    (e) => {
      e.preventDefault();
      handleClose();
    },
    { enableOnFormTags: true, enabled: formHotkeysEnabled && open }
  );

  useHotkeys(
    "a",
    (e) => {
      e.preventDefault();
      setAreaSelectorOpen(true);
    },
    { enabled: formHotkeysEnabled && open }
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent ref={dialogRef} className="p-0 gap-0 max-w-2xl">
        {/* Header */}
        <DialogHeader className="border-b border-stone-200 dark:border-stone-700">
          <DialogTitle className="text-sm font-medium text-stone-600 dark:text-stone-400">
            {mode === "create" ? "New habit" : "Edit habit"}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-6 flex-1 overflow-y-auto">
          {/* Name Input with Emoji - Prominent */}
          <div className="relative mb-6 w-full">
            <div className="flex items-baseline gap-3">
              {/* Emoji Picker */}
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-4xl flex-shrink-0 hover:bg-stone-100 dark:hover:bg-stone-800 rounded w-14 h-14 flex items-center justify-center transition-colors mt-1"
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

              {/* Name Input with Tag Autocomplete */}
              <TagAutocompleteInline
                open={isTagAutocompleteOpen}
                searchValue={currentTagSearch}
                onSelectTag={(tag) => addTag(tag, name, tags)}
                onRemoveTag={handleRemoveTag}
                onClose={() => setIsTagAutocompleteOpen(false)}
                existingTags={tags}
                maxSuggestions={5}
                collisionBoundary={dialogRef.current}
                trigger={
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) =>
                      handleNameChangeWithTags(e.target.value, name, tags)
                    }
                    onBlur={() => handleNameBlurWithTags(name, tags)}
                    autoFocus
                    className="flex-1 text-4xl font-bold bg-transparent outline-none text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
                    placeholder="Habit name..."
                    aria-label="Habit name"
                  />
                }
              />
            </div>

            {/* Validation Error */}
            {validationError && (
              <p
                className="text-sm text-red-500 dark:text-red-400 mt-2"
                role="alert"
              >
                {validationError}
              </p>
            )}

            {/* Tag Badges */}
            <div className="mt-3">
              <TagBadges tags={tags} onRemoveTag={handleRemoveTag} />
            </div>
          </div>

          {/* Area Selector */}
          {selectedArea && (
            <div className="mb-6">
              <label
                htmlFor="area-selector-trigger"
                className="block text-xs font-mono text-stone-500 dark:text-stone-400 mb-2"
              >
                Area
              </label>
              <AreaSelector
                open={areaSelectorOpen}
                selectedAreaId={areaId}
                onSelectArea={handleSelectArea}
                onClose={() => setAreaSelectorOpen(false)}
                onOpen={() => setAreaSelectorOpen(true)}
                collisionBoundary={dialogRef.current}
                trigger={
                  <button
                    ref={areaSelectorRef}
                    id="area-selector-trigger"
                    type="button"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-white hover:opacity-90 w-full"
                    style={{
                      backgroundColor: selectedArea.color,
                      borderColor: selectedArea.color,
                    }}
                  >
                    <span className="text-xl">{selectedArea.emoji}</span>
                    <span className="font-semibold flex-1 text-left">
                      {selectedArea.name}
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-white/20 text-white">
                      A
                    </kbd>
                  </button>
                }
              />
            </div>
          )}

          {/* Attitude & Phase Selectors */}
          <div className="flex flex-col gap-3 mb-6">
            {/* Attitude Selector */}
            <div>
              <label
                htmlFor="attitude-selector-trigger"
                className="block text-xs font-mono text-stone-500 dark:text-stone-400 mb-2"
              >
                Attitude
              </label>
              <AttitudeSelector
                open={attitudeSelectorOpen}
                selectedAttitude={attitude}
                onSelectAttitude={setAttitude}
                onClose={() => setAttitudeSelectorOpen(false)}
                onOpen={() => setAttitudeSelectorOpen(true)}
                collisionBoundary={dialogRef.current}
                trigger={
                  <button
                    id="attitude-selector-trigger"
                    type="button"
                    className="flex items-center gap-2 px-3 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 w-full"
                  >
                    <Clock className="w-4 h-4 text-stone-400 dark:text-stone-500 flex-shrink-0" />
                    <span className="font-mono text-sm flex-1 text-left truncate">
                      {attitude ? `${attitude}` : "No attitude"}
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex-shrink-0">
                      T
                    </kbd>
                  </button>
                }
              />
            </div>

            {/* Phase Selector */}
            <div>
              <label
                htmlFor="phase-selector-trigger"
                className="block text-xs font-mono text-stone-500 dark:text-stone-400 mb-2"
              >
                Default Phase
              </label>
              <PhaseSelector
                open={phaseSelectorOpen}
                selectedPhase={phase}
                onSelectPhase={setPhase}
                onClose={() => setPhaseSelectorOpen(false)}
                onOpen={() => setPhaseSelectorOpen(true)}
                collisionBoundary={dialogRef.current}
                trigger={
                  <button
                    id="phase-selector-trigger"
                    type="button"
                    className="flex items-center gap-2 px-3 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 w-full"
                  >
                    {phase ? (
                      <PhaseIcon
                        phase={phase}
                        className="w-4 h-4 text-stone-400 dark:text-stone-500 flex-shrink-0"
                      />
                    ) : (
                      <Clock className="w-4 h-4 text-stone-400 dark:text-stone-500 flex-shrink-0" />
                    )}
                    <span className="font-mono text-sm flex-1 text-left truncate">
                      {phase
                        ? Object.values(allPhaseConfigs).find(
                            (pc) => pc.phase === phase
                          )?.label
                        : "No phase"}
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex-shrink-0">
                      P
                    </kbd>
                  </button>
                }
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-stone-200 dark:border-stone-700 px-6 py-4">
          <div className="flex items-center justify-between w-full">
            {/* Delete Button (Edit mode only) */}
            {mode === "edit" && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-2 rounded-md text-xs font-mono text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Archive
              </button>
            )}

            <div className="flex gap-2 ml-auto">
              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg font-mono text-sm bg-stone-200 hover:bg-stone-300 text-stone-900 dark:bg-stone-700 dark:hover:bg-stone-600 dark:text-stone-100 transition-colors"
              >
                Cancel
              </button>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-lg font-mono text-sm bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-200 dark:hover:bg-stone-300 dark:text-stone-900 transition-colors"
              >
                {mode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
