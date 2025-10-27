import { Command } from "./types";
import { momentFormState$ } from "@/infrastructure/state/ui-store";

/**
 * Form-specific commands
 *
 * These commands are contextual and only work when the moment form is open.
 * They provide keyboard shortcuts for form navigation and selector opening.
 */
export const formCommands: Command[] = [
  {
    id: "form.openAreaSelector",
    label: "Open Area Selector (in form)",
    shortcut: "a",
    category: "Form",
    keywords: ["area", "select", "choose"],
    action: () => {
      // Opens area selector when form is active
      // Implementation delegated to MomentFormDialog component
      console.log("[Command] Open area selector");
    }
  },
  {
    id: "form.openHorizonSelector",
    label: "Open Horizon Selector (in form)",
    shortcut: "h",
    category: "Form",
    keywords: ["horizon", "timeline", "select"],
    action: () => {
      // Opens horizon selector when form is active
      // Implementation delegated to MomentFormDialog component
      console.log("[Command] Open horizon selector");
    }
  },
  {
    id: "form.openPhaseSelector",
    label: "Open Phase Selector (in form)",
    shortcut: "p",
    category: "Form",
    keywords: ["phase", "time", "select"],
    action: () => {
      // Opens phase selector when form is active
      // Implementation delegated to MomentFormDialog component
      console.log("[Command] Open phase selector");
    }
  },
  {
    id: "form.cycleFieldForward",
    label: "Next Form Field",
    shortcut: "tab",
    category: "Form",
    keywords: ["next", "navigate", "field"],
    action: () => {
      // Cycles to next form field
      // Implementation delegated to MomentFormDialog component
      console.log("[Command] Next form field");
    }
  },
  {
    id: "form.cycleFieldBackward",
    label: "Previous Form Field",
    shortcut: "shift+tab",
    category: "Form",
    keywords: ["previous", "navigate", "field", "back"],
    action: () => {
      // Cycles to previous form field
      // Implementation delegated to MomentFormDialog component
      console.log("[Command] Previous form field");
    }
  },
  {
    id: "form.save",
    label: "Save Moment",
    shortcut: "mod+enter",
    category: "Form",
    keywords: ["save", "submit", "create"],
    action: () => {
      // Saves the moment form
      // Implementation delegated to MomentFormDialog component
      console.log("[Command] Save moment");
    }
  },
  {
    id: "form.cancel",
    label: "Cancel Form",
    shortcut: "escape",
    category: "Form",
    keywords: ["cancel", "close", "discard"],
    action: () => {
      const { closeMomentForm } = require("@/infrastructure/state/ui-store");
      const isOpen = momentFormState$.open.get();

      if (isOpen) {
        closeMomentForm();
      }
    }
  },
];
