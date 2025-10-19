/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
"use client";

import { observer } from "@legendapp/state/react";
import { Archive as ArchiveIcon, ChevronDown, ChevronRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Area } from "@/domain/entities/Area";
import {
  archiveArea,
  canDeleteArchivedArea,
  createArea,
  unarchiveArea,
  updateArea,
} from "@/domain/entities/Area";
import { areas$, moments$ } from "@/infrastructure/state/store";
import { AreaCard } from "./AreaCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface AreaManagementModalProps {
  open: boolean;
  onClose: () => void;
  focusAreaId?: string; // Optional: auto-open edit mode for specific area
}

/**
 * AreaManagementModal - Manage custom areas (CRUD + reordering)
 *
 * Features:
 * - List all areas with color/emoji
 * - Create new areas (inline card-based)
 * - Edit existing areas (inline)
 * - Archive areas (soft delete - preserves data integrity)
 * - Reorder areas (drag & drop - TODO)
 */
export const AreaManagementModal = observer(function AreaManagementModal({
  open,
  onClose,
  focusAreaId,
}: AreaManagementModalProps) {
  const [newAreaDraft, setNewAreaDraft] = useState<Area | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const areaRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const allAreasUnsorted = Object.values(areas$.get() || {});
  const activeAreas = allAreasUnsorted
    .filter((a) => !a.isArchived)
    .sort((a, b) => a.order - b.order);
  const archivedAreas = allAreasUnsorted
    .filter((a) => a.isArchived)
    .sort((a, b) => a.order - b.order);
  const allMoments = Object.values(moments$.get() || {});

  // Auto-focus on specific area when focusAreaId is provided
  useEffect(() => {
    if (open && focusAreaId) {
      // Scroll to the area after a brief delay
      setTimeout(() => {
        areaRefs.current[focusAreaId]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [open, focusAreaId]);

  const handleStartCreate = () => {
    // Calculate order: place new area at the end
    const maxOrder = activeAreas.reduce((max, area) => Math.max(max, area.order), -1);

    // Create a draft area (not yet persisted)
    const draft: Area = {
      id: `draft-${Date.now()}`, // Temporary ID
      name: "",
      color: "#10b981",
      emoji: "🔵",
      isDefault: false,
      isArchived: false,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setNewAreaDraft(draft);
  };

  const handleSaveNewArea = (name: string, color: string, emoji: string) => {
    if (!name.trim()) {
      // Cancel creation if name is empty
      setNewAreaDraft(null);
      return;
    }

    // Calculate order: place new area at the end
    const maxOrder = activeAreas.reduce((max, area) => Math.max(max, area.order), -1);

    const result = createArea(name.trim(), color, emoji, maxOrder + 1);

    if ("error" in result) {
      alert(result.error);
      return;
    }

    areas$.set((prev) => ({
      ...prev,
      [result.id]: result,
    }));

    setNewAreaDraft(null);
  };

  const handleCancelNewArea = () => {
    setNewAreaDraft(null);
  };

  const handleUpdateArea = (area: Area, updates: Partial<Area>) => {
    const result = updateArea(area, updates);

    if ("error" in result) {
      alert(result.error);
      return;
    }

    areas$[area.id].set(result);
  };

  const handleArchiveArea = (areaId: string) => {
    const area = areas$.get()[areaId];
    if (!area) return;

    if (confirm(`Archive "${area.name}"?`)) {
      const archivedArea = archiveArea(area);
      areas$[areaId].set(archivedArea);
    }
  };

  const handleUnarchiveArea = (areaId: string) => {
    const area = areas$.get()[areaId];
    if (!area) return;

    const unarchivedArea = unarchiveArea(area);
    areas$[areaId].set(unarchivedArea);
  };

  const handleDeleteArchivedArea = (areaId: string) => {
    const area = areas$.get()[areaId];
    if (!area) return;

    if (!canDeleteArchivedArea(area, allMoments)) {
      alert("Cannot delete: this archived area still has moments assigned to it.");
      return;
    }

    if (confirm(`Permanently delete "${area.name}"? This cannot be undone.`)) {
      areas$[areaId].delete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Areas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create New Area Button */}
          {!newAreaDraft && (
            <button
              onClick={handleStartCreate}
              className="w-full p-4 border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 rounded-lg transition-colors flex items-center justify-center gap-2 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
              type="button"
            >
              <Plus className="w-5 h-5" />
              <span>Create New Area</span>
            </button>
          )}

          {/* New Area Draft (inline card) */}
          {newAreaDraft && (
            <div
              ref={(el) => {
                areaRefs.current[newAreaDraft.id] = el;
              }}
            >
              <AreaCard
                area={newAreaDraft}
                canDelete={true}
                isNew={true}
                onUpdate={(updates) => {
                  // Update the draft state
                  setNewAreaDraft({ ...newAreaDraft, ...updates });
                }}
                onDelete={handleCancelNewArea}
                onSaveNew={(name, color, emoji) =>
                  handleSaveNewArea(name, color, emoji)
                }
              />
            </div>
          )}

          {/* Active Areas List */}
          <div className="space-y-2">
            {activeAreas.map((area) => (
              <div
                key={area.id}
                ref={(el) => {
                  areaRefs.current[area.id] = el;
                }}
              >
                <AreaCard
                  area={area}
                  canDelete={true}
                  onUpdate={(updates) => handleUpdateArea(area, updates)}
                  onDelete={() => handleArchiveArea(area.id)}
                />
              </div>
            ))}
          </div>

          {/* Archived Areas Section - Collapsible */}
          {archivedAreas.length > 0 && (
            <div className="pt-4 border-t border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="w-full flex items-center justify-between px-2 py-2 text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
              >
                <div className="flex items-center gap-2">
                  {showArchived ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <ArchiveIcon className="w-4 h-4" />
                  <span>Archived Areas ({archivedAreas.length})</span>
                </div>
              </button>

              {showArchived && (
                <div className="mt-2 space-y-2 pl-6">
                  {archivedAreas.map((area) => (
                    <div
                      key={area.id}
                      className="p-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-base">{area.emoji}</span>
                          <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                            {area.name}
                          </span>
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: area.color }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleUnarchiveArea(area.id)}
                            className="px-2 py-1 text-xs rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1"
                            title="Unarchive"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </button>
                          {canDeleteArchivedArea(area, allMoments) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteArchivedArea(area.id)}
                              className="px-2 py-1 text-xs rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-stone-200 dark:border-stone-700">
          <p className="text-sm text-stone-500 dark:text-stone-500">
            {activeAreas.length} active {activeAreas.length === 1 ? "area" : "areas"}
            {archivedAreas.length > 0 && `, ${archivedAreas.length} archived`}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
});
