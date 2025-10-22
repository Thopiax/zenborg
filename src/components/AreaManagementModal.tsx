/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { observer } from "@legendapp/state/react";
import {
  Archive as ArchiveIcon,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface AreaManagementModalProps {
  open: boolean;
  onClose: () => void;
  focusAreaId?: string; // Optional: auto-open edit mode for specific area
}

// Sortable wrapper for individual area cards
function SortableAreaCard({
  area,
  onUpdate,
  onArchive,
}: {
  area: Area;
  onUpdate: (updates: Partial<Area>) => void;
  onArchive: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: area.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <AreaCard
        area={area}
        canDelete={true}
        onUpdate={onUpdate}
        onDelete={onArchive}
        onArchive={onArchive}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/**
 * AreaManagementModal - Manage custom areas (CRUD + reordering)
 *
 * Features:
 * - List all areas with color/emoji
 * - Create new areas (inline card-based)
 * - Edit existing areas (inline)
 * - Archive areas (soft delete - preserves data integrity)
 * - Reorder areas (drag & drop)
 */
export const AreaManagementModal = observer(function AreaManagementModal({
  open,
  onClose,
  focusAreaId,
}: AreaManagementModalProps) {
  const [newAreaDraft, setNewAreaDraft] = useState<Area | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const areaRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    const maxOrder = activeAreas.reduce(
      (max, area) => Math.max(max, area.order),
      -1
    );

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
    const maxOrder = activeAreas.reduce(
      (max, area) => Math.max(max, area.order),
      -1
    );

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
      alert(
        "Cannot delete: this archived area still has moments assigned to it."
      );
      return;
    }

    if (confirm(`Permanently delete "${area.name}"? This cannot be undone.`)) {
      areas$[areaId].delete();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = activeAreas.findIndex((a) => a.id === active.id);
    const newIndex = activeAreas.findIndex((a) => a.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder the array
    const reorderedAreas = arrayMove(activeAreas, oldIndex, newIndex);

    // Update the order property for each area
    reorderedAreas.forEach((area, index) => {
      if (area.order !== index) {
        areas$[area.id].order.set(index);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>manage areas</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 md:space-y-4 px-2 md:px-4 py-2 md:py-4">
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

          {/* Active Areas List - Draggable */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeAreas.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {activeAreas.map((area) => (
                  <div
                    key={area.id}
                    ref={(el) => {
                      areaRefs.current[area.id] = el;
                    }}
                  >
                    <SortableAreaCard
                      area={area}
                      onUpdate={(updates) => handleUpdateArea(area, updates)}
                      onArchive={() => handleArchiveArea(area.id)}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>

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
                <div className="mt-2 space-y-2">
                  {archivedAreas.map((area) => (
                    <AreaCard
                      key={area.id}
                      area={area}
                      canDelete={canDeleteArchivedArea(area, allMoments)}
                      isArchived={true}
                      onUpdate={(updates) => handleUpdateArea(area, updates)}
                      onDelete={() => handleDeleteArchivedArea(area.id)}
                      onUnarchive={() => handleUnarchiveArea(area.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          <p className="text-sm text-stone-500 dark:text-stone-500">
            {activeAreas.length} active{" "}
            {activeAreas.length === 1 ? "area" : "areas"}
            {archivedAreas.length > 0 && `, ${archivedAreas.length} archived`}
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
