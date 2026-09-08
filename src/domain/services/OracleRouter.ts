/**
 * Oracle routing — dispatches a gap practice to the right tool.
 *
 * Routing order: link field → tag-based oracle → timer fallback.
 * Each oracle is data (a name + descriptors), not executable code;
 * the daemon that acts on the route is separate work.
 */

export type OracleType = "link" | "garmin" | "lull-n-learn" | "timer";

export interface OracleRoute {
  readonly type: OracleType;
  readonly target?: string;
}

export interface OracleEntry {
  readonly check: string;
  readonly action: string;
}

export interface OracleConfig {
  readonly oracles: Record<string, OracleEntry>;
  readonly routes: Record<string, readonly string[]>;
}

export interface RoutableHabit {
  readonly tags?: readonly string[] | null;
  readonly link?: string;
  readonly durationMin?: number;
}

// ponytail: linear scan over tags × routes. Fine for ~10 oracles × ~5 tags.
export function routeGapPractice(
  habit: RoutableHabit,
  config: OracleConfig,
): OracleRoute {
  if (habit.link?.trim()) {
    return { type: "link", target: habit.link.trim() };
  }

  const tags = (habit.tags ?? []).map((t) => String(t).trim().toLowerCase());

  for (const tag of tags) {
    const routeKey = `gap.${tag}`;
    const oracleNames = config.routes[routeKey];
    if (!oracleNames) continue;
    for (const name of oracleNames) {
      if (config.oracles[name]) {
        return { type: name as OracleType, target: undefined };
      }
    }
  }

  return {
    type: "timer",
    ...(habit.durationMin ? { target: String(habit.durationMin * 60_000) } : {}),
  };
}

export const DEFAULT_ORACLE_CONFIG: OracleConfig = {
  oracles: {
    garmin: {
      check: "garmin MCP connected",
      action: "schedule_workout for now",
    },
    "lull-n-learn": {
      check: "~/.lull-n-learn/ exists",
      action: "fetch due card/node for tag",
    },
  },
  routes: {
    "gap.wellness": ["garmin"],
    "gap.breathwork": ["garmin"],
    "gap.learning": ["lull-n-learn"],
  },
};
