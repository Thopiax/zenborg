// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { LibraryPort, NotebookPort, NoteHit } from "@/application/ports";
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

/**
 * Slice C step 5's data half: the garden is the writer of the notes now.
 *
 * `wake sync` pulled the device's handwriting into a pond, which left
 * `journals` with two instrument writers and the substrate's one-writer rule
 * with nothing to say. The app absorbed the pull, so the garden needs a way for
 * a person to ask for it — and the place to ask is the one place the garden
 * reads the journal at all.
 *
 * The notebook is a **second port**, not a second method on `LibraryPort`.
 * Bringing prose in is not a date and some text crossing a boundary; it is a
 * different relationship, and giving it its own interface is what keeps the
 * seam's tripwire meaningful instead of merely passed.
 */
describe("SeasonNotes: bringing in what the notebook holds", () => {
  const notebook = (
    pull: NotebookPort["pull"] = vi.fn().mockResolvedValue("pulled"),
  ): NotebookPort => ({ pull });

  it("offers nothing when no notebook was handed to it", async () => {
    render(
      <SeasonNotes
        endDate="2026-03-31"
        intention="Read the tide."
        library={library()}
        startDate="2026-03-01"
      />,
    );

    await screen.findByText(/nothing in the journal/i);
    expect(screen.queryByRole("button", { name: /notebook/i })).toBeNull();
  });

  it("pulls the notebook and then asks the journal again", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const pull = vi.fn().mockResolvedValue("pulled lan; index marked stale");

    render(
      <SeasonNotes
        endDate="2026-03-31"
        intention="Read the tide."
        library={library(search)}
        notebook={notebook(pull)}
        startDate="2026-03-01"
      />,
    );

    await screen.findByText(/nothing in the journal/i);
    expect(search).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /notebook/i }));

    // The pull writes prose and marks the index stale; the next read is what
    // pays for it. Asking again is how the person sees what just arrived.
    await waitFor(() => expect(pull).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  });

  it("says why a pull failed rather than looking like an empty season", async () => {
    render(
      <SeasonNotes
        endDate="2026-03-31"
        intention="Read the tide."
        library={library()}
        notebook={notebook(
          vi
            .fn()
            .mockRejectedValue(
              new Error(
                "supynote CLI not found (install: `uv tool install supynote`)",
              ),
            ),
        )}
        startDate="2026-03-01"
      />,
    );

    await screen.findByText(/nothing in the journal/i);
    fireEvent.click(screen.getByRole("button", { name: /notebook/i }));

    expect(
      await screen.findByText(/uv tool install supynote/),
    ).toBeInTheDocument();
  });

  it("does not ask twice while a pull is still running", async () => {
    let release: (value: string) => void = () => {};
    const pull = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        release = resolve;
      }),
    );

    render(
      <SeasonNotes
        endDate="2026-03-31"
        intention="Read the tide."
        library={library()}
        notebook={notebook(pull)}
        startDate="2026-03-01"
      />,
    );

    await screen.findByText(/nothing in the journal/i);
    const button = screen.getByRole("button", { name: /notebook/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(pull).toHaveBeenCalledTimes(1);

    release("pulled");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /bring in the notebook/i }),
      ).toBeEnabled(),
    );
  });
});
