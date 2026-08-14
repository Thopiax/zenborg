// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { Phase } from "@/domain/value-objects/Phase";
import type {
  HarvestMoment,
  HarvestSeason,
} from "@/infrastructure/state/harvestViewModel";
import { SeasonReadback } from "../SeasonReadback";

// Make React globally available (needed for JSX in components without React import)
globalThis.React = React;

const harvestMoment = (
  id: string,
  name: string,
  day: string,
  extra: Partial<HarvestMoment> = {},
): HarvestMoment => ({
  id,
  name,
  day,
  phase: Phase.MORNING,
  areaId: "a",
  areaName: "Atlantis",
  areaColor: "#7c3aed",
  people: [],
  ...extra,
});

const season = (extra: Partial<HarvestSeason> = {}): HarvestSeason => ({
  cycleId: "c",
  name: "Avalon Spring",
  startDate: "2026-03-01",
  endDate: "2026-03-31",
  intention: "Read the tide.",
  reflection: { l0: "The season held Avalon.", l1: "And the long walks." },
  days: [
    {
      date: "2026-03-01",
      moments: [harvestMoment("m1", "swim", "2026-03-01")],
    },
  ],
  momentCount: 1,
  ...extra,
});

describe("SeasonReadback", () => {
  it("names the season and its window", () => {
    render(<SeasonReadback season={season()} />);

    expect(screen.getByText("Avalon Spring")).toBeInTheDocument();
    expect(screen.getByText(/Mar 1 - 31/)).toBeInTheDocument();
  });

  it("shows what was intended and what the season held, both", () => {
    render(<SeasonReadback season={season()} />);

    expect(screen.getByText("Read the tide.")).toBeInTheDocument();
    expect(screen.getByText("The season held Avalon.")).toBeInTheDocument();
    expect(screen.getByText(/And the long walks\./)).toBeInTheDocument();
  });

  it("lists the moments planted, under their day", () => {
    render(
      <SeasonReadback
        season={season({
          days: [
            {
              date: "2026-03-01",
              moments: [
                harvestMoment("m1", "swim", "2026-03-01"),
                harvestMoment("m2", "write", "2026-03-01", {
                  phase: Phase.EVENING,
                  people: ["Ada", "Bea"],
                }),
              ],
            },
            {
              date: "2026-03-02",
              moments: [harvestMoment("m3", "walk", "2026-03-02")],
            },
          ],
          momentCount: 3,
        })}
      />,
    );

    expect(screen.getByText("swim")).toBeInTheDocument();
    expect(screen.getByText("write")).toBeInTheDocument();
    expect(screen.getByText("walk")).toBeInTheDocument();
    expect(screen.getByText(/Ada, Bea/)).toBeInTheDocument();
  });

  it("attributes colour to the area and nothing else", () => {
    const { container } = render(<SeasonReadback season={season()} />);

    const swatches = container.querySelectorAll("[data-area-swatch]");
    expect(swatches).toHaveLength(1);
    expect(swatches[0]).toHaveAttribute("data-area-id", "a");
  });

  it("renders a season with no reflection, no intention and no moments", () => {
    // Acceptance 1: never an error state.
    render(
      <SeasonReadback
        season={season({
          intention: null,
          reflection: null,
          days: [],
          momentCount: 0,
        })}
      />,
    );

    expect(screen.getByText("Avalon Spring")).toBeInTheDocument();
    expect(screen.queryByText("Read the tide.")).not.toBeInTheDocument();
  });

  it("reads back a reflection that is one line only", () => {
    render(
      <SeasonReadback
        season={season({ reflection: { l0: "One line, no more.", l1: "" } })}
      />,
    );

    expect(screen.getByText("One line, no more.")).toBeInTheDocument();
  });

  it("says so plainly when no season has closed yet", () => {
    render(<SeasonReadback season={null} />);

    expect(screen.getByText(/No season to read back yet/i)).toBeInTheDocument();
  });

  it("never scores the season — no progress bar, no percentage", () => {
    // Acceptance 4, held at the surface as well as in the view model.
    const { container } = render(<SeasonReadback season={season()} />);

    expect(container.querySelector("[role='progressbar']")).toBeNull();
    expect(container.querySelector("progress")).toBeNull();
    expect(container.textContent).not.toMatch(/%/);
  });
});
