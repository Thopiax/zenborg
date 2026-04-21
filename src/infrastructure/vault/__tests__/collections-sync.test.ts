import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPORTABLE_MODELS } from "@/domain/registry";

/**
 * Asserts the Rust vault allow-list matches the TS exportable-models list.
 * Drift between them means a collection becomes unreachable from one side.
 */
describe("vault collections — Rust/TS parity", () => {
  it("ALLOWED_COLLECTIONS in fs.rs matches EXPORTABLE_MODELS", () => {
    const rustSource = readFileSync(
      join(process.cwd(), "src-tauri/src/vault/fs.rs"),
      "utf-8"
    );

    const match = rustSource.match(
      /ALLOWED_COLLECTIONS:\s*&\[&str\]\s*=\s*&\[([\s\S]*?)\];/
    );
    expect(match, "Could not find ALLOWED_COLLECTIONS in fs.rs").toBeTruthy();

    const rustNames = [...(match![1].matchAll(/"([^"]+)"/g))].map((m) => m[1]);

    expect(rustNames.sort()).toEqual([...EXPORTABLE_MODELS].sort());
  });
});
