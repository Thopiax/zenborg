"use client";

import { use$ } from "@legendapp/state/react";
import { useMemo } from "react";
import {
  type SelectorOption,
  SelectorPopover,
} from "@/components/SelectorPopover";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";
import { phaseConfigs$ } from "@/infrastructure/state/store";

interface PhaseSelectorProps {
  open: boolean;
  selectedPhase: Phase | null;
  onSelectPhase: (phase: Phase | null) => void;
  onClose: () => void;
  /** Called when popover should open (when trigger is clicked) */
  onOpen?: () => void;
  /** The trigger button/element that opens this popover */
  trigger: React.ReactNode;
  /** Element to use as collision boundary (e.g., dialog container) */
  collisionBoundary?: Element | null | Array<Element | null>;
}

/**
 * PhaseSelector - Compact popover for selecting phases
 *
 * Monochromatic design with letter shortcuts (M/A/E)
 * Features:
 * - Letter keys (M/A/E) for quick selection
 * - Compact popover UI (no title, max 50% width)
 * - No z-index conflicts with parent dialogs
 * - Built with shadcn/ui Popover component
 */
export function PhaseSelector({
  open,
  selectedPhase,
  onSelectPhase,
  onClose,
  onOpen,
  trigger,
  collisionBoundary,
}: PhaseSelectorProps) {
  const allPhaseConfigs = use$(phaseConfigs$);
  const phaseConfigsList: PhaseConfig[] = useMemo(
    () =>
      Object.values(allPhaseConfigs)
        .filter((pc) => pc.isVisible)
        .sort((a, b) => a.order - b.order),
    [allPhaseConfigs]
  );

  // Map phases to their letter shortcuts: M, A, E (Morning, Afternoon, Evening)
  // Night doesn't have a letter shortcut (usually hidden)
  const phaseHotkeys: Record<Phase, string | undefined> = {
    [Phase.MORNING]: "M",
    [Phase.AFTERNOON]: "A",
    [Phase.EVENING]: "E",
    [Phase.NIGHT]: undefined, // No hotkey for night
  };

  // Build options from phase configs, with a null option at the top
  const options: SelectorOption<Phase | null>[] = [
    {
      value: null,
      label: "No Phase",
      hotkey: "X",
      icon: "--",
      className: "font-mono text-stone-500 dark:text-stone-400",
    },
    ...phaseConfigsList.map((phaseConfig) => ({
      value: phaseConfig.phase,
      label: phaseConfig.label,
      hotkey: phaseHotkeys[phaseConfig.phase],
      icon: phaseConfig.emoji,
      className: "font-mono text-stone-700 dark:text-stone-300",
    })),
  ];

  return (
    <SelectorPopover
      open={open}
      trigger={trigger}
      options={options}
      selectedValue={selectedPhase}
      onSelect={onSelectPhase}
      onClose={onClose}
      onOpen={onOpen}
      enableHotkeys
      collisionBoundary={collisionBoundary}
    />
  );
}
