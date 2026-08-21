// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { TagSummary } from "../TagSummary";

globalThis.React = React;

describe("TagSummary", () => {
  it("renders nothing when there are no tags", () => {
    const { container } = render(<TagSummary tags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when tags are absent", () => {
    const { container } = render(<TagSummary tags={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("spells out a lone tag without a counter", () => {
    render(<TagSummary tags={["gap"]} />);
    expect(screen.getByText("#gap")).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("shows the first tag and collapses the rest into a count", () => {
    render(<TagSummary tags={["gap", "gap-screen", "gap-5m"]} />);
    expect(screen.getByText("#gap")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.queryByText("#gap-screen")).not.toBeInTheDocument();
  });

  it("keeps every tag readable on hover", () => {
    render(<TagSummary tags={["gap", "gap-screen"]} />);
    expect(screen.getByTitle("#gap #gap-screen")).toBeInTheDocument();
  });

  it("honours a wider visible count", () => {
    render(<TagSummary tags={["gap", "gap-screen", "gap-5m"]} visible={2} />);
    expect(screen.getByText("#gap")).toBeInTheDocument();
    expect(screen.getByText("#gap-screen")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
