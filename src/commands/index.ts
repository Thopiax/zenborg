import { Command } from "./types";
import { momentCommands } from "./moment-commands";
import { navigationCommands } from "./navigation-commands";
import { viewCommands } from "./view-commands";
import { clipboardCommands } from "./clipboard-commands";
import { historyCommands } from "./history-commands";
import { areaCommands } from "./area-commands";
import { habitCommands } from "./habit-commands";
import { formCommands } from "./form-commands";

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
