"use client";

import {
  type SelectorOption,
  SelectorPopover,
} from "@/components/SelectorPopover";
import type { Horizon } from "@/domain/entities/Moment";

interface HorizonSelectorProps {
  open: boolean;
  selectedHorizon: Horizon | null;
  onSelectHorizon: (horizon: Horizon | null) => void;
  onClose: () => void;
  /** Called when popover should open (when trigger is clicked) */
  onOpen?: () => void;
  /** The trigger button/element that opens this popover */
  trigger: React.ReactNode;
  /** Element to use as collision boundary (e.g., dialog container) */
  collisionBoundary?: Element | null | Array<Element | null>;
}

/**
 * CycleSelector - Compact popover for selecting time horizon
 *
 * Calm, minimal selector with no colors - just monochrome
 * Features:
 * - Letter hotkeys (W/N/M/L) for quick selection
 * - Compact popover UI (no title, max 50% width)
 * - No z-index conflicts with parent dialogs
 * - Built with SelectorPopover component
 */
export function HorizonSelector({
  open,
  selectedHorizon,
  onSelectHorizon,
  onClose,
  onOpen,
  trigger,
  collisionBoundary,
}: HorizonSelectorProps) {
  // Define horizon options with letter hotkeys
  const options: SelectorOption<Horizon | null>[] = [
    {
      value: "this-week",
      label: "This Week",
      hotkey: "1",
    },
    {
      value: "next-week",
      label: "Next Week",
      hotkey: "2",
    },
    {
      value: "this-month",
      label: "This Month",
      hotkey: "3",
    },
    {
      value: "later",
      label: "Later",
      hotkey: "0",
    },
  ];

  return (
    <SelectorPopover
      open={open}
      trigger={trigger}
      options={options}
      selectedValue={selectedHorizon}
      onSelect={onSelectHorizon}
      onClose={onClose}
      onOpen={onOpen}
      enableHotkeys
      collisionBoundary={collisionBoundary}
    />
  );
}
