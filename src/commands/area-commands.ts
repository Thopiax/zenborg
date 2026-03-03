import type { Command } from "./types";

/**
 * Area management commands
 *
 * Areas are life domains (Wellness, Craft, Social, etc.)
 * Users can create custom areas and manage them
 */
export const areaCommands: Command[] = [
  {
    id: "area.create",
    label: "Create New Area",
    shortcut: "shift+a",
    category: "Areas",
    keywords: ["new", "add", "domain"],
    action: () => {
      // Open area management modal with create mode
      // This requires state refactor - for now log
      console.log("[Command] Create new area");
    },
  },
  {
    id: "area.quick.1",
    label: "Select Area 1 (in form)",
    shortcut: "1",
    category: "Areas",
    keywords: ["quick", "select", "first"],
    action: () => {
      // Only works when area selector is open
      console.log("[Command] Quick select area 1");
    },
  },
  {
    id: "area.quick.2",
    label: "Select Area 2 (in form)",
    shortcut: "2",
    category: "Areas",
    keywords: ["quick", "select"],
    action: () => {
      console.log("[Command] Quick select area 2");
    },
  },
  {
    id: "area.quick.3",
    label: "Select Area 3 (in form)",
    shortcut: "3",
    category: "Areas",
    keywords: ["quick", "select"],
    action: () => {
      console.log("[Command] Quick select area 3");
    },
  },
  {
    id: "area.quick.4",
    label: "Select Area 4 (in form)",
    shortcut: "4",
    category: "Areas",
    keywords: ["quick", "select"],
    action: () => {
      console.log("[Command] Quick select area 4");
    },
  },
  {
    id: "area.quick.5",
    label: "Select Area 5 (in form)",
    shortcut: "5",
    category: "Areas",
    keywords: ["quick", "select"],
    action: () => {
      console.log("[Command] Quick select area 5");
    },
  },
];
