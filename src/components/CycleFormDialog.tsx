/** biome-ignore-all lint/a11y/useButtonType: button type is specified where needed */
"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { TemplateDuration } from "@/application/services/CycleService";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CycleFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  cycleId?: string;
  initialName?: string;
  initialStartDate?: string;
  initialEndDate?: string | null;
  onClose: () => void;
  onSave: (
    name: string,
    templateDuration?: TemplateDuration,
    startDate?: string,
    endDate?: string | null
  ) => void;
  onUpdate?: (
    cycleId: string,
    updates: { name?: string; startDate?: string; endDate?: string | null }
  ) => void;
  onDelete?: (cycleId: string) => void;
}

/**
 * CycleFormDialog - Dialog component for creating/editing cycles
 *
 * Features:
 * - Date inputs (start date required, end date optional)
 * - Cycle name input with validation
 * - Enter to save, Escape to cancel
 * - Delete functionality for edit mode
 *
 * Keyboard Navigation:
 * - Tab: Cycle through fields
 * - Enter: Save cycle
 * - Escape: Close dialog
 */
export function CycleFormDialog({
  open,
  mode,
  cycleId,
  initialName = "",
  initialStartDate = "",
  initialEndDate = null,
  onClose,
  onSave,
  onUpdate,
  onDelete,
}: CycleFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset form when dialog opens or initial values change
  useEffect(() => {
    if (!open) return;

    setName(initialName);
    setStartDate(initialStartDate);
    setEndDate(initialEndDate || "");
    setShowDeleteConfirm(false);
  }, [open, mode, initialName, initialStartDate, initialEndDate]);

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      if (mode === "edit") {
        inputRef.current.select();
      }
    }
  }, [mode, open]);

  // Enter to save
  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      handleSave();
    },
    { enableOnFormTags: true, enabled: open }
  );

  const handleSave = () => {
    if (!name.trim()) {
      return; // Name is required
    }

    if (!startDate) {
      return; // Start date is required
    }

    if (mode === "create") {
      onSave(name, undefined, startDate, endDate || null);
    } else if (mode === "edit" && onUpdate && cycleId) {
      onUpdate(cycleId, {
        name: name.trim(),
        startDate,
        endDate: endDate || null,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (showDeleteConfirm && onDelete && cycleId) {
      onDelete(cycleId);
      onClose();
    } else {
      setShowDeleteConfirm(true);
      // Reset confirmation after 3 seconds
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  const canSave = name.trim().length > 0 && startDate.length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent ref={dialogRef} className="p-0 gap-0 max-w-2xl">
        {/* Header */}
        <DialogHeader className="border-b border-stone-200 dark:border-stone-700">
          <DialogTitle className="text-sm font-medium text-stone-600 dark:text-stone-400">
            {mode === "create" ? "New cycle" : "Edit cycle"}
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-6 flex-1 overflow-y-auto">
          {/* Cycle Name - Prominent */}
          <div className="relative mb-6 w-full">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-4xl font-bold bg-transparent outline-none text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
              placeholder="Cycle name..."
              aria-label="Cycle name"
            />

            {/* Validation */}
            {name.trim().length === 0 && name.length > 0 && (
              <p
                className="text-sm text-red-500 dark:text-red-400 mt-2"
                role="alert"
              >
                Cycle name is required
              </p>
            )}
          </div>

          {/* Date Inputs - Always shown */}
          <div className="space-y-3">
            <div>
              <label
                htmlFor="cycle-start-date"
                className="block text-sm font-mono text-stone-700 dark:text-stone-300 mb-1"
              >
                Start Date
              </label>
              <input
                id="cycle-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
            <div>
              <label
                htmlFor="cycle-end-date"
                className="block text-sm font-mono text-stone-700 dark:text-stone-300 mb-1"
              >
                End Date (optional)
              </label>
              <div className="relative">
                <input
                  id="cycle-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                {endDate && (
                  <button
                    type="button"
                    onClick={() => setEndDate("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                    title="Clear end date"
                  >
                    <X className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex flex-row items-center justify-end gap-2">
          {/* Left side: Delete button (edit mode only) */}
          {mode === "edit" && onDelete ? (
            <button
              onClick={handleDelete}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                showDeleteConfirm
                  ? "bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700"
                  : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">
                {showDeleteConfirm ? "Confirm delete?" : "Delete"}
              </span>
            </button>
          ) : (
            <div />
          )}

          {/* Right side: Save buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                "px-5 py-2 rounded-lg font-medium transition-all",
                canSave
                  ? "bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 hover:opacity-90 active:scale-95"
                  : "bg-stone-300 dark:bg-stone-700 text-stone-500 dark:text-stone-400 cursor-not-allowed"
              )}
            >
              {mode === "create" ? "Create cycle" : "Save changes"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
