import { Command } from "./types";
import { drawingBoardExpanded$ } from "@/infrastructure/state/ui-store";
import { addDays } from "date-fns";

// Note: For focus navigation, we'll need to extract helpers from useFocusManager
// For now, we'll create simple versions that can be enhanced later

export const navigationCommands: Command[] = [
  {
    id: "nav.up",
    label: "Navigate Up",
    shortcut: "up",
    category: "Navigation",
    action: () => {
      // TODO: Call focus manager's focusPrevious
      console.log("Navigate up");
    }
  },
  {
    id: "nav.down",
    label: "Navigate Down",
    shortcut: "down",
    category: "Navigation",
    action: () => {
      // TODO: Call focus manager's focusNext
      console.log("Navigate down");
    }
  },
  {
    id: "nav.up.alt",
    label: "Navigate Up (k)",
    shortcut: "k",
    category: "Navigation",
    action: () => {
      // Same as arrow up
      console.log("Navigate up");
    }
  },
  {
    id: "nav.down.alt",
    label: "Navigate Down (j)",
    shortcut: "j",
    category: "Navigation",
    action: () => {
      // Same as arrow down
      console.log("Navigate down");
    }
  },
  {
    id: "nav.left",
    label: "Navigate Left",
    shortcut: "left",
    category: "Navigation",
    action: () => {
      console.log("Navigate left");
    }
  },
  {
    id: "nav.right",
    label: "Navigate Right",
    shortcut: "right",
    category: "Navigation",
    action: () => {
      console.log("Navigate right");
    }
  },
  {
    id: "nav.next",
    label: "Focus Next Moment",
    shortcut: "tab",
    category: "Navigation",
    keywords: ["forward"],
    action: () => {
      console.log("Focus next");
    }
  },
  {
    id: "nav.previous",
    label: "Focus Previous Moment",
    shortcut: "shift+tab",
    category: "Navigation",
    keywords: ["back"],
    action: () => {
      console.log("Focus previous");
    }
  },
  {
    id: "nav.today",
    label: "Go to Today",
    shortcut: "t",
    category: "Navigation",
    keywords: ["current", "now"],
    action: () => {
      // Scroll to today's date in timeline
      const today = new Date().toISOString().split('T')[0];
      const todayElement = document.querySelector(`[data-day="${today}"]`);
      todayElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },
  {
    id: "nav.tomorrow",
    label: "Go to Tomorrow",
    shortcut: "w",
    category: "Navigation",
    keywords: ["next", "will"],
    action: () => {
      // Scroll to tomorrow's date in timeline
      const tomorrow = addDays(new Date(), 1).toISOString().split('T')[0];
      const tomorrowElement = document.querySelector(`[data-day="${tomorrow}"]`);
      tomorrowElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },
  {
    id: "nav.drawing-board",
    label: "Go to Drawing Board",
    shortcut: "d",
    category: "Navigation",
    keywords: ["unallocated", "unscheduled"],
    action: () => {
      // Expand drawing board and scroll to it
      drawingBoardExpanded$.set(true);
      const drawingBoard = document.querySelector('[data-drawing-board]');
      drawingBoard?.scrollIntoView({ behavior: 'smooth' });
    }
  }
];
