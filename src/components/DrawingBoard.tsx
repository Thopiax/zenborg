"use client";

import { useState, useRef, useEffect } from "react";
import { use$ } from "@legendapp/state/react";
import { cn } from "@/lib/utils";
import { MomentCard } from "./MomentCard";
import { moments$, areas$, unallocatedMoments$ } from "@/infrastructure/state/store";
import { useFocusManager } from "@/hooks/useFocusManager";
import { useVimMode } from "@/hooks/useVimMode";
import { VimMode } from "@/infrastructure/state/vim-mode";
import { createMoment, validateMomentName } from "@/domain/entities/Moment";
import type { Area } from "@/domain/entities/Area";

/**
 * DrawingBoard - Container for unallocated moments
 *
 * Features:
 * - Displays all moments that haven't been allocated to a day/phase
 * - Inline creation form in INSERT mode
 * - Tab to cycle through areas when creating
 * - Desktop: sidebar, Mobile: below timeline
 */
export function DrawingBoard() {
  const unallocated = use$(unallocatedMoments$);
  const allAreas = use$(areas$);
  const { focusedMomentId, focusMoment } = useFocusManager();
  const { mode, isInsertMode, focusedMomentId: vimFocusedId, enterNormalMode } = useVimMode();

  // Create form state
  const [isCreating, setIsCreating] = useState(false);
  const [newMomentName, setNewMomentName] = useState("");
  const [selectedAreaIndex, setSelectedAreaIndex] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const areasList: Area[] = Object.values(allAreas).sort((a, b) => a.order - b.order);

  // Enter create mode when in INSERT mode and no moment is focused
  useEffect(() => {
    if (isInsertMode && !vimFocusedId) {
      setIsCreating(true);
      setNewMomentName("");
      setSelectedAreaIndex(0);
    } else if (mode === VimMode.NORMAL) {
      setIsCreating(false);
    }
  }, [isInsertMode, vimFocusedId, mode]);

  // Auto-focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Update word count
  useEffect(() => {
    if (isCreating) {
      const words = newMomentName.trim().split(/\s+/).filter((w) => w.length > 0);
      setWordCount(words.length);
    }
  }, [newMomentName, isCreating]);

  const handleCreate = () => {
    const validation = validateMomentName(newMomentName);
    if (!validation.valid || areasList.length === 0) return;

    const selectedArea = areasList[selectedAreaIndex];
    const result = createMoment(newMomentName.trim(), selectedArea.id);

    if ("error" in result) {
      console.error("Failed to create moment:", result.error);
      return;
    }

    // Add to store
    moments$[result.id].set(result);

    // Reset form
    setNewMomentName("");
    setSelectedAreaIndex(0);
    setIsCreating(false);

    // Exit INSERT mode and return to NORMAL
    enterNormalMode();

    // Focus the new moment
    focusMoment(result.id);
  };

  const handleCancel = () => {
    setNewMomentName("");
    setSelectedAreaIndex(0);
    setIsCreating(false);

    // Exit INSERT mode and return to NORMAL
    enterNormalMode();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Cycle through areas
      setSelectedAreaIndex((prev) => (prev + 1) % areasList.length);
    }
  };

  const handleUpdate = (momentId: string, newName: string) => {
    moments$[momentId].name.set(newName);
    moments$[momentId].updatedAt.set(new Date().toISOString());
  };

  const validation = validateMomentName(newMomentName);
  const selectedArea = areasList[selectedAreaIndex];

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4 text-stone-800">Drawing Board</h2>
      <div className="space-y-3">
        {/* Create form (shown in INSERT mode when no moment is focused) */}
        {isCreating && (
          <div
            className={cn(
              "min-h-[56px] px-4 py-3",
              "rounded-lg border-2 bg-white",
              "ring-2 ring-offset-2 ring-amber-500"
            )}
            style={{ borderColor: selectedArea?.color || "#d4d4d8" }}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedArea?.emoji || "🔵"}</span>
                <input
                  ref={inputRef}
                  value={newMomentName}
                  onChange={(e) => setNewMomentName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="text-lg font-semibold bg-transparent outline-none w-full font-mono"
                  placeholder="Moment name (1-3 words)"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    "font-mono",
                    !validation.valid ? "text-red-500" : "text-stone-500"
                  )}
                >
                  {wordCount}/3 words
                  {!validation.valid && validation.error && (
                    <span className="ml-2">· {validation.error}</span>
                  )}
                </span>
                <div className="flex gap-2 text-stone-400">
                  <span>Tab to change area</span>
                  <span>·</span>
                  <span>Enter to save</span>
                  <span>·</span>
                  <span>Esc to cancel</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span>Area:</span>
                <div className="flex gap-1">
                  {areasList.map((area, index) => (
                    <span
                      key={area.id}
                      className={cn(
                        "px-2 py-1 rounded border",
                        index === selectedAreaIndex
                          ? "border-blue-500 bg-blue-50 font-semibold"
                          : "border-stone-200 bg-stone-50"
                      )}
                    >
                      {area.emoji} {area.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unallocated moments */}
        {unallocated.length === 0 && !isCreating ? (
          <div className="min-h-[100px] flex items-center justify-center border-2 border-dashed border-stone-200 rounded-lg">
            <p className="text-stone-400 text-sm font-mono">
              No unallocated moments. Press <kbd className="px-1 py-0.5 bg-stone-100 rounded border text-xs">i</kbd> to create one.
            </p>
          </div>
        ) : (
          unallocated.map((moment) => {
            const area = allAreas[moment.areaId];
            if (!area) return null;

            return (
              <MomentCard
                key={moment.id}
                moment={moment}
                area={area}
                isFocused={focusedMomentId === moment.id}
                onFocus={() => focusMoment(moment.id)}
                onUpdate={(newName) => handleUpdate(moment.id, newName)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
