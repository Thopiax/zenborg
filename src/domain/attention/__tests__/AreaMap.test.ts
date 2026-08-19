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
};

function event(
  payload: Record<string, unknown>,
  surface = "agent",
): ActivityEvent {
  return {
    id: "e1",
    surface: surface as ActivityEvent["surface"],
    kind: "prompt",
    ts: 1_700_000_000_000,
    sessionId: "s1",
    payload,
  };
}

describe("resolveArea", () => {
  it("resolves a path to its area", () => {
    expect(
      resolveArea(
        map,
        event({ path: "/Users/rafa/Developer/themia/src/a.ts" }),
      ),
    ).toBe("area-themia");
  });

  it("prefers the longest matching prefix, so a nested repo wins over its parent", () => {
    expect(
      resolveArea(
        map,
        event({ path: "/Users/rafa/Developer/equanimitech/keel/src/x.ts" }),
      ),
    ).toBe("area-keel");
  });

  it("falls back to the parent prefix when no nested one matches", () => {
    expect(
      resolveArea(
        map,
        event({ path: "/Users/rafa/Developer/equanimitech/zenborg/src/x.ts" }),
      ),
    ).toBe("area-craft");
  });

  it("reads cwd when no path is present", () => {
    expect(
      resolveArea(map, event({ cwd: "/Users/rafa/Developer/themia" })),
    ).toBe("area-themia");
  });

  it("prefers an explicit path over cwd", () => {
    expect(
      resolveArea(
        map,
        event({
          path: "/Users/rafa/Developer/themia/x.ts",
          cwd: "/Users/rafa/Developer/equanimitech",
        }),
      ),
    ).toBe("area-themia");
  });

  it("resolves a host on the browser surface", () => {
    expect(resolveArea(map, event({ host: "chess.com" }, "browser"))).toBe(
      "area-leisure",
    );
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
    expect(resolveArea(map, event({ path: "/tmp/scratch" }))).toBeUndefined();
  });

  it("returns undefined when the payload carries no locator at all", () => {
    expect(resolveArea(map, event({}))).toBeUndefined();
  });

  it("does not match a path prefix that is only a string prefix, not a path boundary", () => {
    expect(
      resolveArea(
        map,
        event({ path: "/Users/rafa/Developer/themia-archive/x" }),
      ),
    ).toBeUndefined();
  });

  it("resolves the prefix directory itself", () => {
    expect(
      resolveArea(map, event({ path: "/Users/rafa/Developer/themia" })),
    ).toBe("area-themia");
  });

  it("ignores a non-string locator rather than throwing", () => {
    expect(resolveArea(map, event({ path: 42 }))).toBeUndefined();
  });
});
