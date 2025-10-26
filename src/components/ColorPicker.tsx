"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

/**
 * ColorPicker - Simple color selection grid
 *
 * Provides a palette of monochrome + accent colors following Zenborg's design system:
 * - Monochromatic grays (stone tones)
 * - Area accent colors (wellness green, craft blue, social orange, etc.)
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Color palette: monochrome + area accents
  const colors = [
    // Monochromatic (stone tones)
    { name: "Stone 400", hex: "#a8a29e" },
    { name: "Stone 500", hex: "#78716c" },
    { name: "Stone 600", hex: "#57534e" },
    { name: "Stone 700", hex: "#44403c" },

    // Area accent colors (from PRD)
    { name: "Wellness (Green)", hex: "#10b981" },
    { name: "Craft (Blue)", hex: "#3b82f6" },
    { name: "Social (Orange)", hex: "#f97316" },
    { name: "Joyful (Yellow)", hex: "#eab308" },
    { name: "Introspective (Gray)", hex: "#6b7280" },

    // Additional accents
    { name: "Purple", hex: "#8b5cf6" },
    { name: "Pink", hex: "#ec4899" },
    { name: "Red", hex: "#ef4444" },
    { name: "Cyan", hex: "#06b6d4" },
    { name: "Emerald", hex: "#059669" },
    { name: "Amber", hex: "#f59e0b" },
    { name: "Indigo", hex: "#6366f1" },
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-8 h-8 rounded-lg border-2 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 transition-all shadow-sm"
          style={{ backgroundColor: value }}
          aria-label="Pick a color"
        />
      </PopoverTrigger>
      <PopoverContent className="w-fit p-3" align="start">
        <div className="grid grid-cols-4 gap-2">
          {colors.map((color) => (
            <button
              key={color.hex}
              type="button"
              onClick={() => {
                onChange(color.hex);
                setIsOpen(false);
              }}
              className="w-12 h-12 rounded-lg border-2 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 transition-all relative group"
              style={{ backgroundColor: color.hex }}
              title={color.name}
            >
              {value === color.hex && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check
                    className="w-5 h-5 text-white drop-shadow-lg"
                    strokeWidth={3}
                  />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Custom Color Input */}
        <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-700">
          <label
            htmlFor="custom-color-input"
            className="text-xs text-stone-500 dark:text-stone-400 mb-1 block"
          >
            Custom hex
          </label>
          <input
            id="custom-color-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-300 dark:focus:ring-stone-600 font-mono"
            maxLength={7}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
