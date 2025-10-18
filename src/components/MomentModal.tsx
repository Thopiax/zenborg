/** biome-ignore-all lint/a11y/useButtonType: <explanation> */
"use client";

import { MomentForm } from "./MomentForm";

interface MomentModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialName?: string;
  initialAreaId?: string;
  onSave: (name: string, areaId: string) => void;
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
  onSave,
  onCancel,
}: MomentModalProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="moment-modal-title"
      >
        <div className="bg-stone-900 rounded-xl shadow-2xl overflow-hidden border border-stone-700 flex flex-col max-h-[85vh]">
          <MomentForm
            mode={mode}
            initialName={initialName}
            initialAreaId={initialAreaId}
            onSave={onSave}
            onCancel={onCancel}
            showCreateMore={mode === "create"}
          />
        </div>
      </div>
    </>
  );
}
