import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...a: unknown[]) => invoke(...a),
}));

import { tauriLibrary } from "../adapter";

describe("LibraryPort — the app can read the notes", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("asks the library one question and returns dates and text", async () => {
    invoke.mockResolvedValue([
      {
        date: "2026-06-08",
        preview: "the season held more rest than I planned",
        score: 4.2,
      },
    ]);

    const hits = await tauriLibrary.search("rest");

    expect(invoke).toHaveBeenCalledWith("library_search", {
      query: "rest",
      limit: undefined,
      since: undefined,
      until: undefined,
    });
    expect(hits).toEqual([
      {
        date: "2026-06-08",
        preview: "the season held more rest than I planned",
        score: 4.2,
      },
    ]);
  });

  it("passes a season through as a date window", async () => {
    invoke.mockResolvedValue([]);

    await tauriLibrary.search("rest", {
      limit: 5,
      since: "2026-04-01",
      until: "2026-06-30",
    });

    expect(invoke).toHaveBeenCalledWith("library_search", {
      query: "rest",
      limit: 5,
      since: "2026-04-01",
      until: "2026-06-30",
    });
  });

  it("surfaces a library failure rather than swallowing it", async () => {
    invoke.mockRejectedValue("no ponds registered in ~/.wake/sources.yaml");

    await expect(tauriLibrary.search("rest")).rejects.toThrow(
      /no ponds registered/,
    );
  });
});

describe("the seam carries dates and text, and nothing else", () => {
  /**
   * The port's whole argument is that one method with three scalar fields
   * needs no translation, and therefore no context map. A fourth field, or a
   * second method, is a concept crossing the boundary and needs the same
   * argument made again in a design of its own. This test is the tripwire.
   */
  it("LibraryPort has exactly one method and NoteHit exactly three fields", () => {
    const ports = readFileSync(
      join(process.cwd(), "src/application/ports.ts"),
      "utf-8",
    );

    const noteHit = ports.match(/type NoteHit = \{([\s\S]*?)\n\};/)?.[1] ?? "";
    const fields = [...noteHit.matchAll(/readonly (\w+)(\?)?:/g)].map(
      (m) => m[1],
    );
    expect(fields).toEqual(["date", "preview", "score"]);

    const port =
      ports.match(/interface LibraryPort \{([\s\S]*?)\n\}/)?.[1] ?? "";
    const methods = [...port.matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]);
    expect(methods).toEqual(["search"]);
  });
});
