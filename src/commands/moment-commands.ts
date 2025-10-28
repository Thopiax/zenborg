import { Command } from "./types";
import {
  moments$,
} from "@/infrastructure/state/store";
import {
  focusedMomentId$,
  openMomentFormCreate,
} from "@/infrastructure/state/ui-store";
import {
  deleteMomentWithHistory,
  duplicateMomentWithHistory,
} from "@/infrastructure/state/history-middleware";

export const momentCommands: Command[] = [
  {
    id: "moment.create",
    label: "Create Moment",
    shortcut: "n",
    category: "Moments",
    keywords: ["new", "add"],
    action: () => {
      openMomentFormCreate();
    }
  },
  {
    id: "moment.delete",
    label: "Delete Moment",
    shortcut: "delete",
    category: "Moments",
    keywords: ["remove", "trash"],
    action: () => {
      const focusedId = focusedMomentId$.get();
      if (focusedId) {
        deleteMomentWithHistory(focusedId);
      }
    }
  },
  {
    id: "moment.duplicate",
    label: "Duplicate Moment",
    shortcut: "mod+d",
    category: "Moments",
    keywords: ["copy", "clone"],
    action: () => {
      const focusedId = focusedMomentId$.get();
      if (!focusedId) return;

      const moment = moments$[focusedId].get();
      if (!moment) return;

      // Duplicate to drawing board (unallocated)
      const newMomentId = duplicateMomentWithHistory(focusedId, null, null, 0);
      if (newMomentId) {
        focusedMomentId$.set(newMomentId);
      }
    }
  }
];
