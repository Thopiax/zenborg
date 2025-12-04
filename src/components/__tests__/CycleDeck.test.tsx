// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";

// Mock dependencies
vi.mock("@legendapp/state/react", () => ({
  use$: vi.fn(),
}));

vi.mock("../MomentStack", () => ({
  MomentStack: ({ moments, area }: { moments: Moment[]; area: Area }) => (
    <div data-testid="moment-stack" data-area-id={area.id}>
      Stack: {moments.length} moments
    </div>
  ),
}));

vi.mock("@/infrastructure/state/store", () => ({
  deckMomentsByAreaAndHabit$: {},
  areas$: {},
  activeCycle$: {},
}));

import { use$ } from "@legendapp/state/react";
// Import after mocks
import { CycleDeck } from "../CycleDeck";

const mockUse$ = use$ as unknown as ReturnType<typeof vi.fn>;

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

describe("CycleDeck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("empty state", () => {
    it("should show empty message when no budgeted moments", () => {
      mockUse$.mockReturnValue({});

      render(<CycleDeck />);

      expect(
        screen.getByText(/No budgeted moments in deck/)
      ).toBeInTheDocument();
    });

    it("should show hint to drag habits from library", () => {
      mockUse$.mockReturnValue({});

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

      const areas = {
        "area-1": testArea,
      };

      mockUse$.mockReturnValue(deckMoments);
      mockUse$.mockReturnValueOnce(deckMoments);
      mockUse$.mockReturnValueOnce(areas);
      mockUse$.mockReturnValueOnce(null);

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

      const areas = {
        "area-1": testArea,
      };

      mockUse$.mockReturnValueOnce(deckMoments);
      mockUse$.mockReturnValueOnce(areas);
      mockUse$.mockReturnValueOnce(null);

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

      const areas = {
        "area-1": testArea,
        "area-2": { ...testArea, id: "area-2", name: "Craft", emoji: "🔵" },
      };

      mockUse$.mockReturnValueOnce(deckMoments);
      mockUse$.mockReturnValueOnce(areas);
      mockUse$.mockReturnValueOnce(null);

      render(<CycleDeck />);

      // Both area headers should be present
      expect(screen.getByText("🟢")).toBeInTheDocument();
      expect(screen.getByText("🔵")).toBeInTheDocument();
      expect(screen.getByText("Wellness")).toBeInTheDocument();
      expect(screen.getByText("Craft")).toBeInTheDocument();
    });
  });
});
