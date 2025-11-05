"use client";

import { useSelector } from "@legendapp/state/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { MomentCreationService } from "@/application/services/MomentCreationService";
import { MomentUpdateService } from "@/application/services/MomentUpdateService";
import { allCommands } from "@/commands";
import type { Horizon, Moment } from "@/domain/entities/Moment";
import { isMomentError } from "@/domain/entities/Moment";
import type { Attitude, CustomMetric } from "@/domain/value-objects/Attitude";
import type { Phase } from "@/domain/value-objects/Phase";
import { moments$ } from "@/infrastructure/state/store";
import {
  closeMomentForm,
  momentFormState$,
} from "@/infrastructure/state/ui-store";
import { useFocusManager } from "./useFocusManager";

/**
 * Global keyboard shortcuts - reads from command registry
 *
 * All shortcuts are defined in src/commands/*.ts and registered here.
 * This ensures single source of truth for commands and shortcuts.
 */
export function useGlobalKeyboard() {
  const router = useRouter();
  const { focusMoment } = useFocusManager();

  // Application services for business logic
  const momentCreationService = new MomentCreationService();
  const momentUpdateService = new MomentUpdateService();

  // UI state for CRUD operations
  const [isAreaSelectorOpen, setIsAreaSelectorOpen] = useState(false);
  const [isAreaManagementOpen, setIsAreaManagementOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const globalShortcutsEnabled = useSelector(
    () =>
      !momentFormState$.open.get() &&
      !isAreaSelectorOpen &&
      !isAreaManagementOpen &&
      !isSettingsOpen
  );

  // Register all commands from registry
  useHotkeys(
    allCommands.map((cmd) => cmd.shortcut),
    (e, handler) => {
      e.preventDefault();
      const command = allCommands.find(
        (cmd) => cmd.shortcut === handler.keys?.join("+")
      );
      if (command) {
        command.action();
      }
    },
    {
      enabled: globalShortcutsEnabled,
      enableOnFormTags: false,
    },
    [allCommands]
  );

  useHotkeys(
    "meta+1, ctrl+1",
    (e) => {
      e.preventDefault();
      router.push("/plant");
    },
    {
      enabled: globalShortcutsEnabled,
      enableOnFormTags: false,
    }
  );

  useHotkeys(
    "meta+2, ctrl+2",
    (e) => {
      e.preventDefault();
      window.location.href = "/cultivate";
    },
    {
      enabled: globalShortcutsEnabled,
      enableOnFormTags: false,
    }
  );

  useHotkeys(
    "meta+3, ctrl+3",
    (e) => {
      e.preventDefault();
      router.push("/harvest");
    },
    {
      enabled: globalShortcutsEnabled,
      enableOnFormTags: false,
    }
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
    horizon: Horizon | null,
    phase: Phase | null,
    createMore?: boolean,
    attitude?: Attitude | null,
    tags?: string[],
    customMetric?: CustomMetric
  ) => {
    // Get prefilled allocation from UI state
    const uiAllocation = momentFormState$.prefilledAllocation.peek();

    // Convert UI allocation to service allocation (validate required fields)
    const prefilledAllocation =
      uiAllocation?.day && uiAllocation?.phase
        ? { day: uiAllocation.day, phase: uiAllocation.phase as Phase }
        : undefined;

    // Call application service (pure business logic)
    const result = momentCreationService.createMomentWithWorkflow({
      name,
      areaId,
      horizon,
      phase,
      prefilledAllocation,
      tags,
      customMetric,
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
    horizon?: string,
    attitude?: string
  ) => {
    const { openMomentFormCreate } = require("@/infrastructure/state/ui-store");
    openMomentFormCreate({
      day,
      phaseStr: phase,
      phase: phase as Phase | undefined,
      areaId,
      horizon: horizon as Horizon | undefined,
      attitude: attitude ? (attitude.toUpperCase() as Attitude) : undefined,
    });
  };

  const handleSaveEdit = (
    name: string,
    areaId: string,
    horizon: Horizon | null,
    phase: Phase | null,
    attitude?: Attitude | null,
    tags?: string[],
    customMetric?: CustomMetric
  ) => {
    const editingMomentId = momentFormState$.editingMomentId.peek();
    if (editingMomentId) {
      // Get current moment
      const currentMoment = moments$[editingMomentId].peek();
      if (!currentMoment) {
        console.error("[handleSaveEdit] Moment not found:", editingMomentId);
        closeMomentForm();
        return;
      }

      // Call application service for business logic
      const result = momentUpdateService.updateMoment(currentMoment, {
        name,
        areaId,
        horizon,
        tags,
        customMetric,
        phase,
      });

      // Handle result
      if (!isMomentError(result)) {
        // Infrastructure operation: persist with history
        // Use direct update to avoid double timestamp update
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
    // Area management state
    isAreaManagementOpen,
    setIsAreaManagementOpen,
    // Settings state
    isSettingsOpen,
    setIsSettingsOpen,
  };
}
