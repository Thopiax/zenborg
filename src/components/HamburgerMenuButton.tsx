"use client";

import { Menu, X } from "lucide-react";

interface HamburgerMenuButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

/**
 * Minimalistic hamburger menu button
 * - Opens settings drawer
 * - Positioned in top-right corner
 * - Animates between hamburger and X icon
 * - Monochromatic stone design
 */
export function HamburgerMenuButton({ isOpen, onClick }: HamburgerMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-all duration-200"
      aria-label={isOpen ? "Close settings" : "Open settings"}
      aria-expanded={isOpen}
    >
      <div className="relative w-5 h-5">
        {/* Hamburger icon */}
        <Menu
          className={`absolute inset-0 w-5 h-5 transition-all duration-200 ${
            isOpen ? "opacity-0 rotate-90" : "opacity-100 rotate-0"
          }`}
        />
        {/* X icon */}
        <X
          className={`absolute inset-0 w-5 h-5 transition-all duration-200 ${
            isOpen ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"
          }`}
        />
      </div>
    </button>
  );
}
