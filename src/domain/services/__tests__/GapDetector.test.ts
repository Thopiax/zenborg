import { describe, expect, it } from "vitest";
import type { Moment } from "@/domain/entities/Moment";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";
import {
  canPropose,
  detectTransitionGap,
  freshState,
  recordProposal,
} from "../GapDetector";

const ISO = (d: Date) => d.toISOString();

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
    const now = new Date("2026-09-08T11:30:00"); // late morning
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
    const now = new Date("2026-09-08T20:00:00"); // evening, last visible
    expect(detectTransitionGap([], configs, "regular", now)).toBeNull();
  });

  it("returns null when in a hidden phase", () => {
    const now = new Date("2026-09-08T23:00:00"); // night, hidden
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
    const soon = new Date(now.getTime() + 10 * 60 * 1000); // 10 min later
    expect(canPropose(state, "regular", soon)).toBe(false);
  });

  it("allows after cooldown", () => {
    const state = recordProposal(freshState(), now);
    const later = new Date(now.getTime() + 31 * 60 * 1000); // 31 min later
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
