"use client";

import { useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { cn } from "@/lib/utils";

interface HabitQuickInputProps {
  areaId: string;
  areaColor: string;
  onCreateHabit: (name: string, areaId: string) => void;
}

/**
 * HabitQuickInput - Inline input for quick habit creation
 *
 * Always visible at bottom of area card.
 * Type name + Enter to create.
 * Uses smart defaults (area pre-selected, emoji auto-suggested).
 */
export function HabitQuickInput({
  areaId,
  areaColor,
  onCreateHabit,
}: HabitQuickInputProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Enter to create habit
  useHotkeys(
    "enter",
    () => {
      if (name.trim()) {
        onCreateHabit(name.trim(), areaId);
        setName("");
      }
    },
    { enableOnFormTags: true, enabled: !!name.trim() },
    [name, areaId]
  );

  // Escape to clear and blur
  useHotkeys(
    "escape",
    () => {
      setName("");
      inputRef.current?.blur();
    },
    { enableOnFormTags: true },
    []
  );

  return (
    <div className="px-4 pb-4">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="+ new habit"
        className={cn(
          "w-full px-3 py-2 rounded-md",
          "text-sm font-mono",
          "bg-white/20 dark:bg-stone-950/20 backdrop-blur-sm",
          "border border-stone-300 dark:border-stone-600",
          "focus:border-stone-400 dark:focus:border-stone-500",
          "focus:outline-none",
          "placeholder:text-stone-400 dark:placeholder:text-stone-500",
          "text-stone-900 dark:text-stone-100",
          "transition-colors"
        )}
        style={{
          borderColor: name ? areaColor : undefined,
        }}
      />
    </div>
  );
}
