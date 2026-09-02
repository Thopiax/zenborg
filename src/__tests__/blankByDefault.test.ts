import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as hostBlock from "@zenborg/core/domain/intervention/rules/hostBlock";

/**
 * Blank by default, made checkable.
 *
 * Nearly everything ships blank here because there is no seeder to
 * misconfigure: areas, habits, gap practices, the watchlist and the blocklist
 * are guaranteed empty by the *absence of a code path* rather than by anyone
 * remembering to clear a value. That is the strongest guarantee available and
 * it needs no test.
 *
 * What needs a test is the opposite case: a value somebody typed. A host list,
 * a seeded area, a promise in a comment. Each is one edit away from being one
 * person's life again, and nothing but this file notices. So this asserts what
 * a peer receives on a fresh install: no hosts, no areas, no habits, and a
 * comment that describes the empty state truthfully.
 *
 * The fourth thing a peer receives, the plugin's sample config, lives in
 * another repo and is pinned there by the matching tests in
 * `keel/apps/agent/neutral.test.mjs` ("the sample ships no one's voice").
 */

const repoRoot = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(repoRoot, p), "utf8");

/** A registrable host, loosely. Wide enough to catch a list somebody typed. */
const HOSTNAME = /\b[a-z0-9-]+\.(com|org|net|io|dev|tv|gg|co|be|in)\b/;

const serves = { cycleId: "c-1", areaId: "area-craft" };

describe("a fresh install ships no hosts", () => {
  it("exports no host list from the domain", () => {
    const lists: Record<string, readonly string[]> = {};
    for (const [name, value] of Object.entries(hostBlock)) {
      if (!Array.isArray(value)) continue;
      const hosts = value.filter(
        (v): v is string => typeof v === "string" && HOSTNAME.test(v),
      );
      if (hosts.length > 0) lists[name] = hosts;
    }
    expect(lists).toEqual({});
  });

  it("has no default list to fall back to: an empty seed builds no rules", () => {
    expect(
      hostBlock.hostBlockSeedRules({
        serves,
        returnsTo: ["area-craft"],
        unlockNote: "out of band",
        hosts: [],
      }),
    ).toEqual([]);
  });

  it("keeps the concrete list at the composition edge, where one person's ids live", () => {
    const seed = path.join(repoRoot, "scripts/host-block-seed.hosts.json");
    expect(existsSync(seed)).toBe(true);
    const parsed = JSON.parse(readFileSync(seed, "utf8"));
    expect(parsed.hosts.map((h: { host: string }) => h.host)).toEqual([
      "youtube.com",
      "chess.com",
      "lichess.org",
    ]);
  });

  it("is reached by the seed script and by nothing the app ships", () => {
    expect(read("scripts/host-block-seed.mts")).toMatch(
      /host-block-seed\.hosts\.json/,
    );
    expect(read("packages/core/domain/intervention/rules/hostBlock.ts")).not.toMatch(
      HOSTNAME,
    );
  });
});

describe("a fresh install ships no areas and no habits", () => {
  const source = read("src/infrastructure/state/initialize.ts");
  const firstRun = source.slice(
    source.indexOf("First run: seed default data"),
    source.indexOf("Initialization complete"),
  );

  it("finds a first-run path to read", () => {
    expect(firstRun.length).toBeGreaterThan(0);
  });

  it("writes no area on first run", () => {
    expect(firstRun).not.toMatch(/areas\$/);
  });

  it("writes no habit on first run", () => {
    expect(firstRun).not.toMatch(/habits\$/);
  });

  it("seeds only the structural scaffolding: four phase bands and one cycle", () => {
    expect(firstRun).toMatch(/phaseConfigs\$/);
    expect(firstRun).toMatch(/cycles\$/);
  });

  it("promises no onboarding it does not have", () => {
    // The file used to say areas are unseeded because "users must create their
    // first area from templates in the AreaSelector". There are no templates;
    // AreaSelector is a create-your-own combobox. A stale promise in the file
    // that documents the empty state is how the empty state stays undesigned.
    expect(source).not.toMatch(/template/i);
  });

  it("describes what it actually creates", () => {
    expect(source).not.toMatch(/Create 5 default areas/);
    expect(source).not.toMatch(/default areas, phases, and cycle/);
  });
});
