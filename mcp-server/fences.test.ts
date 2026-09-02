import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sessionFenceRule } from "@zenborg/core/domain/intervention/rules/sessionFence";
import {
  expandHome,
  fencesPath,
  fencesStatePath,
  readCrossingTally,
  readFencesFile,
  writeFencesFile,
} from "./fences.js";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "zenborg-fences-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const fence = sessionFenceRule({
  id: "rule-1",
  label: "Themia data",
  description: "only Themia data this afternoon",
  serves: { cycleId: "cycle-1", areaId: "area-themia" },
  paths: ["/Users/rafa/Developer/themia"],
  encloses: ["area-themia"],
});

describe("fences collection I/O", () => {
  it("round-trips records keyed by id", () => {
    writeFencesFile(root, { "rule-1": fence });
    expect(readFencesFile(root)).toEqual({ "rule-1": fence });
  });

  it("an absent or empty file is an empty collection, not an error", () => {
    expect(readFencesFile(root)).toEqual({});
    fs.writeFileSync(fencesPath(root), "  \n");
    expect(readFencesFile(root)).toEqual({});
  });

  it("throws on malformed JSON — the writer must not fail soft to {} and clobber", () => {
    fs.writeFileSync(fencesPath(root), "{ not json");
    expect(() => readFencesFile(root)).toThrow(
      /Malformed JSON in fences\.json/,
    );
  });

  it("leaves no temp files behind — the write is rename-atomic", () => {
    writeFencesFile(root, { "rule-1": fence });
    expect(fs.readdirSync(root)).toEqual(["fences.json"]);
  });

  it("creates the vault root if it does not exist yet", () => {
    const fresh = path.join(root, "nested", "vault");
    writeFencesFile(fresh, {});
    expect(readFencesFile(fresh)).toEqual({});
  });
});

describe("crossing tally (plugin-owned, read-only, fail-soft)", () => {
  function writeState(value: unknown): void {
    const file = fencesStatePath(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  }

  it("reads what the hook writes", () => {
    writeState({ "rule-1": { crossings: 2, at: 1_700_000_000_000 } });
    expect(readCrossingTally(root)).toEqual({
      "rule-1": { crossings: 2, at: 1_700_000_000_000 },
    });
  });

  it("an absent tally is no crossings, never an error", () => {
    expect(readCrossingTally(root)).toEqual({});
  });

  it("garbled state means no crossings — a reader must not throw on someone else's file", () => {
    fs.mkdirSync(path.dirname(fencesStatePath(root)), { recursive: true });
    fs.writeFileSync(fencesStatePath(root), "{ nope");
    expect(readCrossingTally(root)).toEqual({});
  });

  it("drops entries without a usable count instead of coercing them", () => {
    writeState({
      good: { crossings: 1, at: 5 },
      bad: { crossings: "many" },
      negative: { crossings: -2, at: 5 },
    });
    expect(readCrossingTally(root)).toEqual({ good: { crossings: 1, at: 5 } });
  });
});

describe("expandHome", () => {
  it("expands a leading ~ to the home directory", () => {
    expect(expandHome("~/Developer/themia")).toBe(
      path.join(os.homedir(), "Developer/themia"),
    );
  });

  it("leaves absolute paths and interior tildes alone", () => {
    expect(expandHome("/w/themia")).toBe("/w/themia");
    expect(expandHome("/w/~backup")).toBe("/w/~backup");
  });
});
