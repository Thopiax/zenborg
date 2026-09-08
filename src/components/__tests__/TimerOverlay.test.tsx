// @vitest-environment happy-dom

import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { TimerOverlay } from "../gap/TimerOverlay";
import {
  startGapTimer,
  clearGapTimer,
  gapTimer$,
} from "@/infrastructure/state/ui-store";

beforeEach(() => {
  clearGapTimer();
  vi.useFakeTimers();
});

afterEach(() => {
  clearGapTimer();
  vi.useRealTimers();
});

describe("TimerOverlay", () => {
  it("renders nothing when no timer is active", () => {
    const { container } = render(<TimerOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it("shows habit name and countdown when active", () => {
    render(<TimerOverlay />);
    act(() => startGapTimer("breathwork", 120_000));
    expect(screen.getByText("breathwork")).toBeInTheDocument();
    expect(screen.getByText("remaining")).toBeInTheDocument();
  });

  it("auto-clears after duration", () => {
    render(<TimerOverlay />);
    act(() => startGapTimer("look out", 5_000));
    expect(gapTimer$.active.peek()).toBe(true);
    act(() => vi.advanceTimersByTime(5_100));
    expect(gapTimer$.active.peek()).toBe(false);
  });
});
