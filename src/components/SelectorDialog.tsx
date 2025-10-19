"use client";

import { Check } from "lucide-react";
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
  /** Custom element rendered on the right side (e.g., action button) */
  rightElement?: React.ReactNode;
  /** Whether the dialog should close after selecting this option (default: true) */
  closeOnSelect?: boolean;
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
  /** Optional content rendered before the options list (e.g., inline form) */
  beforeOptions?: React.ReactNode;
  /** Optional content rendered after the options list */
  afterOptions?: React.ReactNode;
  /** Optional content rendered in the header on the right side (e.g., action buttons) */
  rightHeader?: React.ReactNode;
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
  beforeOptions,
  afterOptions,
  rightHeader,
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
      rightHeader={rightHeader}
      className={maxWidth}
      value={selectedValue ? String(selectedValue) : undefined}
    >
      <CommandList className="max-h-96 p-2">
        {beforeOptions}
        <CommandGroup heading={heading} className="gap-1.5">
          {options.map((option, index) => {
            const isSelected = selectedValue === option.value;
            const shouldClose = option.closeOnSelect ?? true;

            return (
              <CommandItem
                key={`${option.value}-${index}`}
                value={String(option.value)}
                onSelect={() => {
                  onSelect(option.value);
                  if (shouldClose) {
                    onClose();
                  }
                }}
                className={cn(
                  "cursor-pointer px-4 py-4 mb-1.5 rounded-lg transition-all",
                  // Override cmdk's default keyboard selection styling (subtle for keyboard nav)
                  "data-[selected=true]:bg-stone-200/40 dark:data-[selected=true]:bg-stone-700/40",
                  // Hover state
                  "hover:bg-stone-200/60 dark:hover:bg-stone-700/60",
                  // Our explicit selected state (checkmark) takes precedence
                  isSelected &&
                    "!bg-stone-900 !text-stone-50 dark:!bg-stone-100 dark:!text-stone-900",
                  isSelected && "hover:!bg-stone-800 dark:hover:!bg-stone-200",
                  option.className
                )}
              >
                {/* Selected indicator (checkmark) - appears on the far left */}
                <div className="w-5 h-5 mr-3 flex-shrink-0 flex items-center justify-center">
                  {isSelected && <Check className="w-5 h-5" strokeWidth={3} />}
                </div>

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
                    <span
                      className={cn(
                        "text-sm block mt-0.5",
                        isSelected
                          ? "text-stone-200 dark:text-stone-700"
                          : "text-stone-500 dark:text-stone-400"
                      )}
                    >
                      {option.description}
                    </span>
                  )}
                </div>

                {/* Hotkey shortcut */}
                {(option.rightElement || option.hotkey) && (
                  <div className="flex items-center gap-2">
                    {option.rightElement}
                    {option.hotkey && (
                      <CommandShortcut
                        className={cn(
                          "text-base font-mono px-2 py-1 rounded",
                          isSelected
                            ? "bg-stone-700 text-stone-100 dark:bg-stone-300 dark:text-stone-900"
                            : "bg-stone-100 dark:bg-stone-800"
                        )}
                      >
                        {option.hotkey}
                      </CommandShortcut>
                    )}
                  </div>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {afterOptions}
      </CommandList>
    </CommandDialog>
  );
}
