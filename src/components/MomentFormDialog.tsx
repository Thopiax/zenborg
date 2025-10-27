/** biome-ignore-all lint/a11y/useButtonType: <explanation> */
"use client";

import { use$, useSelector } from "@legendapp/state/react";
import { Calendar, Clock, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { AreaSelector } from "@/components/AreaSelector";
import { HorizonSelector } from "@/components/HorizonSelector";
import { PhaseSelector } from "@/components/PhaseSelector";
import { TagAutocomplete } from "@/components/TagAutocomplete";
import { TagBadges } from "@/components/TagBadges";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type Horizon,
  normalizeTag,
  validateMomentName,
} from "@/domain/entities/Moment";
import type { Attitude, CustomMetric } from "@/domain/value-objects/Attitude";
import type { Phase } from "@/domain/value-objects/Phase";
import { PhaseIcon } from "@/domain/value-objects/phaseStyles";
import {
  activeAreas$,
  allTags$,
  areas$,
  phaseConfigs$,
} from "@/infrastructure/state/store";
import {
  closeMomentForm,
  lastUsedAreaId$,
  momentFormState$,
} from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

interface MomentFormDialogProps {
  onSave: (
    name: string,
    areaId: string,
    horizon: Horizon | null,
    phase: Phase | null,
    createMore?: boolean,
    attitude?: Attitude | null,
    tags?: string[],
    customMetric?: CustomMetric
  ) => void;
  /** For edit mode: called when user confirms deletion */
  onDelete?: () => void;
}

/**
 * MomentFormDialog - Dialog component for creating/editing moments
 *
 * Features:
 * - Name input with validation (1-3 words)
 * - Area selection: A (opens selector)
 * - Phase selection: P (opens selector)
 * - Horizon selection: H (opens selector, hidden for allocated moments)
 * - Enter to save, Escape to cancel
 * - Optional "Create more" toggle for batch creation
 *
 * Keyboard Navigation:
 * - Tab: Cycle forward through fields (input → area → phase → horizon)
 * - Shift+Tab: Cycle backward through fields
 * - Up/Down arrows: Navigate between fields
 * - A: Open area selector
 * - P: Open phase selector
 * - H: Open horizon selector
 * - Enter: Save moment
 */
export function MomentFormDialog({ onSave, onDelete }: MomentFormDialogProps) {
  // Read state from UI store - now using the store as single source of truth
  const formState = use$(momentFormState$);
  const {
    open,
    mode,
    name,
    areaId: selectedAreaId,
    horizon,
    phase,
    showCreateMore,
    isAllocated,
    attitude,
    tags,
    customMetric,
  } = formState;

  // Use activeAreas$ which filters out archived areas and sorts by order
  const areasList = useSelector(() => activeAreas$.get());

  const allPhaseConfigs = use$(phaseConfigs$);

  // Local UI state (not form data)
  const [isAreaSelectorOpen, setIsAreaSelectorOpen] = useState(false);
  const [isHorizonSelectorOpen, setIsHorizonSelectorOpen] = useState(false);
  const [isPhaseSelectorOpen, setIsPhaseSelectorOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Tag autocomplete state
  const [isTagAutocompleteOpen, setIsTagAutocompleteOpen] = useState(false);
  const [currentTagSearch, setCurrentTagSearch] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const areaSelectorRef = useRef<HTMLButtonElement>(null);
  const phaseSelectorRef = useRef<HTMLButtonElement>(null);
  const horizonSelectorRef = useRef<HTMLButtonElement>(null);

  // Reset local UI state when dialog opens
  useEffect(() => {
    if (!open) return;

    setCreateMore(false);
    setShowDeleteConfirm(false);
    setIsAreaSelectorOpen(false);
    setIsHorizonSelectorOpen(false);
    setIsPhaseSelectorOpen(false);
    setIsTagAutocompleteOpen(false);
    setCurrentTagSearch("");
  }, [open]);

  // Auto-focus and select input
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      if (mode === "edit") {
        inputRef.current.select();
      }
    }
  }, [mode, open]);

  // Disable form hotkeys when any selector is open to avoid conflicts
  const formHotkeysEnabled =
    !isAreaSelectorOpen &&
    !isHorizonSelectorOpen &&
    !isPhaseSelectorOpen &&
    !isTagAutocompleteOpen;

  // Helper: Extract current tag being typed (if any)
  const extractCurrentTag = (
    text: string,
    cursorPos: number
  ): string | null => {
    // Find the last # before cursor position
    const beforeCursor = text.slice(0, cursorPos);
    const lastHashIndex = beforeCursor.lastIndexOf("#");

    if (lastHashIndex === -1) return null;

    // Extract text after # until cursor
    const afterHash = beforeCursor.slice(lastHashIndex + 1);

    // Check if there's a space after # (which would end the tag)
    if (afterHash.includes(" ")) return null;

    return afterHash;
  };

  // Helper: Add tag from autocomplete or manual typing
  const addTag = (tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized || tags?.includes(normalized)) return;

    // Add to tags array
    momentFormState$.tags.set([...(tags || []), normalized]);

    // Remove #tag from name input
    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || 0;
    const beforeCursor = name.slice(0, cursorPos);
    const afterCursor = name.slice(cursorPos);

    // Find and remove the #tag pattern
    const lastHashIndex = beforeCursor.lastIndexOf("#");
    if (lastHashIndex !== -1) {
      const beforeTag = beforeCursor.slice(0, lastHashIndex);
      const newValue = (beforeTag + afterCursor).replace(/\s+/g, " ").trim();
      momentFormState$.name.set(newValue);

      // Set cursor position after removal
      setTimeout(() => {
        input.setSelectionRange(beforeTag.length, beforeTag.length);
        input.focus();
      }, 0);
    }

    // Close autocomplete
    setIsTagAutocompleteOpen(false);
    setCurrentTagSearch("");
  };

  // Helper: Remove tag from tags array
  const removeTag = (tagToRemove: string) => {
    const updatedTags = (tags || []).filter((t) => t !== tagToRemove);
    momentFormState$.tags.set(updatedTags);
  };

  // Helper: Check if user just finished typing a tag (space/comma after #tag)
  const checkForCompletedTag = (text: string, cursorPos: number) => {
    const beforeCursor = text.slice(0, cursorPos);

    // Check if we just typed space or comma after a tag
    const lastChar = beforeCursor[beforeCursor.length - 1];
    if (lastChar !== " " && lastChar !== ",") return;

    // Look for #tag pattern before the space/comma
    const tagMatch = beforeCursor.match(/#([a-z0-9-]+)\s*$/);
    if (tagMatch) {
      const tag = tagMatch[1];
      addTag(tag);
    }
  };

  const handleNameBlur = () => {
    // On blur, close tag autocomplete
    setIsTagAutocompleteOpen(false);

    // Check for any tags in the name to extract
    extractRemainingTags();
  };

  // Handle name input change - detect tags for autocomplete and extraction
  const handleNameChange = (newValue: string) => {
    const prevValue = name;
    momentFormState$.name.set(newValue);

    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || 0;

    // Check if user completed a tag (typed space/comma after #tag)
    if (newValue.length > prevValue.length) {
      checkForCompletedTag(newValue, cursorPos);
    }

    // Check for active tag being typed (for autocomplete)
    const currentTag = extractCurrentTag(newValue, cursorPos);

    if (currentTag !== null && currentTag.length > 0) {
      // User is typing a tag - set search value
      setCurrentTagSearch(currentTag);

      // Only open autocomplete if there are matching tags
      const allExistingTags = allTags$.peek();
      const hasMatches = allExistingTags.some((tag) =>
        tag.toLowerCase().includes(currentTag.toLowerCase())
      );
      setIsTagAutocompleteOpen(hasMatches);
    } else {
      // Not typing a tag
      setIsTagAutocompleteOpen(false);
      setCurrentTagSearch("");
    }
  };

  // A - open area selector
  useHotkeys(
    "a",
    (e) => {
      e.preventDefault();
      setIsAreaSelectorOpen(true);
    },
    { enabled: formHotkeysEnabled && open }
  );

  // H - open horizon selector (disabled for allocated moments)
  useHotkeys(
    "h",
    (e) => {
      e.preventDefault();
      setIsHorizonSelectorOpen(true);
    },
    { enabled: formHotkeysEnabled && open && !isAllocated }
  );

  // P - open phase selector
  useHotkeys(
    "p",
    (e) => {
      e.preventDefault();
      setIsPhaseSelectorOpen(true);
    },
    { enabled: formHotkeysEnabled && open }
  );

  // Get focusable elements in order
  const getFocusableElements = (): HTMLElement[] => {
    const elements: HTMLElement[] = [];
    if (inputRef.current) elements.push(inputRef.current);
    if (areaSelectorRef.current) elements.push(areaSelectorRef.current);
    if (phaseSelectorRef.current) elements.push(phaseSelectorRef.current);
    // Only include horizon selector if moment is not allocated
    if (horizonSelectorRef.current && !isAllocated) {
      elements.push(horizonSelectorRef.current);
    }
    return elements;
  };

  // Tab to cycle through form fields (input → area → phase → horizon)
  useHotkeys(
    "tab",
    (e) => {
      e.preventDefault();
      const focusable = getFocusableElements();
      const currentIndex = focusable.findIndex(
        (el) => el === document.activeElement
      );
      const nextIndex = (currentIndex + 1) % focusable.length;
      focusable[nextIndex]?.focus();
    },
    { enabled: formHotkeysEnabled && open, enableOnFormTags: true }
  );

  // Shift+Tab to cycle backwards
  useHotkeys(
    "shift+tab",
    (e) => {
      e.preventDefault();
      const focusable = getFocusableElements();
      const currentIndex = focusable.findIndex(
        (el) => el === document.activeElement
      );
      const prevIndex =
        currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      focusable[prevIndex]?.focus();
    },
    { enabled: formHotkeysEnabled && open, enableOnFormTags: true }
  );

  // Down arrow to move to next field
  useHotkeys(
    "down",
    (e) => {
      e.preventDefault();
      const focusable = getFocusableElements();
      const currentIndex = focusable.findIndex(
        (el) => el === document.activeElement
      );
      const nextIndex = (currentIndex + 1) % focusable.length;
      focusable[nextIndex]?.focus();
    },
    { enabled: formHotkeysEnabled && open, enableOnFormTags: true }
  );

  // Up arrow to move to previous field
  useHotkeys(
    "up",
    (e) => {
      e.preventDefault();
      const focusable = getFocusableElements();
      const currentIndex = focusable.findIndex(
        (el) => el === document.activeElement
      );
      const prevIndex =
        currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      focusable[prevIndex]?.focus();
    },
    { enabled: formHotkeysEnabled && open, enableOnFormTags: true }
  );

  // Enter to save
  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      handleSave();
    },
    { enableOnFormTags: true, enabled: formHotkeysEnabled && open }
  );

  // Helper: Extract any remaining #tags from name before saving
  const extractRemainingTags = () => {
    const tagRegex = /#([a-z0-9-]+)/g;
    const extractedTags: string[] = [];

    let match: RegExpExecArray | null = tagRegex.exec(name);
    while (match !== null) {
      const tag = normalizeTag(match[1]);
      if (tag && !(tags || []).includes(tag) && !extractedTags.includes(tag)) {
        extractedTags.push(tag);
      }
      match = tagRegex.exec(name);
    }

    // If we found tags, add them and clean the name
    if (extractedTags.length > 0) {
      momentFormState$.tags.set([...(tags || []), ...extractedTags]);
      const cleanName = name.replace(tagRegex, "").replace(/\s+/g, " ").trim();
      momentFormState$.name.set(cleanName);
    }
  };

  const handleSave = () => {
    // Extract any remaining #tags from name before validation
    extractRemainingTags();

    // Get the clean name after tag extraction
    const cleanName = name
      .replace(/#([a-z0-9-]+)/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const validation = validateMomentName(cleanName);
    const selectedArea =
      areasList.find((area) => area.id === selectedAreaId) || areasList[0];

    // Area is required - cannot save without an area
    if (!selectedArea) {
      return;
    }

    if (validation.valid) {
      // Persist the selected area ID for future use
      lastUsedAreaId$.set(selectedArea.id);

      // If "Create more" is enabled, pass it to parent
      const shouldCreateMore = mode === "create" && createMore;

      // Call onSave with clean name and all tags
      onSave(
        cleanName,
        selectedArea.id,
        horizon,
        phase,
        shouldCreateMore,
        attitude,
        tags || [],
        customMetric
      );

      // If "Create more" is enabled, reset form immediately
      // Parent will keep modal open, but preserve area and phase selection
      if (shouldCreateMore) {
        momentFormState$.name.set("");
        momentFormState$.tags.set([]);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm && onDelete) {
      onDelete();
    } else {
      setShowDeleteConfirm(true);
      // Reset confirmation after 3 seconds
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  // Use useSelector to reactively get the selected area
  const selectedArea = useSelector(() =>
    selectedAreaId ? areas$[selectedAreaId].get() : undefined
  );

  // Validate name
  const validation = validateMomentName(name);
  const hasArea = selectedArea !== undefined;
  const canSave = validation.valid && hasArea;

  // Get phase config for display
  const selectedPhaseConfig = phase
    ? Object.values(allPhaseConfigs).find((pc) => pc.phase === phase)
    : null;

  // Format horizon label for display
  const formatHorizonLabel = (c: Horizon | null): string => {
    if (!c) return "later";
    const labels: Record<Horizon, string> = {
      "this-week": "this week",
      "next-week": "next week",
      "this-month": "this month",
      later: "later",
    };
    return labels[c];
  };

  const preventCloseOnEscape = (e: KeyboardEvent) => {
    // Check if the target was an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      // Blur the input naturally, but still prevent dialog close
      target.blur();
      // Always prevent dialog from closing
      e.preventDefault();
    } else if (name.trim().length > 0) {
      // If name is empty, prevent closing to avoid losing data
      e.preventDefault();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeMomentForm()}>
      <DialogContent
        ref={dialogRef}
        className="p-0 gap-0 max-w-2xl"
        onEscapeKeyDown={preventCloseOnEscape}
      >
        {/* Header */}
        <DialogHeader className="border-b border-stone-200 dark:border-stone-700">
          <DialogTitle className="text-sm font-medium text-stone-600 dark:text-stone-400">
            {mode === "create" ? "New moment" : "Edit moment"}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-6 flex-1 overflow-y-auto">
          {/* Name Input - Prominent */}
          <div className="relative mb-6 w-full">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full text-4xl font-bold bg-transparent outline-none text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
              placeholder="Moment name..."
              aria-label="Moment name"
              onBlur={handleNameBlur}
              aria-invalid={!validation.valid}
            />

            {/* Validation */}
            {!validation.valid &&
              validation.error &&
              name.trim().length > 0 && (
                <p
                  className="text-sm text-red-500 dark:text-red-400 mb-6"
                  role="alert"
                >
                  {validation.error}
                </p>
              )}

            {/* Tag Autocomplete - Shows below entire input */}
            {/* {isTagAutocompleteOpen && (
              <TagAutocomplete
                open={isTagAutocompleteOpen}
                searchValue={currentTagSearch}
                onSelectTag={addTag}
                onClose={() => {
                  setIsTagAutocompleteOpen(false);
                  setCurrentTagSearch("");
                }}
                existingTags={tags || []}
                collisionBoundary={dialogRef.current}
                trigger={<div className="w-full" />}
              />
            )} */}

            {/* Tag Badges */}
            <TagBadges
              tags={tags || []}
              onRemoveTag={removeTag}
              className="mt-3"
            />
          </div>

          {/* Selectors Row - Only show when area is selected */}
          {hasArea && selectedArea ? (
            <div className="flex flex-col gap-3">
              {/* Area Selector - Colored */}
              <AreaSelector
                open={isAreaSelectorOpen}
                selectedAreaId={selectedArea.id}
                onSelectArea={(areaId) => {
                  // Set the area ID immediately - it might be newly created
                  momentFormState$.areaId.set(areaId);
                  lastUsedAreaId$.set(areaId);
                }}
                onClose={() => setIsAreaSelectorOpen(false)}
                onOpen={() => setIsAreaSelectorOpen(true)}
                collisionBoundary={dialogRef.current}
                trigger={
                  <button
                    ref={areaSelectorRef}
                    type="button"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-white hover:opacity-90"
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

              {/* Selected values shown as full-width buttons */}
              <div className="flex flex-col gap-3">
                {/* Phase Selector - Show as button if selected */}
                {phase && (
                  <PhaseSelector
                    open={isPhaseSelectorOpen}
                    selectedPhase={phase}
                    onSelectPhase={(newPhase) => {
                      momentFormState$.phase.set(newPhase);
                    }}
                    onClose={() => setIsPhaseSelectorOpen(false)}
                    onOpen={() => setIsPhaseSelectorOpen(true)}
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

                {/* Horizon Selector - Show as button if selected (hide for allocated moments) */}
                {!isAllocated && horizon && (
                  <HorizonSelector
                    open={isHorizonSelectorOpen}
                    selectedHorizon={horizon}
                    onSelectHorizon={(newHorizon) => {
                      momentFormState$.horizon.set(newHorizon);
                    }}
                    onClose={() => setIsHorizonSelectorOpen(false)}
                    onOpen={() => setIsHorizonSelectorOpen(true)}
                    collisionBoundary={dialogRef.current}
                    trigger={
                      <button
                        ref={horizonSelectorRef}
                        type="button"
                        className="flex items-center gap-2 px-3 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 w-full"
                      >
                        <Calendar
                          className="w-4 h-4 text-stone-400 dark:text-stone-500 flex-shrink-0"
                          strokeWidth={1.5}
                        />
                        <span className="font-mono text-sm flex-1 text-left truncate">
                          {formatHorizonLabel(horizon)}
                        </span>
                        <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex-shrink-0">
                          H
                        </kbd>
                      </button>
                    }
                  />
                )}
              </div>

              {/* Subtle wrapped row for empty selectors */}
              <div className="flex flex-wrap gap-3 items-center mt-8 mb-2">
                {/* Phase - subtle label if not selected */}
                {!phase && (
                  <PhaseSelector
                    open={isPhaseSelectorOpen}
                    selectedPhase={phase}
                    onSelectPhase={(newPhase) => {
                      momentFormState$.phase.set(newPhase);
                    }}
                    onClose={() => setIsPhaseSelectorOpen(false)}
                    onOpen={() => setIsPhaseSelectorOpen(true)}
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

                {/* Horizon - subtle label if not selected (hide for allocated moments) */}
                {!isAllocated && !horizon && (
                  <HorizonSelector
                    open={isHorizonSelectorOpen}
                    selectedHorizon={horizon}
                    onSelectHorizon={(newHorizon) => {
                      momentFormState$.horizon.set(newHorizon);
                    }}
                    onClose={() => setIsHorizonSelectorOpen(false)}
                    onOpen={() => setIsHorizonSelectorOpen(true)}
                    collisionBoundary={dialogRef.current}
                    trigger={
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span className="text-xs font-mono">later</span>
                      </button>
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <AreaSelector
                open={isAreaSelectorOpen}
                selectedAreaId=""
                onSelectArea={(areaId) => {
                  // Set the area ID immediately - it might be newly created
                  momentFormState$.areaId.set(areaId);
                  lastUsedAreaId$.set(areaId);
                }}
                onClose={() => setIsAreaSelectorOpen(false)}
                onOpen={() => setIsAreaSelectorOpen(true)}
                collisionBoundary={dialogRef.current}
                trigger={
                  <button
                    ref={areaSelectorRef}
                    type="button"
                    className="w-full px-4 py-3 rounded-lg border-2 border-stone-300 dark:border-stone-600 transition-all text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-400 dark:hover:border-stone-500 flex items-center justify-center gap-2"
                  >
                    <span className="font-medium">Add area</span>
                    <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800">
                      A
                    </kbd>
                  </button>
                }
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex flex-row items-center justify-end gap-2">
          {/* Left side: Create more checkbox OR Delete button */}
          {showCreateMore && mode === "create" ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createMore}
                onChange={(e) => setCreateMore(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 focus:ring-offset-0"
              />
              <span className="text-sm text-stone-600 dark:text-stone-400">
                Create more
              </span>
            </label>
          ) : mode === "edit" && onDelete ? (
            <button
              onClick={handleDelete}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                showDeleteConfirm
                  ? "bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700"
                  : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">
                {showDeleteConfirm ? "Confirm delete?" : "Delete"}
              </span>
            </button>
          ) : (
            <div />
          )}

          {/* Right side: Save button */}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "px-5 py-2 rounded-lg font-medium transition-all text-white",
              canSave
                ? "hover:opacity-90 active:scale-95"
                : "bg-stone-300 dark:bg-stone-700 text-stone-500 dark:text-stone-400 cursor-not-allowed"
            )}
            style={
              canSave && selectedArea
                ? {
                    backgroundColor: selectedArea.color,
                  }
                : undefined
            }
          >
            {mode === "create" ? "Create moment" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
