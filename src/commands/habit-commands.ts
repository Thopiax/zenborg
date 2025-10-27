import { Command } from "./types";
import { habits$ } from "@/infrastructure/state/store";

/**
 * Habit management commands
 *
 * Habits are recurring moment templates that emerge from patterns.
 * Users can create habits proactively or from repeated moments.
 *
 * Note: Habit UI not yet implemented in MVP, but domain/commands ready
 */
export const habitCommands: Command[] = [
  {
    id: "habit.create",
    label: "Create New Habit",
    shortcut: "shift+h",
    category: "Habits",
    keywords: ["new", "template", "recurring"],
    action: () => {
      // Open habit creation dialog
      // UI not implemented yet
      console.log("[Command] Create new habit");
    }
  },
  {
    id: "habit.manage",
    label: "Manage Habits",
    shortcut: "mod+h",
    category: "Habits",
    keywords: ["edit", "organize", "templates"],
    action: () => {
      // Open habit management view
      // UI not implemented yet
      console.log("[Command] Manage habits");
    }
  },
  {
    id: "habit.fromMoment",
    label: "Create Habit from Focused Moment",
    shortcut: "mod+shift+h",
    category: "Habits",
    keywords: ["convert", "template", "pattern"],
    action: () => {
      const { focusedMomentId$ } = require("@/infrastructure/state/ui-store");
      const { moments$ } = require("@/infrastructure/state/store");

      const focusedId = focusedMomentId$.get();
      if (!focusedId) {
        console.log("[Command] No moment focused");
        return;
      }

      const moment = moments$[focusedId].get();
      if (!moment) {
        console.log("[Command] Moment not found");
        return;
      }

      // Create habit from moment template
      // UI not implemented yet
      console.log("[Command] Create habit from moment:", moment.name);
    }
  },
  {
    id: "habit.instantiate",
    label: "Create Moment from Habit",
    shortcut: "mod+shift+n",
    category: "Habits",
    keywords: ["template", "instance", "create"],
    action: () => {
      // Open habit selector to create moment from template
      // UI not implemented yet
      console.log("[Command] Create moment from habit template");
    }
  },
  {
    id: "habit.archive",
    label: "Archive Focused Habit",
    shortcut: "mod+shift+backspace",
    category: "Habits",
    keywords: ["delete", "remove", "hide"],
    action: () => {
      // Archive the focused habit (soft delete)
      // UI not implemented yet
      console.log("[Command] Archive habit");
    }
  },
];
