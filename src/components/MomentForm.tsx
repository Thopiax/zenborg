/** biome-ignore-all lint/a11y/useButtonType: <explanation> */
"use client";

import { use$ } from "@legendapp/state/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { AreaSelector } from "@/components/AreaSelector";
import type { Area } from "@/domain/entities/Area";
import { validateMomentName } from "@/domain/entities/Moment";
import { areas$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface MomentFormProps {
  mode: "create" | "edit";
  initialName?: string;
  initialAreaId?: string;
  onSave: (name: string, areaId: string) => void;
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
 * - Enter to save, Escape to cancel
 * - Optional "Create more" toggle for batch creation
 */
export function MomentForm({
  mode,
  initialName = "",
  initialAreaId = "",
  onSave,
  onCancel,
  showCreateMore = false,
}: MomentFormProps) {
  const allAreas = use$(areas$);
  const areasList: Area[] = useMemo(
    () => Object.values(allAreas).sort((a, b) => a.order - b.order),
    [allAreas]
  );

  // Find initial area or default to first
  const initialArea =
    areasList.find((a) => a.id === initialAreaId) || areasList[0];

  const [name, setName] = useState(initialName);
  const [selectedAreaIndex, setSelectedAreaIndex] = useState(
    areasList.findIndex((a) => a.id === initialArea?.id) || 0
  );
  const [isAreaSelectorOpen, setIsAreaSelectorOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when initialName/initialAreaId changes
  useEffect(() => {
    setName(initialName);
    const areaIndex = initialAreaId
      ? areasList.findIndex((a) => a.id === initialAreaId)
      : 0;
    setSelectedAreaIndex(areaIndex >= 0 ? areaIndex : 0);
    setIsAreaSelectorOpen(false);
  }, [initialName, initialAreaId, areasList]);

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

  // Tab to cycle areas
  useHotkeys("tab", (e) => {
    e.preventDefault();
    setSelectedAreaIndex((prev) => (prev + 1) % areasList.length);
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
  // 1. If area selector is open -> it handles its own escape
  // 2. If input is focused and has text -> blur input (to allow area selection)
  // 3. Otherwise -> cancel modal
  useHotkeys(
    "escape",
    (e) => {
      // Don't handle escape if area selector is open (it handles its own)
      if (isAreaSelectorOpen) {
        return;
      }

      e.preventDefault();

      if (
        document.activeElement === inputRef.current &&
        name.trim().length > 0
      ) {
        // If input is focused and has text, blur it to allow area keyboard shortcuts
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
    if (validation.valid && areasList[selectedAreaIndex]) {
      const selectedArea = areasList[selectedAreaIndex];
      onSave(name.trim(), selectedArea.id);

      // If "Create more" is enabled, reset form and stay open
      if (mode === "create" && createMore) {
        setName("");
        setSelectedAreaIndex(0);
        inputRef.current?.focus();
      }
    }
  };

  const selectedArea = areasList[selectedAreaIndex];
  const validation = validateMomentName(name);

  if (!selectedArea) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-700 flex-shrink-0">
        <h2 className="text-sm font-medium text-stone-300">
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
          className="w-full text-2xl font-semibold bg-transparent outline-none text-stone-100 placeholder:text-stone-500 mb-6"
          placeholder="Moment name..."
          aria-label="Moment name"
          aria-invalid={!validation.valid}
        />

        {/* Validation */}
        {!validation.valid && validation.error && name.trim().length > 0 && (
          <p className="text-sm text-red-400 mb-4" role="alert">
            {validation.error}
          </p>
        )}

        {/* Area Selector Trigger */}
        <button
          onClick={() => setIsAreaSelectorOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-750 border border-stone-700 transition-colors text-stone-200"
        >
          <span className="text-lg">{selectedArea.emoji}</span>
          <span className="font-medium">{selectedArea.name}</span>
          <kbd className="ml-auto px-1.5 py-0.5 rounded text-xs font-mono bg-stone-700 text-stone-400">
            A
          </kbd>
        </button>
      </div>

      {/* Area Selector Dialog */}
      <AreaSelector
        open={isAreaSelectorOpen}
        selectedAreaId={selectedArea.id}
        onSelectArea={(areaId) => {
          const newIndex = areasList.findIndex((a) => a.id === areaId);
          if (newIndex >= 0) {
            setSelectedAreaIndex(newIndex);
          }
        }}
        onClose={() => setIsAreaSelectorOpen(false)}
      />

      {/* Footer */}
      <div className="px-6 py-4 bg-stone-800/50 border-t border-stone-700 flex items-center justify-between flex-shrink-0">
        {showCreateMore && mode === "create" ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={createMore}
              onChange={(e) => setCreateMore(e.target.checked)}
              className="w-4 h-4 rounded border-stone-600 bg-stone-700 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm text-stone-300">Create more</span>
          </label>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          <p className="text-xs text-stone-500">
            <kbd className="px-1.5 py-0.5 rounded bg-stone-700 mr-1">Enter</kbd>
            to save
            <span className="mx-2">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-stone-700 mr-1">Esc</kbd>
            to cancel
          </p>
          <button
            onClick={handleSave}
            disabled={!validation.valid}
            className={cn(
              "px-5 py-2 rounded-lg font-medium transition-all",
              validation.valid
                ? "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                : "bg-stone-700 text-stone-500 cursor-not-allowed"
            )}
          >
            {mode === "create" ? "Create moment" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
