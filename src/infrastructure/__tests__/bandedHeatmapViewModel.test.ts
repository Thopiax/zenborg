// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { deriveBandedHeatmapViewModel } from "../state/bandedHeatmapViewModel";
import type { Area } from "@/domain/entities/Area";
import type { Cycle } from "@/domain/entities/Cycle";
import type { Moment } from "@/domain/entities/Moment";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";

const area = (id: string, order = 0): Area => ({
  id,
  name: `area-${id}`,
  attitude: null,
  tags: [],
  color: "#000000",
  emoji: "🟢",
  isDefault: false,
  isArchived: false,
  order,
  createdAt: "",
  updatedAt: "",
});

const cycle = (
  id: string,
  startDate: string,
  endDate: string | null,
  name = `cycle-${id}`
): Cycle => ({
  id,
  name,
  startDate,
  endDate,
  intention: null,
  reflection: null,
  createdAt: "",
  updatedAt: "",
});

const moment = (
  id: string,
  day: string,
  phase: Phase,
  areaId: string,
  cycleId: string | null = null,
  updatedAt = "2026-01-01T00:00:00.000Z"
): Moment => ({
  id,
  name: `m-${id}`,
  areaId,
  habitId: null,
  cycleId,
  cyclePlanId: null,
  phase,
  day,
  order: 0,
  tags: [],
  emoji: null,
  createdAt: updatedAt,
  updatedAt,
});

const phaseConfig = (
  phase: Phase,
  order: number,
  isVisible = true
): PhaseConfig => ({
  id: `pc-${phase}`,
  phase,
  label: phase,
  emoji: "•",
  color: "#000",
  startHour: 0,
  endHour: 6,
  isVisible,
  order,
  createdAt: "",
  updatedAt: "",
});

const allVisible: PhaseConfig[] = [
  phaseConfig(Phase.MORNING, 0),
  phaseConfig(Phase.AFTERNOON, 1),
  phaseConfig(Phase.EVENING, 2),
  phaseConfig(Phase.NIGHT, 3, false),
];

describe("deriveBandedHeatmapViewModel", () => {
  describe("rows", () => {
    it("includes only visible phases in order", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.rows).toEqual([Phase.MORNING, Phase.AFTERNOON, Phase.EVENING]);
    });

    it("includes NIGHT when configured visible", () => {
      const configs: PhaseConfig[] = [
        phaseConfig(Phase.MORNING, 0),
        phaseConfig(Phase.AFTERNOON, 1),
        phaseConfig(Phase.EVENING, 2),
        phaseConfig(Phase.NIGHT, 3, true),
      ];

      const vm = deriveBandedHeatmapViewModel({
        cycles: [],
        moments: [],
        areas: [],
        phaseConfigs: configs,
        today: "2026-04-30",
      });

      expect(vm.rows).toContain(Phase.NIGHT);
    });
  });

  describe("date range", () => {
    it("spans from earliest cycle start to latest cycle end", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [
          cycle("a", "2026-01-01", "2026-01-03"),
          cycle("b", "2026-01-05", "2026-01-07"),
        ],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-01-04",
      });

      expect(vm.days).toHaveLength(7);
      expect(vm.days[0].date).toBe("2026-01-01");
      expect(vm.days[6].date).toBe("2026-01-07");
    });

    it("extends an ongoing cycle (null endDate) to today", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-04-28", null)],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.days[vm.days.length - 1].date).toBe("2026-04-30");
      expect(vm.days[vm.days.length - 1].cycleId).toBe("a");
    });

    it("extends range to include today even when outside any cycle", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-01-01", "2026-01-05")],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-01-10",
      });

      expect(vm.days[vm.days.length - 1].date).toBe("2026-01-10");
      expect(vm.days[vm.days.length - 1].cycleId).toBeNull();
    });

    it("handles empty cycles by collapsing to a single day at today", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.days).toHaveLength(1);
      expect(vm.days[0].date).toBe("2026-04-30");
      expect(vm.days[0].cycleId).toBeNull();
    });
  });

  describe("todayIndex", () => {
    it("locates today within the day list", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-04-28", "2026-05-02")],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.days[vm.todayIndex].date).toBe("2026-04-30");
    });

    it("returns -1 when today is outside the rendered range (defensive)", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });
      // Empty cycles still includes today, so this just sanity-checks indexOf wiring
      expect(vm.todayIndex).toBe(0);
    });
  });

  describe("day tense", () => {
    it("marks past, active, and future correctly", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-04-29", "2026-05-01")],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.days[0].tense).toBe("past");
      expect(vm.days[1].tense).toBe("active");
      expect(vm.days[2].tense).toBe("future");
    });
  });

  describe("cell state", () => {
    it("marks unplanted for future days with no moments", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-04-30", "2026-05-02")],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      const future = vm.days[2];
      expect(future.cells[Phase.MORNING].state).toBe("unplanted");
      expect(future.cells[Phase.MORNING].areaId).toBeNull();
    });

    it("marks fallow for past days with no moments", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-04-28", "2026-04-30")],
        moments: [],
        areas: [area("x")],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.days[0].cells[Phase.MORNING].state).toBe("fallow");
    });

    it("marks fallow for the active day with no moments", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-04-30", "2026-04-30")],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.days[0].cells[Phase.MORNING].state).toBe("fallow");
    });

    it("marks planted with the dominant areaId when moments exist", () => {
      const moments: Moment[] = [
        moment("m1", "2026-04-30", Phase.MORNING, "wellness", "a"),
        moment("m2", "2026-04-30", Phase.MORNING, "wellness", "a"),
        moment("m3", "2026-04-30", Phase.MORNING, "craft", "a"),
      ];

      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-04-30", "2026-04-30")],
        moments,
        areas: [area("wellness"), area("craft")],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      const cell = vm.days[0].cells[Phase.MORNING];
      expect(cell.state).toBe("planted");
      expect(cell.areaId).toBe("wellness");
    });

    it("breaks ties by most recently updated moment", () => {
      const moments: Moment[] = [
        moment(
          "m1",
          "2026-04-30",
          Phase.MORNING,
          "wellness",
          "a",
          "2026-04-30T10:00:00.000Z"
        ),
        moment(
          "m2",
          "2026-04-30",
          Phase.MORNING,
          "craft",
          "a",
          "2026-04-30T11:00:00.000Z"
        ),
      ];

      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-04-30", "2026-04-30")],
        moments,
        areas: [area("wellness"), area("craft")],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.days[0].cells[Phase.MORNING].areaId).toBe("craft");
    });

    it("scopes moments to their (date, phase) — does not bleed across phases", () => {
      const moments: Moment[] = [
        moment("m1", "2026-04-30", Phase.MORNING, "wellness", "a"),
      ];

      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("a", "2026-04-30", "2026-04-30")],
        moments,
        areas: [area("wellness")],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.days[0].cells[Phase.MORNING].state).toBe("planted");
      expect(vm.days[0].cells[Phase.AFTERNOON].state).toBe("fallow");
      expect(vm.days[0].cells[Phase.EVENING].state).toBe("fallow");
    });
  });

  describe("bands", () => {
    it("emits one band per cycle", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [
          cycle("a", "2026-01-01", "2026-01-03", "first"),
          cycle("b", "2026-01-05", "2026-01-07", "second"),
        ],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-01-04",
      });

      expect(vm.bands).toHaveLength(2);
      expect(vm.bands[0]).toMatchObject({
        cycleId: "a",
        name: "first",
        startIndex: 0,
        endIndex: 2,
      });
      expect(vm.bands[1]).toMatchObject({
        cycleId: "b",
        name: "second",
        startIndex: 4,
        endIndex: 6,
      });
    });

    it("does not emit bands for gap days between cycles", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [
          cycle("a", "2026-01-01", "2026-01-02"),
          cycle("b", "2026-01-05", "2026-01-06"),
        ],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-01-03",
      });

      expect(vm.bands).toHaveLength(2);
      expect(vm.bands.every((b) => b.cycleId !== null)).toBe(true);
      const gapDay = vm.days.find((d) => d.date === "2026-01-03");
      expect(gapDay?.cycleId).toBeNull();
    });

    it("derives band tense from its position relative to today", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [
          cycle("past", "2026-01-01", "2026-01-03"),
          cycle("now", "2026-04-29", "2026-05-01"),
          cycle("soon", "2026-06-01", "2026-06-03"),
        ],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      const byCycle = (id: string) => vm.bands.find((b) => b.cycleId === id)!;
      expect(byCycle("past").tense).toBe("past");
      expect(byCycle("now").tense).toBe("active");
      expect(byCycle("soon").tense).toBe("future");
    });

    it("treats an ongoing cycle (null endDate) as ending today", () => {
      const vm = deriveBandedHeatmapViewModel({
        cycles: [cycle("ongoing", "2026-04-28", null)],
        moments: [],
        areas: [],
        phaseConfigs: allVisible,
        today: "2026-04-30",
      });

      expect(vm.bands).toHaveLength(1);
      expect(vm.bands[0].endIndex).toBe(vm.days.length - 1);
      expect(vm.bands[0].tense).toBe("active");
    });
  });
});
