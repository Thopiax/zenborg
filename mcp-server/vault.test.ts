import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectionPath,
  type Moment,
  readCollection,
  writeCollection,
} from "./vault.js";

const NOW = "2026-08-07T00:00:00.000Z";

function moment(overrides: Partial<Moment>): Moment {
  return {
    id: "m-1",
    name: "Deep work",
    areaId: "area-1",
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: null,
    day: null,
    order: 0,
    emoji: null,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "zenborg-vault-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("moment refs round-trip", () => {
  it("survives a write/read cycle unchanged", () => {
    const refs = [
      "https://linear.app/acme/issue/ABC-1",
      "things:///show?id=abc",
    ];
    writeCollection(root, "moments", { "m-1": moment({ refs }) });
    const read = readCollection(root, "moments");
    expect(read["m-1"].refs).toEqual(refs);
  });

  it("keeps the field absent when the moment refers to nothing", () => {
    writeCollection(root, "moments", { "m-1": moment({}) });
    const raw = JSON.parse(
      fs.readFileSync(collectionPath(root, "moments"), "utf8"),
    );
    expect("refs" in raw["m-1"]).toBe(false);
  });

  it("loads moments written before refs existed", () => {
    // Byte-for-byte what a pre-refs vault holds: no `refs` key at all.
    const legacy = {
      "m-legacy": {
        id: "m-legacy",
        name: "Meditation",
        areaId: "area-1",
        habitId: null,
        cycleId: null,
        cyclePlanId: null,
        phase: "MORNING",
        day: "2026-08-01",
        order: 0,
        emoji: null,
        tags: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    };
    fs.writeFileSync(
      collectionPath(root, "moments"),
      JSON.stringify(legacy, null, 2),
      "utf8",
    );

    const read = readCollection(root, "moments");
    expect(read["m-legacy"].name).toBe("Meditation");
    expect(read["m-legacy"].refs).toBeUndefined();

    // And it round-trips back out without acquiring the field.
    writeCollection(root, "moments", read);
    const raw = JSON.parse(
      fs.readFileSync(collectionPath(root, "moments"), "utf8"),
    );
    expect("refs" in raw["m-legacy"]).toBe(false);
  });
});
