/** biome-ignore-all lint/a11y/useButtonType: <explanation> */
"use client";

import { use$, useSelector } from "@legendapp/state/react";
import { Calendar, Clock, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { AreaSelector } from "@/components/AreaSelector";
import { HorizonSelector } from "@/components/HorizonSelector";
import { PhaseSelector } from "@/components/PhaseSelector";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Horizon, validateMomentName } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import {
  activeAreas$,
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
    createMore?: boolean
  ) => void;
  /** For edit mode: called when user confirms deletion */
  onDelete?: () => void;
}

/**
 * MomentFormDialog - Dialog component for creating/editing moments
 *
 * Features:
 * - Name input with validation (1-3 words)
 * - Area selection: A (opens selector), Tab (cycles areas), 1-9 (quick select)
 * - Phase selection: P (opens selector), M/A/E (Morning/Afternoon/Evening)
 * - Cycle selection: C (opens selector), 1-7 (quick select)
 * - Enter to save, Escape to cancel
 * - Optional "Create more" toggle for batch creation
 *
 * Keyboard Shortcuts:
 * - A: Open area selector
 * - P: Open phase selector
 * - C: Open cycle selector
 * - Tab: Cycle through areas (when selector closed)
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

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset local UI state when dialog opens
  useEffect(() => {
    if (!open) return;

    setCreateMore(false);
    setShowDeleteConfirm(false);
    setIsAreaSelectorOpen(false);
    setIsHorizonSelectorOpen(false);
    setIsPhaseSelectorOpen(false);
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
    !isAreaSelectorOpen && !isHorizonSelectorOpen && !isPhaseSelectorOpen;

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

  // Tab to cycle areas
  useHotkeys(
    "tab",
    (e) => {
      e.preventDefault();
      if (!areasList.length) {
        return;
      }
      const currentIndex = areasList.findIndex((a) => a.id === selectedAreaId);
      const nextIndex = (currentIndex + 1) % areasList.length;
      const nextArea = areasList[nextIndex];
      // Persist the selection
      if (nextArea) {
        momentFormState$.areaId.set(nextArea.id);
        lastUsedAreaId$.set(nextArea.id);
      }
    },
    { enabled: formHotkeysEnabled && open }
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

  const handleSave = () => {
    const validation = validateMomentName(name);
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

      // Call onSave with cycle, phase, and createMore flag
      onSave(name.trim(), selectedArea.id, horizon, phase, shouldCreateMore);

      // If "Create more" is enabled, reset form immediately
      // Parent will keep modal open, but preserve area and phase selection
      if (shouldCreateMore) {
        momentFormState$.name.set("");
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

  const validation = validateMomentName(name);
  const hasArea = selectedArea !== undefined;
  const canSave = validation.valid && hasArea;

  // Get phase config for display
  const selectedPhaseConfig = phase
    ? Object.values(allPhaseConfigs).find((pc) => pc.phase === phase)
    : null;

  // Format cycle label for display
  const formatCycleLabel = (c: Horizon | null): string => {
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
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-sm font-medium text-text-secondary">
            {mode === "create" ? "New moment" : "Edit moment"}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-6 flex-1 overflow-y-auto">
          {/* Name Input - Prominent */}
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => momentFormState$.name.set(e.target.value)}
            className="w-full text-4xl font-bold bg-transparent outline-none text-text-primary placeholder:text-text-tertiary mb-8"
            placeholder="Moment name..."
            aria-label="Moment name"
            aria-invalid={!validation.valid}
          />

          {/* Validation */}
          {!validation.valid && validation.error && name.trim().length > 0 && (
            <p
              className="text-sm text-red-500 dark:text-red-400 mb-6"
              role="alert"
            >
              {validation.error}
            </p>
          )}

          {/* Selectors Row - Only show when area is selected */}
          {hasArea && selectedArea ? (
            <div className="flex flex-col gap-3 mb-6">
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

              {/* Phase & Cycle Selectors - Side by side (hide horizon for allocated moments) */}
              <div className={cn("grid gap-3", isAllocated ? "grid-cols-1" : "grid-cols-2")}>
                {/* Phase Selector - Ghost with clock icon */}
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
                      className={cn(
                        "flex items-center gap-2 px-3 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 w-full"
                      )}
                    >
                      <Clock
                        className="w-4 h-4 text-stone-400 dark:text-stone-500 flex-shrink-0"
                        strokeWidth={1.5}
                      />
                      <span className="font-mono text-sm flex-1 text-left truncate">
                        {phase ? (
                          <>
                            {selectedPhaseConfig?.emoji}{" "}
                            {selectedPhaseConfig?.label}
                          </>
                        ) : (
                          <span className="text-stone-400 dark:text-stone-500">
                            no phase
                          </span>
                        )}
                      </span>
                      <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex-shrink-0">
                        P
                      </kbd>
                    </button>
                  }
                />

                {/* Cycle Selector - Ghost with calendar icon (hidden for allocated moments) */}
                {!isAllocated && (
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
                        className="flex items-center gap-2 px-3 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 w-full"
                      >
                        <Calendar
                          className="w-4 h-4 text-stone-400 dark:text-stone-500 flex-shrink-0"
                          strokeWidth={1.5}
                        />
                        <span className="font-mono text-sm flex-1 text-left truncate">
                          {formatCycleLabel(horizon)}
                        </span>
                        <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex-shrink-0">
                          C
                        </kbd>
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
                    type="button"
                    className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 transition-all text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-400 dark:hover:border-stone-500 flex items-center justify-center gap-2"
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
        <DialogFooter className="px-6 py-4 bg-surface-alt/50 border-t border-border flex-row items-center justify-between backdrop-blur-sm">
          {/* Left side: Create more checkbox OR Delete button */}
          {showCreateMore && mode === "create" ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createMore}
                onChange={(e) => setCreateMore(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface-alt text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-text-secondary">Create more</span>
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
                : "bg-border text-text-tertiary cursor-not-allowed"
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
