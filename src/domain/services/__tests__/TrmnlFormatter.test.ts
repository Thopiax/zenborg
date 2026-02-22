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
    it("formats a day with moments across multiple phases", () => {
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

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.date).toBe(TODAY);
      expect(result.merge_variables.phases).toHaveLength(3);

      // Morning phase
      const morning = result.merge_variables.phases[0];
      expect(morning.label).toBe("Morning");
      expect(morning.moments).toHaveLength(1);
      expect(morning.moments[0].name).toBe("Morning Run");
      expect(morning.moments[0].area_name).toBe("Wellness");

      // Afternoon phase
      const afternoon = result.merge_variables.phases[1];
      expect(afternoon.moments).toHaveLength(2);
      expect(afternoon.moments[0].name).toBe("Deep Work");
      expect(afternoon.moments[1].name).toBe("Team Sync");

      // Evening phase (empty)
      const evening = result.merge_variables.phases[2];
      expect(evening.moments).toHaveLength(0);
      expect(evening.moment_count).toBe(0);
    });

    it("returns empty moment arrays for a day with no allocated moments", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.MORNING),
        createPhaseConfig(Phase.AFTERNOON),
      ]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.total_allocated).toBe(0);
      for (const phase of result.merge_variables.phases) {
        expect(phase.moments).toHaveLength(0);
      }
    });

    it("falls back to 'Unknown' for missing area references", () => {
      const areas: Record<string, Area> = {}; // no areas
      const moments = toRecord([
        createMoment("m-1", "Orphaned", "deleted-area-id", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
      ]);
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      const morning = result.merge_variables.phases[0];
      expect(morning.moments[0].area_name).toBe("Unknown");
      expect(morning.moments[0].area_emoji).toBe("");
    });

    it("only includes visible phases", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.MORNING, { isVisible: true }),
        createPhaseConfig(Phase.AFTERNOON, { isVisible: false }),
        createPhaseConfig(Phase.EVENING, { isVisible: true }),
        createPhaseConfig(Phase.NIGHT, { isVisible: false }),
      ]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.phases).toHaveLength(2);
      expect(result.merge_variables.phases[0].label).toBe("Morning");
      expect(result.merge_variables.phases[1].label).toBe("Evening");
    });

    it("sorts moments within a phase by order", () => {
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

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      const names = result.merge_variables.phases[0].moments.map((m) => m.name);
      expect(names).toEqual(["First", "Middle", "Second"]);
    });

    it("sorts phases by order from phaseConfigs", () => {
      const areas = toRecord([createArea("area-1", "Craft", "🔵")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.EVENING, { order: 0 }),
        createPhaseConfig(Phase.MORNING, { order: 1 }),
        createPhaseConfig(Phase.AFTERNOON, { order: 2 }),
      ]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.phases[0].label).toBe("Evening");
      expect(result.merge_variables.phases[1].label).toBe("Morning");
      expect(result.merge_variables.phases[2].label).toBe("Afternoon");
    });

    it("correctly counts unallocated moments", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments = toRecord([
        createMoment("m-1", "Allocated", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
        createMoment("m-2", "Unallocated 1", "area-1"),
        createMoment("m-3", "Unallocated 2", "area-1"),
      ]);
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.total_allocated).toBe(1);
      expect(result.merge_variables.total_unallocated).toBe(2);
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

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, cycle, TODAY);

      expect(result.merge_variables.cycle_name).toBe("Barcelona Summer");
    });

    it("uses empty string for cycle name when no cycle is active", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.cycle_name).toBe("");
    });

    it("formats date_label as a human-readable string", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, "2026-02-22");

      // Sunday, Feb 22
      expect(result.merge_variables.date_label).toBe("Sunday, Feb 22");
    });

    it("only counts moments allocated to today, not other days", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments = toRecord([
        createMoment("m-1", "Today Moment", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
        createMoment("m-2", "Yesterday", "area-1", {
          day: "2026-02-21",
          phase: Phase.MORNING,
          order: 0,
        }),
        createMoment("m-3", "Tomorrow", "area-1", {
          day: "2026-02-23",
          phase: Phase.MORNING,
          order: 0,
        }),
      ]);
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.total_allocated).toBe(1);
      expect(result.merge_variables.phases[0].moments).toHaveLength(1);
      expect(result.merge_variables.phases[0].moments[0].name).toBe("Today Moment");
    });

    it("produces a payload under 2KB for maximum density", () => {
      const areas = toRecord([
        createArea("area-1", "Wellness", "🟢"),
        createArea("area-2", "Craft", "🔵"),
        createArea("area-3", "Social", "🟠"),
      ]);

      const moments: Record<string, Moment> = {};
      const phases = [Phase.MORNING, Phase.AFTERNOON, Phase.EVENING, Phase.NIGHT];

      // 4 phases x 3 moments = 12 moments (max density)
      let idx = 0;
      for (const phase of phases) {
        for (let order = 0; order < 3; order++) {
          const id = `m-${idx}`;
          moments[id] = createMoment(id, `Moment ${idx}`, `area-${(idx % 3) + 1}`, {
            day: TODAY,
            phase,
            order,
          });
          idx++;
        }
      }

      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.MORNING),
        createPhaseConfig(Phase.AFTERNOON),
        createPhaseConfig(Phase.EVENING),
        createPhaseConfig(Phase.NIGHT, { isVisible: true }),
      ]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);
      const payloadSize = new TextEncoder().encode(JSON.stringify(result)).length;

      expect(payloadSize).toBeLessThan(2048);
    });

    it("includes area emoji in moment data", () => {
      const areas = toRecord([createArea("area-1", "Wellness", "🟢")]);
      const moments = toRecord([
        createMoment("m-1", "Running", "area-1", {
          day: TODAY,
          phase: Phase.MORNING,
          order: 0,
        }),
      ]);
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.phases[0].moments[0].area_emoji).toBe("🟢");
    });

    it("includes phase emoji from config", () => {
      const areas: Record<string, Area> = {};
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([
        createPhaseConfig(Phase.MORNING, { emoji: "☕" }),
      ]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.phases[0].emoji).toBe("☕");
    });

    it("includes updated_at timestamp", () => {
      const areas: Record<string, Area> = {};
      const moments: Record<string, Moment> = {};
      const phaseConfigs = toRecord([createPhaseConfig(Phase.MORNING)]);

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

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

      const result = formatTodayForTrmnl(moments, areas, phaseConfigs, null, TODAY);

      expect(result.merge_variables.phases[0].moments).toHaveLength(1);
      expect(result.merge_variables.phases[0].moments[0].name).toBe("Valid");
      // The "No Phase" moment should count as unallocated
      expect(result.merge_variables.total_allocated).toBe(1);
    });
  });
});
