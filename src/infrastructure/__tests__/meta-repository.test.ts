// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultMeta,
  readMeta,
  writeMeta,
  clearMetaCache,
} from "../vault/meta-repository";

describe("meta-repository", () => {
  beforeEach(() => {
    localStorage.clear();
    clearMetaCache();
  });

  it("returns defaultMeta when nothing persisted", () => {
    const meta = readMeta();
    expect(meta).toEqual(defaultMeta());
    expect(meta.migrations.derivedDeck).toBe(false);
  });

  it("persists a written meta and returns it on read", () => {
    const meta = defaultMeta();
    meta.migrations.derivedDeck = true;
    writeMeta(meta);
    clearMetaCache();
    expect(readMeta().migrations.derivedDeck).toBe(true);
  });

  it("merges unknown legacy keys into defaults without crashing", () => {
    localStorage.setItem(
      "zenborg:meta",
      JSON.stringify({ migrations: { oldThing: true } }),
    );
    clearMetaCache();
    const meta = readMeta();
    expect(meta.migrations.derivedDeck).toBe(false);
  });
});
