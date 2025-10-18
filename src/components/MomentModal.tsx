/** biome-ignore-all lint/a11y/useButtonType: <explanation> */
"use client";

import { X } from "lucide-react";
import type { Horizon } from "@/domain/entities/Moment";
import { MomentForm } from "./MomentForm";

interface MomentModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialName?: string;
  initialAreaId?: string;
  initialHorizon?: Horizon | null;
  /** Whether the moment is allocated (has day/phase). If true, horizon selector is hidden. */
  isAllocated?: boolean;
  onSave: (name: string, areaId: string, horizon: Horizon | null) => void;
  onCancel: () => void;
}

/**
 * MomentModal - Shared modal wrapper for creating/editing moments
 *
 * Uses MomentForm for consistent UI/UX between create and edit flows.
 * - Create mode: Shows "Create more" option
 * - Edit mode: Pre-fills name and area
 */
export function MomentModal({
  open,
  mode,
  initialName = "",
  initialAreaId = "",
  initialHorizon = null,
  isAllocated = false,
  onSave,
  onCancel,
}: MomentModalProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop - hidden on mobile (full screen), visible on desktop */}
      <div
        className="hidden md:block fixed inset-0 bg-black/40 dark:bg-black/60 z-50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal - Full screen on mobile, centered on desktop */}
      <div
        className="fixed inset-0 md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 md:w-full md:max-w-2xl md:mx-4 md:inset-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="moment-modal-title"
      >
        <div className="bg-surface md:rounded-xl shadow-2xl overflow-hidden border-0 md:border border-border flex flex-col h-full md:h-auto md:max-h-[85vh] relative">
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-2 right-2  z-10 p-2 rounded-lg hover:bg-border transition-colors text-text-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <MomentForm
            mode={mode}
            initialName={initialName}
            initialAreaId={initialAreaId}
            initialHorizon={initialHorizon}
            isAllocated={isAllocated}
            onSave={onSave}
            onCancel={onCancel}
            showCreateMore={mode === "create"}
          />
        </div>
      </div>
    </>
  );
}
