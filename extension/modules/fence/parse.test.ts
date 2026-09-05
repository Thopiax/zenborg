import { describe, expect, it } from "vitest";
import {
  fenceableHosts,
  exitLine,
  fencesFor,
  gatesFrom,
  parseFences,
  standingBlockHosts,
} from "./parse";
import type { Fence } from "./types";

/** A minimally well-formed standing host block, as the app projects one. */
function hostBlock(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "shield-youtube",
    label: "YouTube",
    domains: ["youtube.com"],
    enforcement: { kind: "cooldown", enforcement: "browser", standing: true },
    proceed: { label: "Lift it", action: { type: "out_of_band", note: "edit the rule file" } },
    deliveryProbability: 1,
    ...over,
  };
}

function dwell(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "gate-linkedin",
    label: "LinkedIn",
    domains: ["linkedin.com"],
    enforcement: {
      kind: "gate",
      everyMinutes: 20,
      friction: { type: "intention", prompt: "Still what you came for?" },
    },
    proceed: { label: "Keep going", action: { type: "continue" } },
    abort: { label: "Close the tab" },
    deliveryProbability: 1,
    ...over,
  };
}

describe("parseFences — malformed input never clears the cache", () => {
  it("returns null for a non-object push", () => {
    expect(parseFences(null)).toBeNull();
    expect(parseFences("nope")).toBeNull();
    expect(parseFences(42)).toBeNull();
    expect(parseFences(undefined)).toBeNull();
  });

  it("returns null for an array, which is not a record collection", () => {
    expect(parseFences([hostBlock()])).toBeNull();
  });

  it("honours an explicitly empty record — a deliberate lift must land", () => {
    expect(parseFences({})).toEqual({ fences: {}, refused: [] });
  });
});

describe("parseFences — invariant 6, no exit means no arming", () => {
  it("refuses an entry carrying no proceed affordance", () => {
    const parsed = parseFences({ a: hostBlock({ proceed: undefined }) });
    expect(parsed?.fences).toEqual({});
    expect(parsed?.refused).toEqual([{ id: "shield-youtube", reason: "no_exit" }]);
  });

  it("refuses an exit with no label — an invisible exit is not an exit", () => {
    const parsed = parseFences({
      a: hostBlock({ proceed: { label: "   ", action: { type: "continue" } } }),
    });
    expect(parsed?.fences).toEqual({});
    expect(parsed?.refused[0]?.reason).toBe("no_exit");
  });

  it("refuses an exit whose action is not one the extension can offer", () => {
    const parsed = parseFences({
      a: hostBlock({ proceed: { label: "Out", action: { type: "teleport" } } }),
    });
    expect(parsed?.fences).toEqual({});
    expect(parsed?.refused[0]?.reason).toBe("no_exit");
  });

  it("keeps the sound entries when one of several is exitless", () => {
    const parsed = parseFences({ a: hostBlock(), b: dwell({ proceed: undefined }) });
    expect(Object.keys(parsed?.fences ?? {})).toEqual(["shield-youtube"]);
    expect(parsed?.refused).toEqual([{ id: "gate-linkedin", reason: "no_exit" }]);
  });
});

describe("parseFences — shape", () => {
  it("accepts a standing browser block", () => {
    const parsed = parseFences({ "shield-youtube": hostBlock() });
    expect(parsed?.fences["shield-youtube"]).toEqual<Fence>({
      id: "shield-youtube",
      label: "YouTube",
      domains: ["youtube.com"],
      enforcement: { kind: "block", enforcement: "browser", standing: true },
      proceed: { label: "Lift it", action: { type: "out_of_band", note: "edit the rule file" } },
      deliveryProbability: 1,
    });
  });

  it("accepts a dwell gate with both affordances", () => {
    const parsed = parseFences({ "gate-linkedin": dwell() });
    const entry = parsed?.fences["gate-linkedin"];
    expect(entry?.enforcement).toEqual({
      kind: "gate",
      everyMinutes: 20,
      friction: { type: "intention", prompt: "Still what you came for?" },
    });
    expect(entry?.abort).toEqual({ label: "Close the tab" });
  });

  it("falls back to the record key when the entry omits its own id", () => {
    const parsed = parseFences({ "from-the-key": hostBlock({ id: undefined }) });
    expect(parsed?.fences["from-the-key"]?.id).toBe("from-the-key");
  });

  it("normalizes domains and drops the ones that are not hosts", () => {
    const parsed = parseFences({
      a: hostBlock({ domains: ["https://www.Chess.com/play", "not a domain", "chess.com"] }),
    });
    expect(parsed?.fences["shield-youtube"]?.domains).toEqual(["chess.com"]);
  });

  it("refuses an entry left with no domains at all", () => {
    const parsed = parseFences({ a: hostBlock({ domains: ["not a domain"] }) });
    expect(parsed?.fences).toEqual({});
    expect(parsed?.refused[0]?.reason).toBe("no_domains");
  });

  it("refuses an enforcement the extension cannot actuate", () => {
    const parsed = parseFences({ a: hostBlock({ enforcement: { kind: "intercept" } }) });
    expect(parsed?.fences).toEqual({});
    expect(parsed?.refused[0]?.reason).toBe("unactuatable");
  });

  it("clamps deliveryProbability and defaults it to 1", () => {
    expect(parseFences({ a: hostBlock({ deliveryProbability: 4 }) })?.fences["shield-youtube"]
      ?.deliveryProbability).toBe(1);
    expect(parseFences({ a: hostBlock({ deliveryProbability: -1 }) })?.fences["shield-youtube"]
      ?.deliveryProbability).toBe(0);
    expect(parseFences({ a: hostBlock({ deliveryProbability: undefined }) })?.fences[
      "shield-youtube"
    ]?.deliveryProbability).toBe(1);
  });
});

describe("reading the cache", () => {
  const fences = parseFences({ a: hostBlock(), b: dwell() })?.fences ?? {};

  it("fencesFor matches on the exact host", () => {
    expect(fencesFor(fences, "youtube.com").map((f) => f.id)).toEqual(["shield-youtube"]);
    expect(fencesFor(fences, "example.com")).toEqual([]);
  });

  it("fencesFor matches a subdomain, because DNR does too", () => {
    expect(fencesFor(fences, "m.youtube.com").map((f) => f.id)).toEqual(["shield-youtube"]);
  });

  it("fencesFor does not match a host that merely ends in the same letters", () => {
    expect(fencesFor(fences, "notyoutube.com")).toEqual([]);
  });

  it("standingBlockHosts carries only what this surface can enforce", () => {
    expect(standingBlockHosts(fences)).toEqual(["youtube.com"]);
  });

  it("standingBlockHosts skips resolver- and device-enforced blocks", () => {
    const resolver =
      parseFences({
        a: hostBlock({
          enforcement: { kind: "cooldown", enforcement: "resolver", standing: true },
        }),
      })?.fences ?? {};
    expect(standingBlockHosts(resolver)).toEqual([]);
  });

  it("fenceableHosts carries the timed blocks a gesture may arm, not the standing ones", () => {
    // The big red button's candidate set: a standing block is already held and
    // is deliberately not offered to the gesture.
    const timed =
      parseFences({
        a: hostBlock(),
        t: hostBlock({
          id: "watched",
          domains: ["news.example.com"],
          enforcement: { kind: "cooldown", enforcement: "browser", standing: false },
        }),
      })?.fences ?? {};
    expect(fenceableHosts(timed)).toEqual(["news.example.com"]);
    expect(fenceableHosts(fences)).toEqual([]);
  });

  it("gatesFrom extracts only the gate entries, in DwellGate shape", () => {
    expect(gatesFrom(fences)).toEqual([
      {
        ruleId: "gate-linkedin",
        domains: ["linkedin.com"],
        everyMinutes: 20,
        friction: { type: "intention", prompt: "Still what you came for?" },
        proceed: { label: "Keep going", action: { type: "continue" } },
        abort: { label: "Close the tab" },
      },
    ]);
    // The standing block on youtube is a block, not a gate.
  });

  it("a gate carrying a block-shaped exit degrades to continue, keeping its label", () => {
    const odd =
      parseFences({
        a: dwell({ proceed: { label: "Push on", action: { type: "wait" } } }),
      })?.fences ?? {};
    expect(gatesFrom(odd)[0]?.proceed).toEqual({
      label: "Push on",
      action: { type: "continue" },
    });
  });
});

describe("exitLine — the sentence the person reads", () => {
  it("says how a standing block is lifted", () => {
    const f = parseFences({ a: hostBlock() })?.fences["shield-youtube"] as Fence;
    expect(exitLine(f)).toBe("Lift it — edit the rule file");
  });

  it("says a wait is a wait", () => {
    const f = parseFences({
      a: hostBlock({ proceed: { label: "Wait it out", action: { type: "wait" } } }),
    })?.fences["shield-youtube"] as Fence;
    expect(exitLine(f)).toBe("Wait it out");
  });

  it("names the prompt an intention unlock asks for", () => {
    const f = parseFences({
      a: hostBlock({
        proceed: { label: "Unlock", action: { type: "intention", prompt: "What for?" } },
      }),
    })?.fences["shield-youtube"] as Fence;
    expect(exitLine(f)).toBe("Unlock — What for?");
  });

  it("names the cost of a delayed unlock", () => {
    const f = parseFences({
      a: hostBlock({
        proceed: { label: "Unlock", action: { type: "delay", seconds: 90 } },
      }),
    })?.fences["shield-youtube"] as Fence;
    expect(exitLine(f)).toBe("Unlock — after 90s");
  });

  it("names the destination of a redirect", () => {
    const f = parseFences({
      a: dwell({
        proceed: { label: "Move on", action: { type: "redirect", to: "https://example.com" } },
      }),
    })?.fences["gate-linkedin"] as Fence;
    expect(exitLine(f)).toBe("Move on — goes to https://example.com");
  });
});
