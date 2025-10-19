/** biome-ignore-all lint/a11y/useButtonType: <explanation> */
"use client";

import { use$ } from "@legendapp/state/react";
import { Calendar, Clock, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { AreaSelector } from "@/components/AreaSelector";
import { CycleSelector } from "@/components/CycleSelector";
import { PhaseSelector } from "@/components/PhaseSelector";
import type { Area } from "@/domain/entities/Area";
import { type Cycle, validateMomentName } from "@/domain/entities/Moment";
import { Phase } from "@/domain/value-objects/Phase";
import { areas$, phaseConfigs$ } from "@/infrastructure/state/store";
import { lastUsedAreaId$ } from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

interface MomentFormProps {
  mode: "create" | "edit";
  initialName?: string;
  initialAreaId?: string;
  initialCycle?: Cycle | null;
  initialPhase?: Phase | null;
  /** Whether the moment is allocated (has day/phase). If true, cycle selector is hidden. */
  isAllocated?: boolean;
  onSave: (
    name: string,
    areaId: string,
    cycle: Cycle | null,
    phase: Phase | null,
    createMore?: boolean
  ) => void;
  onCancel: () => void;
  /** For create mode: allow creating multiple moments in a row */
  showCreateMore?: boolean;
  /** For edit mode: called when user confirms deletion */
  onDelete?: () => void;
}

/**
 * MomentForm - Shared form component for creating/editing moments
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
 * - Escape: Cancel or blur input
 */
export function MomentForm({
  mode,
  initialName = "",
  initialAreaId = "",
  initialCycle = null,
  initialPhase = null,
  isAllocated = false,
  onSave,
  onCancel,
  showCreateMore = false,
  onDelete,
}: MomentFormProps) {
  const allAreas = use$(areas$);
  const allPhaseConfigs = use$(phaseConfigs$);
  const lastUsedAreaId = use$(lastUsedAreaId$);
  const areasList: Area[] = useMemo(
    () => Object.values(allAreas).sort((a, b) => a.order - b.order),
    [allAreas]
  );

  const [name, setName] = useState(initialName);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(() => {
    // Prioritize explicit initialAreaId (from column click, edit, etc.)
    if (initialAreaId) {
      return initialAreaId;
    }
    // Fall back to last used area for create mode
    if (mode === "create" && lastUsedAreaId) {
      return lastUsedAreaId;
    }
    return areasList[0]?.id ?? "";
  });
  const [cycle, setCycle] = useState<Cycle | null>(initialCycle ?? "later");
  const [phase, setPhase] = useState<Phase | null>(
    initialPhase ?? Phase.MORNING
  );
  const [isAreaSelectorOpen, setIsAreaSelectorOpen] = useState(false);
  const [isCycleSelectorOpen, setIsCycleSelectorOpen] = useState(false);
  const [isPhaseSelectorOpen, setIsPhaseSelectorOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  // Track whether user has manually changed the area via AreaSelector
  const [hasManuallyChangedArea, setHasManuallyChangedArea] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when initialName changes
  useEffect(() => {
    setName(initialName);
    setIsAreaSelectorOpen(false);
  }, [initialName]);

  // Keep the selected area in sync with props and persisted preferences.
  // BUT: Don't override if user has manually changed the area
  useEffect(() => {
    if (!areasList.length || hasManuallyChangedArea) {
      return;
    }

    const findArea = (id?: string) =>
      id ? areasList.find((area) => area.id === id) : undefined;

    let desiredAreaId: string | undefined;

    // Prioritize explicit initialAreaId (from column click, edit, etc.)
    if (initialAreaId) {
      desiredAreaId = initialAreaId;
    } else if (mode === "create") {
      // Fall back to last used area only if no initialAreaId was provided
      desiredAreaId = lastUsedAreaId ?? undefined;
    }

    if (!findArea(desiredAreaId)) {
      desiredAreaId = undefined;
    }

    if (!desiredAreaId) {
      desiredAreaId = areasList[0]?.id;
    }

    if (desiredAreaId && desiredAreaId !== selectedAreaId) {
      setSelectedAreaId(desiredAreaId);
    }
  }, [
    mode,
    initialAreaId,
    lastUsedAreaId,
    areasList,
    selectedAreaId,
    hasManuallyChangedArea,
  ]);

  // Auto-focus and select input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (mode === "edit") {
        inputRef.current.select();
      }
    }
  }, [mode]);

  // Disable form hotkeys when any selector is open to avoid conflicts
  const formHotkeysEnabled =
    !isAreaSelectorOpen && !isCycleSelectorOpen && !isPhaseSelectorOpen;

  // A - open area selector
  useHotkeys(
    "a",
    (e) => {
      e.preventDefault();
      setIsAreaSelectorOpen(true);
    },
    { enabled: formHotkeysEnabled }
  );

  // C - open cycle selector
  useHotkeys(
    "c",
    (e) => {
      e.preventDefault();
      setIsCycleSelectorOpen(true);
    },
    { enabled: formHotkeysEnabled }
  );

  // P - open phase selector
  useHotkeys(
    "p",
    (e) => {
      e.preventDefault();
      setIsPhaseSelectorOpen(true);
    },
    { enabled: formHotkeysEnabled }
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
      // Persist the selection and mark as manually changed
      if (nextArea) {
        setSelectedAreaId(nextArea.id);
        lastUsedAreaId$.set(nextArea.id);
        setHasManuallyChangedArea(true);
      }
    },
    { enabled: formHotkeysEnabled }
  );

  // Enter to save
  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      handleSave();
    },
    { enableOnFormTags: true, enabled: formHotkeysEnabled }
  );

  // Escape - Smart behavior:
  // 1. If any selector is open -> it handles its own escape
  // 2. If input is focused and has text -> blur input (to allow keyboard shortcuts)
  // 3. Otherwise -> cancel modal
  useHotkeys(
    "escape",
    (e) => {
      // Don't handle escape if any selector is open (they handle their own)
      if (isAreaSelectorOpen || isCycleSelectorOpen || isPhaseSelectorOpen) {
        return;
      }

      e.preventDefault();

      if (
        document.activeElement === inputRef.current &&
        name.trim().length > 0
      ) {
        // If input is focused and has text, blur it to allow keyboard shortcuts
        inputRef.current?.blur();
      } else {
        // Otherwise close the modal
        onCancel();
      }
    },
    { enableOnFormTags: true }
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
      onSave(name.trim(), selectedArea.id, cycle, phase, shouldCreateMore);

      // If "Create more" is enabled, reset form immediately
      // Parent will keep modal open, but preserve area and phase selection
      if (shouldCreateMore) {
        setName("");
        setCycle("later"); // Reset cycle to default "later"
        // Don't reset selectedAreaId or phase - keep the same area and phase
        // Refocus input after a brief delay to allow state update
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

  const selectedArea = areasList.find((area) => area.id === selectedAreaId);
  const validation = validateMomentName(name);
  const hasArea = selectedArea !== undefined;
  const canSave = validation.valid && hasArea;

  // Get phase config for display
  const selectedPhaseConfig = phase
    ? Object.values(allPhaseConfigs).find((pc) => pc.phase === phase)
    : null;

  // Format cycle label for display
  const formatCycleLabel = (c: Cycle | null): string => {
    if (!c) return "Unset";
    const labels: Record<Cycle, string> = {
      yesterday: "Yesterday",
      today: "Today",
      tomorrow: "Tomorrow",
      "this-week": "This Week",
      "next-week": "Next Week",
      "this-month": "This Month",
      later: "Later",
    };
    return labels[c];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-medium text-text-secondary">
          {mode === "create" ? "New moment" : "Edit moment"}
        </h2>
      </div>

      {/* Content */}
      <div className="px-6 py-6 flex-1 overflow-y-auto">
        {/* Name Input - Prominent */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
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

        {/* Area Required Message - Show when no area */}
        {!hasArea && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setIsAreaSelectorOpen(true)}
              className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 transition-all text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-400 dark:hover:border-stone-500 flex items-center justify-center gap-2"
            >
              <span className="font-medium">Add area</span>
              <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800">
                A
              </kbd>
            </button>
          </div>
        )}

        {/* Selectors Row - Only show when area is selected */}
        {hasArea && (
          <div className="flex flex-col gap-3 mb-6">
            {/* Area Selector - Colored */}
            <button
              type="button"
              onClick={() => setIsAreaSelectorOpen(true)}
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

            {/* Phase Selector - Ghost with clock icon */}
            <button
              type="button"
              onClick={() => setIsPhaseSelectorOpen(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600"
            >
              <Clock
                className="w-5 h-5 text-stone-400 dark:text-stone-500"
                strokeWidth={1.5}
              />
              <span className="font-mono text-sm flex-1 text-left">
                {selectedPhaseConfig?.emoji} {selectedPhaseConfig?.label || "Morning"}
              </span>
              <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                P
              </kbd>
            </button>

            {/* Cycle Selector - Ghost with calendar icon */}
            <button
              type="button"
              onClick={() => setIsCycleSelectorOpen(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600"
            >
              <Calendar
                className="w-5 h-5 text-stone-400 dark:text-stone-500"
                strokeWidth={1.5}
              />
              <span className="font-mono text-sm flex-1 text-left">
                {formatCycleLabel(cycle)}
              </span>
              <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                C
              </kbd>
            </button>
          </div>
        )}
      </div>

      {/* Phase Selector Dialog */}
      <PhaseSelector
        open={isPhaseSelectorOpen}
        selectedPhase={phase}
        onSelectPhase={(newPhase) => {
          setPhase(newPhase);
        }}
        onClose={() => setIsPhaseSelectorOpen(false)}
      />

      {/* Cycle Selector Dialog */}
      <CycleSelector
        open={isCycleSelectorOpen}
        selectedCycle={cycle}
        onSelectCycle={(newCycle) => {
          setCycle(newCycle);
        }}
        onClose={() => setIsCycleSelectorOpen(false)}
      />

      {/* Area Selector Dialog */}
      <AreaSelector
        open={isAreaSelectorOpen}
        selectedAreaId={selectedArea?.id ?? ""}
        onSelectArea={(areaId) => {
          const nextArea = areasList.find((a) => a.id === areaId);
          if (nextArea) {
            setSelectedAreaId(nextArea.id);
            // Persist the selection immediately when user changes area
            lastUsedAreaId$.set(nextArea.id);
            // Mark that user has manually changed the area
            setHasManuallyChangedArea(true);
          }
        }}
        onClose={() => setIsAreaSelectorOpen(false)}
      />

      {/* Footer - Sticky on mobile to stay above keyboard */}
      <div className="sticky bottom-0 px-6 py-4 bg-surface-alt/50 border-t border-border flex items-center justify-between flex-shrink-0 backdrop-blur-sm md:static">
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

        {/* Right side: Keyboard hints + Save button */}
        <div className="flex items-center gap-3">
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
        </div>
      </div>
    </div>
  );
}
