/**
 * Grouping utilities for organizing moments in the drawing board
 */

import {
  format,
  isThisMonth,
  isThisWeek,
  isToday,
  isYesterday,
} from "date-fns";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import { ATTITUDE_METADATA, Attitude } from "@/domain/value-objects/Attitude";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";
import { PHASE_ICONS } from "@/domain/value-objects/phaseStyles";
import { attitudeService } from "@/domain/services/AttitudeService";

/**
 * Sort moments by order (primary) and createdAt (secondary)
 * This ensures consistent ordering for unallocated moments
 */
function sortMoments(moments: Moment[]): Moment[] {
  return moments.sort((a, b) => {
    // Primary sort: by order
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    // Secondary sort: by creation date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Grouped collection of moments
 */
export interface MomentGroup {
  groupId: string;
  groupLabel: string;
  color?: string; // Optional color for the group (used for area grouping)
  emoji?: string; // Optional emoji for the group (used for area grouping)
  icon?: React.ComponentType<{ className?: string }>; // Optional icon component (used for phase grouping)
  showEmptyState?: boolean; // Whether to show empty state when no moments (default: true)
  moments: Moment[];
}

/**
 * Group moments by area
 * Shows all provided areas (caller is responsible for filtering)
 *
 * Note: Caller should pass only active areas if archived areas should be hidden.
 * Moments referencing archived areas will be included in their respective groups.
 */
export function groupByArea(
  moments: Moment[],
  _habits?: Record<string, Habit>,
  areas?: Record<string, Area>
): MomentGroup[] {
  if (!areas) {
    return [];
  }

  // Initialize all provided areas as empty groups
  const allAreas = Object.values(areas).sort((a, b) => a.order - b.order);
  const grouped = new Map<string, MomentGroup>(
    allAreas.map((area) => [
      area.id,
      {
        groupId: area.id,
        groupLabel: area.name,
        color: area.color,
        emoji: area.emoji,
        moments: [],
      },
    ])
  );

  // Fill in moments for each area
  for (const moment of moments) {
    const group = grouped.get(moment.areaId);
    if (group) {
      group.moments.push(moment);
    }
  }

  // Sort moments within each group
  for (const group of grouped.values()) {
    sortMoments(group.moments);
  }

  // Return in area order
  return Array.from(grouped.values());
}

/**
 * Group moments by creation date
 * Categories: Today, Yesterday, This Week, This Month, All Time
 */
export function groupByCreated(moments: Moment[]): MomentGroup[] {
  const groups = {
    today: [] as Moment[],
    yesterday: [] as Moment[],
    thisWeek: [] as Moment[],
    thisMonth: [] as Moment[],
    allTime: [] as Moment[],
  };

  for (const moment of moments) {
    const createdDate = new Date(moment.createdAt);

    if (isToday(createdDate)) {
      groups.today.push(moment);
    } else if (isYesterday(createdDate)) {
      groups.yesterday.push(moment);
    } else if (isThisWeek(createdDate, { weekStartsOn: 1 })) {
      groups.thisWeek.push(moment);
    } else if (isThisMonth(createdDate)) {
      groups.thisMonth.push(moment);
    } else {
      groups.allTime.push(moment);
    }
  }

  // Build result array, only including non-empty groups
  const result: MomentGroup[] = [];

  if (groups.today.length > 0) {
    result.push({
      groupId: "created-today",
      groupLabel: "Today",
      moments: sortMoments(groups.today),
    });
  }

  if (groups.yesterday.length > 0) {
    result.push({
      groupId: "created-yesterday",
      groupLabel: "Yesterday",
      moments: sortMoments(groups.yesterday),
    });
  }

  if (groups.thisWeek.length > 0) {
    result.push({
      groupId: "created-this-week",
      groupLabel: "This Week",
      moments: sortMoments(groups.thisWeek),
    });
  }

  if (groups.thisMonth.length > 0) {
    result.push({
      groupId: "created-this-month",
      groupLabel: "This Month",
      moments: sortMoments(groups.thisMonth),
    });
  }

  if (groups.allTime.length > 0) {
    result.push({
      groupId: "created-all-time",
      groupLabel: "All Time",
      moments: sortMoments(groups.allTime),
    });
  }

  return result;
}

/**
 * Group moments by attitude
 * Shows all attitude levels including moments with no attitude
 * Monochrome design - no color coding
 *
 * Attitudes are computed from: habit?.attitude ?? area?.attitude ?? null
 */
export function groupByAttitude(
  moments: Moment[],
  habits?: Record<string, Habit>,
  areas?: Record<string, Area>
): MomentGroup[] {
  const groups: Record<string, Moment[]> = {
    beginning: [],
    keeping: [],
    building: [],
    pushing: [],
    being: [],
    none: [],
  };

  if (!habits || !areas) {
    return [];
  }

  for (const moment of moments) {
    const attitude = attitudeService.getMomentAttitude(moment, habits, areas);

    switch (attitude) {
      case Attitude.BEGINNING:
        groups.beginning.push(moment);
        break;
      case Attitude.KEEPING:
        groups.keeping.push(moment);
        break;
      case Attitude.BUILDING:
        groups.building.push(moment);
        break;
      case Attitude.PUSHING:
        groups.pushing.push(moment);
        break;
      case Attitude.BEING:
        groups.being.push(moment);
        break;
      default:
        groups.none.push(moment);
        break;
    }
  }

  // Return all attitudes in order
  // No colors - monochrome design
  return [
    {
      groupId: "attitude-none",
      groupLabel: "Pure presence",
      emoji: "○",
      moments: sortMoments(groups.none),
    },
    {
      groupId: "attitude-beginning",
      groupLabel: ATTITUDE_METADATA[Attitude.BEGINNING].label,
      emoji: ATTITUDE_METADATA[Attitude.BEGINNING].icon,
      moments: sortMoments(groups.beginning),
    },
    {
      groupId: "attitude-keeping",
      groupLabel: ATTITUDE_METADATA[Attitude.KEEPING].label,
      emoji: ATTITUDE_METADATA[Attitude.KEEPING].icon,
      moments: sortMoments(groups.keeping),
    },
    {
      groupId: "attitude-building",
      groupLabel: ATTITUDE_METADATA[Attitude.BUILDING].label,
      emoji: ATTITUDE_METADATA[Attitude.BUILDING].icon,
      moments: sortMoments(groups.building),
    },
    {
      groupId: "attitude-pushing",
      groupLabel: ATTITUDE_METADATA[Attitude.PUSHING].label,
      emoji: ATTITUDE_METADATA[Attitude.PUSHING].icon,
      moments: sortMoments(groups.pushing),
    },
    {
      groupId: "attitude-being",
      groupLabel: ATTITUDE_METADATA[Attitude.BEING].label,
      emoji: ATTITUDE_METADATA[Attitude.BEING].icon,
      moments: sortMoments(groups.being),
    },
  ];
}

/**
 * Group moments by tags
 * Creates a group for each unique tag found in moments
 * Moments with multiple tags appear in multiple groups
 * Includes an "Untagged" group for moments without tags
 */
export function groupByTag(moments: Moment[]): MomentGroup[] {
  // Collect all unique tags
  const tagSet = new Set<string>();
  const untagged: Moment[] = [];

  for (const moment of moments) {
    const hasTags = moment.tags && moment.tags.length > 0;

    if (!hasTags) {
      untagged.push(moment);
    } else {
      for (const tag of moment.tags!) {
        tagSet.add(tag);
      }
    }
  }

  // Sort tags alphabetically
  const sortedTags = Array.from(tagSet).sort();

  // Create groups for each tag
  const groups: MomentGroup[] = sortedTags.map((tag) => {
    const taggedMoments = moments.filter((moment) =>
      moment.tags?.includes(tag)
    );

    return {
      groupId: `tag-${tag}`,
      groupLabel: `#${tag}`,
      moments: sortMoments(taggedMoments),
    };
  });

  // Add untagged group at the end if there are untagged moments
  if (untagged.length > 0) {
    groups.push({
      groupId: "tag-none",
      groupLabel: "Untagged",
      moments: sortMoments(untagged),
    });
  }

  return groups;
}

/*
 * Monochrome colors for phase grouping (stone palette)
 * Follows wabi-sabi design principles with subtle tonal variations
 */
const PHASE_COLORS: Record<Phase, string> = {
  [Phase.MORNING]: "#d6d3d1", // stone-300
  [Phase.AFTERNOON]: "#a8a29e", // stone-400
  [Phase.EVENING]: "#78716c", // stone-500
  [Phase.NIGHT]: "#57534e", // stone-600
};

/**
 * Group moments by phase of day
 * Categories: Morning, Afternoon, Evening, Night
 * Shows all visible phases in order
 * Uses phase configuration for labels and phaseStyles for icons/colors
 */
export function groupByPhase(
  moments: Moment[],
  phaseConfigs: PhaseConfig[]
): MomentGroup[] {
  // Get visible phases sorted by order
  const visiblePhases = phaseConfigs
    .filter((config) => config.isVisible)
    .sort((a, b) => a.order - b.order);

  // Initialize groups for all visible phases
  const groups: MomentGroup[] = visiblePhases.map((config) => ({
    groupId: `phase-${config.phase}`,
    groupLabel: config.label,
    color: PHASE_COLORS[config.phase], // Use monochrome colors
    icon: PHASE_ICONS[config.phase], // Use icons from phaseStyles
    moments: [],
  }));

  // Add unallocated phase group (moments without phase assignment)
  // No empty state for this group - it's a catch-all for unorganized moments
  groups.push({
    groupId: "phase-unset",
    groupLabel: "No Phase",
    color: "#e7e5e4", // stone-200
    showEmptyState: false, // Calmer appearance - no promotional empty state
    moments: [],
  });

  // Group moments by their phase
  const groupsMap = new Map<string, Moment[]>();
  for (const group of groups) {
    groupsMap.set(group.groupId, []);
  }

  for (const moment of moments) {
    if (moment.phase) {
      const groupId = `phase-${moment.phase}`;
      const groupMoments = groupsMap.get(groupId);
      if (groupMoments) {
        groupMoments.push(moment);
      }
    } else {
      // Moments without phase go to "No Phase" group
      const groupMoments = groupsMap.get("phase-unset");
      if (groupMoments) {
        groupMoments.push(moment);
      }
    }
  }

  // Fill in sorted moments for each group
  for (const group of groups) {
    const groupMoments = groupsMap.get(group.groupId);
    if (groupMoments) {
      group.moments = sortMoments(groupMoments);
    }
  }

  return groups;
}

/**
 * Get grouping function based on grouping mode
 *
 * Note: Phase grouping is not included here because it requires different
 * parameters (PhaseConfig[] instead of Record<string, Area>). Handle phase
 * grouping separately by calling groupByPhase directly.
 */
export function getGroupingFunction(
  groupBy: "none" | "area" | "created" | "attitude" | "tag"
):
  | ((
      moments: Moment[],
      habits?: Record<string, Habit>,
      areas?: Record<string, Area>
    ) => MomentGroup[])
  | null {
  switch (groupBy) {
    case "area":
      return groupByArea;
    case "created":
      return (moments: Moment[]) => groupByCreated(moments);
    case "attitude":
      return groupByAttitude;
    case "tag":
      return (moments: Moment[]) => groupByTag(moments);
    case "none":
    default:
      return null;
  }
}
