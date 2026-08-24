import { describe, expect, it } from "vitest";
import {
  createMoment,
  isMomentError,
  type Moment,
} from "@/domain/entities/Moment";
import { getDefaultPhaseConfigs, Phase } from "@/domain/value-objects/Phase";
import { deriveWeekGridViewModel } from "./weekGridViewModel.ts";

function moment(overrides: Partial<Moment>): Moment {
  const created = createMoment({ name: "standup", areaId: "area-1" });
  if (isMomentError(created)) throw new Error(created.error);
  return { ...created, ...overrides };
}

const configs = getDefaultPhaseConfigs();

describe("deriveWeekGridViewModel", () => {
  const base = {
    phaseConfigs: configs,
    weekStart: "2026-08-24",
    today: "2026-08-26",
  };

  it("produces seven days, Monday first, with today flagged", () => {
    const vm = deriveWeekGridViewModel({ ...base, moments: [] });
    expect(vm.days.map((d) => d.date)).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ]);
    expect(vm.days[2].isToday).toBe(true);
  });

  it("bounds the grid by visible phase configs: 6 to 22 by default", () => {
    const vm = deriveWeekGridViewModel({ ...base, moments: [] });
    expect(vm.startHour).toBe(6);
    expect(vm.endHour).toBe(22);
  });

  it("a hidden NIGHT phase does not extend the grid", () => {
    const vm = deriveWeekGridViewModel({ ...base, moments: [] });
    expect(vm.hours).not.toContain(23);
  });

  it("a visible wrapping phase extends the grid to midnight", () => {
    const withNight = configs.map((c) =>
      c.phase === Phase.NIGHT ? { ...c, isVisible: true } : c,
    );
    const vm = deriveWeekGridViewModel({
      ...base,
      phaseConfigs: withNight,
      moments: [],
    });
    expect(vm.endHour).toBe(24);
  });

  it("positions a timed moment by start and duration", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [
        moment({
          day: "2026-08-24",
          phase: Phase.MORNING,
          startTime: "08:00",
          durationMin: 60,
        }),
      ],
    });
    const block = vm.days[0].blocks[0];
    expect(vm.rowsPerHour).toBe(4);
    expect(vm.totalRows).toBe(64);
    // 08:00 is 2 hours after startHour 6, so 8 quarter-hours = row offset 8
    // gridRowStart = offset + 1 (ambient lane) + 1 (1-indexed) = 10
    expect(block.gridRowStart).toBe(10);
    expect(block.gridRowSpan).toBe(4);
  });

  it("a block can never span past the last row", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [
        moment({
          day: "2026-08-24",
          phase: Phase.EVENING,
          startTime: "21:30",
          durationMin: 180,
        }),
      ],
    });
    const block = vm.days[0].blocks[0];
    expect(block.gridRowStart + block.gridRowSpan).toBeLessThanOrEqual(
      vm.totalRows + 2,
    );
  });

  it("routes an ambient allocated moment to the ambient lane, not the hour rows", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [moment({ day: "2026-08-24", phase: Phase.MORNING })],
    });
    expect(vm.days[0].blocks).toHaveLength(0);
    expect(vm.days[0].ambient).toHaveLength(1);
  });

  it("flags tentative blocks", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [
        moment({
          day: "2026-08-24",
          status: "tentative",
          startTime: "10:00",
          durationMin: 30,
          phase: Phase.MORNING,
        }),
      ],
    });
    expect(vm.days[0].blocks[0].tentative).toBe(true);
  });

  it("has no per-phase cap: five afternoon blocks all render", () => {
    const five = ["12:00", "13:00", "14:00", "15:00", "16:00"].map((t) =>
      moment({
        day: "2026-08-24",
        phase: Phase.AFTERNOON,
        startTime: t,
        durationMin: 45,
      }),
    );
    const vm = deriveWeekGridViewModel({ ...base, moments: five });
    expect(vm.days[0].blocks).toHaveLength(5);
  });

  it("ignores unallocated moments and other weeks", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [
        moment({ startTime: "10:00", durationMin: 30 }),
        moment({
          day: "2026-09-07",
          startTime: "10:00",
          durationMin: 30,
          phase: Phase.MORNING,
        }),
      ],
    });
    expect(
      vm.days.every((d) => d.blocks.length === 0 && d.ambient.length === 0),
    ).toBe(true);
  });
});
