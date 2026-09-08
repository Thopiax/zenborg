import type { Moment } from "@/domain/entities/Moment";
import {
  type Phase,
  type PhaseConfig,
  getCurrentPhase,
  getVisiblePhases,
} from "@/domain/value-objects/Phase";
import type { WateringHoursMode } from "@/domain/intervention/rules/wateringHours";

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
 *
 * Returns null when there's no gap, or when fence mode is "by_hand"
 * (only declared gaps in by-hand mode).
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
