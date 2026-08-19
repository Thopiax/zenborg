import { areaCommands } from "./area-commands";
import { clipboardCommands } from "./clipboard-commands";
import { formCommands } from "./form-commands";
import { habitCommands } from "./habit-commands";
import { historyCommands } from "./history-commands";
import { momentCommands } from "./moment-commands";
import { navigationCommands } from "./navigation-commands";
import type { Command } from "./types";
import { viewCommands } from "./view-commands";

export const allCommands: Command[] = [
  ...momentCommands,
  ...navigationCommands,
  ...viewCommands,
  ...clipboardCommands,
  ...historyCommands,
  ...areaCommands,
  ...habitCommands,
  ...formCommands,
];

export type { Command };
