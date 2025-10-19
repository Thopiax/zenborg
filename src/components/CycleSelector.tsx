"use client";

import {
  SelectorDialog,
  type SelectorOption,
} from "@/components/SelectorDialog";
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
 * - Number keys (1-7) for quick selection
 * - Arrow keys for navigation
 * - Enter to confirm
 * - Escape to cancel
 * - Built with SelectorDialog component
 */
export function CycleSelector({
  open,
  selectedCycle,
  onSelectCycle,
  onClose,
}: CycleSelectorProps) {
  // Define cycle options with number hotkeys
  const options: SelectorOption<Cycle | null>[] = [
    {
      value: "yesterday",
      label: "Yesterday",
      hotkey: "Y",
      // description: "Allocate to yesterday",
    },
    {
      value: "today",
      label: "Today",
      hotkey: "T",
      // description: "Allocate to today",
    },
    {
      value: "tomorrow",
      label: "Tomorrow",
      hotkey: "R",
      // description: "Allocate to tomorrow",
    },
    {
      value: "this-week",
      label: "This Week",
      hotkey: "W",
      // description: "This week",
    },
    {
      value: "next-week",
      label: "Next Week",
      hotkey: "N",
      // description: "Next week",
    },
    {
      value: "this-month",
      label: "This Month",
      hotkey: "M",
      // description: "This month",
    },
    {
      value: "later",
      label: "Later",
      hotkey: "L",
      // description: "Someday",
    },
  ];

  return (
    <SelectorDialog
      open={open}
      title="Select Cycle"
      description="Choose a time perspective for your moment"
      heading="Cycle"
      options={options}
      selectedValue={selectedCycle}
      onSelect={onSelectCycle}
      onClose={onClose}
      maxWidth="max-w-md"
      enableHotkeys
    />
  );
}
