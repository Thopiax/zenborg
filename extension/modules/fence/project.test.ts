import { describe, expect, it, vi } from "vitest";

// `project.ts` also exports `syncFenceRules`, which pulls in `./store` and
// `../friction/cooldown/store` — both call `storage.defineItem` at module
// load, which throws outside a real extension environment (no `browser.runtime`).
// `buildDnrRules` never touches either, so these mocks exist only to keep the
// import graph loadable in plain vitest — see `../drogues/blocklist/sync.test.ts`
// for the same pattern against the modules this one replaces.
vi.mock("./store", () => ({ fenceCache: { getValue: async () => ({}) } }));
vi.mock("../friction/cooldown/store", () => ({ cooldownDomains: async () => [] }));

const { buildDnrRules } = await import("./project");

/**
 * `buildDnrRules` is the pure heart of the projector: two domain lists in,
 * DNR rules out, no chrome and no storage. `syncFenceRules` is the thin
 * wrapper that resolves those two lists from state and hands them here.
 */
describe("buildDnrRules", () => {
  it("projects standing blocks onto the BLOCK_RULE_ID rule", () => {
    const rules = buildDnrRules(["chess.com", "youtube.com"], []);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe(1);
    expect([...rules[0].condition.requestDomains].sort()).toEqual([
      "chess.com",
      "youtube.com",
    ]);
  });

  it("projects cooldown domains onto the COOLDOWN_RULE_ID rule", () => {
    const rules = buildDnrRules([], ["news.example.com"]);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe(2);
    expect(rules[0].condition.requestDomains).toEqual(["news.example.com"]);
  });

  it("emits both rules when both lists are non-empty", () => {
    const rules = buildDnrRules(["chess.com"], ["news.example.com"]);
    expect(rules.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  it("emits nothing when neither list has domains", () => {
    const rules = buildDnrRules([], []);
    expect(rules).toEqual([]);
  });
});
