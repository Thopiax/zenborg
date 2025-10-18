/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
"use client";

import { observer } from "@legendapp/state/react";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Area } from "@/domain/entities/Area";
import { canDeleteArea, createArea, updateArea } from "@/domain/entities/Area";
import { areas$, moments$ } from "@/infrastructure/state/store";
import { ColorPicker } from "./ColorPicker";

interface AreaManagementModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * AreaManagementModal - Manage custom areas (CRUD + reordering)
 *
 * Features:
 * - List all areas with color/emoji
 * - Create new areas
 * - Edit existing areas (inline)
 * - Delete areas (with FK constraint check)
 * - Reorder areas (drag & drop - TODO)
 */
export const AreaManagementModal = observer(function AreaManagementModal({
  open,
  onClose,
}: AreaManagementModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#10b981",
    emoji: "🔵",
  });

  const areas = Object.values(areas$.get() || {}).sort(
    (a, b) => a.order - b.order
  );
  const allMoments = Object.values(moments$.get() || {});

  if (!open) {
    return null;
  }

  const handleStartCreate = () => {
    setFormData({ name: "", color: "#10b981", emoji: "🔵" });
    setIsCreating(true);
    setEditingId(null);
  };

  const handleStartEdit = (area: Area) => {
    setFormData({
      name: area.name,
      color: area.color,
      emoji: area.emoji,
    });
    setEditingId(area.id);
    setIsCreating(false);
  };

  const handleSaveCreate = () => {
    if (!formData.name.trim()) return;

    // Calculate order: place new area at the end
    const maxOrder = areas.reduce((max, area) => Math.max(max, area.order), -1);

    const result = createArea(
      formData.name.trim(),
      formData.color,
      formData.emoji,
      maxOrder + 1
    );

    if ("error" in result) {
      alert(result.error);
      return;
    }

    areas$.set((prev) => ({
      ...prev,
      [result.id]: result,
    }));

    setIsCreating(false);
    setFormData({ name: "", color: "#10b981", emoji: "🔵" });
  };

  const handleSaveEdit = () => {
    if (!editingId || !formData.name.trim()) return;

    const existingArea = areas$.get()[editingId];
    if (!existingArea) return;

    const result = updateArea(existingArea, {
      name: formData.name.trim(),
      color: formData.color,
      emoji: formData.emoji,
    });

    if ("error" in result) {
      alert(result.error);
      return;
    }

    areas$[editingId].set(result);
    setEditingId(null);
  };

  const handleDelete = (areaId: string) => {
    const area = areas$.get()[areaId];
    if (!area) return;

    const canDelete = canDeleteArea(area, allMoments);
    if (!canDelete) {
      alert("Cannot delete area: moments are still assigned to it.");
      return;
    }

    if (confirm(`Delete "${area.name}"? This cannot be undone.`)) {
      areas$[areaId].delete();
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({ name: "", color: "#10b981", emoji: "🔵" });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="hidden md:block fixed inset-0 bg-black/40 dark:bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 md:w-full md:max-w-2xl md:mx-4 md:inset-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="area-modal-title"
      >
        <div className="bg-surface md:rounded-xl shadow-2xl overflow-hidden border-0 md:border border-border flex flex-col h-full md:h-auto md:max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2
              id="area-modal-title"
              className="text-xl font-semibold text-text-primary"
            >
              Manage Areas
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-border transition-colors text-text-secondary hover:text-text-primary"
              aria-label="Close"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Create New Area Button */}
            {!isCreating && !editingId && (
              <button
                onClick={handleStartCreate}
                className="w-full p-4 border-2 border-dashed border-border hover:border-text-tertiary rounded-lg transition-colors flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary"
                type="button"
              >
                <Plus className="w-5 h-5" />
                <span>Create New Area</span>
              </button>
            )}

            {/* Create Form */}
            {isCreating && (
              <div className="p-4 border-2 border-text-tertiary rounded-lg bg-surface-elevated space-y-3">
                <h3 className="font-medium text-text-primary">New Area</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Area name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-text-tertiary"
                    autoFocus
                  />
                  <div className="flex items-center gap-3">
                    <ColorPicker
                      value={formData.color}
                      onChange={(color) => setFormData({ ...formData, color })}
                    />
                    <input
                      type="text"
                      placeholder="Emoji"
                      value={formData.emoji}
                      onChange={(e) =>
                        setFormData({ ...formData, emoji: e.target.value })
                      }
                      className="w-20 px-3 py-2 bg-surface border border-border rounded-lg text-center text-xl focus:outline-none focus:ring-2 focus:ring-text-tertiary"
                      maxLength={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveCreate}
                      disabled={!formData.name.trim()}
                      className="flex-1 px-4 py-2 bg-text-primary text-surface rounded-lg hover:bg-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                    >
                      Create
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-surface-elevated transition-colors text-text-secondary hover:text-text-primary"
                      type="reset"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Areas List */}
            <div className="space-y-2">
              {areas.map((area) => (
                <div
                  key={area.id}
                  className={`p-4 rounded-lg border transition-all ${
                    editingId === area.id
                      ? "border-text-tertiary bg-surface-elevated"
                      : "border-border hover:border-text-tertiary bg-surface"
                  }`}
                >
                  {editingId === area.id ? (
                    // Edit Form
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-text-tertiary"
                        autoFocus
                      />
                      <div className="flex items-center gap-3">
                        <ColorPicker
                          value={formData.color}
                          onChange={(color) =>
                            setFormData({ ...formData, color })
                          }
                        />
                        <input
                          type="text"
                          value={formData.emoji}
                          onChange={(e) =>
                            setFormData({ ...formData, emoji: e.target.value })
                          }
                          className="w-20 px-3 py-2 bg-surface border border-border rounded-lg text-center text-xl focus:outline-none focus:ring-2 focus:ring-text-tertiary"
                          maxLength={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={!formData.name.trim()}
                          className="flex-1 px-4 py-2 bg-text-primary text-surface rounded-lg hover:bg-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          type="submit"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 border border-border rounded-lg hover:bg-surface-elevated transition-colors text-text-secondary hover:text-text-primary"
                          type="reset"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display Mode
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ backgroundColor: area.color }}
                        >
                          {area.emoji}
                        </div>
                        <div>
                          <div className="font-medium text-text-primary">
                            {area.name}
                          </div>
                          {area.isDefault && (
                            <div className="text-xs text-text-tertiary">
                              Default area
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(area)}
                          className="px-3 py-1.5 text-sm rounded-lg hover:bg-surface-elevated transition-colors text-text-secondary hover:text-text-primary"
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(area.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-text-tertiary hover:text-red-500"
                          aria-label="Delete area"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border">
            <p className="text-sm text-text-tertiary">
              {areas.length} {areas.length === 1 ? "area" : "areas"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
});
