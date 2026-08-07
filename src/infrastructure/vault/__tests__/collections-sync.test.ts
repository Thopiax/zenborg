import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPORTABLE_MODELS } from "@/domain/registry";

/**
 * Vault files the Rust side may touch that are NOT exportable collections.
 *
 * Everything in `ALLOWED_COLLECTIONS` is normally a `Record<uuid, Entity>` in
 * `DomainModelRegistry`. These are the deliberate exceptions: singleton files
 * with their own shape, reachable through the same generic Tauri commands
 * because Rust only ever moves opaque JSON strings.
 *
 * Adding a name here is a design decision, not a formality — it means the file
 * is intentionally outside export/import and the synced collection stores.
 */
const NON_COLLECTION_VAULT_FILES = [
  // { momentId, at } — the intention pointer. Written here and by the MCP
  // server's set_active_moment; read by keel to surface the intention in every
  // Claude Code session. Owned by src/infrastructure/vault/active-moment.ts.
  "activeMoment",
] as const;

/**
 * Asserts the Rust vault allow-list matches the TS exportable-models list,
 * plus the explicitly-listed singleton files. Drift between them means a
 * collection becomes unreachable from one side.
 */
describe("vault collections — Rust/TS parity", () => {
  it("ALLOWED_COLLECTIONS in fs.rs matches EXPORTABLE_MODELS + known singletons", () => {
    const rustSource = readFileSync(
      join(process.cwd(), "src-tauri/src/vault/fs.rs"),
      "utf-8"
    );

    const match = rustSource.match(
      /ALLOWED_COLLECTIONS:\s*&\[&str\]\s*=\s*&\[([\s\S]*?)\];/
    );
    expect(match, "Could not find ALLOWED_COLLECTIONS in fs.rs").toBeTruthy();

    const rustNames = [...(match![1].matchAll(/"([^"]+)"/g))].map((m) => m[1]);

    expect(rustNames.sort()).toEqual(
      [...EXPORTABLE_MODELS, ...NON_COLLECTION_VAULT_FILES].sort()
    );
  });

  it("singleton files stay out of the exportable collection registry", () => {
    for (const file of NON_COLLECTION_VAULT_FILES) {
      expect(
        [...EXPORTABLE_MODELS] as string[],
        `${file} is a singleton pointer, not a Record<uuid, Entity> — it must not join EXPORTABLE_MODELS`
      ).not.toContain(file);
    }
  });
});
