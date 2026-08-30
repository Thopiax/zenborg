import { activeCycle$ } from "@/infrastructure/state/store";
import {
  cycleDeckCollapsed$,
  isCommandPaletteOpen$,
  plantViewMode$,
} from "@/infrastructure/state/ui-store";
import type { Command } from "./types";

export const viewCommands: Command[] = [
  {
    id: "view.commandPalette",
    label: "Open Command Palette",
    shortcut: "mod+k",
    category: "Views",
    keywords: ["search", "commands", "palette"],
    action: () => {
      isCommandPaletteOpen$.set(true);
    },
  },
  {
    id: "view.planning.toggle",
    label: "Toggle Planning Panel",
    shortcut: "p",
    category: "Views",
    keywords: ["show", "hide", "cycle", "deck", "collapse"],
    action: () => {
      // Only toggle cycle deck when an active cycle exists
      const cycle = activeCycle$.peek();
      if (cycle) {
        cycleDeckCollapsed$.set(!cycleDeckCollapsed$.peek());
      }
    },
  },
  {
    id: "view.plant.areas",
    label: "View Areas",
    shortcut: "shift+1",
    category: "Views",
    keywords: ["areas", "plots", "habits", "plant"],
    action: () => {
      plantViewMode$.set("areas");
    },
  },
  {
    id: "view.plant.people",
    label: "View People",
    shortcut: "shift+2",
    category: "Views",
    keywords: ["people", "contacts", "friends", "family"],
    action: () => {
      plantViewMode$.set("people");
    },
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
    },
  },
];
