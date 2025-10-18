/**
 * Grouping utilities for organizing moments in the drawing board
 */

import type { Area } from "@/domain/entities/Area";
import type { Moment, Horizon } from "@/domain/entities/Moment";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";

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
 * Shows all areas, including empty ones
 */
export function groupByArea(
  moments: Moment[],
  areas: Record<string, Area>
): MomentGroup[] {
  // Initialize all areas as empty groups
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
 * Categories: Now, Soon, Later, Unset
 * Shows all horizon levels, including empty ones
 * Monochrome design - no color coding
 */
export function groupByHorizon(moments: Moment[]): MomentGroup[] {
  const groups: Record<string, Moment[]> = {
    now: [],
    soon: [],
    later: [],
    unset: [],
  };

  for (const moment of moments) {
    if (moment.horizon === "now") {
      groups.now.push(moment);
    } else if (moment.horizon === "soon") {
      groups.soon.push(moment);
    } else if (moment.horizon === "later") {
      groups.later.push(moment);
    } else {
      groups.unset.push(moment);
    }
  }

  // Return all horizon levels in order (Now > Soon > Later > Unset)
  // No colors - monochrome design
  return [
    {
      groupId: "horizon-now",
      groupLabel: "Now",
      moments: groups.now,
    },
    {
      groupId: "horizon-soon",
      groupLabel: "Soon",
      moments: groups.soon,
    },
    {
      groupId: "horizon-later",
      groupLabel: "Later",
      moments: groups.later,
    },
    {
      groupId: "horizon-unset",
      groupLabel: "Unset",
      moments: groups.unset,
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
