"use client";

import { useEffect } from "react";
import {
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { Cycle } from "@/domain/entities/Moment";

interface CycleSelectorProps {
  open: boolean;
  selectedCycle: Cycle | null;
  onSelectCycle: (cycle: Cycle | null) => void;
  onClose: () => void;
}

/**
 * CycleSelector - Ghost-style command palette for selecting time cycle
 *
 * Calm, minimal selector with no colors - just monochrome
 * Features:
 * - Number keys (1-3) for quick selection, 0 to clear
 * - Arrow keys for navigation
 * - Enter to confirm
 * - Escape to cancel
 * - Built with shadcn/ui Command component
 */
export function CycleSelector({
  open,
  selectedCycle,
  onSelectCycle,
  onClose,
}: CycleSelectorProps) {
  const cycles: Array<{ value: Cycle | null; label: string; key: string }> = [
    { value: "now", label: "Now", key: "1" },
    { value: "soon", label: "Soon", key: "2" },
    { value: "later", label: "Later", key: "3" },
    { value: null, label: "Unset", key: "0" },
  ];

  // Handle number key shortcuts (1-3 for cycles, 0 to clear)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys 0-3 for quick selection
      if (e.key >= "0" && e.key <= "3") {
        e.preventDefault();
        const selected = cycles.find((c) => c.key === e.key);
        if (selected) {
          onSelectCycle(selected.value);
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onSelectCycle, onClose]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Select Cycle"
      description="Choose a time perspective for your moment"
      showCloseButton={false}
      className="max-w-md"
    >
      <CommandList className="max-h-64">
        <CommandGroup heading="Cycle">
          {cycles.map((cycle) => {
            const isSelected = selectedCycle === cycle.value;

            return (
              <CommandItem
                key={cycle.key}
                value={cycle.label}
                onSelect={() => {
                  onSelectCycle(cycle.value);
                  onClose();
                }}
                className={isSelected ? "bg-stone-100 dark:bg-stone-800" : ""}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono text-sm text-stone-700 dark:text-stone-300">
                    {cycle.label}
                  </span>
                  <CommandShortcut>{cycle.key}</CommandShortcut>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
