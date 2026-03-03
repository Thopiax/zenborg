// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";

// Make React globally available (needed for JSX in components without React import)
globalThis.React = React;

// Test data - needs to be before mocks
const testArea: Area = {
  id: "area-1",
  name: "Wellness",
  color: "#10b981",
  emoji: "🟢",
  isDefault: true,
  attitude: null,
  tags: [],
  isArchived: false,
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

const testCycle = {
  id: "cycle-1",
  name: "Barcelona Summer",
  startDate: "2026-01-01",
  endDate: "2026-04-01",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock dependencies
vi.mock("@legendapp/state/react", () => ({
  use$: vi.fn(),
  useValue: vi.fn(),
}));

vi.mock("../MomentStack", () => ({
  MomentStack: ({ moments, area }: { moments: Moment[]; area: Area }) => (
    <div data-testid="moment-stack" data-area-id={area.id}>
      Stack: {moments.length} moments
    </div>
  ),
}));

vi.mock("../CycleStarter", () => ({
  CycleStarter: () => (
    <div data-testid="cycle-starter">CycleStarter</div>
  ),
}));

vi.mock("../CycleDeckColumn", () => ({
  CycleDeckColumn: ({
    area,
    habitMoments,
    isEditMode,
    showAllHabits,
  }: {
    area: Area;
    habitMoments: Record<string, Moment[]>;
    isEditMode: boolean;
    showAllHabits: boolean;
    cycleId: string;
  }) => (
    <div
      data-testid={`cycle-deck-column-${area.id}`}
      data-edit-mode={isEditMode}
      data-show-all={showAllHabits}
    >
      <span>{area.emoji}</span>
      <span>{area.name}</span>
      {Object.entries(habitMoments).map(([habitId, moments]) => (
        <div key={habitId} data-testid="moment-stack" data-area-id={area.id}>
          Stack: {moments.length} moments
        </div>
      ))}
      {showAllHabits && (
        <div data-testid={`ghost-cards-${area.id}`}>Ghost cards</div>
      )}
    </div>
  ),
}));

const mockGetCurrentAndFutureCycles = vi.fn(() => [testCycle]);
const mockGetAreasWithDeckMoments = vi.fn((deckMoments) => {
  const areasMap: Record<string, Area> = {
    "area-1": testArea,
    "area-2": testArea2,
  };
  return Object.keys(deckMoments)
    .map((areaId) => ({
      area: areasMap[areaId],
      habits: deckMoments[areaId],
    }))
    .filter(({ area }) => Boolean(area))
    .sort((a, b) => a.area.order - b.area.order);
});
const mockUpdateCycle = vi.fn();
const mockGetDefaultStartDate = vi.fn(() => "2026-04-02");
const mockPlanCycle = vi.fn(() => ({ id: "new-cycle" }));
const mockBudgetHabitToCycle = vi.fn();

vi.mock("@/infrastructure/state/store", () => ({
  deckMomentsByAreaAndHabit$: { get: vi.fn(() => ({})) },
  areas$: {
    get: vi.fn(() => ({
      "area-1": testArea,
      "area-2": testArea2,
    })),
  },
  activeCycle$: { get: vi.fn(() => null) },
  habits$: {
    get: vi.fn(() => ({})),
  },
}));

vi.mock("@dnd-kit/core", () => ({
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}));

vi.mock("@/application/services/CycleService", () => ({
  CycleService: vi.fn().mockImplementation(() => ({
    getAreasWithDeckMoments: mockGetAreasWithDeckMoments,
    getCurrentAndFutureCycles: mockGetCurrentAndFutureCycles,
    updateCycle: mockUpdateCycle,
    getDefaultStartDate: mockGetDefaultStartDate,
    planCycle: mockPlanCycle,
    budgetHabitToCycle: mockBudgetHabitToCycle,
  })),
}));

vi.mock("@/lib/dates", () => ({
  formatCycleSubtitle: vi.fn(() => "ends in 5 days"),
}));

vi.mock("@/infrastructure/state/ui-store", () => ({
  cycleDeckCollapsed$: { get: vi.fn(() => false), set: vi.fn(), peek: vi.fn(() => false) },
  cycleDeckEditMode$: { get: vi.fn(() => false), set: vi.fn(), peek: vi.fn(() => false) },
  cycleDeckSelectedCycleId$: { get: vi.fn(() => null), set: vi.fn(), peek: vi.fn(() => null) },
}));

vi.mock("../CycleFormDialog", () => ({
  CycleFormDialog: () => <div data-testid="cycle-form-dialog" />,
}));

import { useValue } from "@legendapp/state/react";
import { habits$ } from "@/infrastructure/state/store";
// Import after mocks
import { CycleDeck } from "../CycleDeck";

const mockUseValue = useValue as unknown as ReturnType<typeof vi.fn>;

// Test helpers
const createTestMoment = (overrides: Partial<Moment> = {}): Moment => ({
  id: `moment-${Math.random()}`,
  name: "Test Moment",
  areaId: "area-1",
  habitId: "habit-1",
  cycleId: "cycle-1",
  cyclePlanId: "plan-1",
  phase: null,
  day: null,
  order: 0,
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe("CycleDeck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentAndFutureCycles.mockReturnValue([testCycle]);
  });

  /**
   * Mock useValue calls with a cycling implementation.
   *
   * CycleDeck calls useValue in this order:
   * 1. deckMoments (via selector fn)
   * 2. activeCycle (via selector fn)
   * 3. cycleDeckCollapsed$ (boolean)
   * 4. cycleDeckEditMode$ (boolean)
   * 5. cycleDeckSelectedCycleId$ (string | null)
   * Then child components call useValue(habits$) etc.
   */
  const mockCycleDeckValues = (
    deckMoments: Record<string, unknown>,
    activeCycle: unknown = null,
    isCollapsed = false,
    isEditMode = false,
    habitsMap: Record<string, unknown> = {},
    selectedCycleId: string | null = null,
  ) => {
    const values = [
      deckMoments,
      activeCycle,
      isCollapsed,
      isEditMode,
      selectedCycleId,
    ];
    let callIndex = 0;

    mockUseValue.mockImplementation(() => {
      const idx = callIndex % values.length;
      callIndex++;
      // For calls beyond the first 5 (child components), return habitsMap
      if (callIndex > values.length) {
        return habitsMap;
      }
      return values[idx];
    });
  };

  describe("no active cycle", () => {
    it("should render CycleStarter when no active cycle", () => {
      mockCycleDeckValues({}, null);

      render(<CycleDeck />);

      expect(screen.getByTestId("cycle-starter")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should show empty message when no budgeted moments in read-only mode", () => {
      mockCycleDeckValues(
        {},
        testCycle,
      );

      render(<CycleDeck />);

      expect(
        screen.getByText(/No budgeted moments in deck/)
      ).toBeInTheDocument();
    });

    it("should show hint to drag habits from library", () => {
      mockCycleDeckValues(
        {},
        testCycle,
      );

      render(<CycleDeck />);

      expect(screen.getByText(/Drag habits/i)).toBeInTheDocument();
    });
  });

  describe("with budgeted moments", () => {
    it("should render area headers", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(deckMoments, testCycle);

      render(<CycleDeck />);

      expect(screen.getByText("🟢")).toBeInTheDocument();
      expect(screen.getByText("Wellness")).toBeInTheDocument();
    });

    it("should render MomentStack for each habit", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [
            createTestMoment({ id: "1" }),
            createTestMoment({ id: "2" }),
          ],
        },
      };

      mockCycleDeckValues(deckMoments, testCycle);

      const { container } = render(<CycleDeck />);

      const stacks = container.querySelectorAll('[data-testid="moment-stack"]');
      expect(stacks).toHaveLength(1);
      expect(stacks[0]).toHaveTextContent("Stack: 2 moments");
    });

    it("should group moments by area", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ areaId: "area-1" })],
        },
        "area-2": {
          "habit-2": [createTestMoment({ areaId: "area-2" })],
        },
      };

      mockCycleDeckValues(deckMoments, testCycle);

      render(<CycleDeck />);

      expect(screen.getByText("🟢")).toBeInTheDocument();
      expect(screen.getByText("🔵")).toBeInTheDocument();
      expect(screen.getByText("Wellness")).toBeInTheDocument();
      expect(screen.getByText("Craft")).toBeInTheDocument();
    });
  });

  describe("arrow navigation", () => {
    it("should show left and right arrow buttons", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
      );

      render(<CycleDeck />);

      expect(screen.getByLabelText("Previous cycle")).toBeInTheDocument();
      expect(screen.getByLabelText(/Next cycle|Create new cycle/)).toBeInTheDocument();
    });

    it("should disable left arrow when on first cycle", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
      );

      render(<CycleDeck />);

      const prevButton = screen.getByLabelText("Previous cycle");
      expect(prevButton).toBeDisabled();
    });

    it("should show + icon when on last cycle", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
      );

      render(<CycleDeck />);

      expect(screen.getByLabelText("Create new cycle")).toBeInTheDocument();
    });

    it("should show collapse button", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
      );

      render(<CycleDeck />);

      expect(screen.getByTitle("Collapse cycle deck")).toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("should show Done editing button when edit mode is active", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" }), createTestMoment({ id: "2" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
        false,
        true,  // editMode ON
      );

      render(<CycleDeck />);

      expect(screen.getByTitle("Done editing")).toBeInTheDocument();
    });

    it("should show Edit button when edit mode is inactive", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
        false,
        false, // editMode OFF
      );

      render(<CycleDeck />);

      expect(screen.getByTitle("Edit cycle deck")).toBeInTheDocument();
    });

    it("should hide Edit button when collapsed", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
        true,  // collapsed
        false,
      );

      render(<CycleDeck />);

      expect(screen.queryByTitle("Edit cycle deck")).toBeNull();
    });
  });

  describe("inline cycle header editing", () => {
    it("should render name as input when edit mode is active", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
        false, true,
      );

      render(<CycleDeck />);

      const nameInput = screen.getByDisplayValue("Barcelona Summer");
      expect(nameInput).toBeInTheDocument();
      expect(nameInput.tagName).toBe("INPUT");
    });

    it("should render name as plain text when edit mode is off", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
        false, false,
      );

      render(<CycleDeck />);

      expect(screen.getByText(/Barcelona Summer/)).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Barcelona Summer")).toBeNull();
    });

    it("should render date inputs when edit mode is active", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
        false, true,
      );

      render(<CycleDeck />);

      expect(screen.getByLabelText("Start date")).toBeInTheDocument();
      expect(screen.getByLabelText("End date")).toBeInTheDocument();
    });

    it("should hide arrow navigation during edit mode", () => {
      const deckMoments = {
        "area-1": {
          "habit-1": [createTestMoment({ id: "1" })],
        },
      };

      mockCycleDeckValues(
        deckMoments,
        testCycle,
        false, true,
      );

      render(<CycleDeck />);

      expect(screen.queryByLabelText("Previous cycle")).toBeNull();
      expect(screen.queryByLabelText(/Next cycle|Create new cycle/)).toBeNull();
    });
  });

  describe("empty state in edit mode", () => {
    it("should show area columns instead of empty message", () => {
      const habitsData = {
        "habit-1": { id: "habit-1", name: "Morning Run", areaId: "area-1", isArchived: false, order: 0, emoji: null },
        "habit-2": { id: "habit-2", name: "Deep Work", areaId: "area-2", isArchived: false, order: 0, emoji: null },
      };

      (habits$.get as ReturnType<typeof vi.fn>).mockReturnValue(habitsData);

      mockCycleDeckValues(
        {},           // empty deck
        testCycle,
        false,
        true,         // editMode ON
        habitsData,   // habits for child components
      );

      render(<CycleDeck />);

      expect(screen.queryByText(/No budgeted moments/)).toBeNull();
      expect(screen.getByTestId("cycle-deck-column-area-1")).toBeInTheDocument();
      expect(screen.getByTestId("cycle-deck-column-area-2")).toBeInTheDocument();
    });
  });
});
