"use client";

import { use$ } from "@legendapp/state/react";
import { Clock, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { AreaSelector } from "@/components/AreaSelector";
import { AttitudeSelector } from "@/components/AttitudeSelector";
import { PhaseSelector } from "@/components/PhaseSelector";
import { RhythmSelector } from "@/components/RhythmSelector";
import { TaggedNameInput } from "@/components/TaggedNameInput";
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
import type {
  CreateHabitProps,
  UpdateHabitProps,
} from "@/domain/entities/Habit";
import {
  type Attitude,
  getAttitudeIcon,
  getAttitudeLabel,
} from "@/domain/value-objects/Attitude";
import type { Phase } from "@/domain/value-objects/Phase";
import { PhaseIcon } from "@/domain/value-objects/phaseStyles";
import { useTaggedNameField } from "@/hooks/useTaggedNameField";
import { areas$, phaseConfigs$ } from "@/infrastructure/state/store";
import {
  closeHabitForm,
  habitFormState$,
  lastUsedAreaId$,
} from "@/infrastructure/state/ui-store";
import {
  extractLeadingEmoji,
  suggestEmojiForAreaName,
} from "@/lib/emoji-utils";

interface HabitFormDialogProps {
  /** Called when user saves the habit (create or update) */
  onSave: (props: CreateHabitProps | UpdateHabitProps) => void;
  /** For edit mode: called when user confirms deletion */
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
export function HabitFormDialog({ onSave, onDelete }: HabitFormDialogProps) {
  // Read state from UI store - single source of truth
  const formState = use$(habitFormState$);
  const {
    open,
    mode,
    name,
    areaId,
    emoji,
    attitude,
    phase,
    tags,
    rhythm,
    editingHabitId,
  } = formState;

  // Local UI state only (not form data)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [areaSelectorOpen, setAreaSelectorOpen] = useState(false);
  const [attitudeSelectorOpen, setAttitudeSelectorOpen] = useState(false);
  const [phaseSelectorOpen, setPhaseSelectorOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [manualEmojiOverride, setManualEmojiOverride] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const areaSelectorRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastProcessedName = useRef<string>("");

  const allAreas = use$(areas$);
  const allPhaseConfigs = use$(phaseConfigs$);
  const selectedArea = areaId ? allAreas[areaId] : null;

  // Get phase config for display
  const selectedPhaseConfig = phase
    ? Object.values(allPhaseConfigs).find((pc) => pc.phase === phase)
    : null;

  // Tagged name field
  const taggedField = useTaggedNameField(name, tags);

  // Sync form state TO tagged field when dialog opens or editing habit changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!open) return;

    // Reinitialize field when opening dialog (create or edit mode)
    taggedField.reinitialize(name, tags);
  }, [open, editingHabitId]);

  // Sync typed text FROM tagged field back to form store (for emoji auto-suggestion)
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!open) return;
    habitFormState$.name.set(taggedField.displayValue);
  }, [taggedField.displayValue, open]);

  // Disable form hotkeys when area selector or emoji picker is open
  const formHotkeysEnabled =
    !areaSelectorOpen &&
    !emojiPickerOpen &&
    !taggedField.isAutocompleteOpen &&
    !attitudeSelectorOpen &&
    !phaseSelectorOpen;

  // Reset local UI state when dialog opens
  useEffect(() => {
    if (open) {
      setValidationError(null);
      setManualEmojiOverride(false);
      lastProcessedName.current = "";
      setAreaSelectorOpen(false);
      setEmojiPickerOpen(false);
      setAttitudeSelectorOpen(false);
      setPhaseSelectorOpen(false);
    }
  }, [open]);

  // Auto-focus name input when dialog opens
  useEffect(() => {
    if (open && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [open]);

  // Extract leading emoji from name and auto-suggest emoji
  useEffect(() => {
    if (manualEmojiOverride) return;
    if (name === lastProcessedName.current) return;

    lastProcessedName.current = name;

    const { emoji: leadingEmoji, remainingText } = extractLeadingEmoji(name);

    if (leadingEmoji && remainingText.length > 0) {
      habitFormState$.emoji.set(leadingEmoji);
      // Update both form store and tagged field to keep them in sync
      habitFormState$.name.set(remainingText);
      taggedField.reinitialize(remainingText, taggedField.tags);
      return;
    }

    // Auto-suggest emoji for new habits
    if (mode === "create" && !leadingEmoji && name.trim().length >= 2) {
      const suggested = suggestEmojiForAreaName(name);
      if (suggested) {
        habitFormState$.emoji.set(suggested);
      }
    }
  }, [name, mode, manualEmojiOverride, taggedField]);

  // Handlers
  const handleSave = () => {
    // Extract any remaining #tags and get fresh values (not stale React state)
    const { name: cleanName, tags: finalTags } = taggedField.extractRemainingTags();

    if (!cleanName) {
      setValidationError("Habit name cannot be empty");
      return;
    }

    if (!areaId) {
      setValidationError("Please select an area");
      return;
    }

    // Persist the selected area ID for future use
    lastUsedAreaId$.set(areaId);

    onSave({
      name: cleanName,
      areaId,
      emoji: emoji || "⭐",
      attitude,
      phase,
      tags: finalTags,
      rhythm: rhythm ?? undefined,
    });

    closeHabitForm();
  };

  const handleEmojiSelect = (selectedEmoji: string) => {
    habitFormState$.emoji.set(selectedEmoji);
    setEmojiPickerOpen(false);
    setManualEmojiOverride(true);
  };

  const handleSelectArea = (selectedAreaId: string) => {
    habitFormState$.areaId.set(selectedAreaId);
    lastUsedAreaId$.set(selectedAreaId);
  };

  // Prevent closing on escape when inputs have focus or data exists
  const preventCloseOnEscape = (e: KeyboardEvent) => {
    // Check if the target was an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      // Blur the input naturally, but still prevent dialog close
      target.blur();
      // Always prevent dialog from closing
      e.preventDefault();
    } else if (name.trim().length > 0) {
      // If name has content, prevent closing to avoid losing data
      e.preventDefault();
    }
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
    "a",
    (e) => {
      e.preventDefault();
      setAreaSelectorOpen(true);
    },
    { enabled: formHotkeysEnabled && open }
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeHabitForm()}>
      <DialogContent
        ref={dialogRef}
        className="p-0 gap-0 max-w-2xl"
        onEscapeKeyDown={preventCloseOnEscape}
      >
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

              {/* Name Input with Tags */}
              <TaggedNameInput
                field={taggedField}
                placeholder="Habit name..."
                autoFocus={true}
                className="flex-1 text-4xl font-bold"
                collisionBoundary={dialogRef.current}
                maxSuggestions={5}
                showTags={true}
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

          {/* Selected values shown as full-width buttons */}
          <div className="flex flex-col gap-3">
            {/* Attitude Selector - Show as button if selected */}
            {attitude && (
              <AttitudeSelector
                open={attitudeSelectorOpen}
                selectedAttitude={attitude}
                onSelectAttitude={(newAttitude) =>
                  habitFormState$.attitude.set(newAttitude)
                }
                onClose={() => setAttitudeSelectorOpen(false)}
                onOpen={() => setAttitudeSelectorOpen(true)}
                collisionBoundary={dialogRef.current}
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-2 px-3 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 w-full"
                  >
                    <span className="text-base flex-shrink-0">
                      {getAttitudeIcon(attitude)}
                    </span>
                    <span className="font-mono text-sm flex-1 text-left truncate">
                      {getAttitudeLabel(attitude)}
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex-shrink-0">
                      T
                    </kbd>
                  </button>
                }
              />
            )}

            {/* Phase Selector - Show as button if selected */}
            {phase && (
              <PhaseSelector
                open={phaseSelectorOpen}
                selectedPhase={phase}
                onSelectPhase={(newPhase) =>
                  habitFormState$.phase.set(newPhase)
                }
                onClose={() => setPhaseSelectorOpen(false)}
                onOpen={() => setPhaseSelectorOpen(true)}
                collisionBoundary={dialogRef.current}
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-2 px-3 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 w-full"
                  >
                    <PhaseIcon
                      phase={phase}
                      className="w-4 h-4 text-stone-400 dark:text-stone-500 flex-shrink-0"
                    />
                    <span className="font-mono text-sm flex-1 text-left truncate">
                      {selectedPhaseConfig?.label}
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex-shrink-0">
                      P
                    </kbd>
                  </button>
                }
              />
            )}
          </div>

          {/* Subtle wrapped row for empty selectors */}
          <div className="flex flex-wrap gap-3 items-center mt-8 mb-2">
            {/* Attitude - subtle label if not selected */}
            {!attitude && (
              <AttitudeSelector
                open={attitudeSelectorOpen}
                selectedAttitude={attitude}
                onSelectAttitude={(newAttitude) =>
                  habitFormState$.attitude.set(newAttitude)
                }
                onClose={() => setAttitudeSelectorOpen(false)}
                onOpen={() => setAttitudeSelectorOpen(true)}
                collisionBoundary={dialogRef.current}
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="text-xs font-mono">no attitude</span>
                  </button>
                }
              />
            )}

            {/* Phase - subtle label if not selected */}
            {!phase && (
              <PhaseSelector
                open={phaseSelectorOpen}
                selectedPhase={phase}
                onSelectPhase={(newPhase) =>
                  habitFormState$.phase.set(newPhase)
                }
                onClose={() => setPhaseSelectorOpen(false)}
                onOpen={() => setPhaseSelectorOpen(true)}
                collisionBoundary={dialogRef.current}
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="text-xs font-mono">no phase</span>
                  </button>
                }
              />
            )}
          </div>

          {/* Rhythm selector */}
          <div className="mt-4">
            <RhythmSelector
              value={rhythm}
              onChange={(newRhythm) => habitFormState$.rhythm.set(newRhythm)}
            />
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
                onClick={closeHabitForm}
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
