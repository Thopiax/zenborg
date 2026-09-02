import { describe, expect, it, vi } from "vitest";
import type {
  ActivityLogPort,
  DiscrepancyRecord,
  DiscrepancyStorePort,
  GardenPort,
  Planting,
  ShadowDeps,
} from "@zenborg/core/application/ports";
import {
  deriveDiscrepancies,
  runShadowMode,
} from "@zenborg/core/application/use-cases/deriveDiscrepancies";
import type { ActivityEvent } from "@zenborg/core/domain/attention/ActivityEvent";
import type { AreaMap } from "@zenborg/core/domain/attention/AreaMap";
import type { Instant } from "@zenborg/core/domain/attention/ids";

const T = 1_700_000_000_000;
const MINUTE = 60_000;
const WINDOW = { from: T, to: T + 60 * MINUTE };

const areaMap: AreaMap = {
  paths: [
    { prefix: "/w/craft", areaId: "area-craft" },
    { prefix: "/w/themia", areaId: "area-themia" },
  ],
  hosts: [],
};

/** The payload shape keel actually writes: raw hook stdin, file path under tool_input. */
function ev(
  id: string,
  ts: number,
  path: string,
  kind = "prompt",
): ActivityEvent {
  return {
    id,
    surface: "agent",
    kind,
    ts,
    sessionId: "s1",
    payload: { tool_name: "Edit", tool_input: { file_path: path } },
  };
}

function deps(
  events: readonly ActivityEvent[],
  planting: Planting,
  store?: DiscrepancyStorePort,
  boundaries: readonly number[] = [],
): ShadowDeps {
  const log: ActivityLogPort = { read: vi.fn(async () => events) };
  const garden: GardenPort = {
    areaMap: vi.fn(async () => areaMap),
    plantingsAt: vi.fn(async (_: Instant) => planting),
    boundaries: vi.fn(async () => boundaries),
  };
  return {
    log,
    garden,
    store: store ?? { write: vi.fn(async () => {}) },
    clock: { now: () => T + 99 },
    span: { idleGapMs: 15 * MINUTE },
  };
}

const plantedCraft: Planting = {
  momentIds: ["m-1", "m-2"],
  areaIds: ["area-craft"],
};
const plantedNothing: Planting = { momentIds: [], areaIds: [] };

describe("deriveDiscrepancies", () => {
  it("reports nothing when the log is empty", async () => {
    const record = await deriveDiscrepancies(deps([], plantedCraft), WINDOW);
    expect(record.discrepancies).toEqual([]);
  });

  it("reports nothing when attention stayed inside a planted area", async () => {
    const record = await deriveDiscrepancies(
      deps([ev("a", T, "/w/craft/x.ts")], plantedCraft),
      WINDOW,
    );
    expect(record.discrepancies).toEqual([]);
  });

  it("reports drift when attention resolved to an area the cell never planted", async () => {
    const record = await deriveDiscrepancies(
      deps([ev("a", T, "/w/themia/x.ts")], plantedCraft),
      WINDOW,
    );
    expect(record.discrepancies).toHaveLength(1);
    expect(record.discrepancies[0]).toMatchObject({
      kind: "drift",
      observedAreaId: "area-themia",
      plantedMomentIds: ["m-1", "m-2"],
      since: T,
    });
  });

  it("reports absence for an unplanted cell, because working with no intention is its own discrepancy", async () => {
    const record = await deriveDiscrepancies(
      deps([ev("a", T, "/w/themia/x.ts")], plantedNothing),
      WINDOW,
    );
    expect(record.discrepancies).toHaveLength(1);
    expect(record.discrepancies[0]).toMatchObject({
      kind: "absence",
      observedAreaId: "area-themia",
      plantedMomentIds: [],
    });
  });

  it("reports drift rather than absence when the cell did plant something", async () => {
    const record = await deriveDiscrepancies(
      deps([ev("a", T, "/w/themia/x.ts")], plantedCraft),
      WINDOW,
    );
    expect(record.discrepancies.map((d) => d.kind)).toEqual(["drift"]);
  });

  it("reports nothing at all when there is no observed attention to judge", async () => {
    const record = await deriveDiscrepancies(deps([], plantedNothing), WINDOW);
    expect(record.discrepancies).toEqual([]);
  });

  it("reports one drift per drifting span", async () => {
    const record = await deriveDiscrepancies(
      deps(
        [
          ev("a", T, "/w/themia/x.ts"),
          ev("b", T + 30 * MINUTE, "/w/themia/y.ts"),
        ],
        plantedCraft,
      ),
      WINDOW,
    );
    expect(record.discrepancies).toHaveLength(2);
  });

  it("counts magnitude from human-actor events only", async () => {
    const record = await deriveDiscrepancies(
      deps(
        [
          ev("a", T, "/w/themia/x.ts", "prompt"),
          ev("b", T + 1000, "/w/themia/x.ts", "tool_dispatched"),
          ev("c", T + 2000, "/w/themia/x.ts", "tool_completed"),
        ],
        plantedCraft,
      ),
      WINDOW,
    );
    expect(record.discrepancies[0].magnitude).toBe(1);
  });

  it("asks the log only for the window it was given", async () => {
    const d = deps([], plantedCraft);
    await deriveDiscrepancies(d, WINDOW);
    expect(d.log.read).toHaveBeenCalledWith(WINDOW.from, WINDOW.to);
  });

  it("asks the garden what was planted at the span's own start", async () => {
    const d = deps([ev("a", T + 5 * MINUTE, "/w/themia/x.ts")], plantedCraft);
    await deriveDiscrepancies(d, WINDOW);
    expect(d.garden.plantingsAt).toHaveBeenCalledWith(T + 5 * MINUTE);
  });

  it("stamps the record from the clock and marks it shadow", async () => {
    const record = await deriveDiscrepancies(deps([], plantedCraft), WINDOW);
    expect(record.generatedAt).toBe(T + 99);
    expect(record.shadow).toBe(true);
    expect(record.window).toEqual(WINDOW);
  });

  it("writes nothing on its own", async () => {
    const d = deps([ev("a", T, "/w/themia/x.ts")], plantedCraft);
    await deriveDiscrepancies(d, WINDOW);
    expect(d.store.write).not.toHaveBeenCalled();
  });
});

describe("runShadowMode", () => {
  it("writes the record exactly once and returns it", async () => {
    const write = vi.fn(async (_: DiscrepancyRecord) => {});
    const d = deps([ev("a", T, "/w/themia/x.ts")], plantedCraft, { write });
    const record = await runShadowMode(d, WINDOW);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(record);
  });

  it("changes nothing else: the garden is only ever read", async () => {
    const d = deps([ev("a", T, "/w/themia/x.ts")], plantedCraft);
    await runShadowMode(d, WINDOW);
    expect(Object.keys(d.garden)).toEqual([
      "areaMap",
      "plantingsAt",
      "boundaries",
    ]);
  });
});

describe("deriveDiscrepancies across plan boundaries", () => {
  it("asks the garden for the window's boundaries", async () => {
    const d = deps([], plantedCraft);
    await deriveDiscrepancies(d, WINDOW);
    expect(d.garden.boundaries).toHaveBeenCalledWith(WINDOW.from, WINDOW.to);
  });

  it("splits one stretch of work into two when the plan says a moment ended it", async () => {
    const d = deps(
      [ev("a", T, "/w/themia/x.ts"), ev("b", T + 2 * MINUTE, "/w/themia/y.ts")],
      plantedCraft,
      undefined,
      [T + MINUTE],
    );
    const record = await deriveDiscrepancies(d, WINDOW);
    expect(record.discrepancies).toHaveLength(2);
  });

  it("judges each piece against the cell it actually fell in", async () => {
    const d = deps(
      [ev("a", T, "/w/themia/x.ts"), ev("b", T + 2 * MINUTE, "/w/themia/y.ts")],
      plantedCraft,
      undefined,
      [T + MINUTE],
    );
    await deriveDiscrepancies(d, WINDOW);
    expect(d.garden.plantingsAt).toHaveBeenCalledWith(T);
    expect(d.garden.plantingsAt).toHaveBeenCalledWith(T + 2 * MINUTE);
  });
});
