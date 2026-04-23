// @vitest-environment happy-dom

/**
 * DnDProvider — drag-end routing tests.
 *
 * These tests exercise the pure routing decisions inside `handleDragEnd`
 * by mocking `@dnd-kit/core`'s `DndContext` to capture the `onDragEnd`
 * prop, rendering the provider, and invoking the captured callback with
 * synthesised drag-end events.
 */

import { render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import type { Moment } from "@/domain/entities/Moment";

globalThis.React = React;

// --- Module-scoped spies ---
const allocateFromPlanSpy = vi.fn();
const unallocateMomentSpy = vi.fn();

// --- Mocks ---

// Capture onDragEnd on each render so tests can fire events manually.
let capturedOnDragEnd:
  | ((event: {
      active: { id: string; data: { current?: unknown } };
      over: { id: string; data: { current?: unknown } } | null;
    }) => void)
  | null = null;

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd?: typeof capturedOnDragEnd;
  }) => {
    capturedOnDragEnd = onDragEnd ?? null;
    return <div data-testid="dnd-context">{children}</div>;
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  MouseSensor: class {},
  TouchSensor: class {},
  KeyboardSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  pointerWithin: vi.fn(() => []),
  rectIntersection: vi.fn(() => []),
}));

vi.mock("@dnd-kit/modifiers", () => ({
  snapCenterToCursor: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  sortableKeyboardCoordinates: vi.fn(),
}));

// A mutable store so tests can seed moments/areas.
const momentsStore: Record<string, Moment> = {};
const areasStore: Record<string, unknown> = {};
const selectedIds: string[] = [];

vi.mock("@legendapp/state/react", () => ({
  useValue: vi.fn((obs: unknown) => {
    if (obs === "moments") return momentsStore;
    if (obs === "areas") return areasStore;
    if (obs === "selected") return selectedIds;
    if (obs === "duplicate") return false;
    return undefined;
  }),
}));

vi.mock("@/infrastructure/state/store", () => ({
  moments$: "moments",
  areas$: "areas",
}));

vi.mock("@/infrastructure/state/selection", () => ({
  selectionState$: {
    selectedMomentIds: {
      get: () => selectedIds,
    },
  },
}));

vi.mock("@/infrastructure/state/ui-store", () => ({
  isDuplicateMode$: {
    set: vi.fn(),
  },
}));

vi.mock("@/infrastructure/state/history", () => ({
  startBatch: vi.fn(),
  endBatch: vi.fn(),
}));

vi.mock("@/infrastructure/state/history-middleware", () => ({
  duplicateMomentWithHistory: vi.fn(),
  moveMomentWithHistory: vi.fn(),
  reorderMomentsWithHistory: vi.fn(),
}));

vi.mock("@/application/services/CycleService", () => ({
  CycleService: vi.fn().mockImplementation(() => ({
    allocateFromPlan: allocateFromPlanSpy,
    unallocateMoment: unallocateMomentSpy,
  })),
}));

vi.mock("../MomentCard", () => ({
  MomentCard: () => <div data-testid="moment-card" />,
}));

// useValue is imported above. We need it to hit our store mock keyed by
// identity string. Override behavior to match the order of calls in
// DnDProvider: isDuplicateMode, moments, areas, selectedMomentIds.
import { useValue } from "@legendapp/state/react";
const mockUseValue = useValue as unknown as ReturnType<typeof vi.fn>;

function primeUseValue() {
  // DnDProvider calls useValue four times in order:
  // 1) isDuplicateMode$, 2) moments$, 3) areas$, 4) selectionState$.selectedMomentIds
  let call = 0;
  mockUseValue.mockImplementation(() => {
    call += 1;
    switch (call) {
      case 1:
        return false; // isDuplicateMode
      case 2:
        return momentsStore;
      case 3:
        return areasStore;
      case 4:
        return selectedIds;
      default:
        return undefined;
    }
  });
}

// Imports after mocks
import { DnDProvider } from "../DnDProvider";

// --- Fixtures ---
const allocatedMoment: Moment = {
  id: "m-existing",
  name: "writing",
  areaId: "a-1",
  habitId: "h-other",
  cycleId: "c-1",
  cyclePlanId: "plan-other",
  day: "2026-04-24",
  phase: "MORNING" as Moment["phase"],
  order: 0,
  tags: [],
  emoji: null,
  createdAt: "",
  updatedAt: "",
};

describe("DnDProvider handleDragEnd — deck-card over allocated moment (Bug C1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores
    for (const k of Object.keys(momentsStore)) delete momentsStore[k];
    for (const k of Object.keys(areasStore)) delete areasStore[k];
    selectedIds.length = 0;
    capturedOnDragEnd = null;
    allocateFromPlanSpy.mockReturnValue({
      ...allocatedMoment,
      id: "m-new",
      habitId: "h-target",
      cyclePlanId: "plan-target",
    });
    primeUseValue();
  });

  it("routes deck-card dropped on allocated moment to handleAllocateFromPlan with the moment's cell", () => {
    // Seed: one allocated moment in the target cell
    momentsStore[allocatedMoment.id] = allocatedMoment;

    render(
      <DnDProvider>
        <div />
      </DnDProvider>,
    );

    expect(capturedOnDragEnd).toBeTruthy();

    // Simulate: deck-card dragged on top of the allocated moment.
    // @dnd-kit resolves over.id to the sortable item's id (not its cell).
    capturedOnDragEnd!({
      active: {
        id: "deck-card-c-1-h-target-0",
        data: {
          current: {
            type: "deck-card",
            cycleId: "c-1",
            habitId: "h-target",
          },
        },
      },
      over: {
        id: allocatedMoment.id, // resolves to the sortable moment
        data: {
          current: undefined, // sortable items have no targetType
        },
      },
    });

    expect(allocateFromPlanSpy).toHaveBeenCalledTimes(1);
    expect(allocateFromPlanSpy).toHaveBeenCalledWith({
      cycleId: "c-1",
      habitId: "h-target",
      day: allocatedMoment.day,
      phase: allocatedMoment.phase,
    });
    // unallocateMoment must NOT be invoked.
    expect(unallocateMomentSpy).not.toHaveBeenCalled();
  });

  it("does not route when over.id is a moment but active is not a deck-card (regression guard)", () => {
    momentsStore[allocatedMoment.id] = allocatedMoment;

    render(
      <DnDProvider>
        <div />
      </DnDProvider>,
    );

    // Simulate: a non-existent active moment (so activeMoment is undefined),
    // but the drag payload is a normal moment drag, not a deck-card.
    capturedOnDragEnd!({
      active: {
        id: "missing-moment",
        data: {
          current: {
            momentId: "missing-moment",
            sourceType: "timeline",
            sourceDay: "2026-04-20",
            sourcePhase: "MORNING",
          },
        },
      },
      over: {
        id: allocatedMoment.id,
        data: { current: undefined },
      },
    });

    expect(allocateFromPlanSpy).not.toHaveBeenCalled();
  });
});
