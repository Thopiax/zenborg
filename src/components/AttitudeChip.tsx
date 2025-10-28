"use client";

import { ATTITUDE_METADATA } from "@/domain/value-objects/Attitude";
import type { Attitude } from "@/domain/value-objects/Attitude";
import { cn } from "@/lib/utils";

interface AttitudeChipProps {
  attitude: Attitude | null;
  onClick: () => void;
  className?: string;
}

/**
 * AttitudeChip - Clickable chip showing current attitude
 *
 * Styled like a badge but distinct from tag badges:
 * - Shows attitude icon + label
 * - Click opens AttitudeSelector
 * - Visual treatment: bordered, subtle background
 */
export function AttitudeChip({ attitude, onClick, className }: AttitudeChipProps) {
  const metadata = attitude
    ? ATTITUDE_METADATA[attitude]
    : {
        icon: "○",
        label: "Pure presence",
        className: "font-mono text-stone-700 dark:text-stone-300",
      };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md",
        "border border-stone-300 dark:border-stone-600",
        "bg-white dark:bg-stone-950",
        "hover:bg-stone-50 dark:hover:bg-stone-900",
        "text-xs font-mono transition-colors",
        metadata.className,
        className
      )}
      title={`Attitude: ${metadata.label}`}
    >
      <span className="text-sm">{metadata.icon}</span>
      <span>{metadata.label}</span>
    </button>
  );
}
