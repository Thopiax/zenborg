import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import {
  type Phase,
  type PhaseConfig,
  getCurrentPhase,
  getVisiblePhases,
} from "@/domain/value-objects/Phase";
import { PERIOD_DAYS } from "@/domain/value-objects/Rhythm";
import type { WateringHoursMode } from "@/domain/intervention/rules/wateringHours";

// ── Transition (#3) ───────────────────────────────────────────────

export type GapType = "transition" | "declared";

export interface DetectedGap {
  readonly gapType: GapType;
  readonly fromPhase: Phase;
  readonly toPhase: Phase;
  readonly estimatedMinutes: number;
}

const COOLDOWN_MS = 30 * 60 * 1000;
const MAX_PROPOSALS_PER_DAY = 3;

export interface GapDetectorState {
  lastProposalAt: number | null;
  proposalsToday: number;
  todayDate: string | null;
}

export function freshState(): GapDetectorState {
  return { lastProposalAt: null, proposalsToday: 0, todayDate: null };
}

/**
 * Can we propose right now? Checks cooldown, daily cap, and fence mode.
 */
export function canPropose(
  state: GapDetectorState,
  fenceMode: WateringHoursMode,
  now: Date,
): boolean {
  if (fenceMode === "dry") return false;
  const today = now.toISOString().slice(0, 10);
  const count =
    state.todayDate === today ? state.proposalsToday : 0;
  if (count >= MAX_PROPOSALS_PER_DAY) return false;
  if (state.lastProposalAt !== null) {
    if (now.getTime() - state.lastProposalAt < COOLDOWN_MS) return false;
  }
  return true;
}

/**
 * Record that a proposal was made.
 */
export function recordProposal(
  state: GapDetectorState,
  now: Date,
): GapDetectorState {
  const today = now.toISOString().slice(0, 10);
  return {
    lastProposalAt: now.getTime(),
    proposalsToday:
      (state.todayDate === today ? state.proposalsToday : 0) + 1,
    todayDate: today,
  };
}

/**
 * Detect a transition gap: the current phase has no remaining moments AND
 * the next phase has nothing planted.
 */
export function detectTransitionGap(
  todayMoments: readonly Moment[],
  phaseConfigs: readonly PhaseConfig[],
  fenceMode: WateringHoursMode,
  now: Date,
): DetectedGap | null {
  if (fenceMode === "dry" || fenceMode === "by_hand") return null;

  const hour = now.getHours();
  const currentPhase = getCurrentPhase(hour, [...phaseConfigs]);
  if (!currentPhase) return null;

  const visible = getVisiblePhases([...phaseConfigs]);
  const currentIdx = visible.findIndex((c) => c.phase === currentPhase);
  if (currentIdx < 0 || currentIdx >= visible.length - 1) return null;

  const nextConfig = visible[currentIdx + 1];

  const momentsInPhase = (phase: Phase) =>
    todayMoments.filter((m) => m.phase === phase && m.day !== null);

  if (momentsInPhase(nextConfig.phase).length > 0) return null;

  const currentConfig = visible[currentIdx];
  const gapMinutes =
    (nextConfig.endHour > nextConfig.startHour
      ? nextConfig.endHour - nextConfig.startHour
      : 24 - nextConfig.startHour + nextConfig.endHour) * 60;
  // ponytail: rough estimate from phase bounds, good enough for proposal label
  const estimatedMinutes = Math.min(gapMinutes, 15);

  return {
    gapType: "transition",
    fromPhase: currentConfig.phase,
    toPhase: nextConfig.phase,
    estimatedMinutes,
  };
}

// ── Periodic (#12) ─────────────────────────────────────────────────

const PERIODIC_TAG = "gap-periodic";
const TWO_MINUTES_MS = 2 * 60_000;

export interface PeriodicGap {
  readonly gapType: "periodic";
  readonly habit: Habit;
  readonly intervalMs: number;
}

/**
 * Clock-driven gaps (e.g. 20-20-20 rule). A habit opts in with the
 * `gap-periodic` tag; rhythm gives the interval, durationMin gives
 * the practice length. Bypasses thirst — fires on its clock.
 */
export function detectPeriodicGaps(
  habits: readonly Habit[],
  lastBreakAt: Date | null,
  now: Date,
): PeriodicGap | null {
  const elapsed = lastBreakAt
    ? now.getTime() - lastBreakAt.getTime()
    : Number.POSITIVE_INFINITY;

  for (const h of habits) {
    if (h.isArchived) continue;
    if (!h.tags?.some((t) => t.toLowerCase() === PERIODIC_TAG)) continue;
    if (!h.rhythm) continue;

    const intervalMs =
      (PERIOD_DAYS[h.rhythm.period] / h.rhythm.count) * 86_400_000;
    if (elapsed >= intervalMs) {
      return { gapType: "periodic", habit: h, intervalMs };
    }
  }
  return null;
}

// ── Micro (#14) ────────────────────────────────────────────────────

export interface MicroGap {
  readonly gapType: "micro";
  readonly durationMs: number;
}

/**
 * Idle gap after a moment ends and nothing follows. Off by default.
 * Auto-dismisses at 2 minutes.
 */
export function detectMicroGap(
  activeMoment: { endedAt: Date } | null,
  nextMoment: { startsAt: Date } | null,
  now: Date,
  idleThresholdMs: number,
): MicroGap | null {
  if (!activeMoment) return null;
  const idle = now.getTime() - activeMoment.endedAt.getTime();
  if (idle < idleThresholdMs) return null;
  if (idle > TWO_MINUTES_MS) return null;
  if (nextMoment && nextMoment.startsAt.getTime() <= now.getTime())
    return null;
  return { gapType: "micro", durationMs: idle };
}

// ── Context-aware (#11) ────────────────────────────────────────────

export interface ContextSignal {
  readonly frontmostApp: string;
  readonly activeMoment: string | null;
  readonly durationInContextMs: number;
}

export interface ContextSuggestion {
  readonly areaId: string;
  readonly suggestedName: string;
  readonly confidence: number;
}

// ponytail: linear scan over ~20 areas × ~10 app mappings; hash map if either grows past 100
export const DEFAULT_APP_AREA_MAP: Record<string, string> = {
  Mail: "admin",
  Outlook: "admin",
  "Microsoft Outlook": "admin",
  Calendar: "admin",
  "Google Calendar": "admin",
  "Fantastical": "admin",
  "Visual Studio Code": "work",
  "VS Code": "work",
  Cursor: "work",
  Terminal: "work",
  iTerm2: "work",
  Warp: "work",
  Xcode: "work",
  "Garmin Connect": "wellness",
  "Garmin Express": "wellness",
  Headspace: "wellness",
};

const DEFAULT_THRESHOLD_MS = 10 * 60_000;

/**
 * The inverse of gap proposals: names what you're already doing.
 * Returns null when a moment is active (no interruption during intention)
 * or below threshold.
 */
export function suggestMomentFromContext(
  signal: ContextSignal,
  areas: readonly Area[],
  appAreaMap: Record<string, string> = DEFAULT_APP_AREA_MAP,
  thresholdMs: number = DEFAULT_THRESHOLD_MS,
): ContextSuggestion | null {
  if (signal.activeMoment) return null;
  if (signal.durationInContextMs < thresholdMs) return null;

  const areaSlug = appAreaMap[signal.frontmostApp];
  if (!areaSlug) return null;

  const area = areas.find(
    (a) => a.name.toLowerCase() === areaSlug.toLowerCase(),
  );
  if (!area) return null;

  const minutes = Math.round(signal.durationInContextMs / 60_000);
  return {
    areaId: area.id,
    suggestedName: areaSlug,
    confidence: Math.min(minutes / 30, 1),
  };
}
