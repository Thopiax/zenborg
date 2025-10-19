"use client";

import { useEffect } from "react";
import {
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/**
 * Generic option for selector
 */
export interface SelectorOption<T = string> {
  value: T;
  label: string;
  /** Optional keyboard shortcut (e.g., "1", "M", "A") */
  hotkey?: string;
  /** Optional description shown as subtitle */
  description?: string;
  /** Optional icon/emoji to display before label */
  icon?: React.ReactNode;
  /** Optional left accent (e.g., colored bar for areas) */
  leftAccent?: {
    color: string;
    width?: string;
    height?: string;
  };
  /** Custom className for the option */
  className?: string;
}

interface SelectorDialogProps<T = string> {
  open: boolean;
  title: string;
  description?: string;
  heading?: string;
  options: SelectorOption<T>[];
  selectedValue?: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
  /** Max width of dialog (default: "max-w-md") */
  maxWidth?: string;
  /** Enable keyboard shortcuts automatically */
  enableHotkeys?: boolean;
}

/**
 * SelectorDialog - Reusable command palette for selections
 *
 * Features:
 * - Configurable options with hotkeys
 * - Optional icons, descriptions, and left accents
 * - Automatic keyboard shortcut handling
 * - Consistent styling across all selectors
 * - DRY principle - single source of truth for selector UI
 *
 * Usage:
 * ```tsx
 * <SelectorDialog
 *   open={isOpen}
 *   title="Select Phase"
 *   heading="Phase"
 *   options={[
 *     { value: "MORNING", label: "Morning", hotkey: "M", icon: "☕" },
 *     { value: "AFTERNOON", label: "Afternoon", hotkey: "A", icon: "☀️" },
 *   ]}
 *   selectedValue={selectedPhase}
 *   onSelect={setPhase}
 *   onClose={() => setIsOpen(false)}
 *   enableHotkeys
 * />
 * ```
 */
export function SelectorDialog<T = string>({
  open,
  title,
  description,
  heading,
  options,
  selectedValue,
  onSelect,
  onClose,
  maxWidth = "max-w-md",
  enableHotkeys = true,
}: SelectorDialogProps<T>) {
  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open || !enableHotkeys) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Find option with matching hotkey
      const option = options.find(
        (opt) => opt.hotkey?.toLowerCase() === e.key.toLowerCase()
      );

      if (option) {
        e.preventDefault();
        onSelect(option.value);
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, enableHotkeys, options, onSelect, onClose]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={title}
      description={description}
      showCloseButton={false}
      className={maxWidth}
    >
      <CommandList className="max-h-96 p-2">
        <CommandGroup heading={heading} className="gap-1.5">
          {options.map((option, index) => {
            const isSelected = selectedValue === option.value;

            return (
              <CommandItem
                key={`${option.value}-${index}`}
                value={String(option.value)}
                onSelect={() => {
                  onSelect(option.value);
                  onClose();
                }}
                className={cn(
                  "cursor-pointer px-4 py-4 mb-1.5 rounded-lg",
                  isSelected && "bg-stone-100 dark:bg-stone-800",
                  option.className
                )}
              >
                {/* Left accent (e.g., colored bar for areas) */}
                {option.leftAccent && (
                  <div
                    className="rounded-full mr-4 flex-shrink-0"
                    style={{
                      backgroundColor: option.leftAccent.color,
                      width: option.leftAccent.width || "6px",
                      height: option.leftAccent.height || "40px",
                    }}
                    aria-hidden="true"
                  />
                )}

                {/* Icon/Emoji */}
                {option.icon && (
                  <span
                    className="text-2xl mr-4 flex-shrink-0"
                    aria-hidden="true"
                  >
                    {option.icon}
                  </span>
                )}

                {/* Label and optional description */}
                <div className="flex-1">
                  <span className="font-medium text-lg block">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="text-sm text-stone-500 dark:text-stone-400 block mt-0.5">
                      {option.description}
                    </span>
                  )}
                </div>

                {/* Hotkey shortcut */}
                {option.hotkey && (
                  <CommandShortcut className="text-base font-mono bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded">
                    {option.hotkey}
                  </CommandShortcut>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
