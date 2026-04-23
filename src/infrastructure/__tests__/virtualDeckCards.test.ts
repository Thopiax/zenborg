// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { computeVirtualDeckCards } from "../state/virtualDeckCards";
import type { Habit } from "@/domain/entities/Habit";
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Moment } from "@/domain/entities/Moment";
import { Phase } from "@/domain/value-objects/Phase";
import type { Area } from "@/domain/entities/Area";

const area = (id: string, order: number): Area => ({
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

const habit = (id: string, areaId: string, order = 0): Habit => ({
  id,
  name: `habit-${id}`,
  areaId,
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order,
  createdAt: "",
  updatedAt: "",
});

const plan = (
  id: string,
  habitId: string,
  cycleId: string,
  budgetedCount: number,
): CyclePlan => ({
  id,
  cycleId,
  habitId,
  budgetedCount,
  createdAt: "",
  updatedAt: "",
});

const allocatedMoment = (
  id: string,
  planId: string,
  day: string,
): Moment => ({
  id,
  name: "x",
  areaId: "a",
  habitId: "h",
  cycleId: "c",
  cyclePlanId: planId,
  day,
  phase: Phase.MORNING,
  order: 0,
  tags: [],
  emoji: null,
  createdAt: "",
  updatedAt: "",
});

describe("computeVirtualDeckCards", () => {
  it("returns full ghost count when nothing allocated", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 4)],
      habits: [habit("h-1", "a-1")],
      areas: [area("a-1", 0)],
      moments: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].ghosts).toBe(4);
  });

  it("subtracts allocated moments from ghost count", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 4)],
      habits: [habit("h-1", "a-1")],
      areas: [area("a-1", 0)],
      moments: [allocatedMoment("m-1", "p-1", "2026-04-24")],
    });
    expect(result[0].ghosts).toBe(3);
  });

  it("clamps ghosts to 0 when allocated exceeds budget", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 1)],
      habits: [habit("h-1", "a-1")],
      areas: [area("a-1", 0)],
      moments: [
        allocatedMoment("m-1", "p-1", "2026-04-24"),
        allocatedMoment("m-2", "p-1", "2026-04-25"),
      ],
    });
    expect(result[0].ghosts).toBe(0);
  });

  it("orders by area.order then habit.order", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [
        plan("p-B", "h-B", "c-1", 1),
        plan("p-A2", "h-A2", "c-1", 1),
        plan("p-A1", "h-A1", "c-1", 1),
      ],
      habits: [
        habit("h-A1", "a-1", 0),
        habit("h-A2", "a-1", 1),
        habit("h-B", "a-2", 0),
      ],
      areas: [area("a-1", 0), area("a-2", 1)],
      moments: [],
    });
    expect(result.map((c) => c.habit.id)).toEqual(["h-A1", "h-A2", "h-B"]);
  });

  it("filters plans by cycleId", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 2), plan("p-2", "h-2", "c-2", 2)],
      habits: [habit("h-1", "a-1"), habit("h-2", "a-1")],
      areas: [area("a-1", 0)],
      moments: [],
    });
    expect(result.map((c) => c.plan.id)).toEqual(["p-1"]);
  });

  it("omits plans whose habit is archived", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 2)],
      habits: [{ ...habit("h-1", "a-1"), isArchived: true }],
      areas: [area("a-1", 0)],
      moments: [],
    });
    expect(result).toHaveLength(0);
  });
});
