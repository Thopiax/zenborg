import { format, parseISO } from "date-fns";
import type { Area } from "@/domain/entities/Area";
import type { Cycle } from "@/domain/entities/Cycle";
import type { Moment } from "@/domain/entities/Moment";
import { type PhaseConfig, getVisiblePhases, getCurrentPhase } from "@/domain/value-objects/Phase";

// ============================================================================
// Types
// ============================================================================

export interface TrmnlMomentData {
  readonly name: string;
  readonly area_name: string;
  readonly area_emoji: string;
}

export interface TrmnlPhaseData {
  readonly phase: string;
  readonly label: string;
  readonly emoji: string;
  readonly moments: TrmnlMomentData[];
  readonly moment_count: number;
  readonly is_current: boolean;
}

export interface TrmnlMergeVariables {
  readonly date: string;
  readonly date_label: string;
  readonly cycle_name: string;
  readonly phases: TrmnlPhaseData[];
  readonly total_allocated: number;
  readonly total_unallocated: number;
  readonly updated_at: string;
}

export interface TrmnlPayload {
  readonly merge_variables: TrmnlMergeVariables;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatTodayForTrmnl(
  moments: Record<string, Moment>,
  areas: Record<string, Area>,
  phaseConfigs: Record<string, PhaseConfig>,
  activeCycle: Cycle | null,
  today: string
): TrmnlPayload {
  const allMoments = Object.values(moments);
  const configsArray = Object.values(phaseConfigs);
  const visiblePhases = getVisiblePhases(configsArray);
  const currentHour = new Date().getHours();
  const currentPhase = getCurrentPhase(currentHour, configsArray);

  // Filter moments allocated to today with a phase
  const todayMoments = allMoments.filter(
    (m) => m.day === today && m.phase !== null
  );

  // Group today's moments by phase
  const momentsByPhase: Record<string, Moment[]> = {};
  for (const moment of todayMoments) {
    const phase = moment.phase!;
    if (!momentsByPhase[phase]) {
      momentsByPhase[phase] = [];
    }
    momentsByPhase[phase].push(moment);
  }

  // Sort moments within each phase by order
  for (const phase in momentsByPhase) {
    momentsByPhase[phase].sort((a, b) => a.order - b.order);
  }

  // Build phase data
  const phases: TrmnlPhaseData[] = [];
  for (const config of visiblePhases) {
    const phaseMoments = momentsByPhase[config.phase] ?? [];

    const trmnlMoments: TrmnlMomentData[] = [];
    for (const moment of phaseMoments) {
      const area = areas[moment.areaId];
      trmnlMoments.push({
        name: moment.name,
        area_name: area?.name ?? "Unknown",
        area_emoji: area?.emoji ?? "",
      });
    }

    phases.push({
      phase: config.phase,
      label: config.label,
      emoji: config.emoji,
      moments: trmnlMoments,
      moment_count: trmnlMoments.length,
      is_current: config.phase === currentPhase,
    });
  }

  // Count unallocated moments (day is null)
  const unallocatedCount = allMoments.filter((m) => m.day === null).length;

  // Format date label
  const dateLabel = format(parseISO(today), "EEEE, MMM d");

  return {
    merge_variables: {
      date: today,
      date_label: dateLabel,
      cycle_name: activeCycle?.name ?? "",
      phases,
      total_allocated: todayMoments.length,
      total_unallocated: unallocatedCount,
      updated_at: new Date().toISOString(),
    },
  };
}
