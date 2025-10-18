"use client";

import { use$ } from "@legendapp/state/react";
import { useEffect } from "react";
import {
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { Area } from "@/domain/entities/Area";
import { areas$ } from "@/infrastructure/state/store";

interface AreaSelectorProps {
  open: boolean;
  selectedAreaId: string;
  onSelectArea: (areaId: string) => void;
  onClose: () => void;
}

/**
 * AreaSelector - Notion-style command palette for selecting areas
 *
 * Features:
 * - Number keys (1-5) for quick selection
 * - Arrow keys for navigation
 * - Enter to confirm
 * - Escape to cancel
 * - Built with shadcn/ui Command component
 */
export function AreaSelector({
  open,
  selectedAreaId,
  onSelectArea,
  onClose,
}: AreaSelectorProps) {
  const allAreas = use$(areas$);
  const areasList: Area[] = Object.values(allAreas).sort(
    (a, b) => a.order - b.order
  );

  // Handle number key shortcuts (1-5)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys 1-5 for quick selection
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const index = Number.parseInt(e.key) - 1;
        if (index < areasList.length) {
          onSelectArea(areasList[index].id);
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, areasList, onSelectArea, onClose]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Select Area"
      description="Choose an area for your moment"
      showCloseButton={false}
    >
      <CommandList>
        <CommandGroup heading="Areas">
          {areasList.map((area, index) => {
            const numberKey = index + 1;

            return (
              <CommandItem
                key={area.id}
                value={area.id}
                onSelect={() => {
                  onSelectArea(area.id);
                  onClose();
                }}
                className="cursor-pointer"
              >
                <span className="text-xl mr-2" aria-hidden="true">
                  {area.emoji}
                </span>
                <span className="flex-1">{area.name}</span>
                <CommandShortcut>{numberKey}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
