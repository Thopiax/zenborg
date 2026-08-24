// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { WeekGrid } from "../week-grid/WeekGrid";
globalThis.React = React;

import type { WeekGridViewModel } from "@/infrastructure/state/weekGridViewModel";

const block = (over: Record<string, unknown> = {}) => ({
  momentId: "m-1",
  name: "standup",
  areaId: "a1",
  startTime: "10:00",
  durationMin: 60,
  gridRowStart: 18,
  gridRowSpan: 4,
  tentative: false,
  ...over,
});

const day = (date: string, blocks: ReturnType<typeof block>[] = []) => ({
  date,
  isToday: date === "2026-08-26",
  blocks,
  ambient: [],
});

const vm: WeekGridViewModel = {
  days: [
    day("2026-08-24", [
      block({}),
      block({
        momentId: "m-2",
        name: "dentist",
        areaId: "a2",
        tentative: true,
        startTime: "14:00",
        gridRowStart: 34,
      }),
    ]),
    day("2026-08-25"),
    day("2026-08-26"),
    day("2026-08-27"),
    day("2026-08-28"),
    day("2026-08-29"),
    day("2026-08-30"),
  ],
  startHour: 6,
  endHour: 22,
  hours: Array.from({ length: 16 }, (_, i) => i + 6),
  rowsPerHour: 4,
  totalRows: 64,
};

const areas = {
  a1: { id: "a1", name: "work", color: "#7c9a72" },
  a2: { id: "a2", name: "health", color: "#b06060" },
} as never;

const noop = () => {};

describe("WeekGrid", () => {
  it("renders seven day columns", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    expect(screen.getAllByTestId("week-day-column")).toHaveLength(7);
  });

  it("renders one hour rule per entry in vm.hours, not a hardcoded 24", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    expect(screen.getAllByTestId("hour-rule")).toHaveLength(16);
  });

  it("places a block by grid row rather than absolute position", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    const el = screen.getByText("standup").closest("[data-testid=week-block]");
    expect(el).toHaveStyle({ gridRow: "18 / span 4" });
  });

  it("fills an accepted block with its area color", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    const el = screen.getByText("standup").closest("[data-testid=week-block]");
    expect(el).toHaveStyle({ backgroundColor: "#7c9a72" });
  });

  it("renders a tentative block unfilled with a hairline outline", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    const el = screen.getByText("dentist").closest("[data-testid=week-block]");
    expect(el).toHaveStyle({ backgroundColor: "transparent" });
    expect(el).toHaveStyle({ borderColor: "#b06060" });
  });

  it("accepting a tentative block is one gesture", () => {
    const onAccept = vi.fn();
    render(
      <WeekGrid vm={vm} areas={areas} onAccept={onAccept} onRename={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept moment" }));
    expect(onAccept).toHaveBeenCalledWith("m-2");
  });

  it("renames inline without a modal", () => {
    const onRename = vi.fn();
    render(
      <WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={onRename} />,
    );
    fireEvent.doubleClick(screen.getByText("standup"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "sync" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("m-1", "sync");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders more than three blocks in one phase band", () => {
    const five = ["12:00", "13:00", "14:00", "15:00", "16:00"].map((t, i) =>
      block({
        momentId: `m-${i + 10}`,
        name: `b${i}`,
        startTime: t,
        gridRowStart: 26 + i * 4,
      }),
    );
    const crowded = {
      ...vm,
      days: [day("2026-08-24", five), ...vm.days.slice(1)],
    };
    render(
      <WeekGrid vm={crowded} areas={areas} onAccept={noop} onRename={noop} />,
    );
    expect(screen.getAllByTestId("week-block")).toHaveLength(5);
  });
});
