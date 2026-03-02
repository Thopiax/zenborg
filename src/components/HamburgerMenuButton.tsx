"use client";

import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HamburgerMenuButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

/**
 * Settings button - Clean, minimal icon button
 *
 * Simplified from animated hamburger to a single settings icon.
 * Matches Claude's minimal top-bar aesthetic.
 */
export function HamburgerMenuButton({
  isOpen,
  onClick,
}: HamburgerMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md text-stone-500 dark:text-stone-400 transition-colors duration-150",
        "hover:text-stone-700 dark:hover:text-stone-300",
        "hover:bg-stone-100 dark:hover:bg-stone-800",
        isOpen && "text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800"
      )}
      aria-label={isOpen ? "Close settings" : "Open settings"}
      aria-expanded={isOpen}
    >
      <Settings2 className="w-4.5 h-4.5" />
    </button>
  );
}
