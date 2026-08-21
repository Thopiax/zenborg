"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryPort, NotebookPort, NoteHit } from "@/application/ports";
import { getDateLabel } from "@/lib/dates";

/**
 * SeasonNotes: what the journal says about this season's intention.
 *
 * Slice C's whole payoff, and the only surface in the garden that reads the
 * library. Harvest reads back what a season held; until now the season's own
 * account of itself lived in a journal the app had no way to ask. This asks.
 *
 * **What crosses the seam here is a date and some text.** The query is the
 * season's intention, which is text the garden already holds. The window is
 * the season's own two dates. What comes back is dates and prose. Nothing is
 * parsed, nothing is joined to a moment, and nothing here knows that an entry,
 * a blueprint or a knowledge graph exists.
 *
 * **The port is injected, never imported.** The composition root supplies the
 * adapter; this component knows an interface. Omit `library` and the section
 * does not render at all, which is how every surface that does not want the
 * notes stays a surface that cannot reach them.
 *
 * **No score renders.** The port carries one because ranking is how a search
 * orders itself, but harvest never returns a verdict (`docs/principles.md`
 * Red Lines). A relevance number beside your own words is a verdict.
 *
 * **The notebook is optional and separate.** Step 5's data half made the app
 * the writer of the notes, so a person needs somewhere to ask for the pull, and
 * the place to ask is the one place the garden reads the journal at all. It
 * arrives as its own port: a surface handed only a `LibraryPort` still cannot
 * write, and the seam stays one method wide. Omit `notebook` and nothing is
 * offered.
 */
export function SeasonNotes({
  intention,
  startDate,
  endDate,
  library,
  notebook,
}: {
  /** The season's intention. Null means no question to ask, so none is asked. */
  readonly intention: string | null;
  readonly startDate: string;
  /** Null while the season is still open, and the window stays open with it. */
  readonly endDate: string | null;
  readonly library: LibraryPort;
  /** Omit and no pull is offered. Injected, never imported, like the library. */
  readonly notebook?: NotebookPort;
}) {
  const [state, setState] = useState<
    | { readonly kind: "asking" }
    | { readonly kind: "answered"; readonly hits: readonly NoteHit[] }
    | { readonly kind: "unreachable"; readonly why: string }
  >({ kind: "asking" });

  const [pull, setPull] = useState<
    | { readonly kind: "idle" }
    | { readonly kind: "pulling" }
    | { readonly kind: "failed"; readonly why: string }
  >({ kind: "idle" });

  // Which question is the current one. An answer to an abandoned question --
  // the season changed, or a later ask overtook this one -- is discarded rather
  // than rendered, so what is on screen is always the answer to what is asked.
  const current = useRef(0);

  const ask = useCallback(() => {
    if (!intention) {
      return;
    }

    current.current += 1;
    const mine = current.current;
    setState({ kind: "asking" });

    library
      .search(intention, {
        limit: 5,
        since: startDate,
        until: endDate ?? undefined,
      })
      .then((hits) => {
        if (mine === current.current) {
          setState({ kind: "answered", hits });
        }
      })
      .catch((error: unknown) => {
        if (mine === current.current) {
          setState({
            kind: "unreachable",
            why: error instanceof Error ? error.message : String(error),
          });
        }
      });
  }, [intention, startDate, endDate, library]);

  /**
   * Bring in what the notebook holds, then ask the journal again.
   *
   * Asking again is not a refresh for its own sake. The pull writes prose and
   * marks the index stale; the next read is what pays for that staleness. So
   * the second ask is how what just arrived becomes visible, and it is the
   * whole loop -- write, mark, read, pay -- running once in front of a person.
   */
  const bringInTheNotebook = useCallback(() => {
    if (!notebook || pull.kind === "pulling") {
      return;
    }

    setPull({ kind: "pulling" });
    notebook
      .pull()
      .then(() => {
        setPull({ kind: "idle" });
        ask();
      })
      .catch((error: unknown) => {
        setPull({
          kind: "failed",
          why: error instanceof Error ? error.message : String(error),
        });
      });
  }, [notebook, pull.kind, ask]);

  useEffect(() => {
    ask();
    // Leaving, or a new season: abandon whatever is still in flight.
    return () => {
      current.current += 1;
    };
  }, [ask]);

  if (!intention) {
    return null;
  }

  return (
    <section className="border-t border-stone-200 pt-8 dark:border-stone-800">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500">
          From the journal
        </h2>

        {notebook && (
          <button
            className="text-xs text-stone-400 underline-offset-4 hover:underline disabled:no-underline disabled:opacity-60 dark:text-stone-500"
            disabled={pull.kind === "pulling"}
            onClick={bringInTheNotebook}
            type="button"
          >
            {pull.kind === "pulling"
              ? "Bringing in the notebook…"
              : "Bring in the notebook"}
          </button>
        )}
      </div>

      {/*
        A pull that failed is not an empty season either. The device being
        unreachable and having written nothing are different facts, and only
        one of them is about the person.
      */}
      {pull.kind === "failed" && (
        <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
          The notebook could not be brought in. {pull.why}
        </p>
      )}

      {state.kind === "asking" && (
        <p className="mt-4 text-sm text-stone-400 dark:text-stone-500">
          Reading the journal…
        </p>
      )}

      {/*
        A failure and an empty season are different answers, and a surface
        that cannot tell them apart will quietly show the wrong one. An
        unregistered pond is not evidence that you wrote nothing.
      */}
      {state.kind === "unreachable" && (
        <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
          The journal could not be read. {state.why}
        </p>
      )}

      {state.kind === "answered" &&
        (state.hits.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
            Nothing in the journal from this season names this intention.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {state.hits.map((h) => (
              <li key={`${h.date}-${h.preview}`}>
                <h3 className="text-xs text-stone-400 dark:text-stone-500">
                  {getDateLabel(h.date)}
                </h3>
                <p className="mt-1 leading-relaxed text-stone-700 dark:text-stone-300">
                  {h.preview}
                </p>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
