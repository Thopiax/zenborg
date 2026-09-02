// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";

globalThis.React = React;

// ---------- Test fixtures ----------
const testArea: Area = {
  id: "area-1",
  name: "Wellness",
  color: "#10b981",
  emoji: "🟢",
  isDefault: true,
  attitude: null,
  tags: [],
  order: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const testArea2: Area = {
  ...testArea,
  id: "area-2",
  name: "Craft",
  emoji: "🔵",
  order: 1,
};

const testHabit1: Habit = {
  id: "habit-1",
  name: "fiction",
  areaId: "area-1",
  attitude: null,
  phase: null,
  tags: [],
  emoji: "📖",
  isArchived: false,
  order: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const testHabit2: Habit = {
  ...testHabit1,
  id: "habit-2",
  name: "deep work",
  areaId: "area-2",
  emoji: "💻",
};

const testArchivedHabit: Habit = {
  ...testHabit1,
  id: "habit-archived",
  name: "old thing",
  isArchived: true,
};

const testCycle = {
  id: "cycle-1",
  name: "Dev Summer",
  startDate: "2026-01-01",
  endDate: "2026-04-01",
  intention: null as string | null,
  reflection: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ---------- Mocks ----------
vi.mock("@legendapp/state/react", () => ({
  use$: vi.fn(),
  useValue: vi.fn(),
}));

vi.mock("../banded-heatmap/CycleDeckHeatmap", () => ({
  CycleDeckHeatmap: () => <div data-testid="cycle-deck-heatmap" />,
}));

vi.mock("../CycleCalendarDialog", () => ({
  CycleCalendarDialog: () => <div data-testid="cycle-calendar-dialog" />,
}));

vi.mock("@/hooks/useHabitHealth", () => ({
  useHabitHealth: vi.fn(() => ({ health: "blooming", daysSinceLast: null })),
}));

vi.mock("@/application/services/CycleService", () => ({
  CycleService: vi.fn().mockImplementation(() => ({
    endCycle: vi.fn(),
  })),
}));

vi.mock("@/lib/dates", () => ({
  formatCycleSubtitle: vi.fn(() => "ends in 5 days"),
  formatCycleDateRange: vi.fn(() => "Jan 1 - Apr 1"),
  fromISODate: vi.fn((s: string) => new Date(s)),
  toISODate: vi.fn((d: Date) => d.toISOString().slice(0, 10)),
}));

vi.mock("@/infrastructure/state/store", () => ({
  areas$: { get: vi.fn(() => ({})) },
  activeCycle$: { get: vi.fn(() => null) },
  cycles$: { get: vi.fn(() => ({})) },
  habits$: { get: vi.fn(() => ({})) },
  storeHydrated$: { get: vi.fn(() => true) },
}));

vi.mock("@/infrastructure/state/ui-store", () => ({
  cycleDeckCollapsed$: {
    get: vi.fn(() => false),
    set: vi.fn(),
    peek: vi.fn(() => false),
  },
  cycleDeckSelectedCycleId$: {
    get: vi.fn(() => null),
    set: vi.fn(),
    peek: vi.fn(() => null),
  },
}));

// ---------- Imports after mocks ----------
import { useValue } from "@legendapp/state/react";
import { useHabitHealth } from "@/hooks/useHabitHealth";
import { CycleDeck } from "../CycleDeck";

const mockUseValue = useValue as unknown as ReturnType<typeof vi.fn>;
const mockUseHabitHealth = useHabitHealth as unknown as ReturnType<
  typeof vi.fn
>;

interface MockStoreState {
  activeCycle?: typeof testCycle | null;
  isCollapsed?: boolean;
  selectedCycleId?: string | null;
  cyclesMap?: Record<string, typeof testCycle>;
  habitsMap?: Record<string, Habit>;
  areasMap?: Record<string, Area>;
  isHydrated?: boolean;
}

/**
 * CycleDeck useValue call order:
 * 1. activeCycle$ (selector)
 * 2. cycleDeckCollapsed$
 * 3. cycleDeckSelectedCycleId$
 * 4. cycles$ (selector)
 * 5. habits$ (selector)
 * 6. areas$ (selector)
 * 7. storeHydrated$
 */
const mockStore = (state: MockStoreState) => {
  const values = [
    state.activeCycle ?? null,
    state.isCollapsed ?? false,
    state.selectedCycleId ?? null,
    state.cyclesMap ??
      (state.activeCycle ? { [state.activeCycle.id]: state.activeCycle } : {}),
    state.habitsMap ?? {},
    state.areasMap ?? {},
    state.isHydrated ?? true,
  ];

  let callIndex = 0;
  mockUseValue.mockImplementation(() => {
    const v = values[callIndex] ?? null;
    callIndex++;
    return v;
  });
};

describe("CycleDeck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseHabitHealth.mockReturnValue({
      health: "blooming",
      daysSinceLast: null,
    });
  });

  describe("no active cycle", () => {
    it("renders hint and heatmap when no cycle is active", () => {
      mockStore({ activeCycle: null });

      render(<CycleDeck />);

      expect(screen.getByTestId("cycle-deck-heatmap")).toBeInTheDocument();
      expect(screen.getByText(/no active cycle/)).toBeInTheDocument();
      expect(screen.getByText("plan one")).toBeInTheDocument();
    });
  });

  describe("cycle overview", () => {
    it("shows cycle name in the header", () => {
      mockStore({
        activeCycle: testCycle,
        habitsMap: { "habit-1": testHabit1 },
        areasMap: { "area-1": testArea },
      });

      render(<CycleDeck />);

      expect(screen.getByText("Dev Summer")).toBeInTheDocument();
    });

    it("shows habits grouped by area", () => {
      mockStore({
        activeCycle: testCycle,
        habitsMap: { "habit-1": testHabit1, "habit-2": testHabit2 },
        areasMap: { "area-1": testArea, "area-2": testArea2 },
      });

      render(<CycleDeck />);

      expect(screen.getByText("Wellness")).toBeInTheDocument();
      expect(screen.getByText("Craft")).toBeInTheDocument();
      expect(screen.getByText("fiction")).toBeInTheDocument();
      expect(screen.getByText("deep work")).toBeInTheDocument();
    });

    it("excludes archived habits", () => {
      mockStore({
        activeCycle: testCycle,
        habitsMap: {
          "habit-1": testHabit1,
          "habit-archived": testArchivedHabit,
        },
        areasMap: { "area-1": testArea },
      });

      render(<CycleDeck />);

      expect(screen.getByText("fiction")).toBeInTheDocument();
      expect(screen.queryByText("old thing")).toBeNull();
    });

    it("shows cycle intention when set", () => {
      const cycleWithIntention = {
        ...testCycle,
        intention: "Focus on creative work",
      };
      mockStore({
        activeCycle: cycleWithIntention,
        habitsMap: { "habit-1": testHabit1 },
        areasMap: { "area-1": testArea },
      });

      render(<CycleDeck />);

      expect(screen.getByText("Focus on creative work")).toBeInTheDocument();
    });

    it("shows days-since-last for wilting habits", () => {
      mockUseHabitHealth.mockReturnValue({
        health: "wilting",
        daysSinceLast: 5,
      });

      mockStore({
        activeCycle: testCycle,
        habitsMap: { "habit-1": testHabit1 },
        areasMap: { "area-1": testArea },
      });

      render(<CycleDeck />);

      expect(screen.getByText("5d")).toBeInTheDocument();
    });
  });

  describe("header", () => {
    it("shows collapse button", () => {
      mockStore({
        activeCycle: testCycle,
        habitsMap: { "habit-1": testHabit1 },
        areasMap: { "area-1": testArea },
      });

      render(<CycleDeck />);

      expect(screen.getByTitle("Collapse cycle deck")).toBeInTheDocument();
    });

    it("always renders heatmap", () => {
      mockStore({
        activeCycle: testCycle,
        habitsMap: {},
        areasMap: {},
      });

      render(<CycleDeck />);

      expect(screen.getByTestId("cycle-deck-heatmap")).toBeInTheDocument();
    });
  });

  describe("collapsed state", () => {
    it("hides overview content when collapsed", () => {
      mockStore({
        activeCycle: testCycle,
        isCollapsed: true,
        habitsMap: { "habit-1": testHabit1 },
        areasMap: { "area-1": testArea },
      });

      render(<CycleDeck />);

      expect(screen.queryByText("fiction")).toBeNull();
      expect(screen.getByText("Dev Summer")).toBeInTheDocument();
    });
  });
});
