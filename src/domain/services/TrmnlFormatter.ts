import { format, parseISO } from "date-fns";
import type { Area } from "@/domain/entities/Area";
import type { Cycle } from "@/domain/entities/Cycle";
import type { Moment } from "@/domain/entities/Moment";
import { type PhaseConfig, getCurrentPhase, getPhaseConfig } from "@/domain/value-objects/Phase";

// ============================================================================
// Types
// ============================================================================

export interface TrmnlMomentData {
  readonly name: string;
  readonly emoji: string;
  readonly emoji_url: string;
  readonly area_name: string;
}

export interface TrmnlPhaseData {
  readonly phase: string;
  readonly label: string;
  readonly emoji: string;
  readonly emoji_url: string;
  readonly moments: TrmnlMomentData[];
  readonly moment_count: number;
}

export interface TrmnlMergeVariables {
  readonly date: string;
  readonly date_label: string;
  readonly cycle_name: string;
  readonly phase: TrmnlPhaseData | null;
  readonly updated_at: string;
}

export interface TrmnlPayload {
  readonly merge_variables: TrmnlMergeVariables;
}

// ============================================================================
// Twemoji
// ============================================================================

const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

function emojiToTwemojiUrl(emoji: string): string {
  if (!emoji) return "";

  const codepoints = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && cp !== 0xfe0f) {
      codepoints.push(cp.toString(16));
    }
  }

  if (codepoints.length === 0) return "";
  return `${TWEMOJI_BASE}/${codepoints.join("-")}.svg`;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatTodayForTrmnl(
  moments: Record<string, Moment>,
  areas: Record<string, Area>,
  phaseConfigs: Record<string, PhaseConfig>,
  activeCycle: Cycle | null,
  today: string,
  currentHour?: number
): TrmnlPayload {
  const allMoments = Object.values(moments);
  const configsArray = Object.values(phaseConfigs);
  const hour = currentHour ?? new Date().getHours();
  const currentPhase = getCurrentPhase(hour, configsArray);

  // Format date label
  const dateLabel = format(parseISO(today), "EEEE, MMM d");

  // No current phase → null
  if (currentPhase === null) {
    return {
      merge_variables: {
        date: today,
        date_label: dateLabel,
        cycle_name: activeCycle?.name ?? "",
        phase: null,
        updated_at: new Date().toISOString(),
      },
    };
  }

  // Get the config for the current phase
  const config = getPhaseConfig(currentPhase, configsArray);

  // Filter moments for today + current phase
  const phaseMoments = allMoments
    .filter((m) => m.day === today && m.phase === currentPhase)
    .sort((a, b) => a.order - b.order);

  // Build moment data — prefer moment emoji, fall back to area emoji
  const trmnlMoments: TrmnlMomentData[] = [];
  for (const moment of phaseMoments) {
    const area = areas[moment.areaId];
    const emoji = moment.emoji || area?.emoji || "";
    trmnlMoments.push({
      name: moment.name,
      emoji,
      emoji_url: emojiToTwemojiUrl(emoji),
      area_name: area?.name ?? "",
    });
  }

  return {
    merge_variables: {
      date: today,
      date_label: dateLabel,
      cycle_name: activeCycle?.name ?? "",
      phase: {
        phase: currentPhase,
        label: config?.label ?? currentPhase,
        emoji: config?.emoji ?? "",
        emoji_url: emojiToTwemojiUrl(config?.emoji ?? ""),
        moments: trmnlMoments,
        moment_count: trmnlMoments.length,
      },
      updated_at: new Date().toISOString(),
    },
  };
}
