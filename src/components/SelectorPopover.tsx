"use client";

import { Check } from "lucide-react";
import { useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  /** Whether the popover should close after selecting this option (default: true) */
  closeOnSelect?: boolean;
  /** Custom className for the option */
  className?: string;
}

interface SelectorPopoverProps<T = string> {
  open: boolean;
  trigger: React.ReactNode;
  options: SelectorOption<T>[];
  selectedValue?: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
  /** Called when popover should open (when trigger is clicked) */
  onOpen?: () => void;
  /** Enable keyboard shortcuts automatically */
  enableHotkeys?: boolean;
  /** Optional content rendered before the options list (e.g., inline form) */
  beforeOptions?: React.ReactNode;
  /** Optional actions rendered at bottom with separator */
  actions?: React.ReactNode;
  /** Popover side (default: "bottom") */
  side?: "top" | "right" | "bottom" | "left";
  /** Popover alignment (default: "center") */
  align?: "start" | "center" | "end";
  /** Element to use as collision boundary (e.g., dialog container) */
  collisionBoundary?: Element | null | Array<Element | null>;
}

/**
 * SelectorPopover - Reusable popover-based selector
 *
 * Features:
 * - Compact popover UI (max 50% width, scrollable)
 * - No title (cleaner than dialog)
 * - Hotkey indicators preserved
 * - Actions section at bottom with separator
 * - Automatic keyboard shortcut handling
 * - No z-index conflicts with parent dialogs
 *
 * Usage:
 * ```tsx
 * <SelectorPopover
 *   open={isOpen}
 *   trigger={<button>Select Phase</button>}
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
export function SelectorPopover<T = string>({
  open,
  trigger,
  options,
  selectedValue,
  onSelect,
  onClose,
  onOpen,
  enableHotkeys = true,
  beforeOptions,
  actions,
  side = "bottom",
  align = "center",
  collisionBoundary,
}: SelectorPopoverProps<T>) {
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
        const shouldClose = option.closeOnSelect ?? true;
        onSelect(option.value);
        if (shouldClose) {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, enableHotkeys, options, onSelect, onClose]);

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          onOpen?.();
        } else {
          onClose();
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-auto min-w-[20vw] max-w-[50vw] !p-0 max-h-[30vh] overflow-hidden h-full"
        sideOffset={8}
        collisionPadding={16}
        // collisionBoundary={collisionBoundary}
      >
        {/* Before options content (e.g., inline forms) */}
        <div className="flex flex-col overflow-y-auto">
          {beforeOptions && (
            <>
              <div className="p-4">{beforeOptions}</div>
              <div className="h-px bg-stone-200 dark:bg-stone-700 my-2" />
            </>
          )}

          {/* Scrollable options list */}
          <div className="p-2 flex flex-col gap-1">
            {options.map((option, index) => {
              const isSelected = selectedValue === option.value;
              const shouldClose = option.closeOnSelect ?? true;

              return (
                <button
                  key={`${option.value}-${index}`}
                  type="button"
                  onClick={() => {
                    onSelect(option.value);
                    if (shouldClose) {
                      onClose();
                    }
                  }}
                  className={cn(
                    "cursor-pointer px-4 py-3 rounded-lg transition-all flex items-center text-left",
                    // Hover state
                    "hover:bg-stone-200/60 dark:hover:bg-stone-700/60",
                    // Selected state
                    isSelected &&
                      "!bg-stone-300/60 hover:!bg-stone-200 !text-stone-900 dark:!bg-stone-100 dark:hover:!bg-stone-200 dark:!text-stone-900",
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
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-base block">
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

                  {/* Right element and hotkey */}
                  {(option.rightElement || option.hotkey) && (
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      {option.rightElement}
                      {/* Selected indicator (checkmark) */}
                      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                        {isSelected && (
                          <Check className="w-5 h-5" strokeWidth={3} />
                        )}
                      </div>
                      {option.hotkey && (
                        <kbd
                          className={cn(
                            "text-sm font-mono px-2 py-1 rounded",
                            isSelected
                              ? "bg-stone-700 text-stone-100 dark:bg-stone-300 dark:text-stone-900"
                              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                          )}
                        >
                          {option.hotkey}
                        </kbd>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions section with separator */}
          {actions && (
            <>
              <div className="h-px bg-stone-200 dark:bg-stone-700 my-2" />
              <div className="p-2">{actions}</div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
