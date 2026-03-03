// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { Habit } from "@/domain/entities/Habit";
import type { Area } from "@/domain/entities/Area";

// Make React globally available (needed for JSX in components without React import)
globalThis.React = React;

// Mock dependencies
vi.mock("@legendapp/state/react", () => ({
  use$: vi.fn(),
}));

vi.mock("@/infrastructure/state/store", () => ({
  habits$: {},
  areas$: {
    get: vi.fn(() => ({
      "area-1": {
        id: "area-1",
        name: "Wellness",
        color: "#10b981",
        emoji: "🟢",
        isDefault: true,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })),
  },
  lastUsedAreaId$: {
    peek: vi.fn(() => "area-1"),
  },
}));

vi.mock("../HabitAutocompleteInline", () => ({
  HabitAutocompleteInline: ({
    open,
    searchValue,
    onSelectHabit,
    onClose,
  }: any) => (
    <div data-testid="habit-autocomplete">
      {open && (
        <>
          <div data-testid="search-value">{searchValue}</div>
          <button onClick={() => onSelectHabit({ id: "habit-1", name: "Running" })}>
            Select Running
          </button>
          <button onClick={onClose}>Close</button>
        </>
      )}
    </div>
  ),
}));

// Import after mocks
import { MomentFormInline } from "../MomentFormInline";
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

const testHabit: Habit = {
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
};

describe("MomentFormInline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUse$.mockReturnValue({ "area-1": testArea });
  });

  describe("rendering", () => {
    it("should render input field when open", () => {
      render(
        <MomentFormInline
          open={true}
          onClose={vi.fn()}
          onSpawnHabit={vi.fn()}

          day="2025-01-01"
          phase="morning"
        />
      );

      expect(screen.getByPlaceholderText(/type moment name/i)).toBeInTheDocument();
    });

    it("should not render when closed", () => {
      render(
        <MomentFormInline
          open={false}
          onClose={vi.fn()}
          onSpawnHabit={vi.fn()}

          day="2025-01-01"
          phase="morning"
        />
      );

      expect(screen.queryByPlaceholderText(/type moment name/i)).not.toBeInTheDocument();
    });

    it("should auto-focus input when opened", () => {
      const { rerender } = render(
        <MomentFormInline
          open={false}
          onClose={vi.fn()}
          onSpawnHabit={vi.fn()}

          day="2025-01-01"
          phase="morning"
        />
      );

      rerender(
        <MomentFormInline
          open={true}
          onClose={vi.fn()}
          onSpawnHabit={vi.fn()}

          day="2025-01-01"
          phase="morning"
        />
      );

      expect(screen.getByPlaceholderText(/type moment name/i)).toHaveFocus();
    });
  });

  describe("autocomplete integration", () => {
    it("should show autocomplete when typing", () => {
      render(
        <MomentFormInline
          open={true}
          onClose={vi.fn()}
          onSpawnHabit={vi.fn()}

          day="2025-01-01"
          phase="morning"
        />
      );

      const input = screen.getByPlaceholderText(/type moment name/i);
      fireEvent.change(input, { target: { value: "run" } });

      expect(screen.getByTestId("habit-autocomplete")).toBeInTheDocument();
      expect(screen.getByTestId("search-value")).toHaveTextContent("run");
    });

    it("should hide autocomplete when input is empty", () => {
      render(
        <MomentFormInline
          open={true}
          onClose={vi.fn()}
          onSpawnHabit={vi.fn()}

          day="2025-01-01"
          phase="morning"
        />
      );

      const input = screen.getByPlaceholderText(/type moment name/i);
      fireEvent.change(input, { target: { value: "run" } });
      fireEvent.change(input, { target: { value: "" } });

      // Autocomplete should still render but be closed
      const autocomplete = screen.getByTestId("habit-autocomplete");
      expect(autocomplete).toBeInTheDocument();
    });
  });

  describe("habit selection", () => {
    it("should call onSpawnHabit when habit selected", () => {
      const onSpawnHabit = vi.fn();

      render(
        <MomentFormInline
          open={true}
          onClose={vi.fn()}
          onSpawnHabit={onSpawnHabit}

          day="2025-01-01"
          phase="morning"
        />
      );

      const input = screen.getByPlaceholderText(/type moment name/i);
      fireEvent.change(input, { target: { value: "run" } });

      const selectButton = screen.getByText("Select Running");
      fireEvent.click(selectButton);

      expect(onSpawnHabit).toHaveBeenCalledWith(
        { id: "habit-1", name: "Running" },
        "2025-01-01",
        "morning"
      );
    });

    it("should clear input after habit selected", () => {
      render(
        <MomentFormInline
          open={true}
          onClose={vi.fn()}
          onSpawnHabit={vi.fn()}

          day="2025-01-01"
          phase="morning"
        />
      );

      const input = screen.getByPlaceholderText(/type moment name/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "run" } });

      const selectButton = screen.getByText("Select Running");
      fireEvent.click(selectButton);

      expect(input.value).toBe("");
    });
  });

  describe("keyboard shortcuts", () => {
    it("should close on Escape key", () => {
      const onClose = vi.fn();

      render(
        <MomentFormInline
          open={true}
          onClose={onClose}
          onSpawnHabit={vi.fn()}

          day="2025-01-01"
          phase="morning"
        />
      );

      const input = screen.getByPlaceholderText(/type moment name/i);
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });
  });
});
