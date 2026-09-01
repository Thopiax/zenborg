import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "../ActivityEvent";
import { type AreaMap, resolveArea } from "../AreaMap";

const map: AreaMap = {
  paths: [
    { prefix: "/Users/rafa/Developer/equanimitech", areaId: "area-craft" },
    { prefix: "/Users/rafa/Developer/equanimitech/keel", areaId: "area-keel" },
    { prefix: "/Users/rafa/Developer/themia", areaId: "area-themia" },
  ],
  hosts: [
    { host: "github.com", areaId: "area-craft" },
    { host: "chess.com", areaId: "area-leisure" },
  ],
  apps: [
    { app: "Slack", areaId: "area-themia" },
    { app: "Linear", areaId: "area-themia" },
  ],
};

function event(
  payload: Record<string, unknown>,
  surface = "agent",
): ActivityEvent {
  return {
    id: "e1",
    surface: surface as ActivityEvent["surface"],
    kind: "tool_dispatched",
    ts: 1_700_000_000_000,
    sessionId: "s1",
    payload,
  };
}

/** The shape keel actually writes: raw Claude Code hook stdin, capped per field. */
const dispatch = (toolInput: Record<string, unknown>, cwd?: string) =>
  event({
    tool_name: "Edit",
    tool_input: toolInput,
    ...(cwd === undefined ? {} : { cwd }),
  });

describe("resolveArea", () => {
  it("resolves the edited file's path to its area", () => {
    expect(
      resolveArea(
        map,
        dispatch({ file_path: "/Users/rafa/Developer/themia/src/a.ts" }),
      ),
    ).toBe("area-themia");
  });

  it("prefers the longest matching prefix, so a nested repo wins over its parent", () => {
    expect(
      resolveArea(
        map,
        dispatch({
          file_path: "/Users/rafa/Developer/equanimitech/keel/src/x.ts",
        }),
      ),
    ).toBe("area-keel");
  });

  it("falls back to the parent prefix when no nested one matches", () => {
    expect(
      resolveArea(
        map,
        dispatch({
          file_path: "/Users/rafa/Developer/equanimitech/zenborg/src/x.ts",
        }),
      ),
    ).toBe("area-craft");
  });

  it("reads a notebook path too", () => {
    expect(
      resolveArea(
        map,
        dispatch({ notebook_path: "/Users/rafa/Developer/themia/n.ipynb" }),
      ),
    ).toBe("area-themia");
  });

  it("falls back to cwd when the tool input names no file", () => {
    expect(
      resolveArea(
        map,
        dispatch({ command: "ls" }, "/Users/rafa/Developer/themia"),
      ),
    ).toBe("area-themia");
  });

  it("prefers the touched file over cwd, which is what makes cross-area work visible", () => {
    expect(
      resolveArea(
        map,
        dispatch(
          { file_path: "/Users/rafa/Developer/themia/x.ts" },
          "/Users/rafa/Developer/equanimitech",
        ),
      ),
    ).toBe("area-themia");
  });

  it("reads cwd from an event carrying no tool input at all", () => {
    expect(
      resolveArea(map, event({ cwd: "/Users/rafa/Developer/themia" })),
    ).toBe("area-themia");
  });

  it("resolves a host on the browser surface", () => {
    expect(resolveArea(map, event({ host: "chess.com" }, "browser"))).toBe(
      "area-leisure",
    );
  });

  it("parses a host out of a url", () => {
    expect(
      resolveArea(
        map,
        event({ url: "https://chess.com/play/online" }, "browser"),
      ),
    ).toBe("area-leisure");
  });

  it("matches a host suffix, so a subdomain resolves to its parent", () => {
    expect(
      resolveArea(map, event({ host: "gist.github.com" }, "browser")),
    ).toBe("area-craft");
  });

  it("does not treat a lookalike suffix as a match", () => {
    expect(
      resolveArea(map, event({ host: "notgithub.com" }, "browser")),
    ).toBeUndefined();
  });

  it("returns undefined when nothing matches, rather than guessing", () => {
    expect(
      resolveArea(map, dispatch({ file_path: "/tmp/scratch" })),
    ).toBeUndefined();
  });

  it("returns undefined when the payload carries no locator at all", () => {
    expect(resolveArea(map, event({ tool_name: "Glob" }))).toBeUndefined();
  });

  it("does not match a path prefix that is only a string prefix, not a path boundary", () => {
    expect(
      resolveArea(
        map,
        dispatch({ file_path: "/Users/rafa/Developer/themia-archive/x" }),
      ),
    ).toBeUndefined();
  });

  it("resolves the prefix directory itself", () => {
    expect(
      resolveArea(map, dispatch({ file_path: "/Users/rafa/Developer/themia" })),
    ).toBe("area-themia");
  });

  it("ignores a non-string locator rather than throwing", () => {
    expect(resolveArea(map, dispatch({ file_path: 42 }))).toBeUndefined();
  });

  it("ignores a malformed url rather than throwing", () => {
    expect(
      resolveArea(map, event({ url: "not a url" }, "browser")),
    ).toBeUndefined();
  });

  it("ignores a non-object tool input rather than throwing", () => {
    expect(resolveArea(map, event({ tool_input: "oops" }))).toBeUndefined();
  });

  it("resolves a desktop app_name via app rules", () => {
    expect(
      resolveArea(map, event({ app_name: "Slack" }, "desktop")),
    ).toBe("area-themia");
  });

  it("prefers path over app_name when both are present", () => {
    expect(
      resolveArea(
        map,
        event(
          { app_name: "Slack", cwd: "/Users/rafa/Developer/equanimitech/keel" },
          "agent",
        ),
      ),
    ).toBe("area-keel");
  });

  it("returns undefined for an unmapped app_name", () => {
    expect(
      resolveArea(map, event({ app_name: "Calculator" }, "desktop")),
    ).toBeUndefined();
  });
});
