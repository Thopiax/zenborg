import { Command } from "./types";
import {
  cycleDeckCollapsed$,
  isCommandPaletteOpen$,
} from "@/infrastructure/state/ui-store";

export const viewCommands: Command[] = [
  {
    id: "view.commandPalette",
    label: "Open Command Palette",
    shortcut: "mod+k",
    category: "Views",
    keywords: ["search", "commands", "palette"],
    action: () => {
      isCommandPaletteOpen$.set(true);
    }
  },
  {
    id: "view.planning.toggle",
    label: "Toggle Planning Panel",
    shortcut: "p",
    category: "Views",
    keywords: ["show", "hide", "cycle", "deck", "collapse"],
    action: () => {
      cycleDeckCollapsed$.set(!cycleDeckCollapsed$.peek());
    }
  },
  {
    id: "view.areas",
    label: "Open Area Management",
    shortcut: "shift+e",
    category: "Views",
    keywords: ["manage", "edit", "settings"],
    action: () => {
      // Open area management dialog/view
      // This depends on how areas are currently managed
      console.log("Open area management");
    }
  },
  {
    id: "view.settings",
    label: "Open Settings",
    shortcut: "mod+comma",
    category: "Views",
    keywords: ["preferences", "configure"],
    action: () => {
      // Open settings dialog
      console.log("Open settings");
    }
  }
];
