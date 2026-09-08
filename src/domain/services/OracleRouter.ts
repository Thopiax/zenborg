import type { Habit } from "@/domain/entities/Habit";
import type { ThirstScore } from "./ThirstService";

/**
 * Oracle routing — given a gap habit, decide what tool handles it.
 *
 * Routing order: link field → tag-based oracle → timer (if sized) → whisper-only.
 * Each oracle is a typed action the infrastructure layer dispatches.
 * The domain says WHAT; the infra says HOW.
 */

export type OracleAction =
  | { readonly kind: "garmin"; readonly workoutType: "breathwork"; readonly durationMin: number }
  | { readonly kind: "lull-n-learn"; readonly mode: "study" | "read"; readonly tag?: string }
  | { readonly kind: "link"; readonly url: string; readonly appName: string }
  | { readonly kind: "timer"; readonly durationMs: number; readonly habitName: string }
  | { readonly kind: "whisper-only" };

const TAG_ROUTES: ReadonlyArray<{ tag: string; route: (h: Habit) => OracleAction | null }> = [
  {
    tag: "wellness",
    route: (h) => ({
      kind: "garmin",
      workoutType: "breathwork",
      durationMin: h.durationMin ?? 2,
    }),
  },
  {
    tag: "breathwork",
    route: (h) => ({
      kind: "garmin",
      workoutType: "breathwork",
      durationMin: h.durationMin ?? 2,
    }),
  },
  {
    tag: "learning",
    route: (h) => ({
      kind: "lull-n-learn",
      mode: h.durationMin && h.durationMin >= 5 ? "read" : "study",
      tag: h.tags.find((t) => t !== "gap" && t !== "learning" && !t.startsWith("gap-")),
    }),
  },
];

/**
 * Route a habit to its oracle action.
 *
 * Priority: link field → tag-based oracle → timer (if sized) → whisper-only.
 */
export function routeOracle(habit: Habit): OracleAction {
  if (habit.link?.trim()) {
    let appName: string;
    try {
      appName = new URL(habit.link).hostname.replace(/^www\./, "").split(".")[0];
    } catch {
      appName = "app";
    }
    return { kind: "link", url: habit.link, appName };
  }

  const tags = (habit.tags ?? []).map((t) => t.toLowerCase());
  for (const { tag, route } of TAG_ROUTES) {
    if (tags.includes(tag)) {
      const action = route(habit);
      if (action) return action;
    }
  }

  const sizeMs = parseSizeTag(tags);
  if (sizeMs) return { kind: "timer", durationMs: sizeMs, habitName: habit.name };

  return { kind: "whisper-only" };
}

const SIZE_TAG = /^gap-(\d+)(s|m)$/;

function parseSizeTag(tags: readonly string[]): number | undefined {
  for (const t of tags) {
    const m = SIZE_TAG.exec(t);
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    return m[2] === "s" ? n * 1000 : n * 60_000;
  }
  return undefined;
}

/**
 * Notification shape for a gap proposal.
 */
export interface GapProposal {
  readonly habitId: string;
  readonly habitName: string;
  readonly action: OracleAction;
  readonly gapType: "periodic" | "micro" | "transition" | "declared";
  readonly thirst: number;
}

/**
 * Build proposals from thirst-ranked habits, routing each through its oracle.
 */
export function buildProposals(
  rankedHabits: ReadonlyArray<{ habit: Habit; thirst: ThirstScore }>,
  gapType: GapProposal["gapType"],
  limit: number = 3,
): readonly GapProposal[] {
  const out: GapProposal[] = [];
  for (const { habit, thirst } of rankedHabits) {
    if (out.length >= limit) break;
    out.push({
      habitId: habit.id,
      habitName: habit.name,
      action: routeOracle(habit),
      gapType,
      thirst: thirst.score,
    });
  }
  return out;
}

// ── Config-driven oracle registry (for oracles.json) ─────────────────

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
): { type: string; target?: string } {
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
        return { type: name, target: undefined };
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
