"use client";

import { use$ } from "@legendapp/state/react";
import { useMemo } from "react";
import { SelectorDialog, type SelectorOption } from "@/components/SelectorDialog";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";
import { phaseConfigs$ } from "@/infrastructure/state/store";

interface PhaseSelectorProps {
  open: boolean;
  selectedPhase: Phase | null;
  onSelectPhase: (phase: Phase) => void;
  onClose: () => void;
}

/**
 * PhaseSelector - Ghost-style command palette for selecting phases
 *
 * Monochromatic design with number shortcuts (1-4)
 * Features:
 * - Number keys (1-4) for quick selection
 * - Arrow keys for navigation
 * - Enter to confirm
 * - Escape to cancel
 * - Built with shadcn/ui Command component
 */
export function PhaseSelector({
  open,
  selectedPhase,
  onSelectPhase,
  onClose,
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

  // Build options from phase configs
  const options: SelectorOption<Phase>[] = phaseConfigsList.map((phaseConfig) => ({
    value: phaseConfig.phase,
    label: phaseConfig.label,
    hotkey: phaseHotkeys[phaseConfig.phase],
    icon: phaseConfig.emoji,
    className: "font-mono text-stone-700 dark:text-stone-300",
  }));

  return (
    <SelectorDialog
      open={open}
      title="Select Phase"
      description="Choose a time of day for your moment"
      heading="Phase"
      options={options}
      selectedValue={selectedPhase}
      onSelect={onSelectPhase}
      onClose={onClose}
      maxWidth="max-w-md"
      enableHotkeys
    />
  );
}
