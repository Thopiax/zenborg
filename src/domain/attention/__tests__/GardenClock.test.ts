import { describe, expect, it } from "vitest";
import {
  boundariesIn,
  cellWindow,
  phaseAt,
  plantingsAt,
} from "../GardenClock";

const phaseConfigs = [
  { phase: "MORNING", startHour: 6, endHour: 12 },
  { phase: "AFTERNOON", startHour: 12, endHour: 18 },
  { phase: "EVENING", startHour: 18, endHour: 22 },
  { phase: "NIGHT", startHour: 22, endHour: 6 },
];

describe("phaseAt", () => {
  it("resolves morning", () => {
    const ts = new Date(2026, 8, 1, 9, 0).getTime();
    expect(phaseAt(ts, phaseConfigs)).toBe("MORNING");
  });

  it("resolves night (wrapping)", () => {
    const ts = new Date(2026, 8, 1, 23, 0).getTime();
    expect(phaseAt(ts, phaseConfigs)).toBe("NIGHT");
  });

  it("resolves night before dawn (wrapping)", () => {
    const ts = new Date(2026, 8, 1, 3, 0).getTime();
    expect(phaseAt(ts, phaseConfigs)).toBe("NIGHT");
  });
});

describe("plantingsAt", () => {
  const moments = [
    { id: "m1", areaId: "a1", day: "2026-09-01", phase: "MORNING" },
    { id: "m2", areaId: "a2", day: "2026-09-01", phase: "MORNING" },
    { id: "m3", areaId: "a1", day: "2026-09-01", phase: "AFTERNOON" },
  ];

  it("returns moments in the matching cell", () => {
    const ts = new Date(2026, 8, 1, 9, 0).getTime();
    const p = plantingsAt(ts, moments, phaseConfigs);
    expect(p.momentIds).toEqual(["m1", "m2"]);
    expect(p.areaIds).toContain("a1");
    expect(p.areaIds).toContain("a2");
  });

  it("returns empty for a cell with nothing planted", () => {
    const ts = new Date(2026, 8, 1, 20, 0).getTime();
    const p = plantingsAt(ts, moments, phaseConfigs);
    expect(p.momentIds).toHaveLength(0);
  });
});

describe("boundariesIn", () => {
  it("includes phase band edges and clock-timed moments", () => {
    const moments = [
      { id: "m1", areaId: "a1", day: "2026-09-01", phase: "MORNING", startTime: "10:00", durationMin: 60 },
    ];
    const from = new Date(2026, 8, 1, 0, 0).getTime();
    const to = new Date(2026, 8, 2, 0, 0).getTime();
    const bs = boundariesIn(from, to, moments, phaseConfigs);
    const hours = bs.map((b) => new Date(b).getHours());
    expect(hours).toContain(6);
    expect(hours).toContain(12);
    expect(hours).toContain(10);
    expect(hours).toContain(11);
  });
});

describe("cellWindow", () => {
  it("returns correct window for a phase", () => {
    const w = cellWindow("2026-09-01", "MORNING", phaseConfigs);
    expect(w).not.toBeNull();
    const from = new Date(w!.from);
    const to = new Date(w!.to);
    expect(from.getHours()).toBe(6);
    expect(to.getHours()).toBe(12);
  });

  it("handles wrapping phases", () => {
    const w = cellWindow("2026-09-01", "NIGHT", phaseConfigs);
    expect(w).not.toBeNull();
    expect(w!.to - w!.from).toBe(8 * 60 * 60_000);
  });

  it("returns null for unknown phase", () => {
    expect(cellWindow("2026-09-01", "DAWN", phaseConfigs)).toBeNull();
  });
});
