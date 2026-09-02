"use client";

import { useSelector } from "@legendapp/state/react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { MomentCreationService } from "@/application/services/MomentCreationService";
import { MomentUpdateService } from "@/application/services/MomentUpdateService";
import { allCommands } from "@/commands";
import { isMomentError } from "@/domain/entities/Moment";
import { classifyMentionIds } from "@/domain/services/MentionService";
import type { Attitude, CustomMetric } from "@/domain/value-objects/Attitude";
import type { Phase } from "@/domain/value-objects/Phase";
import { moments$, places$ } from "@/infrastructure/state/store";
import {
  closeMomentForm,
  isSettingsOpen$,
  momentFormState$,
} from "@/infrastructure/state/ui-store";
import { useFocusManager } from "./useFocusManager.ts";

/**
 * Global keyboard shortcuts - reads from command registry
 *
 * All shortcuts are defined in src/commands/*.ts and registered here.
 * This ensures single source of truth for commands and shortcuts.
 */
export function useGlobalKeyboard() {
  const { focusMoment } = useFocusManager();

  // Application services for business logic
  const momentCreationService = new MomentCreationService();
  const momentUpdateService = new MomentUpdateService();

  // UI state for CRUD operations
  const [isAreaSelectorOpen, setIsAreaSelectorOpen] = useState(false);

  const globalShortcutsEnabled = useSelector(
    () =>
      !momentFormState$.open.get() && !isAreaSelectorOpen && !isSettingsOpen$.get(),
  );

  // Register all commands from registry
  useHotkeys(
    allCommands.map((cmd) => cmd.shortcut),
    (e, handler) => {
      e.preventDefault();
      const command = allCommands.find(
        (cmd) => cmd.shortcut === handler.hotkey,
      );
      if (command) {
        command.action();
      }
    },
    {
      enabled: globalShortcutsEnabled,
      enableOnFormTags: false,
    },
    [allCommands],
  );

  // ==================== HELPER FUNCTIONS ====================

  const updateMomentArea = (momentId: string, newAreaId: string) => {
    const { updateMomentWithHistory } = require("@/infrastructure/state/store");
    updateMomentWithHistory(momentId, { areaId: newAreaId });
    setIsAreaSelectorOpen(false);
  };

  const handleCreateMoment = (
    name: string,
    areaId: string,
    phase: Phase | null,
    createMore?: boolean,
    emoji?: string | null,
    tags?: string[],
    customMetric?: CustomMetric,
    startTime?: string,
    mentionIds?: string[],
  ) => {
    const uiAllocation = momentFormState$.prefilledAllocation.peek();

    const prefilledAllocation =
      uiAllocation?.day && uiAllocation?.phase
        ? { day: uiAllocation.day, phase: uiAllocation.phase as Phase }
        : undefined;

    const placeKeys = new Set(Object.values(places$.peek()).map((p) => p.key));

    const habitId = momentFormState$.habitId.peek();

    const result = momentCreationService.createMomentWithWorkflow({
      name,
      areaId,
      habitId,
      phase,
      emoji: emoji || null,
      prefilledAllocation,
      tags,
      customMetric,
      startTime,
      mentionIds,
      placeKeys,
    });

    // Handle result
    if (!isMomentError(result)) {
      // Infrastructure operation: persist with history
      const {
        createMomentWithHistory,
      } = require("@/infrastructure/state/store");
      createMomentWithHistory(result);

      // UI operation: focus the new moment
      focusMoment(result.id);
    }

    // UI operation: close form if not creating more
    if (!createMore) {
      closeMomentForm();
    }
  };

  const handleOpenCreateModal = (
    day?: string,
    phase?: string,
    areaId?: string,
    attitude?: string,
  ) => {
    const { openMomentFormCreate } = require("@/infrastructure/state/ui-store");
    openMomentFormCreate({
      day,
      phaseStr: phase,
      phase: phase as Phase | undefined,
      areaId,
      attitude: attitude ? (attitude.toUpperCase() as Attitude) : undefined,
    });
  };

  const handleSaveEdit = (
    name: string,
    areaId: string,
    phase: Phase | null,
    emoji?: string | null,
    tags?: string[],
    customMetric?: CustomMetric,
    startTime?: string,
    mentionIds?: string[],
  ) => {
    const editingMomentId = momentFormState$.editingMomentId.peek();
    if (editingMomentId) {
      const currentMoment = moments$[editingMomentId].peek();
      if (!currentMoment) {
        console.error("[handleSaveEdit] Moment not found:", editingMomentId);
        closeMomentForm();
        return;
      }

      const editHabitId = momentFormState$.habitId.peek();

      const result = momentUpdateService.updateMoment(currentMoment, {
        name,
        areaId,
        habitId: editHabitId,
        emoji: emoji || null,
        tags,
        customMetric,
        phase,
        ...(startTime !== undefined ? { startTime } : {}),
      });

      if (!isMomentError(result)) {
        if (mentionIds && mentionIds.length > 0) {
          const placeKeys = new Set(
            Object.values(places$.peek()).map((p) => p.key),
          );
          const classified = classifyMentionIds(mentionIds, placeKeys);
          result.personIds =
            classified.personIds.length > 0 ? classified.personIds : undefined;
          result.placeIds =
            classified.placeIds.length > 0 ? classified.placeIds : undefined;
        } else {
          delete result.personIds;
          delete result.placeIds;
        }
        moments$[editingMomentId].set(result);
      }
    }
    closeMomentForm();
  };

  const handleDeleteEdit = () => {
    const editingMomentId = momentFormState$.editingMomentId.peek();
    if (editingMomentId) {
      // Delete the moment with history tracking
      const {
        deleteMomentWithHistory,
      } = require("@/infrastructure/state/store");
      deleteMomentWithHistory(editingMomentId);
      closeMomentForm();
    }
  };

  const handleOpenEditModal = (momentId: string) => {
    const moment = moments$[momentId].peek();
    if (moment) {
      const { openMomentFormEdit } = require("@/infrastructure/state/ui-store");
      openMomentFormEdit(momentId, moment);
    }
  };

  // Return state and helpers for components
  return {
    isAreaSelectorOpen,
    setIsAreaSelectorOpen,
    updateMomentArea,
    focusedMomentId: null, // No longer tracking focus here - managed by state
    // Moment form callbacks
    handleCreateMoment,
    handleOpenCreateModal,
    handleSaveEdit,
    handleDeleteEdit,
    handleOpenEditModal,
  };
}
