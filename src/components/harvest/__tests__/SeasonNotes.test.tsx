// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { LibraryPort, NoteHit } from "@/application/ports";
import { SeasonNotes } from "../SeasonNotes";

globalThis.React = React;

/**
 * Slice C step 4: the one garden surface that reads the library.
 *
 * The payoff the whole slice was for. Harvest reads back what a season held,
 * and the season's own account of itself was in a journal the app had no way
 * to ask. This is the asking, and these tests are what "the seam holds under
 * two surfaces" means from the garden's side.
 *
 * The library is injected, never imported. The surface knows a port; the
 * composition root knows the adapter. That is what keeps the dependency
 * pointing one way and what makes this testable without Tauri.
 */

const library = (
  search: LibraryPort["search"] = vi.fn().mockResolvedValue([]),
): LibraryPort => ({ search });

const hit = (date: string, preview: string, score = 1): NoteHit => ({
  date,
  preview,
  score,
});

describe("SeasonNotes: the season's own account of itself", () => {
  it("asks the library about the intention, bounded by the season", async () => {
    const search = vi.fn().mockResolvedValue([]);

    render(
      <SeasonNotes
        endDate="2026-03-31"
        intention="Read the tide."
        library={library(search)}
        startDate="2026-03-01"
      />,
    );

    await screen.findByText(/nothing in the journal/i);

    expect(search).toHaveBeenCalledWith("Read the tide.", {
      limit: 5,
      since: "2026-03-01",
      until: "2026-03-31",
    });
  });

  it("leaves the window open when the season has not closed", async () => {
    const search = vi.fn().mockResolvedValue([]);

    render(
      <SeasonNotes
        endDate={null}
        intention="Read the tide."
        library={library(search)}
        startDate="2026-03-01"
      />,
    );

    await screen.findByText(/nothing in the journal/i);

    expect(search).toHaveBeenCalledWith("Read the tide.", {
      limit: 5,
      since: "2026-03-01",
      until: undefined,
    });
  });

  it("renders what was written: a date and the prose, unparsed", async () => {
    render(
      <SeasonNotes
        endDate="2026-03-31"
        intention="Read the tide."
        library={library(
          vi
            .fn()
            .mockResolvedValue([
              hit("2026-03-04", "the tide came in before I was ready", 4.2),
            ]),
        )}
        startDate="2026-03-01"
      />,
    );

    expect(
      await screen.findByText("the tide came in before I was ready"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mar 4/)).toBeInTheDocument();
  });

  it("never renders the score, because a match is not a verdict", async () => {
    const { container } = render(
      <SeasonNotes
        endDate="2026-03-31"
        intention="Read the tide."
        library={library(
          vi.fn().mockResolvedValue([hit("2026-03-04", "a line", 4.2)]),
        )}
        startDate="2026-03-01"
      />,
    );

    await screen.findByText("a line");
    expect(container.textContent).not.toMatch(/4\.2/);
  });

  it("says nothing was found without saying nothing happened", async () => {
    render(
      <SeasonNotes
        endDate="2026-03-31"
        intention="Read the tide."
        library={library()}
        startDate="2026-03-01"
      />,
    );

    expect(
      await screen.findByText(/nothing in the journal/i),
    ).toBeInTheDocument();
  });

  it("never asks when the season named no intention", () => {
    const search = vi.fn();

    const { container } = render(
      <SeasonNotes
        endDate="2026-03-31"
        intention={null}
        library={library(search)}
        startDate="2026-03-01"
      />,
    );

    expect(search).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a library failure rather than an empty journal", async () => {
    render(
      <SeasonNotes
        endDate="2026-03-31"
        intention="Read the tide."
        library={library(
          vi
            .fn()
            .mockRejectedValue(
              new Error("no ponds registered in ~/.wake/sources.yaml"),
            ),
        )}
        startDate="2026-03-01"
      />,
    );

    expect(await screen.findByText(/no ponds registered/)).toBeInTheDocument();
    expect(screen.queryByText(/nothing in the journal/i)).toBeNull();
  });
});
