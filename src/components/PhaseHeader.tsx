"use client";

import { useTheme } from "next-themes";
import type { PhaseConfig } from "@/domain/value-objects/Phase";
import { themeConfig } from "@/lib/theme-config";

interface PhaseHeaderProps {
  phaseConfig: PhaseConfig;
}

/**
 * PhaseHeader - Minimalist header for each phase row
 *
 * Design Philosophy:
 * - Monochromatic base with subtle phase color tint
 * - Phase color only on left border accent (4px)
 * - Semantic HTML with proper heading structure
 * - Accessible time range for screen readers
 * - Theme-aware (light/dark)
 *
 * FIXED: Removed heavy colored background (was violating design system)
 */
export function PhaseHeader({ phaseConfig }: PhaseHeaderProps) {
  const { emoji, label, color, startHour, endHour, phase } = phaseConfig;
  const { theme } = useTheme();

  // Format time range (handle wrap-around for night)
  const formatHour = (hour: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };

  const timeRange =
    endHour <= startHour
      ? `${formatHour(startHour)} - ${formatHour(endHour)} (next day)`
      : `${formatHour(startHour)} - ${formatHour(endHour)}`;

  // Get subtle tint from theme config (10% opacity for background)
  const currentTheme = theme === "dark" ? "dark" : "light";
  const phaseTint =
    themeConfig[currentTheme].phase[
      phase as unknown as keyof typeof themeConfig.light.phase
    ]?.tint || color;

  return (
    <header
      className="flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 bg-surface-alt transition-colors"
      style={{
        borderLeftColor: color,
        backgroundColor: phaseTint,
      }}
    >
      <span className="text-2xl" aria-hidden="true">
        {emoji}
      </span>
      <div className="flex flex-row gap-0.5">
        <h3 className="font-semibold text-base text-foreground">{label}</h3>
        <span className="text-xs text-text-secondary font-mono">
          {timeRange}
        </span>
      </div>
    </header>
  );
}
