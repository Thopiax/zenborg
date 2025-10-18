"use client";

import { useEffect } from "react";
import {
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { Horizon } from "@/domain/entities/Moment";

interface HorizonSelectorProps {
  open: boolean;
  selectedHorizon: Horizon | null;
  onSelectHorizon: (horizon: Horizon | null) => void;
  onClose: () => void;
}

/**
 * HorizonSelector - Ghost-style command palette for selecting time horizon
 *
 * Calm, minimal selector with no colors - just monochrome
 * Features:
 * - Number keys (1-3) for quick selection, 0 to clear
 * - Arrow keys for navigation
 * - Enter to confirm
 * - Escape to cancel
 * - Built with shadcn/ui Command component
 */
export function HorizonSelector({
  open,
  selectedHorizon,
  onSelectHorizon,
  onClose,
}: HorizonSelectorProps) {
  const horizons: Array<{ value: Horizon | null; label: string; key: string }> =
    [
      { value: "now", label: "Now", key: "1" },
      { value: "soon", label: "Soon", key: "2" },
      { value: "later", label: "Later", key: "3" },
      { value: null, label: "Unset", key: "0" },
    ];

  // Handle number key shortcuts (1-3 for horizons, 0 to clear)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys 0-3 for quick selection
      if (e.key >= "0" && e.key <= "3") {
        e.preventDefault();
        const selected = horizons.find((h) => h.key === e.key);
        if (selected) {
          onSelectHorizon(selected.value);
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onSelectHorizon, onClose]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Select Horizon"
      description="Choose a time perspective for your moment"
      showCloseButton={false}
      className="max-w-md"
    >
      <CommandList className="max-h-64">
        <CommandGroup heading="Horizon">
          {horizons.map((horizon) => {
            const isSelected = selectedHorizon === horizon.value;

            return (
              <CommandItem
                key={horizon.key}
                value={horizon.label}
                onSelect={() => {
                  onSelectHorizon(horizon.value);
                  onClose();
                }}
                className={isSelected ? "bg-stone-100 dark:bg-stone-800" : ""}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono text-sm text-stone-700 dark:text-stone-300">
                    {horizon.label}
                  </span>
                  <CommandShortcut>{horizon.key}</CommandShortcut>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
