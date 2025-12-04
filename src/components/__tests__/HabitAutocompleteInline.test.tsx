// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { Habit } from "@/domain/entities/Habit";
import type { Area } from "@/domain/entities/Area";

// Mock dependencies
vi.mock("@legendapp/state/react", () => ({
  use$: vi.fn(),
}));

vi.mock("@/infrastructure/state/store", () => ({
  habits$: {},
  areas$: {},
}));

// Import after mocks
import { HabitAutocompleteInline } from "../HabitAutocompleteInline";
import { use$ } from "@legendapp/state/react";

const mockUse$ = use$ as unknown as ReturnType<typeof vi.fn>;

// Test data
const testArea: Area = {
  id: "area-1",
  name: "Wellness",
  color: "#10b981",
  emoji: "🟢",
  isDefault: true,
  order: 0,
  attitude: null,
  tags: [],
  isArchived: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const testHabits: Record<string, Habit> = {
  "habit-1": {
    id: "habit-1",
    name: "Running",
    areaId: "area-1",
    emoji: "🏃",
    tags: [],
    attitude: null,
    phase: null,
    isArchived: false,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "habit-2": {
    id: "habit-2",
    name: "Meditation",
    areaId: "area-1",
    emoji: "🧘",
    tags: [],
    attitude: null,
    phase: null,
    isArchived: false,
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  "habit-3": {
    id: "habit-3",
    name: "Writing",
    areaId: "area-2",
    emoji: "✍️",
    tags: [],
    attitude: null,
    phase: null,
    isArchived: false,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

describe("HabitAutocompleteInline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUse$.mockReturnValue({});
  });

  describe("empty state", () => {
    it("should not show popover when closed", () => {
      mockUse$.mockReturnValueOnce(testHabits);
      mockUse$.mockReturnValueOnce({ "area-1": testArea });

      const { container } = render(
        <HabitAutocompleteInline
          open={false}
          searchValue=""
          onSelectHabit={vi.fn()}
          onCreateStandalone={vi.fn()}
          onClose={vi.fn()}
          trigger={<div>Trigger</div>}
        />
      );

      // Popover should not be visible
      expect(screen.queryByText("Running")).not.toBeInTheDocument();
    });

    it("should show popular habits when search is empty", () => {
      mockUse$.mockReturnValueOnce(testHabits);
      mockUse$.mockReturnValueOnce({
        "area-1": testArea,
        "area-2": { ...testArea, id: "area-2", name: "Craft", emoji: "🔵" },
      });

      render(
        <HabitAutocompleteInline
          open={true}
          searchValue=""
          onSelectHabit={vi.fn()}
          onCreateStandalone={vi.fn()}
          onClose={vi.fn()}
          trigger={<div>Trigger</div>}
        />
      );

      // Should show all habits when no search
      expect(screen.getByText("Running")).toBeInTheDocument();
      expect(screen.getByText("Meditation")).toBeInTheDocument();
      expect(screen.getByText("Writing")).toBeInTheDocument();
    });
  });

  describe("search and filtering", () => {
    it("should filter habits by exact match", () => {
      mockUse$.mockReturnValueOnce(testHabits);
      mockUse$.mockReturnValueOnce({ "area-1": testArea });

      render(
        <HabitAutocompleteInline
          open={true}
          searchValue="Running"
          onSelectHabit={vi.fn()}
          onCreateStandalone={vi.fn()}
          onClose={vi.fn()}
          trigger={<div>Trigger</div>}
        />
      );

      expect(screen.getByText("Running")).toBeInTheDocument();
      expect(screen.queryByText("Meditation")).not.toBeInTheDocument();
    });

    it("should filter habits by prefix match", () => {
      mockUse$.mockReturnValueOnce(testHabits);
      mockUse$.mockReturnValueOnce({ "area-1": testArea });

      render(
        <HabitAutocompleteInline
          open={true}
          searchValue="run"
          onSelectHabit={vi.fn()}
          onCreateStandalone={vi.fn()}
          onClose={vi.fn()}
          trigger={<div>Trigger</div>}
        />
      );

      expect(screen.getByText("Running")).toBeInTheDocument();
      expect(screen.queryByText("Meditation")).not.toBeInTheDocument();
    });

    it("should show create standalone option when no matches", () => {
      mockUse$.mockReturnValueOnce(testHabits);
      mockUse$.mockReturnValueOnce({ "area-1": testArea });

      render(
        <HabitAutocompleteInline
          open={true}
          searchValue="Coffee Break"
          onSelectHabit={vi.fn()}
          onCreateStandalone={vi.fn()}
          onClose={vi.fn()}
          trigger={<div>Trigger</div>}
        />
      );

      // Should show "Create standalone" option
      expect(screen.getByText(/Create:/)).toBeInTheDocument();
      expect(screen.getByText(/Coffee Break/)).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should call onSelectHabit when habit clicked", () => {
      mockUse$.mockReturnValueOnce(testHabits);
      mockUse$.mockReturnValueOnce({ "area-1": testArea });

      const onSelectHabit = vi.fn();

      render(
        <HabitAutocompleteInline
          open={true}
          searchValue="run"
          onSelectHabit={onSelectHabit}
          onCreateStandalone={vi.fn()}
          onClose={vi.fn()}
          trigger={<div>Trigger</div>}
        />
      );

      fireEvent.click(screen.getByText("Running"));
      expect(onSelectHabit).toHaveBeenCalledWith(testHabits["habit-1"]);
    });

    it("should call onCreateStandalone when create option clicked", () => {
      mockUse$.mockReturnValueOnce(testHabits);
      mockUse$.mockReturnValueOnce({ "area-1": testArea });

      const onCreateStandalone = vi.fn();

      render(
        <HabitAutocompleteInline
          open={true}
          searchValue="Coffee Break"
          onSelectHabit={vi.fn()}
          onCreateStandalone={onCreateStandalone}
          onClose={vi.fn()}
          trigger={<div>Trigger</div>}
        />
      );

      const createButton = screen.getByText(/Create:/);
      fireEvent.click(createButton.closest("button")!);
      expect(onCreateStandalone).toHaveBeenCalledWith("Coffee Break");
    });
  });

  describe("area information", () => {
    it("should show area name and emoji for each habit", () => {
      mockUse$.mockReturnValueOnce(testHabits);
      mockUse$.mockReturnValueOnce({
        "area-1": testArea,
        "area-2": { ...testArea, id: "area-2", name: "Craft", emoji: "🔵" },
      });

      render(
        <HabitAutocompleteInline
          open={true}
          searchValue=""
          onSelectHabit={vi.fn()}
          onCreateStandalone={vi.fn()}
          onClose={vi.fn()}
          trigger={<div>Trigger</div>}
        />
      );

      // Should show area names with habits (using getAllByText since Wellness appears twice)
      expect(screen.getAllByText("Wellness").length).toBeGreaterThan(0);
      expect(screen.getByText("Craft")).toBeInTheDocument();
    });
  });
});
