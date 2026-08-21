import { describe, expect, it } from "vitest";
import { carriesExit, type GateSpec } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import {
  FIVE_MINUTES,
  GAP_TAG,
  gapPracticeRule,
  PLACE_PREFIX,
  practicesForGap,
} from "../gapPractice";

const serves = { cycleId: "c-1", areaId: "area-themia" };

const rule = gapPracticeRule({
  id: "rule-gap-practice",
  name: "fill the gap",
  description: "the agent is working; the wait does not need filling",
  serves,
  staysOutOf: ["area-entertainement", "area-playful"],
});

// Shaped after the real garden: breathwork carries ["gap", "gap-2m"].
const habits = [
  { id: "h-breathwork", name: "breathwork", tags: ["gap", "gap-2m"] },
  { id: "h-vipassana", name: "Vipassana", tags: [] },
  { id: "h-qigong", name: "qi gong", tags: ["gap"] },
  { id: "h-look", name: "look out", tags: ["gap", "gap-30s"] },
  { id: "h-old", name: "retired", tags: ["gap", "gap-10s"], isArchived: true },
];

describe("gapPracticeRule", () => {
  it("produces a rule the validator accepts", () => {
    expect(validateRuleSpec(rule)).toEqual([]);
  });

  it("is still the only substitution", () => {
    expect(rule.mechanism).toBe("substitution");
  });

  it("names no practice — the garden defines, the rule references", () => {
    // The whole point of the rewrite: breathe.ts hardcoded three breaths while
    // a `breathwork` habit already existed, better described, with a Garmin story.
    expect(JSON.stringify(rule)).not.toMatch(/breath/i);
  });

  it("offers rather than restricts, and says so with confirmation", () => {
    const gate = rule.primitives[0] as GateSpec;
    expect(gate.frictionType).toEqual({ type: "confirmation" });
    expect(carriesExit(gate)).toBe(true);
    expect(gate.proceedAffordance.label).toBe("Skip");
  });

  it("fires on entry — the gap opening, which is an event and not a stretch", () => {
    const gate = rule.primitives[0] as GateSpec;
    expect(gate.trigger).toEqual({ type: "entry" });
  });

  it("claims an absence and bounds it where the drift excess ends", () => {
    expect(rule.outcome.measure).toEqual({
      kind: "no_span_matching",
      areaIds: ["area-entertainement", "area-playful"],
    });
    expect(rule.outcome.windowMs).toBe(FIVE_MINUTES);
  });
});

describe("practicesForGap", () => {
  it("takes only what the garden tagged for a gap", () => {
    const names = practicesForGap(habits).map((p) => p.name);
    expect(names).toContain("breathwork");
    expect(names).not.toContain("Vipassana"); // a 25-45min sit is not a gap filler
  });

  it("sorts smallest first, because the hole that drains is small", () => {
    // Drift excess sits at 15–60s; median time-to-first-drift is 38s. A
    // two-minute practice must never crowd out a thirty-second one.
    expect(practicesForGap(habits).map((p) => p.name)).toEqual([
      "look out",
      "breathwork",
      "qi gong",
    ]);
  });

  it("sorts unsized practices last — unknown is not small", () => {
    const last = practicesForGap(habits).at(-1);
    expect(last?.name).toBe("qi gong");
    expect(last?.fitsMs).toBeUndefined();
  });

  it("reads both second and minute sizings", () => {
    const by = Object.fromEntries(
      practicesForGap(habits).map((p) => [p.name, p.fitsMs]),
    );
    expect(by["look out"]).toBe(30_000);
    expect(by.breathwork).toBe(120_000);
  });

  it("skips archived practices", () => {
    expect(practicesForGap(habits).map((p) => p.habitId)).not.toContain("h-old");
  });

  it("can be bounded to what fits the gap it has", () => {
    // An unsized practice is never excluded by a bound it cannot be checked
    // against — that would silently drop the garden's untagged content.
    const short = practicesForGap(habits, 60_000).map((p) => p.name);
    expect(short).toEqual(["look out", "qi gong"]);
  });

  it("survives an empty or malformed garden", () => {
    expect(practicesForGap([])).toEqual([]);
    expect(practicesForGap([{ id: "x", name: "n" }])).toEqual([]);
    expect(practicesForGap([{ id: "x", name: "n", tags: null }])).toEqual([]);
  });

  it("matches the tag case-insensitively, since tags are typed by hand", () => {
    const found = practicesForGap([
      { id: "h", name: "walk", tags: [GAP_TAG.toUpperCase(), "GAP-1M"] },
    ]);
    expect(found).toEqual([{ habitId: "h", name: "walk", fitsMs: 60_000 }]);
  });
});

describe("practicesForGap, where the principal is", () => {
  // A synthetic roster, deliberately: fixtures never carry a real person's
  // places or practices. `rope climb` needs a climbing rope, and the rope is in
  // Harbor City, while the year is split with River City. `breathwork` needs
  // nothing and is most of the roster: every practice but two carries no place.
  const roster = [
    {
      id: "h-hang",
      name: "rope climb",
      tags: ["gap", "gap-30s", "place-harbor-city"],
    },
    { id: "h-breathwork", name: "breathwork", tags: ["gap", "gap-30s"] },
  ];

  const namesAt = (at?: string) =>
    practicesForGap(roster, undefined, at)
      .map((p) => p.name)
      .sort();

  it("keeps a Harbor City practice out of River City", () => {
    // The rope is on another continent. An offer he cannot take teaches him the
    // roster is not worth reading, which costs more than the offer was worth.
    expect(namesAt("river-city")).toEqual(["breathwork"]);
  });

  it("offers it where the equipment is", () => {
    expect(namesAt("harbor-city")).toEqual(["breathwork", "rope climb"]);
  });

  it("offers an unplaced practice in both cities", () => {
    expect(namesAt("river-city")).toContain("breathwork");
    expect(namesAt("harbor-city")).toContain("breathwork");
  });

  it("offers everything when the place is unknown", () => {
    expect(namesAt()).toEqual(["breathwork", "rope climb"]);
  });

  it("offers a practice tagged for both places in each of them", () => {
    const both = [
      {
        id: "h-walk",
        name: "walk out",
        tags: ["gap", "gap-1m", "place-harbor-city", "place-river-city"],
      },
    ];
    expect(practicesForGap(both, undefined, "river-city")).toHaveLength(1);
    expect(practicesForGap(both, undefined, "harbor-city")).toHaveLength(1);
    expect(practicesForGap(both, undefined, "lisbon")).toEqual([]);
  });

  it("reads the place however the edge spells it", () => {
    // Tags are typed by hand, and an edge holding `place-harbor-city` rather than
    // `harbor-city` names the same city. Either way in, or every placed practice
    // vanishes with nothing raised.
    expect(namesAt("Harbor-City")).toContain("rope climb");
    expect(namesAt(`${PLACE_PREFIX}harbor-city`)).toContain("rope climb");
  });

  it("still bounds a placed practice by the gap it has", () => {
    expect(practicesForGap(roster, 10_000, "harbor-city")).toEqual([]);
  });
});
