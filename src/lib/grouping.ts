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
import type { Horizon, Moment } from "@/domain/entities/Moment";

/**
 * Grouped collection of moments
 */
export interface MomentGroup {
  groupId: string;
  groupLabel: string;
  color?: string; // Optional color for the group (used for area grouping)
  emoji?: string; // Optional emoji for the group (used for area grouping)
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
  areas: Record<string, Area>
): MomentGroup[] {
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
      moments: groups.today,
    });
  }

  if (groups.yesterday.length > 0) {
    result.push({
      groupId: "created-yesterday",
      groupLabel: "Yesterday",
      moments: groups.yesterday,
    });
  }

  if (groups.thisWeek.length > 0) {
    result.push({
      groupId: "created-this-week",
      groupLabel: "This Week",
      moments: groups.thisWeek,
    });
  }

  if (groups.thisMonth.length > 0) {
    result.push({
      groupId: "created-this-month",
      groupLabel: "This Month",
      moments: groups.thisMonth,
    });
  }

  if (groups.allTime.length > 0) {
    result.push({
      groupId: "created-all-time",
      groupLabel: "All Time",
      moments: groups.allTime,
    });
  }

  return result;
}

/**
 * Group moments by horizon (time perspective)
 * Categories: This Week, Next Week, This Month, Later, Unset
 * Shows all horizon levels, including empty ones
 * Monochrome design - no color coding
 */
export function groupByHorizon(moments: Moment[]): MomentGroup[] {
  const groups: Record<string, Moment[]> = {
    thisWeek: [],
    nextWeek: [],
    thisMonth: [],
    later: [],
    unset: [],
  };

  for (const moment of moments) {
    switch (moment.horizon) {
      case "this-week":
        groups.thisWeek.push(moment);
        break;
      case "next-week":
        groups.nextWeek.push(moment);
        break;
      case "this-month":
        groups.thisMonth.push(moment);
        break;
      case "later":
      default:
        groups.later.push(moment);
        break;
    }
  }

  // Return all horizon levels in order (This Week > Next Week > This Month > Later > Unset)
  // No colors - monochrome design
  return [
    {
      groupId: "horizon-this-week",
      groupLabel: "This Week",
      moments: groups.thisWeek,
    },
    {
      groupId: "horizon-next-week",
      groupLabel: "Next Week",
      moments: groups.nextWeek,
    },
    {
      groupId: "horizon-this-month",
      groupLabel: "This Month",
      moments: groups.thisMonth,
    },
    {
      groupId: "horizon-later",
      groupLabel: "Later",
      moments: groups.later,
    },
  ];
}

/**
 * Get grouping function based on grouping mode
 */
export function getGroupingFunction(
  groupBy: "none" | "area" | "created" | "horizon"
): ((moments: Moment[], areas?: Record<string, Area>) => MomentGroup[]) | null {
  switch (groupBy) {
    case "area":
      return (moments: Moment[], areas?: Record<string, Area>) => {
        if (!areas) return [];
        return groupByArea(moments, areas);
      };
    case "created":
      return groupByCreated;
    case "horizon":
      return groupByHorizon;
    case "none":
    default:
      return null;
  }
}
