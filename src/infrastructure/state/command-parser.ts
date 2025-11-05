import { Phase } from "@/domain/value-objects/Phase";

/**
 * Command Types
 */

export type AllocationCommand = {
  type: "allocate";
  day: "yesterday" | "today" | "tomorrow";
  phase: Phase;
};

export type UnallocationCommand = {
  type: "unallocate";
};

export type NavigationCommand = {
  type: "navigate";
  destination: "area" | "settings" | "help" | "garden";
};

export type Command =
  | AllocationCommand
  | UnallocationCommand
  | NavigationCommand;

export type CommandResult = Command | { error: string };

/**
 * Day mapping
 * y = yesterday
 * t = today
 * w = tomorrow (will do)
 */
const DAY_MAP: Record<string, "yesterday" | "today" | "tomorrow"> = {
  y: "yesterday",
  t: "today",
  w: "tomorrow",
};

/**
 * Phase mapping
 * 1 = morning
 * 2 = afternoon
 * 3 = evening
 * 4 = night
 */
const PHASE_MAP: Record<string, Phase> = {
  "1": Phase.MORNING,
  "2": Phase.AFTERNOON,
  "3": Phase.EVENING,
  "4": Phase.NIGHT,
};

/**
 * Parses a command string into a structured command
 *
 * Allocation commands:
 * - :ty1 → allocate to Today Morning
 * - :wy3 → allocate to Tomorrow Evening
 * - :yy2 → allocate to Yesterday Afternoon
 *
 * Unallocation command:
 * - :d → unallocate (return to drawing board)
 *
 * Navigation commands:
 * - :area → open area management
 * - :settings → open phase settings
 * - :garden → open garden sync settings
 * - :help → show help
 *
 * @param input - Command string (without leading colon)
 * @returns Parsed command or error object
 */
export function parseCommand(input: string): CommandResult {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return { error: "Empty command" };
  }

  // Unallocation command
  if (trimmed === "d") {
    return { type: "unallocate" };
  }

  // Navigation commands
  if (trimmed === "area") {
    return { type: "navigate", destination: "area" };
  }

  if (trimmed === "settings") {
    return { type: "navigate", destination: "settings" };
  }

  if (trimmed === "garden") {
    return { type: "navigate", destination: "garden" };
  }

  if (trimmed === "help") {
    return { type: "navigate", destination: "help" };
  }

  // Allocation commands (format: [day][phase])
  // e.g., "ty1" = today morning, "wy3" = tomorrow evening
  if (trimmed.length === 3) {
    const dayChar = trimmed[0];
    const phaseChar = trimmed[2];

    // Check middle character is 'y' (just a separator for readability)
    if (trimmed[1] !== "y") {
      return {
        error: `Invalid command format. Use format like 'ty1' (today morning) or 'wy3' (tomorrow evening)`,
      };
    }

    const day = DAY_MAP[dayChar];
    const phase = PHASE_MAP[phaseChar];

    if (!day) {
      return {
        error: `Invalid day: '${dayChar}'. Use y (yesterday), t (today), or w (tomorrow)`,
      };
    }

    if (!phase) {
      return {
        error: `Invalid phase: '${phaseChar}'. Use 1 (morning), 2 (afternoon), 3 (evening), or 4 (night)`,
      };
    }

    return {
      type: "allocate",
      day,
      phase,
    };
  }

  return { error: `Unknown command: '${trimmed}'` };
}

/**
 * Type guard to check if result is an error
 */
export function isCommandError(
  result: CommandResult
): result is { error: string } {
  return "error" in result;
}
