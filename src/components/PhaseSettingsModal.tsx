"use client";

import { observer } from "@legendapp/state/react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PhaseConfig } from "@/domain/value-objects/Phase";
import { phaseConfigs$ } from "@/infrastructure/state/store";
import { CircularPhaseSlider } from "./CircularPhaseSlider";

interface PhaseSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * PhaseSettingsModal - Configure phase time boundaries with unified timeline slider
 *
 * Features:
 * - Unified 24-hour timeline with draggable phase boundaries
 * - Visual representation of all phases on one slider
 * - Wake up time (start of first phase)
 * - Bedtime (end of last phase)
 * - Phase visibility toggles
 * - Label and emoji editing (inline)
 * - Monochromatic design
 */
export const PhaseSettingsModal = observer(function PhaseSettingsModal({
  open,
  onClose,
}: PhaseSettingsModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    emoji: "",
  });

  // Get all phases in their natural order (Morning, Afternoon, Evening, Night)
  const phaseConfigs = Object.values(phaseConfigs$.get() || {}).sort(
    (a, b) => a.order - b.order
  );

  const handleStartEdit = (config: PhaseConfig) => {
    setFormData({
      label: config.label,
      emoji: config.emoji,
    });
    setEditingId(config.id);
  };

  const handleSaveEdit = () => {
    if (!editingId || !formData.label.trim()) return;

    phaseConfigs$[editingId].set((prev) => ({
      ...prev,
      label: formData.label.trim(),
      emoji: formData.emoji,
      updatedAt: new Date().toISOString(),
    }));

    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ label: "", emoji: "" });
  };

  const handleVisibilityToggle = (configId: string) => {
    phaseConfigs$[configId].set((prev) => ({
      ...prev,
      isVisible: !prev.isVisible,
      updatedAt: new Date().toISOString(),
    }));
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full h-full max-w-full max-h-full sm:max-w-3xl sm:max-h-[85dvh] overflow-y-auto rounded-none sm:rounded-lg p-0 gap-0">
        <DialogHeader>
          <DialogTitle>Phase Settings</DialogTitle>
          <DialogDescription>
            Configure your daily rhythm with phase boundaries
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 px-6 py-6">
          {/* Circular Timeline Slider */}
          <div className="space-y-6">
            {/* <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-center">
              Daily Timeline
            </h3> */}

            <CircularPhaseSlider
              phaseConfigs={phaseConfigs}
              onUpdatePhase={(phaseId, updates) => {
                phaseConfigs$[phaseId].set((prev) => ({
                  ...prev,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                }));
              }}
            />
          </div>

          {/* Phase Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Phase Details
            </h3>

            <div className="space-y-2">
              {phaseConfigs.map((config) => (
                <div
                  key={config.id}
                  className={`p-3 rounded-lg border transition-all ${
                    editingId === config.id
                      ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
                      : "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {editingId === config.id ? (
                      // Edit Mode
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={formData.emoji}
                          onChange={(e) =>
                            setFormData({ ...formData, emoji: e.target.value })
                          }
                          className="w-12 px-2 py-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-center text-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
                          maxLength={2}
                        />
                        <input
                          type="text"
                          value={formData.label}
                          onChange={(e) =>
                            setFormData({ ...formData, label: e.target.value })
                          }
                          className="flex-1 px-2 py-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveEdit}
                          disabled={!formData.label.trim()}
                          className="px-2 py-1 text-xs bg-stone-700 dark:bg-stone-300 text-stone-50 dark:text-stone-900 rounded hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-2 py-1 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      // Display Mode
                      <>
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-lg">{config.emoji}</span>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                              {config.label}
                            </div>
                            <div className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                              {formatHour(config.startHour)} -{" "}
                              {formatHour(config.endHour)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEdit(config)}
                            className="px-2 py-1 text-xs rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={config.isVisible}
                            onClick={() => handleVisibilityToggle(config.id)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              config.isVisible
                                ? "bg-stone-700 dark:bg-stone-300"
                                : "bg-stone-300 dark:bg-stone-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-stone-50 dark:bg-stone-900 transition-transform ${
                                config.isVisible
                                  ? "translate-x-5"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="px-6 pt-4 pb-6 border-t border-stone-200 dark:border-stone-700">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Adjust the timeline sliders to set your daily rhythm. Phase
            boundaries automatically update adjacent phases.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
});
