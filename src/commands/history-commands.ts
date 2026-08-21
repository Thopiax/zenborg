import { redo as redoFn, undo as undoFn } from "@/infrastructure/state/history";
import {
  applyInverseOperation,
  applyOperation,
} from "@/infrastructure/state/history-middleware";
import type { Command } from "./types";

export const historyCommands: Command[] = [
  {
    id: "history.undo",
    label: "Undo",
    shortcut: "mod+z",
    category: "History",
    action: () => {
      const entry = undoFn();
      if (entry) {
        // Apply inverse of all operations in reverse order
        for (let i = entry.operations.length - 1; i >= 0; i--) {
          applyInverseOperation(entry.operations[i]);
        }
        console.log(`[History] Undone: "${entry.description}"`);
      }
    },
  },
  {
    id: "history.redo",
    label: "Redo",
    shortcut: "mod+shift+z",
    category: "History",
    action: () => {
      const entry = redoFn();
      if (entry) {
        // Apply all operations in forward order
        for (const operation of entry.operations) {
          applyOperation(operation);
        }
        console.log(`[History] Redone: "${entry.description}"`);
      }
    },
  },
  {
    id: "history.redo.alt",
    label: "Redo (Cmd+Y)",
    shortcut: "mod+y",
    category: "History",
    action: () => {
      // Same as mod+shift+z
      const entry = redoFn();
      if (entry) {
        // Apply all operations in forward order
        for (const operation of entry.operations) {
          applyOperation(operation);
        }
        console.log(`[History] Redone: "${entry.description}"`);
      }
    },
  },
];
