import { describe, expect, it } from "vitest";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";
import {
  canPropose,
  detectMicroGap,
  detectPeriodicGaps,
  detectTransitionGap,
  freshState,
  recordProposal,
  suggestMomentFromContext,
} from "../GapDetector";

const ISO = (d: Date) => d.toISOString();

// ── Transition (#3+#4) ────────────────────────────────────────────

const configs: PhaseConfig[] = [
  { id: "1", phase: Phase.MORNING, label: "Morning", emoji: "☕", startHour: 6, endHour: 12, isVisible: true, order: 0, createdAt: "", updatedAt: "" },
  { id: "2", phase: Phase.AFTERNOON, label: "Afternoon", emoji: "☀️", startHour: 12, endHour: 18, isVisible: true, order: 1, createdAt: "", updatedAt: "" },
  { id: "3", phase: Phase.EVENING, label: "Evening", emoji: "🌙", startHour: 18, endHour: 22, isVisible: true, order: 2, createdAt: "", updatedAt: "" },
  { id: "4", phase: Phase.NIGHT, label: "Night", emoji: "✨", startHour: 22, endHour: 6, isVisible: false, order: 3, createdAt: "", updatedAt: "" },
];

const moment = (phase: Phase, day: string): Moment => ({
  id: "m-1", name: "test", areaId: "a", habitId: null,
  cycleId: null, cyclePlanId: null, phase, day,
  order: 0, tags: null, createdAt: ISO(new Date()), updatedAt: ISO(new Date()),
});

describe("detectTransitionGap", () => {
  it("detects gap when next phase is empty", () => {
    const now = new Date("2026-09-08T11:30:00");
    const moments = [moment(Phase.MORNING, "2026-09-08")];
    const gap = detectTransitionGap(moments, configs, "regular", now);

    expect(gap).not.toBeNull();
    expect(gap!.gapType).toBe("transition");
    expect(gap!.fromPhase).toBe(Phase.MORNING);
    expect(gap!.toPhase).toBe(Phase.AFTERNOON);
  });

  it("returns null when next phase has moments", () => {
    const now = new Date("2026-09-08T11:30:00");
    const moments = [
      moment(Phase.MORNING, "2026-09-08"),
      moment(Phase.AFTERNOON, "2026-09-08"),
    ];
    expect(detectTransitionGap(moments, configs, "regular", now)).toBeNull();
  });

  it("returns null in dry mode", () => {
    const now = new Date("2026-09-08T11:30:00");
    expect(detectTransitionGap([], configs, "dry", now)).toBeNull();
  });

  it("returns null in by_hand mode", () => {
    const now = new Date("2026-09-08T11:30:00");
    expect(detectTransitionGap([], configs, "by_hand", now)).toBeNull();
  });

  it("returns null for the last visible phase (no next phase)", () => {
    const now = new Date("2026-09-08T20:00:00");
    expect(detectTransitionGap([], configs, "regular", now)).toBeNull();
  });

  it("returns null when in a hidden phase", () => {
    const now = new Date("2026-09-08T23:00:00");
    expect(detectTransitionGap([], configs, "regular", now)).toBeNull();
  });
});

describe("canPropose", () => {
  const now = new Date("2026-09-08T14:00:00");

  it("allows proposal on fresh state", () => {
    expect(canPropose(freshState(), "regular", now)).toBe(true);
  });

  it("blocks during cooldown", () => {
    const state = recordProposal(freshState(), now);
    const soon = new Date(now.getTime() + 10 * 60 * 1000);
    expect(canPropose(state, "regular", soon)).toBe(false);
  });

  it("allows after cooldown", () => {
    const state = recordProposal(freshState(), now);
    const later = new Date(now.getTime() + 31 * 60 * 1000);
    expect(canPropose(state, "regular", later)).toBe(true);
  });

  it("blocks after 3 proposals in a day", () => {
    let state = freshState();
    for (let i = 0; i < 3; i++) {
      state = recordProposal(state, new Date(now.getTime() + i * 31 * 60 * 1000));
    }
    const later = new Date(now.getTime() + 4 * 31 * 60 * 1000);
    expect(canPropose(state, "regular", later)).toBe(false);
  });

  it("resets count on a new day", () => {
    let state = freshState();
    for (let i = 0; i < 3; i++) {
      state = recordProposal(state, new Date(now.getTime() + i * 31 * 60 * 1000));
    }
    const tomorrow = new Date("2026-09-09T14:00:00");
    expect(canPropose(state, "regular", tomorrow)).toBe(true);
  });

  it("blocks in dry mode regardless", () => {
    expect(canPropose(freshState(), "dry", now)).toBe(false);
  });
});

// ── Periodic (#12) ─────────────────────────────────────────────────

const stubHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: "h-1",
  name: "test",
  areaId: "a-1",
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  createdAt: ISO(new Date("2026-01-01")),
  updatedAt: ISO(new Date("2026-01-01")),
  ...overrides,
});

const stubArea = (overrides: Partial<Area> = {}): Area => ({
  id: "a-1",
  name: "admin",
  attitude: null,
  tags: [],
  color: "#888",
  emoji: "📬",
  isDefault: false,
  order: 0,
  createdAt: ISO(new Date("2026-01-01")),
  updatedAt: ISO(new Date("2026-01-01")),
  ...overrides,
});

describe("detectPeriodicGaps", () => {
  const now = new Date("2026-09-08T12:00:00Z");

  it("fires when interval has elapsed since last break", () => {
    const habit = stubHabit({
      tags: ["gap", "gap-periodic-20m", "gap-30s"],
      durationMin: 1,
    });
    const lastBreak = new Date("2026-09-08T11:30:00Z"); // 30 min ago > 20m
    const result = detectPeriodicGaps([habit], lastBreak, now);
    expect(result).not.toBeNull();
    expect(result!.gapType).toBe("periodic");
    expect(result!.habit.id).toBe("h-1");
    expect(result!.intervalMs).toBe(20 * 60_000);
  });

  it("returns null when interval has not elapsed", () => {
    const habit = stubHabit({
      tags: ["gap", "gap-periodic-20m"],
    });
    const lastBreak = new Date("2026-09-08T11:55:00Z"); // 5 min ago < 20m
    expect(detectPeriodicGaps([habit], lastBreak, now)).toBeNull();
  });

  it("skips archived habits", () => {
    const habit = stubHabit({
      tags: ["gap", "gap-periodic-20m"],
      isArchived: true,
    });
    expect(detectPeriodicGaps([habit], null, now)).toBeNull();
  });

  it("skips habits without gap-periodic tag", () => {
    const habit = stubHabit({
      tags: ["gap", "gap-2m"],
    });
    expect(detectPeriodicGaps([habit], null, now)).toBeNull();
  });

  it("fires when lastBreakAt is null (never had a break)", () => {
    const habit = stubHabit({
      tags: ["gap", "gap-periodic-20m"],
    });
    const result = detectPeriodicGaps([habit], null, now);
    expect(result).not.toBeNull();
  });

  it("parses seconds interval too", () => {
    const habit = stubHabit({
      tags: ["gap", "gap-periodic-30s"],
    });
    const lastBreak = new Date("2026-09-08T11:59:00Z"); // 60s ago > 30s
    const result = detectPeriodicGaps([habit], lastBreak, now);
    expect(result).not.toBeNull();
    expect(result!.intervalMs).toBe(30_000);
  });
});

// ── Micro (#14) ────────────────────────────────────────────────────

describe("detectMicroGap", () => {
  const now = new Date("2026-09-08T12:01:00Z");

  it("detects idle gap after moment ended", () => {
    const ended = new Date("2026-09-08T12:00:00Z");
    const result = detectMicroGap({ endedAt: ended }, null, now, 30_000);
    expect(result).not.toBeNull();
    expect(result!.gapType).toBe("micro");
    expect(result!.durationMs).toBe(60_000);
  });

  it("returns null when idle below threshold", () => {
    const ended = new Date("2026-09-08T12:00:50Z");
    expect(detectMicroGap({ endedAt: ended }, null, now, 30_000)).toBeNull();
  });

  it("returns null when no moment has ended", () => {
    expect(detectMicroGap(null, null, now, 30_000)).toBeNull();
  });

  it("auto-dismisses after 2 minutes", () => {
    const ended = new Date("2026-09-08T11:58:00Z");
    expect(detectMicroGap({ endedAt: ended }, null, now, 30_000)).toBeNull();
  });

  it("returns null when next moment has already started", () => {
    const ended = new Date("2026-09-08T12:00:00Z");
    const next = { startsAt: new Date("2026-09-08T12:00:30Z") };
    expect(detectMicroGap({ endedAt: ended }, next, now, 30_000)).toBeNull();
  });
});

// ── Context-aware (#11) ────────────────────────────────────────────

describe("suggestMomentFromContext", () => {
  const areas = [
    stubArea({ id: "a-admin", name: "admin" }),
    stubArea({ id: "a-work", name: "work" }),
    stubArea({ id: "a-well", name: "wellness" }),
  ];

  it("suggests area when app matches and threshold exceeded", () => {
    const result = suggestMomentFromContext(
      { frontmostApp: "Mail", activeMoment: null, durationInContextMs: 15 * 60_000 },
      areas,
    );
    expect(result).not.toBeNull();
    expect(result!.areaId).toBe("a-admin");
    expect(result!.suggestedName).toBe("admin");
  });

  it("returns null when a moment is active", () => {
    const result = suggestMomentFromContext(
      { frontmostApp: "Mail", activeMoment: "moment-1", durationInContextMs: 15 * 60_000 },
      areas,
    );
    expect(result).toBeNull();
  });

  it("returns null below threshold", () => {
    const result = suggestMomentFromContext(
      { frontmostApp: "Mail", activeMoment: null, durationInContextMs: 5 * 60_000 },
      areas,
    );
    expect(result).toBeNull();
  });

  it("returns null for unknown apps", () => {
    const result = suggestMomentFromContext(
      { frontmostApp: "Minecraft", activeMoment: null, durationInContextMs: 30 * 60_000 },
      areas,
    );
    expect(result).toBeNull();
  });

  it("returns null when area not in registry", () => {
    const result = suggestMomentFromContext(
      { frontmostApp: "Garmin Connect", activeMoment: null, durationInContextMs: 15 * 60_000 },
      [stubArea({ id: "a-other", name: "other" })],
    );
    expect(result).toBeNull();
  });

  it("confidence scales with duration, caps at 1.0", () => {
    const r10 = suggestMomentFromContext(
      { frontmostApp: "Mail", activeMoment: null, durationInContextMs: 10 * 60_000 },
      areas,
    );
    const r30 = suggestMomentFromContext(
      { frontmostApp: "Mail", activeMoment: null, durationInContextMs: 30 * 60_000 },
      areas,
    );
    const r60 = suggestMomentFromContext(
      { frontmostApp: "Mail", activeMoment: null, durationInContextMs: 60 * 60_000 },
      areas,
    );
    expect(r10!.confidence).toBeLessThan(r30!.confidence);
    expect(r30!.confidence).toBe(1.0);
    expect(r60!.confidence).toBe(1.0);
  });

  it("accepts custom app-area map", () => {
    const custom = { Figma: "design" };
    const areasWithDesign = [...areas, stubArea({ id: "a-d", name: "design" })];
    const result = suggestMomentFromContext(
      { frontmostApp: "Figma", activeMoment: null, durationInContextMs: 15 * 60_000 },
      areasWithDesign,
      custom,
    );
    expect(result).not.toBeNull();
    expect(result!.suggestedName).toBe("design");
  });
});
