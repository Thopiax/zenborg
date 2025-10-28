"use client";

import { useMemo } from "react";
import {
  type SelectorOption,
  SelectorPopover,
} from "@/components/SelectorPopover";
import {
  ATTITUDE_METADATA,
  ATTITUDE_METADATA_ARRAY,
  Attitude,
} from "@/domain/value-objects/Attitude";

interface AttitudeSelectorProps {
  open: boolean;
  selectedAttitude: Attitude | null;
  onSelectAttitude: (attitude: Attitude | null) => void;
  onClose: () => void;
  /** Called when popover should open (when trigger is clicked) */
  onOpen?: () => void;
  /** The trigger button/element that opens this popover */
  trigger: React.ReactNode;
  /** Element to use as collision boundary (e.g., dialog container) */
  collisionBoundary?: Element | null | Array<Element | null>;
}

/**
 * AttitudeSelector - Compact popover for selecting attitudes
 *
 * Philosophy: Most moments stay pure presence (null).
 * This selector makes choosing an attitude explicit and intentional.
 *
 * Features:
 * - Pure presence (null) as first option
 * - All 5 attitudes with descriptions
 * - Letter shortcuts for quick selection
 * - Compact popover UI
 */
export function AttitudeSelector({
  open,
  selectedAttitude,
  onSelectAttitude,
  onClose,
  onOpen,
  trigger,
  collisionBoundary,
}: AttitudeSelectorProps) {
  // Build options from attitudes, with a null option at the top
  const options: SelectorOption<Attitude | null>[] = useMemo(
    () => [
      {
        value: null,
        label: "Pure presence",
        description: "No tracking or progression",
        hotkey: "0",
        icon: "○",
        className: "font-mono text-stone-700 dark:text-stone-300",
      },
      ...Object.values(Attitude).map((attitude) => ({
        value: attitude,
        ...ATTITUDE_METADATA[attitude],
      })),
    ],
    []
  );

  return (
    <SelectorPopover
      open={open}
      options={options}
      selectedValue={selectedAttitude}
      onSelect={onSelectAttitude}
      onClose={onClose}
      onOpen={onOpen}
      trigger={trigger}
      collisionBoundary={collisionBoundary}
    />
  );
}
