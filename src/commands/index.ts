import { areaCommands } from "./area-commands.ts";
import { clipboardCommands } from "./clipboard-commands.ts";
import { formCommands } from "./form-commands.ts";
import { habitCommands } from "./habit-commands.ts";
import { historyCommands } from "./history-commands.ts";
import { momentCommands } from "./moment-commands.ts";
import { navigationCommands } from "./navigation-commands.ts";
import type { Command } from "./types";
import { viewCommands } from "./view-commands.ts";

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
