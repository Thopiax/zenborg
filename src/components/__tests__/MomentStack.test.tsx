// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { MomentStack } from "../MomentStack";

// Mock MomentCard to avoid complex dependencies
vi.mock("../MomentCard", () => ({
  MomentCard: ({ moment, area }: { moment: Moment; area: Area }) => (
    <div data-testid="moment-card" data-moment-id={moment.id}>
      {moment.name}
    </div>
  ),
}));

// Helper to create test moments
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

describe("MomentStack", () => {
  describe("single moment", () => {
    it("should render the moment card without stack layers", () => {
      const moment = createTestMoment({ name: "Running" });
      render(<MomentStack moments={[moment]} area={testArea} />);

      expect(screen.getByText("Running")).toBeInTheDocument();
      expect(screen.queryByText(/x\d+/)).not.toBeInTheDocument();
    });

    it("should not show counter badge for single moment", () => {
      const moment = createTestMoment();
      const { container } = render(
        <MomentStack moments={[moment]} area={testArea} />
      );

      // Counter badge should not be present
      const badge = container.querySelector('[data-testid="stack-counter"]');
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe("multiple moments (stack)", () => {
    it("should show counter badge with correct count", () => {
      const moments = [
        createTestMoment({ id: "1", name: "Running" }),
        createTestMoment({ id: "2", name: "Running" }),
        createTestMoment({ id: "3", name: "Running" }),
      ];

      render(<MomentStack moments={moments} area={testArea} />);

      const badge = screen.getByTestId("stack-counter");
      expect(badge).toHaveTextContent("x3");
    });

    it("should render visual stack layers (max 3 layers)", () => {
      const moments = Array.from({ length: 6 }, (_, i) =>
        createTestMoment({ id: `moment-${i}` })
      );

      const { container } = render(
        <MomentStack moments={moments} area={testArea} />
      );

      // Should have exactly 3 visual layers (never more than 3)
      const layers = container.querySelectorAll('[data-testid="stack-layer"]');
      expect(layers).toHaveLength(3);
    });

    it("should render 2 layers for 2 moments", () => {
      const moments = [
        createTestMoment({ id: "1" }),
        createTestMoment({ id: "2" }),
      ];

      const { container } = render(
        <MomentStack moments={moments} area={testArea} />
      );

      const layers = container.querySelectorAll('[data-testid="stack-layer"]');
      expect(layers).toHaveLength(2);
    });

    it("should render top moment card", () => {
      const moments = [
        createTestMoment({ id: "1", name: "Top Moment" }),
        createTestMoment({ id: "2", name: "Bottom Moment" }),
      ];

      render(<MomentStack moments={moments} area={testArea} />);

      // Only the first moment should be visible (top of stack)
      expect(screen.getByText("Top Moment")).toBeInTheDocument();
      expect(screen.queryByText("Bottom Moment")).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("should handle empty moments array gracefully", () => {
      const { container } = render(
        <MomentStack moments={[]} area={testArea} />
      );

      // Should render nothing or a placeholder
      expect(container.firstChild).toBeNull();
    });

    it("should show counter badge for 10+ moments", () => {
      const moments = Array.from({ length: 15 }, (_, i) =>
        createTestMoment({ id: `moment-${i}` })
      );

      render(<MomentStack moments={moments} area={testArea} />);

      const badge = screen.getByTestId("stack-counter");
      expect(badge).toHaveTextContent("x15");
    });
  });

  describe("draggable behavior", () => {
    it("should make the stack draggable", () => {
      const moments = [
        createTestMoment({ id: "moment-1", name: "Running" }),
        createTestMoment({ id: "moment-2", name: "Running" }),
      ];

      const { container } = render(
        <MomentStack moments={moments} area={testArea} />
      );

      // Should have draggable container
      const draggable = container.querySelector("[data-draggable]");
      expect(draggable).toBeInTheDocument();
    });

    it("should use the top moment ID for drag data", () => {
      const moments = [
        createTestMoment({ id: "top-moment", name: "Running" }),
        createTestMoment({ id: "bottom-moment", name: "Running" }),
      ];

      const { container } = render(
        <MomentStack moments={moments} area={testArea} />
      );

      const draggable = container.querySelector("[data-draggable]");
      expect(draggable).toHaveAttribute("data-moment-id", "top-moment");
    });
  });
});
