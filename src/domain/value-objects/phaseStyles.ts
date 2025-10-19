import { Phase } from "./Phase";

/**
 * Visual styling for phases including icons, backgrounds, and text colors
 */
export interface PhaseStyle {
  phase: Phase;
  emoji: string;
  background: string; // Tailwind class or hex color
  text: string; // Tailwind class or hex color
}

/**
 * Phase icon and styling configuration
 * Used across the app for consistent phase visualization
 */
export const PHASE_STYLES: Record<Phase, PhaseStyle> = {
  [Phase.MORNING]: {
    phase: Phase.MORNING,
    emoji: "☕",
    background: "#e2e8f0", // slate-200 - brightest for morning energy
    text: "#0f172a", // slate-900
  },
  [Phase.AFTERNOON]: {
    phase: Phase.AFTERNOON,
    emoji: "☀️",
    background: "#cbd5e1", // slate-300 - bright midday
    text: "#0f172a", // slate-900
  },
  [Phase.EVENING]: {
    phase: Phase.EVENING,
    emoji: "🌙",
    background: "#64748b", // slate-500 - darker for evening
    text: "#f8fafc", // slate-50
  },
  [Phase.NIGHT]: {
    phase: Phase.NIGHT,
    emoji: "🌃",
    background: "#1e293b", // slate-800 - very dark but not pure black
    text: "#f8fafc", // slate-50
  },
};

/**
 * Get phase style by phase enum
 */
export function getPhaseStyle(phase: Phase): PhaseStyle {
  return PHASE_STYLES[phase];
}
