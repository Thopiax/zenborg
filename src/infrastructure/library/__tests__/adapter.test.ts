import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...a: unknown[]) => invoke(...a),
}));

import { tauriLibrary, tauriNotebook } from "../adapter";

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

describe("the notebook: the pull the app absorbed from `wake sync`", () => {
  it("asks the app to pull, and hands back what happened", async () => {
    invoke.mockResolvedValue(
      "pulled lan into /ponds/journals; index marked stale",
    );

    const said = await tauriNotebook.pull();

    expect(invoke).toHaveBeenCalledWith("library_sync", {
      mode: undefined,
      ip: undefined,
      port: undefined,
    });
    expect(said).toMatch(/index marked stale/);
  });

  it("passes a pinned device through when LAN discovery is flaky", async () => {
    invoke.mockResolvedValue("pulled");

    await tauriNotebook.pull({ mode: "lan", ip: "192.168.1.9", port: 8089 });

    expect(invoke).toHaveBeenCalledWith("library_sync", {
      mode: "lan",
      ip: "192.168.1.9",
      port: 8089,
    });
  });

  it("surfaces a failed pull rather than reporting a quiet success", async () => {
    invoke.mockRejectedValue(
      "supynote CLI not found (install: `uv tool install supynote`)",
    );

    await expect(tauriNotebook.pull()).rejects.toThrow(/uv tool install/);
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

  /**
   * Step 5's data half added a *second port* rather than a second method, so
   * the tripwire above stays meaningful. It has the same discipline: writing
   * prose in is one verb, and a second one needs its own argument.
   */
  it("NotebookPort has exactly one method, and it is not on LibraryPort", () => {
    const ports = readFileSync(
      join(process.cwd(), "src/application/ports.ts"),
      "utf-8",
    );

    const port =
      ports.match(/interface NotebookPort \{([\s\S]*?)\n\}/)?.[1] ?? "";
    const methods = [...port.matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]);
    expect(methods).toEqual(["pull"]);
  });
});
