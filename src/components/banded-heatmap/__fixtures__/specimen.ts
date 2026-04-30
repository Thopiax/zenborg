import type { Area } from "@/domain/entities/Area";
import type { Cycle } from "@/domain/entities/Cycle";
import type { Moment } from "@/domain/entities/Moment";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";

const TODAY = "2026-04-30";

function shiftDays(date: string, delta: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + delta * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

const ts = "2026-04-30T12:00:00.000Z";

export const specimenToday = TODAY;

export const specimenAreas: Area[] = [
  {
    id: "body",
    name: "body",
    attitude: null,
    tags: [],
    color: "oklch(0.72 0.16 150)",
    emoji: "🌿",
    isDefault: false,
    isArchived: false,
    order: 0,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "mind",
    name: "mind",
    attitude: null,
    tags: [],
    color: "oklch(0.68 0.18 255)",
    emoji: "🧠",
    isDefault: false,
    isArchived: false,
    order: 1,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "hearth",
    name: "hearth",
    attitude: null,
    tags: [],
    color: "oklch(0.72 0.18 15)",
    emoji: "🏠",
    isDefault: false,
    isArchived: false,
    order: 2,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "craft",
    name: "craft",
    attitude: null,
    tags: [],
    color: "oklch(0.78 0.14 75)",
    emoji: "🛠️",
    isDefault: false,
    isArchived: false,
    order: 3,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "spirit",
    name: "spirit",
    attitude: null,
    tags: [],
    color: "oklch(0.70 0.14 295)",
    emoji: "✨",
    isDefault: false,
    isArchived: false,
    order: 4,
    createdAt: ts,
    updatedAt: ts,
  },
];

export const specimenCycles: Cycle[] = [
  {
    id: "barcelona",
    name: "barcelona — winter",
    startDate: shiftDays(TODAY, -55),
    endDate: shiftDays(TODAY, -36),
    intention: null,
    reflection: null,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "rest",
    name: "rest week",
    startDate: shiftDays(TODAY, -32),
    endDate: shiftDays(TODAY, -26),
    intention: null,
    reflection: null,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "paris",
    name: "paris — bday",
    startDate: shiftDays(TODAY, -3),
    endDate: shiftDays(TODAY, 5),
    intention: null,
    reflection: null,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "may-block",
    name: "may writing block",
    startDate: shiftDays(TODAY, 10),
    endDate: shiftDays(TODAY, 24),
    intention: null,
    reflection: null,
    createdAt: ts,
    updatedAt: ts,
  },
];

const phases = [Phase.MORNING, Phase.AFTERNOON, Phase.EVENING];
const areaIds = ["body", "mind", "hearth", "craft", "spirit"];

function makeMoments(): Moment[] {
  const out: Moment[] = [];
  let id = 0;

  const seedFor = (date: string): number => {
    let h = 0;
    for (let i = 0; i < date.length; i++) {
      h = (h * 31 + date.charCodeAt(i)) >>> 0;
    }
    return h;
  };

  const cycles = specimenCycles;
  for (const cycle of cycles) {
    const start = Date.parse(`${cycle.startDate}T00:00:00Z`);
    const end = Date.parse(`${cycle.endDate}T00:00:00Z`);
    for (let ms = start; ms <= end; ms += 86_400_000) {
      const date = new Date(ms).toISOString().slice(0, 10);
      const seed = seedFor(date);
      for (let p = 0; p < phases.length; p++) {
        if (((seed >> (p * 3)) & 7) < 2) continue; // ~25% fallow
        const areaId = areaIds[(seed >> (p * 5 + 1)) % areaIds.length];
        out.push({
          id: `m-${id++}`,
          name: `m${id}`,
          areaId,
          habitId: null,
          cycleId: cycle.id,
          cyclePlanId: null,
          phase: phases[p],
          day: date,
          order: 0,
          tags: [],
          emoji: null,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }
  }
  return out;
}

export const specimenMoments: Moment[] = makeMoments();

export const specimenPhaseConfigs: PhaseConfig[] = [
  {
    id: "pc-am",
    phase: Phase.MORNING,
    label: "morning",
    emoji: "☕",
    color: "#f59e0b",
    startHour: 6,
    endHour: 12,
    isVisible: true,
    order: 0,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "pc-pm",
    phase: Phase.AFTERNOON,
    label: "afternoon",
    emoji: "☀️",
    color: "#eab308",
    startHour: 12,
    endHour: 18,
    isVisible: true,
    order: 1,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "pc-eve",
    phase: Phase.EVENING,
    label: "evening",
    emoji: "🌙",
    color: "#8b5cf6",
    startHour: 18,
    endHour: 22,
    isVisible: true,
    order: 2,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: "pc-night",
    phase: Phase.NIGHT,
    label: "night",
    emoji: "✨",
    color: "#1e293b",
    startHour: 22,
    endHour: 6,
    isVisible: false,
    order: 3,
    createdAt: ts,
    updatedAt: ts,
  },
];
