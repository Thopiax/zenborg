"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmableAction } from "./ConfirmableAction";
import { resetStore } from "@/infrastructure/state/initialize";

/**
 * Reset button component with text-based confirmation
 *
 * Features:
 * - Requires typing "RESET" to confirm action
 * - Calls resetStore() which clears all data and reinitializes defaults
 * - Shows loading state during reset
 * - Fixed position in top-right corner
 */
export function ResetButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      console.log("[ResetButton] Starting database reset...");
      await resetStore();
      console.log("[ResetButton] Reset complete, reloading page...");
      // Force page reload to ensure all components re-render with fresh data
      window.location.reload();
    } catch (error) {
      console.error("[ResetButton] Failed to reset store:", error);
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="fixed top-6 right-6 z-40 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 shadow-md hover:shadow-lg transition-all p-3 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Reset all data"
          disabled={isResetting}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset all data?</DialogTitle>
          <DialogDescription>
            This will permanently delete all moments, and reset areas, phases,
            and cycles to factory defaults. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isResetting ? (
            <div className="text-center text-stone-600 dark:text-stone-400 font-mono">
              Resetting...
            </div>
          ) : (
            <ConfirmableAction
              buttonLabel="Reset Everything"
              confirmText="RESET"
              variant="danger"
              description="Type RESET below to permanently delete all data:"
              onConfirm={handleReset}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
