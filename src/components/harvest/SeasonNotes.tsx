"use client";

import { useEffect, useState } from "react";
import type { LibraryPort, NoteHit } from "@/application/ports";
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
 */
export function SeasonNotes({
  intention,
  startDate,
  endDate,
  library,
}: {
  /** The season's intention. Null means no question to ask, so none is asked. */
  readonly intention: string | null;
  readonly startDate: string;
  /** Null while the season is still open, and the window stays open with it. */
  readonly endDate: string | null;
  readonly library: LibraryPort;
}) {
  const [state, setState] = useState<
    | { readonly kind: "asking" }
    | { readonly kind: "answered"; readonly hits: readonly NoteHit[] }
    | { readonly kind: "unreachable"; readonly why: string }
  >({ kind: "asking" });

  useEffect(() => {
    if (!intention) {
      return;
    }

    let live = true;

    library
      .search(intention, {
        limit: 5,
        since: startDate,
        until: endDate ?? undefined,
      })
      .then((hits) => {
        if (live) {
          setState({ kind: "answered", hits });
        }
      })
      .catch((error: unknown) => {
        if (live) {
          setState({
            kind: "unreachable",
            why: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      live = false;
    };
  }, [intention, startDate, endDate, library]);

  if (!intention) {
    return null;
  }

  return (
    <section className="border-t border-stone-200 pt-8 dark:border-stone-800">
      <h2 className="text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500">
        From the journal
      </h2>

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
