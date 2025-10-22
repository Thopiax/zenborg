"use client";

import { useMemo } from "react";
import {
  type SelectorOption,
  SelectorPopover,
} from "@/components/SelectorPopover";
import {
  Attitude,
  ATTITUDE_METADATA,
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
  // Map attitudes to their number shortcuts
  const attitudeHotkeys: Record<Attitude, string> = {
    [Attitude.BEGINNING]: "1",
    [Attitude.KEEPING]: "2",
    [Attitude.BUILDING]: "3",
    [Attitude.PUSHING]: "4",
    [Attitude.BEING]: "5",
  };

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
      {
        value: Attitude.BEGINNING,
        label: ATTITUDE_METADATA[Attitude.BEGINNING].label,
        description: ATTITUDE_METADATA[Attitude.BEGINNING].description,
        hotkey: attitudeHotkeys[Attitude.BEGINNING],
        icon: "◇",
        className: "font-mono text-stone-700 dark:text-stone-300",
      },
      {
        value: Attitude.KEEPING,
        label: ATTITUDE_METADATA[Attitude.KEEPING].label,
        description: ATTITUDE_METADATA[Attitude.KEEPING].description,
        hotkey: attitudeHotkeys[Attitude.KEEPING],
        icon: "◌",
        className: "font-mono text-stone-700 dark:text-stone-300",
      },
      {
        value: Attitude.BUILDING,
        label: ATTITUDE_METADATA[Attitude.BUILDING].label,
        description: ATTITUDE_METADATA[Attitude.BUILDING].description,
        hotkey: attitudeHotkeys[Attitude.BUILDING],
        icon: "△",
        className: "font-mono text-stone-700 dark:text-stone-300",
      },
      {
        value: Attitude.PUSHING,
        label: ATTITUDE_METADATA[Attitude.PUSHING].label,
        description: ATTITUDE_METADATA[Attitude.PUSHING].description,
        hotkey: attitudeHotkeys[Attitude.PUSHING],
        icon: "↑",
        className: "font-mono text-stone-700 dark:text-stone-300",
      },
      {
        value: Attitude.BEING,
        label: ATTITUDE_METADATA[Attitude.BEING].label,
        description: ATTITUDE_METADATA[Attitude.BEING].description,
        hotkey: attitudeHotkeys[Attitude.BEING],
        icon: "◉",
        className: "font-mono text-stone-700 dark:text-stone-300",
      },
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
