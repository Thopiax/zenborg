import { describe, expect, it } from "vitest";
import type { Area } from "@/domain/entities/Area";
import type { Cycle } from "@/domain/entities/Cycle";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";
import {
  deriveHarvestSeason,
  pickHarvestSeason,
  resolveHarvestCycle,
} from "../state/harvestViewModel";

const area = (id: string, name = `area-${id}`, order = 0): Area => ({
  id,
  name,
  attitude: null,
  tags: [],
  color: "#334155",
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
  extra: Partial<Cycle> = {},
): Cycle => ({
  id,
  name: `cycle-${id}`,
  startDate,
  endDate,
  intention: null,
  reflection: null,
  createdAt: "",
  updatedAt: "",
  ...extra,
});

const moment = (
  id: string,
  day: string | null,
  phase: Phase | null,
  areaId: string,
  extra: Partial<Moment> = {},
): Moment => ({
  id,
  name: `m-${id}`,
  areaId,
  habitId: null,
  cycleId: null,
  cyclePlanId: null,
  phase,
  day,
  order: 0,
  tags: [],
  emoji: null,
  createdAt: "",
  updatedAt: "",
  ...extra,
});

const person = (id: string, name: string): Habit => ({
  id,
  name,
  areaId: "friends",
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  kind: "person",
  createdAt: "",
  updatedAt: "",
});

const phaseConfig = (phase: Phase, order: number): PhaseConfig => ({
  id: `pc-${phase}`,
  phase,
  label: phase,
  emoji: "",
  startHour: order * 6,
  endHour: order * 6 + 6,
  isVisible: true,
  order,
  createdAt: "",
  updatedAt: "",
});

const PHASES: PhaseConfig[] = [
  phaseConfig(Phase.MORNING, 0),
  phaseConfig(Phase.AFTERNOON, 1),
  phaseConfig(Phase.EVENING, 2),
  phaseConfig(Phase.NIGHT, 3),
];

const derive = (
  c: Cycle,
  moments: Moment[],
  areas: Area[] = [area("a")],
  habits: Habit[] = [],
) =>
  deriveHarvestSeason({
    cycle: c,
    moments,
    areas,
    habits,
    phaseConfigs: PHASES,
  });

describe("deriveHarvestSeason — the season's window", () => {
  it("keeps the moments planted inside the window, both ends inclusive", () => {
    const season = derive(cycle("c", "2026-03-01", "2026-03-31"), [
      moment("in-first", "2026-03-01", Phase.MORNING, "a"),
      moment("in-last", "2026-03-31", Phase.MORNING, "a"),
      moment("before", "2026-02-28", Phase.MORNING, "a"),
      moment("after", "2026-04-01", Phase.MORNING, "a"),
    ]);

    expect(season.days.flatMap((d) => d.moments).map((m) => m.id)).toEqual([
      "in-first",
      "in-last",
    ]);
    expect(season.momentCount).toBe(2);
  });

  it("leaves unallocated moments out — nothing was planted on no day", () => {
    const season = derive(cycle("c", "2026-03-01", "2026-03-31"), [
      moment("drawing-board", null, Phase.MORNING, "a"),
    ]);

    expect(season.days).toEqual([]);
    expect(season.momentCount).toBe(0);
  });

  it("runs to the present for an ongoing season with no end date", () => {
    const season = derive(cycle("c", "2026-03-01", null), [
      moment("later", "2027-01-09", Phase.MORNING, "a"),
      moment("before", "2026-02-01", Phase.MORNING, "a"),
    ]);

    expect(season.days.flatMap((d) => d.moments).map((m) => m.id)).toEqual([
      "later",
    ]);
  });

  it("orders days oldest first, and within a day by phase then order", () => {
    const season = derive(cycle("c", "2026-03-01", "2026-03-31"), [
      moment("d2", "2026-03-02", Phase.MORNING, "a"),
      moment("evening", "2026-03-01", Phase.EVENING, "a"),
      moment("morning-second", "2026-03-01", Phase.MORNING, "a", { order: 1 }),
      moment("morning-first", "2026-03-01", Phase.MORNING, "a", { order: 0 }),
    ]);

    expect(season.days.map((d) => d.date)).toEqual([
      "2026-03-01",
      "2026-03-02",
    ]);
    expect(season.days[0].moments.map((m) => m.id)).toEqual([
      "morning-first",
      "morning-second",
      "evening",
    ]);
  });

  it("sorts a moment with no phase after the phased ones", () => {
    const season = derive(cycle("c", "2026-03-01", "2026-03-31"), [
      moment("phaseless", "2026-03-01", null, "a"),
      moment("night", "2026-03-01", Phase.NIGHT, "a"),
    ]);

    expect(season.days[0].moments.map((m) => m.id)).toEqual([
      "night",
      "phaseless",
    ]);
  });

  it("renders every moment in a phase past three — history is not a day view", () => {
    // DAY_VIEW_PHASE_CAPACITY is a display capacity, never a data invariant.
    // A historical phase can legitimately hold more; truncating drops real
    // history on the floor.
    const season = derive(
      cycle("c", "2026-03-01", "2026-03-31"),
      Array.from({ length: 5 }, (_, i) =>
        moment(`m${i}`, "2026-03-01", Phase.MORNING, "a", { order: i }),
      ),
    );

    expect(season.days[0].moments).toHaveLength(5);
  });
});

describe("deriveHarvestSeason — what a moment carries", () => {
  it("attributes each moment to its area — the one sanctioned colour channel", () => {
    const season = derive(
      cycle("c", "2026-03-01", "2026-03-31"),
      [moment("m", "2026-03-01", Phase.MORNING, "a")],
      [{ ...area("a", "Atlantis"), color: "#7c3aed", emoji: "🌊" }],
    );

    expect(season.days[0].moments[0]).toMatchObject({
      areaId: "a",
      areaName: "Atlantis",
      areaColor: "#7c3aed",
    });
  });

  it("still renders a moment whose area is gone — fail soft, never an error state", () => {
    const season = derive(
      cycle("c", "2026-03-01", "2026-03-31"),
      [moment("orphan", "2026-03-01", Phase.MORNING, "vanished")],
      [],
    );

    expect(season.days[0].moments[0]).toMatchObject({
      id: "orphan",
      areaName: null,
      areaColor: null,
    });
  });

  it("resolves the people present, dropping ids that no longer exist", () => {
    const season = derive(
      cycle("c", "2026-03-01", "2026-03-31"),
      [
        moment("dinner", "2026-03-01", Phase.EVENING, "a", {
          personIds: ["p1", "p2", "gone"],
        }),
      ],
      [area("a")],
      [person("p1", "Ada"), person("p2", "Bea")],
    );

    expect(season.days[0].moments[0].people).toEqual(["Ada", "Bea"]);
  });

  it("carries no people when the moment names none", () => {
    const season = derive(cycle("c", "2026-03-01", "2026-03-31"), [
      moment("solo", "2026-03-01", Phase.MORNING, "a"),
    ]);

    expect(season.days[0].moments[0].people).toEqual([]);
  });
});

describe("deriveHarvestSeason — what the season says", () => {
  it("carries the season's name, window and intention", () => {
    const season = derive(
      cycle("c", "2026-03-01", "2026-03-31", {
        name: "Avalon Spring",
        intention: "Read the tide.",
      }),
      [],
    );

    expect(season).toMatchObject({
      cycleId: "c",
      name: "Avalon Spring",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      intention: "Read the tide.",
    });
  });

  it("parses the reflection into its two rungs", () => {
    const season = derive(
      cycle("c", "2026-03-01", "2026-03-31", {
        reflection: "The season held Avalon.\n\nAnd the long walks.",
      }),
      [],
    );

    expect(season.reflection).toEqual({
      l0: "The season held Avalon.",
      l1: "And the long walks.",
    });
  });

  it("reads back a season with no reflection, no intention and no moments", () => {
    // Acceptance 1: harvest renders with no journals, no ollama, no photos.
    const season = derive(cycle("c", "2026-03-01", "2026-03-31"), []);

    expect(season.reflection).toBeNull();
    expect(season.intention).toBeNull();
    expect(season.days).toEqual([]);
    expect(season.momentCount).toBe(0);
  });
});

describe("pickHarvestSeason", () => {
  it("opens on the season most recently closed", () => {
    const picked = pickHarvestSeason(
      [
        cycle("old", "2026-01-01", "2026-01-31"),
        cycle("recent", "2026-02-01", "2026-02-28"),
        cycle("now", "2026-03-01", null),
      ],
      "2026-03-15",
    );

    expect(picked?.id).toBe("recent");
  });

  it("ignores a season whose end date has not arrived yet", () => {
    const picked = pickHarvestSeason(
      [
        cycle("closed", "2026-01-01", "2026-01-31"),
        cycle("running", "2026-03-01", "2026-12-31"),
      ],
      "2026-03-15",
    );

    expect(picked?.id).toBe("closed");
  });

  it("falls back to the season holding today when none has closed", () => {
    const picked = pickHarvestSeason(
      [cycle("now", "2026-03-01", null)],
      "2026-03-15",
    );

    expect(picked?.id).toBe("now");
  });

  it("falls back to the latest season started when none holds today", () => {
    const picked = pickHarvestSeason(
      [
        cycle("first", "2027-01-01", "2027-01-31"),
        cycle("second", "2027-02-01", "2027-02-28"),
      ],
      "2026-03-15",
    );

    expect(picked?.id).toBe("second");
  });

  it("returns null for an empty garden", () => {
    expect(pickHarvestSeason([], "2026-03-15")).toBeNull();
  });
});

describe("resolveHarvestCycle", () => {
  const seasons = [
    cycle("closed", "2026-01-01", "2026-01-31"),
    cycle("chosen", "2026-02-01", "2026-02-28"),
    cycle("now", "2026-03-01", null),
  ];

  it("shows the season you picked from the index", () => {
    expect(resolveHarvestCycle(seasons, "now", "2026-03-15")?.id).toBe("now");
  });

  it("opens on the default season when you have picked nothing", () => {
    expect(resolveHarvestCycle(seasons, null, "2026-03-15")?.id).toBe("chosen");
  });

  it("falls back to the default when the picked season is gone", () => {
    // Deleted from another pane while harvest held its id — fail soft.
    expect(resolveHarvestCycle(seasons, "deleted", "2026-03-15")?.id).toBe(
      "chosen",
    );
  });

  it("returns null for an empty garden", () => {
    expect(resolveHarvestCycle([], "anything", "2026-03-15")).toBeNull();
  });
});
