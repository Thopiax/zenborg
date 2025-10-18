/** biome-ignore-all lint/a11y/useButtonType: <explanation> */
"use client";

import { use$ } from "@legendapp/state/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { AreaSelector } from "@/components/AreaSelector";
import { HorizonSelector } from "@/components/HorizonSelector";
import type { Area } from "@/domain/entities/Area";
import { validateMomentName, type Horizon } from "@/domain/entities/Moment";
import { areas$ } from "@/infrastructure/state/store";
import { lastUsedAreaId$ } from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

interface MomentFormProps {
  mode: "create" | "edit";
  initialName?: string;
  initialAreaId?: string;
  initialHorizon?: Horizon | null;
  onSave: (
    name: string,
    areaId: string,
    horizon: Horizon | null,
    createMore?: boolean
  ) => void;
  onCancel: () => void;
  /** For create mode: allow creating multiple moments in a row */
  showCreateMore?: boolean;
}

/**
 * MomentForm - Shared form component for creating/editing moments
 *
 * Features:
 * - Name input with validation (1-3 words)
 * - Area selection with keyboard shortcuts (1-5, Tab, A)
 * - Horizon selection (only for create mode - unallocated moments)
 * - Enter to save, Escape to cancel
 * - Optional "Create more" toggle for batch creation
 */
export function MomentForm({
  mode,
  initialName = "",
  initialAreaId = "",
  initialHorizon = null,
  onSave,
  onCancel,
  showCreateMore = false,
}: MomentFormProps) {
  // Horizon is only editable for create mode (unallocated moments)
  const showHorizonSelector = mode === "create";
  const allAreas = use$(areas$);
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
  const [horizon, setHorizon] = useState<Horizon | null>(initialHorizon);
  const [isAreaSelectorOpen, setIsAreaSelectorOpen] = useState(false);
  const [isHorizonSelectorOpen, setIsHorizonSelectorOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when initialName changes
  useEffect(() => {
    setName(initialName);
    setIsAreaSelectorOpen(false);
  }, [initialName]);

  // Keep the selected area in sync with props and persisted preferences.
  useEffect(() => {
    if (!areasList.length) {
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
  }, [mode, initialAreaId, lastUsedAreaId, areasList, selectedAreaId]);

  // Auto-focus and select input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (mode === "edit") {
        inputRef.current.select();
      }
    }
  }, [mode]);

  // A - open area selector
  useHotkeys("a", (e) => {
    e.preventDefault();
    setIsAreaSelectorOpen(true);
  });

  // H - open horizon selector (only for create mode)
  useHotkeys("h", (e) => {
    if (!showHorizonSelector) return;
    e.preventDefault();
    setIsHorizonSelectorOpen(true);
  });

  // Tab to cycle areas
  useHotkeys("tab", (e) => {
    e.preventDefault();
    if (!areasList.length) {
      return;
    }
    const currentIndex = areasList.findIndex((a) => a.id === selectedAreaId);
    const nextIndex = (currentIndex + 1) % areasList.length;
    const nextArea = areasList[nextIndex];
    // Persist the selection
    if (nextArea) {
      setSelectedAreaId(nextArea.id);
      lastUsedAreaId$.set(nextArea.id);
    }
  });

  // Enter to save
  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      handleSave();
    },
    { enableOnFormTags: true }
  );

  // Escape - Smart behavior:
  // 1. If area/horizon selector is open -> it handles its own escape
  // 2. If input is focused and has text -> blur input (to allow keyboard shortcuts)
  // 3. Otherwise -> cancel modal
  useHotkeys(
    "escape",
    (e) => {
      // Don't handle escape if any selector is open (they handle their own)
      if (isAreaSelectorOpen || isHorizonSelectorOpen) {
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
    if (validation.valid && selectedArea) {

      // Persist the selected area ID for future use
      lastUsedAreaId$.set(selectedArea.id);

      // If "Create more" is enabled, pass it to parent
      const shouldCreateMore = mode === "create" && createMore;

      // Call onSave with horizon and createMore flag
      onSave(name.trim(), selectedArea.id, horizon, shouldCreateMore);

      // If "Create more" is enabled, reset form immediately
      // Parent will keep modal open, but preserve area selection
      if (shouldCreateMore) {
        setName("");
        setHorizon(null); // Reset horizon too
        // Don't reset selectedAreaId - keep the same area
        // Refocus input after a brief delay to allow state update
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    }
  };

  const selectedArea =
    areasList.find((area) => area.id === selectedAreaId) || areasList[0];
  const validation = validateMomentName(name);

  if (!selectedArea) {
    return null;
  }

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
        {/* Name Input */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-2xl font-semibold bg-transparent outline-none text-text-primary placeholder:text-text-tertiary mb-6"
          placeholder="Moment name..."
          aria-label="Moment name"
          aria-invalid={!validation.valid}
        />

        {/* Validation */}
        {!validation.valid && validation.error && name.trim().length > 0 && (
          <p
            className="text-sm text-red-500 dark:text-red-400 mb-4"
            role="alert"
          >
            {validation.error}
          </p>
        )}

        {/* Selectors Row with flex wrap and breathing room */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Area Selector Trigger - Always first */}
          <button
            type="button"
            onClick={() => setIsAreaSelectorOpen(true)}
            className="min-w-[200px] flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-white hover:opacity-90"
            style={{
              backgroundColor: selectedArea.color,
              borderColor: selectedArea.color,
            }}
          >
            <span className="text-lg">{selectedArea.emoji}</span>
            <span className="font-medium">{selectedArea.name}</span>
            <kbd className="ml-auto px-1.5 py-0.5 rounded text-xs font-mono bg-white/20 text-white">
              A
            </kbd>
          </button>

          {/* Horizon Selector Trigger - Ghost style, only for unallocated moments */}
          {showHorizonSelector && (
            <button
              type="button"
              onClick={() => setIsHorizonSelectorOpen(true)}
              className="min-w-[200px] flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border border-stone-200 dark:border-stone-700 transition-all text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-stone-400">Horizon:</span>
                <span className="font-mono text-sm">
                  {horizon ? horizon.charAt(0).toUpperCase() + horizon.slice(1) : "Unset"}
                </span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                H
              </kbd>
            </button>
          )}
        </div>
      </div>

      {/* Horizon Selector Dialog */}
      <HorizonSelector
        open={isHorizonSelectorOpen}
        selectedHorizon={horizon}
        onSelectHorizon={(newHorizon) => {
          setHorizon(newHorizon);
        }}
        onClose={() => setIsHorizonSelectorOpen(false)}
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
          }
        }}
        onClose={() => setIsAreaSelectorOpen(false)}
      />

      {/* Footer */}
      <div className="px-6 py-4 bg-surface-alt/50 border-t border-border flex items-center justify-between flex-shrink-0">
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
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          <p className="hidden md:block text-xs text-text-tertiary">
            <kbd className="px-1.5 py-0.5 rounded bg-border mr-1">Enter</kbd>
            to save
            <span className="mx-2">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-border mr-1">Esc</kbd>
            to blur
            <span className="mx-2">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-border mr-1">A</kbd>
            then
            <kbd className="px-1.5 py-0.5 rounded bg-border ml-1">1-5</kbd>
            for area
          </p>
          <button
            onClick={handleSave}
            disabled={!validation.valid}
            className={cn(
              "px-5 py-2 rounded-lg font-medium transition-all text-white",
              validation.valid
                ? "hover:opacity-90 active:scale-95"
                : "bg-border text-text-tertiary cursor-not-allowed"
            )}
            style={
              validation.valid
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
