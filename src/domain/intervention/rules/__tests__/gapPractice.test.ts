import { describe, expect, it } from "vitest";
import { carriesExit, type GateSpec } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import {
  FIVE_MINUTES,
  GAP_TAG,
  gapPracticeRule,
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
