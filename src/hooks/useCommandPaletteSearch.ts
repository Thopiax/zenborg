import { useSelector } from "@legendapp/state/react";
import Fuse from "fuse.js";
import { useMemo } from "react";
import { allCommands, type Command } from "@/commands";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import {
  activeAreas$,
  activeHabits$,
  areas$,
  moments$,
} from "@/infrastructure/state/store";

export type AppMode = "plant" | "cultivate" | "harvest";

export interface SearchableEntity {
  type: "area" | "habit" | "moment";
  id: string;
  name: string;
  emoji: string | null;
  areaName: string | null;
  areaColor: string | null;
  areaEmoji: string | null;
  entity: Area | Habit | Moment;
}

export interface CommandPaletteSearchResult {
  commands: Command[];
  areas: SearchableEntity[];
  habits: SearchableEntity[];
  moments: SearchableEntity[];
}

const MAX_ENTITIES_PER_GROUP = 8;

/**
 * Hook for searching commands and entities in the command palette.
 *
 * - Commands are always searchable
 * - Entities depend on the current mode:
 *   - Plant: areas + habits
 *   - Cultivate: moments
 *   - Harvest: none (for now)
 * - Entities only appear when the user is typing (non-empty search)
 */
export function useCommandPaletteSearch(
  mode: AppMode,
  searchQuery: string
): CommandPaletteSearchResult {
  const areasArray = useSelector(() => activeAreas$.get());
  const habitsArray = useSelector(() => activeHabits$.get());
  const allMoments = useSelector(() => moments$.get());
  const areaMap = useSelector(() => areas$.get());

  // Build searchable entities based on mode
  const searchableEntities = useMemo(() => {
    if (mode === "plant") {
      const areaItems: SearchableEntity[] = areasArray.map((a) => ({
        type: "area" as const,
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        areaName: null,
        areaColor: a.color,
        areaEmoji: null,
        entity: a,
      }));
      const habitItems: SearchableEntity[] = habitsArray.map((h) => {
        const area = areaMap[h.areaId];
        return {
          type: "habit" as const,
          id: h.id,
          name: h.name,
          emoji: h.emoji,
          areaName: area?.name ?? null,
          areaColor: area?.color ?? null,
          areaEmoji: area?.emoji ?? null,
          entity: h,
        };
      });
      return { areas: areaItems, habits: habitItems, moments: [] as SearchableEntity[] };
    }

    if (mode === "cultivate") {
      const momentItems: SearchableEntity[] = Object.values(allMoments).map((m) => {
        const area = areaMap[m.areaId];
        return {
          type: "moment" as const,
          id: m.id,
          name: m.name,
          emoji: m.emoji ?? null,
          areaName: area?.name ?? null,
          areaColor: area?.color ?? null,
          areaEmoji: area?.emoji ?? null,
          entity: m,
        };
      });
      return { areas: [] as SearchableEntity[], habits: [] as SearchableEntity[], moments: momentItems };
    }

    return { areas: [] as SearchableEntity[], habits: [] as SearchableEntity[], moments: [] as SearchableEntity[] };
  }, [mode, areasArray, habitsArray, allMoments, areaMap]);

  // Fuse.js instances per entity group
  const fuseInstances = useMemo(() => {
    const opts = {
      keys: ["name", "areaName"],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
    };
    return {
      areas: new Fuse(searchableEntities.areas, opts),
      habits: new Fuse(searchableEntities.habits, opts),
      moments: new Fuse(searchableEntities.moments, opts),
    };
  }, [searchableEntities]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!searchQuery) return allCommands;
    const lower = searchQuery.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(lower))
    );
  }, [searchQuery]);

  // Filter entities (only when searching)
  const filteredEntities = useMemo(() => {
    const empty = { areas: [] as SearchableEntity[], habits: [] as SearchableEntity[], moments: [] as SearchableEntity[] };
    if (!searchQuery.trim()) return empty;

    const trimmed = searchQuery.trim();

    const searchGroup = (
      items: SearchableEntity[],
      fuse: Fuse<SearchableEntity>
    ): SearchableEntity[] => {
      const lower = trimmed.toLowerCase();

      // Tiered matching: exact > prefix > contains > fuzzy
      const exact: SearchableEntity[] = [];
      const prefix: SearchableEntity[] = [];
      const contains: SearchableEntity[] = [];
      const matched = new Set<string>();

      for (const item of items) {
        const lowerName = item.name.toLowerCase();
        if (lowerName === lower) {
          exact.push(item);
          matched.add(item.id);
        } else if (lowerName.startsWith(lower)) {
          prefix.push(item);
          matched.add(item.id);
        } else if (lowerName.includes(lower)) {
          contains.push(item);
          matched.add(item.id);
        }
      }

      // Fuzzy for remaining
      const remaining = items.filter((i) => !matched.has(i.id));
      let fuzzy: SearchableEntity[] = [];
      if (remaining.length > 0) {
        const remainingFuse = new Fuse(remaining, {
          keys: ["name", "areaName"],
          threshold: 0.4,
          distance: 100,
          includeScore: true,
        });
        fuzzy = remainingFuse.search(trimmed).map((r) => r.item);
      }

      return [...exact, ...prefix, ...contains, ...fuzzy].slice(
        0,
        MAX_ENTITIES_PER_GROUP
      );
    };

    return {
      areas: searchGroup(searchableEntities.areas, fuseInstances.areas),
      habits: searchGroup(searchableEntities.habits, fuseInstances.habits),
      moments: searchGroup(searchableEntities.moments, fuseInstances.moments),
    };
  }, [searchQuery, searchableEntities, fuseInstances]);

  return {
    commands: filteredCommands,
    ...filteredEntities,
  };
}
