import { describe, it, expect } from "vitest";
import {
  formatTodayForTrmnl,
  type TrmnlPayload,
} from "../TrmnlFormatter";
import type { Moment } from "@/domain/entities/Moment";
import type { Area } from "@/domain/entities/Area";
import type { Cycle } from "@/domain/entities/Cycle";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";

// ============================================================================
// Test Helpers
// ============================================================================

function createMoment(
  id: string,
  name: string,
  areaId: string,
  overrides: Partial<Moment> = {}
): Moment {
  return {
    id,
    name,
    areaId,
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: null,
    day: null,
    order: 0,
    emoji: null,
    tags: null,
    createdAt: "2026-02-22T10:00:00.000Z",
    updatedAt: "2026-02-22T10:00:00.000Z",
    ...overrides,
  };
}

function createArea(
  id: string,
  name: string,
  emoji: string,
  overrides: Partial<Area> = {}
): Area {
  return {
    id,
    name,
    attitude: null,
    tags: [],
    color: "#10b981",
    emoji,
    isDefault: true,
    isArchived: false,
    order: 0,
    createdAt: "2026-02-22T10:00:00.000Z",
    updatedAt: "2026-02-22T10:00:00.000Z",
    ...overrides,
  };
}

function createPhaseConfig(
  phase: Phase,
  overrides: Partial<PhaseConfig> = {}
): PhaseConfig {
  const defaults: Record<Phase, Omit<PhaseConfig, "id" | "createdAt" | "updatedAt">> = {
    [Phase.MORNING]: {
      phase: Phase.MORNING,
      label: "Morning",
      emoji: "☕",
      color: "#f59e0b",
      startHour: 6,
      endHour: 12,
      isVisible: true,
      order: 0,
    },
    [Phase.AFTERNOON]: {
      phase: Phase.AFTERNOON,
      label: "Afternoon",
      emoji: "☀️",
      color: "#eab308",
      startHour: 12,
      endHour: 18,
      isVisible: true,
      order: 1,
    },
    [Phase.EVENING]: {
      phase: Phase.EVENING,
      label: "Evening",
      emoji: "🌙",
      color: "#8b5cf6",
      startHour: 18,
      endHour: 22,
      isVisible: true,
      order: 2,
    },
    [Phase.NIGHT]: {
      phase: Phase.NIGHT,
      label: "Night",
      emoji: "✨",
      color: "#1e293b",
      startHour: 22,
      endHour: 6,
      isVisible: false,
      order: 3,
    },
  };

  return {
    id: `phase-${phase}`,
    ...defaults[phase],
    ...overrides,
    createdAt: "2026-02-22T10:00:00.000Z",
    updatedAt: "2026-02-22T10:00:00.000Z",
  };
}

function toRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  const record: Record<string, T> = {};
  for (const item of items) {
    record[item.id] = item;
  }
  return record;
}

const TODAY = "2026-02-22";

// ============================================================================
// Tests
// ============================================================================

describe("TrmnlFormatter", () => {
  describe("formatTodayForTrmnl", () => {
    it("returns only the current phase with its moments", () => {
      const areas = toRecord([
        createArea("area-1", "Wellness", "🟢"),
        createArea("area-2", "Craft", "🔵"),
      ]);

      const moments = toRecord([
        createMoment("m-1", "Morning Run", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
        createMoment("m-2", "Deep Work", "area-2", {
          day: TODAY,
          phase: Phase.AFTERNOON,
          order: 0,
        }),
        createMoment("m-3", "Team Sync", "area-2", {
          day: TODAY,
          phase: Phase.AFTERNOON,
          order: 1,
        }),
      ]);

      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.MORNING),
        createPhaseConfig(Phase.AFTERNOON),
        createPhaseConfig(Phase.EVENING),
      ]);

      // currentHour=14 → Afternoon phase
      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 14);

      expect(result.merge_variables.phase).not.toBeNull();
      expect(result.merge_variables.phase!.label).toBe("Afternoon");
      expect(result.merge_variables.phase!.moments).toHaveLength(2);
      expect(result.merge_variables.phase!.moments[0].name).toBe("Deep Work");
      expect(result.merge_variables.phase!.moments[1].name).toBe("Team Sync");
    });

    it("returns null phase when no phase matches current hour", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.MORNING),
        createPhaseConfig(Phase.AFTERNOON),
        createPhaseConfig(Phase.EVENING),
        // Night is not visible by default, so hour 3 has no matching phase
      ]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 3);

      expect(result.merge_variables.phase).toBeNull();
    });

    it("returns empty moments for current phase with no allocated moments", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.MORNING),
        createPhaseConfig(Phase.AFTERNOON),
      ]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      expect(result.merge_variables.phase).not.toBeNull();
      expect(result.merge_variables.phase!.label).toBe("Morning");
      expect(result.merge_variables.phase!.moments).toHaveLength(0);
    });

    it("falls back to empty emoji for missing area references", () => {
      const areas: Record<string, Area> = {}; // no areas
      const moments = toRecord([
        createMoment("m-1", "Orphaned", "deleted-area-id", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
      ]);
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      expect(result.merge_variables.phase!.moments[0].emoji).toBe("");
    });

    it("sorts moments within the current phase by order", () => {
      const areas = toRecord([createArea("area-1", "Craft", "🔵")]);
      const moments = toRecord([
        createMoment("m-2", "Second", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 2,
        }),
        createMoment("m-0", "First", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
        createMoment("m-1", "Middle", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 1,
        }),
      ]);
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      const names = result.merge_variables.phase!.moments.map((m) => m.name);
      expect(names).toEqual(["First", "Middle", "Second"]);
    });

    it("includes cycle name when active cycle exists", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);
      const cycle: Cycle = {
        id: "cycle-1",
        name: "Barcelona Summer",
        startDate: "2026-02-01",
        endDate: "2026-03-01",
        isActive: true,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      };

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, cycle, TODAY, 8);

      expect(result.merge_variables.cycle_name).toBe("Barcelona Summer");
    });

    it("uses empty string for cycle name when no cycle is active", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      expect(result.merge_variables.cycle_name).toBe("");
    });

    it("formats date_label as a human-readable string", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, "2026-02-22", 8);

      // Sunday, Feb 22
      expect(result.merge_variables.date_label).toBe("Sunday, Feb 22");
    });

    it("only includes moments from current phase, not other phases", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments = toRecord([
        createMoment("m-1", "Morning Thing", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
        createMoment("m-2", "Afternoon Thing", "area-1", {
          day: TODAY,
          phase: Phase.AFTERNOON,
          order: 0,
        }),
        createMoment("m-3", "Evening Thing", "area-1", {
          day: TODAY,
          phase: Phase.EVENING,
          order: 0,
        }),
      ]);
      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.MORNING),
        createPhaseConfig(Phase.AFTERNOON),
        createPhaseConfig(Phase.EVENING),
      ]);

      // currentHour=8 → Morning
      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      expect(result.merge_variables.phase!.label).toBe("Morning");
      expect(result.merge_variables.phase!.moments).toHaveLength(1);
      expect(result.merge_variables.phase!.moments[0].name).toBe("Morning Thing");
    });

    it("produces a payload under 2KB for maximum density", () => {
      const areas = toRecord([
        createArea("area-1", "Wellness", "🟢"),
        createArea("area-2", "Craft", "🔵"),
        createArea("area-3", "Social", "🟠"),
      ]);

      // 3 moments in morning (max per phase)
      const moments = toRecord([
        createMoment("m-0", "Moment Zero", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
        createMoment("m-1", "Moment One", "area-2", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 1,
        }),
        createMoment("m-2", "Moment Two", "area-3", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 2,
        }),
      ]);

      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);
      const payloadSize = new TextEncoder().encode(JSON.stringify(result)).length;

      expect(payloadSize).toBeLessThan(2048);
    });

    it("includes moment emoji when available, falls back to area emoji", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments = toRecord([
        createMoment("m-1", "Running", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
          emoji: "🏃",
        }),
        createMoment("m-2", "Stretching", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 1,
          emoji: null,
        }),
      ]);
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      // Moment with its own emoji → uses moment emoji
      expect(result.merge_variables.phase!.moments[0].emoji).toBe("🏃");
      // Moment without emoji → falls back to area emoji
      expect(result.merge_variables.phase!.moments[1].emoji).toBe("🟢");
    });

    it("includes phase emoji from config", () => {
      const areas: Record<string, Area> = {};
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.MORNING, { emoji: "☕" }),
      ]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      expect(result.merge_variables.phase!.emoji).toBe("☕");
    });

    it("includes updated_at timestamp", () => {
      const areas: Record<string, Area> = {};
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      expect(result.merge_variables.updated_at).toBeDefined();
      // Should be a valid ISO string
      expect(new Date(result.merge_variables.updated_at).toISOString()).toBe(
        result.merge_variables.updated_at
      );
    });

    it("ignores moments with day set but no phase", () => {
      const areas = toRecord([createArea("area-1", "Craft", "🔵")]);
      const moments = toRecord([
        createMoment("m-1", "Valid", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
        createMoment("m-2", "No Phase", "area-1", {
          day: TODAY,
          phase: null,
          order: 0,
        }),
      ]);
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      expect(result.merge_variables.phase!.moments).toHaveLength(1);
      expect(result.merge_variables.phase!.moments[0].name).toBe("Valid");
    });

    it("does not include moments from other days in current phase", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments = toRecord([
        createMoment("m-1", "Today", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
        createMoment("m-2", "Yesterday", "area-1", {
          day: "2026-02-21",
          phase: Phase.MORNING,
          order: 0,
        }),
      ]);
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY, 8);

      expect(result.merge_variables.phase!.moments).toHaveLength(1);
      expect(result.merge_variables.phase!.moments[0].name).toBe("Today");
    });
  });
});
