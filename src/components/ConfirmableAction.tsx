"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ConfirmableActionProps {
  /** The text prompt user must type to confirm (e.g., "DELETE ALL DATA") */
  confirmText: string;
  /** Button label when not in confirmation mode */
  buttonLabel: string;
  /** Button variant/style */
  variant?: "danger" | "warning" | "default";
  /** Callback when action is confirmed */
  onConfirm: () => void;
  /** Optional description of what will happen */
  description?: string;
}

/**
 * ConfirmableAction - A button that requires typing a specific text to confirm
 *
 * Pattern:
 * 1. Click button → Shows input field with prompt
 * 2. User types confirmation text
 * 3. "Confirm" button enables when text matches
 * 4. Can cancel to go back to initial state
 *
 * Usage:
 * <ConfirmableAction
 *   buttonLabel="Reset Database"
 *   confirmText="RESET"
 *   variant="danger"
 *   description="This will permanently delete all moments, areas, and settings."
 *   onConfirm={handleReset}
 * />
 */
export function ConfirmableAction({
  confirmText,
  buttonLabel,
  variant = "default",
  onConfirm,
  description,
}: ConfirmableActionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const isConfirmEnabled = inputValue === confirmText;

  const handleInitiate = () => {
    setIsConfirming(true);
    setInputValue("");
  };

  const handleCancel = () => {
    setIsConfirming(false);
    setInputValue("");
  };

  const handleConfirm = () => {
    if (isConfirmEnabled) {
      onConfirm();
      setIsConfirming(false);
      setInputValue("");
    }
  };

  const variantStyles = {
    danger: {
      button:
        "bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800",
      confirmButton:
        "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 dark:bg-red-700 dark:hover:bg-red-800 dark:disabled:bg-red-900",
    },
    warning: {
      button:
        "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-700 dark:hover:bg-amber-800",
      confirmButton:
        "bg-amber-600 hover:bg-amber-700 text-white disabled:bg-amber-300 dark:bg-amber-700 dark:hover:bg-amber-800 dark:disabled:bg-amber-900",
    },
    default: {
      button:
        "bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-200 dark:hover:bg-stone-300 dark:text-stone-900",
      confirmButton:
        "bg-stone-800 hover:bg-stone-900 text-white disabled:bg-stone-300 dark:bg-stone-200 dark:hover:bg-stone-300 dark:text-stone-900 dark:disabled:bg-stone-700",
    },
  };

  const styles = variantStyles[variant];

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={handleInitiate}
        className={cn(
          "px-4 py-2 rounded-lg font-mono text-sm transition-colors",
          styles.button
        )}
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 border border-stone-300 dark:border-stone-700 rounded-lg bg-stone-50 dark:bg-stone-900">
      {description && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {description}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="confirm-input"
          className="text-sm font-mono text-stone-700 dark:text-stone-300"
        >
          Type <strong className="font-bold">{confirmText}</strong> to confirm:
        </label>
        <input
          id="confirm-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="px-3 py-2 border border-stone-300 dark:border-stone-600 rounded bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder={confirmText}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && isConfirmEnabled) {
              handleConfirm();
            } else if (e.key === "Escape") {
              handleCancel();
            }
          }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isConfirmEnabled}
          className={cn(
            "px-4 py-2 rounded-lg font-mono text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            styles.confirmButton
          )}
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 rounded-lg font-mono text-sm bg-stone-200 hover:bg-stone-300 text-stone-900 dark:bg-stone-700 dark:hover:bg-stone-600 dark:text-stone-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
