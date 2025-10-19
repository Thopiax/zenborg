"use client";

import { use$ } from "@legendapp/state/react";
import { useEffect, useState } from "react";
import { SelectorDialog, type SelectorOption } from "@/components/SelectorDialog";
import { createArea, DEFAULT_AREAS, type Area } from "@/domain/entities/Area";
import { areas$ } from "@/infrastructure/state/store";

interface AreaSelectorProps {
  open: boolean;
  selectedAreaId: string;
  onSelectArea: (areaId: string) => void;
  onClose: () => void;
}

/**
 * AreaSelector - Notion-style command palette for selecting areas
 *
 * Features:
 * - Number keys (1-5) for quick selection
 * - Arrow keys for navigation
 * - Enter to confirm
 * - Escape to cancel
 * - Built with shadcn/ui Command component
 */
export function AreaSelector({
  open,
  selectedAreaId,
  onSelectArea,
  onClose,
}: AreaSelectorProps) {
  const allAreas = use$(areas$);
  const areasList: Area[] = Object.values(allAreas).sort(
    (a, b) => a.order - b.order
  );

  const [showTemplates, setShowTemplates] = useState(areasList.length === 0);

  // Update showTemplates when areas change
  useEffect(() => {
    setShowTemplates(areasList.length === 0);
  }, [areasList.length]);

  // Handle creating area from template
  const handleCreateFromTemplate = (templateName: string) => {
    const index = DEFAULT_AREAS.findIndex((t) => t.name === templateName);
    const template = DEFAULT_AREAS[index];

    if (!template) return;

    const newArea = createArea(
      template.name,
      template.color,
      template.emoji,
      index
    );

    if ("error" in newArea) {
      console.error("Failed to create area:", newArea.error);
      return;
    }

    // Add to store
    areas$[newArea.id].set(newArea);

    // Select the newly created area
    onSelectArea(newArea.id);
  };

  // Build options based on whether we're showing templates or existing areas
  const options: SelectorOption[] = showTemplates
    ? DEFAULT_AREAS.map((template, index) => ({
        value: template.name,
        label: template.name,
        hotkey: String(index + 1),
        icon: template.emoji,
        leftAccent: {
          color: template.color,
        },
      }))
    : areasList.map((area, index) => ({
        value: area.id,
        label: area.name,
        hotkey: String(index + 1),
        icon: area.emoji,
        leftAccent: {
          color: area.color,
        },
      }));

  const handleSelect = (value: string) => {
    if (showTemplates) {
      handleCreateFromTemplate(value);
    } else {
      onSelectArea(value);
    }
  };

  return (
    <SelectorDialog
      open={open}
      title={showTemplates ? "Create your first area" : "Select Area"}
      description={
        showTemplates
          ? "Choose from templates to get started"
          : "Choose an area for your moment"
      }
      heading={showTemplates ? "Templates" : "Areas"}
      options={options}
      selectedValue={showTemplates ? null : selectedAreaId}
      onSelect={handleSelect}
      onClose={onClose}
      maxWidth="max-w-2xl"
      enableHotkeys
    />
  );
}
