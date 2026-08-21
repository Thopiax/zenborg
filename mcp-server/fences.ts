import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type {
  CrossingRecord,
  CrossingTallyPort,
  FenceStorePort,
} from "../src/application/ports.ts";
import type { RuleSpec } from "../src/domain/intervention/RuleSpec.ts";

/**
 * Vault I/O for the `fences` collection and the plugin's crossing tally.
 *
 * `fences` is a kernel root collection (`{vaultRoot}/fences.json`, records
 * keyed by id) whose writer is zenborg — this server is that writer. It is
 * deliberately NOT in `vault.ts`'s `COLLECTION_NAMES`: that registry mirrors
 * the collections whose record shapes the desktop app owns, while a fence's
 * record shape is the domain's `RuleSpec`, imported here directly so there is
 * no second copy to drift. (The plugin hook, `plugin/hooks/fences.mts`, made
 * the same call for the same reason.) Keeping it out of the registry also
 * keeps it out of export/import, which has never carried it.
 *
 * Reads by this writer THROW on malformed JSON rather than failing soft the
 * way the hook does. The hook is a reader: garbled state must never trap the
 * person mid-session. This file is the writer: failing soft to `{}` and then
 * writing would silently destroy every standing fence, which is worse than an
 * error message.
 */

export const FENCES_FILE = "fences.json";
/** Plugin-owned runtime state — this server only ever reads it. */
export const FENCES_STATE_FILE = path.join("plugin", "fences-state.json");

export function fencesPath(root: string): string {
  return path.join(root, FENCES_FILE);
}

export function fencesStatePath(root: string): string {
  return path.join(root, FENCES_STATE_FILE);
}

export function readFencesFile(root: string): Record<string, RuleSpec> {
  const file = fencesPath(root);
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, RuleSpec>;
  } catch (error) {
    throw new Error(
      `Malformed JSON in ${FENCES_FILE} at ${file}: ${(error as Error).message}`,
    );
  }
}

/** Atomic write: temp file in the same directory, then rename — same
 * semantics as `writeCollection`, so watchers see one event and readers
 * never catch a half-written collection. */
export function writeFencesFile(
  root: string,
  all: Record<string, RuleSpec>,
): void {
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  const file = fencesPath(root);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

/**
 * The crossing tally, fail-soft: this is a read of someone else's runtime
 * state, and a garbled tally means "no crossings recorded", never an error.
 * Entries that don't carry a numeric `crossings` are dropped rather than
 * coerced into lies.
 */
export function readCrossingTally(
  root: string,
): Record<string, CrossingRecord> {
  try {
    const raw = JSON.parse(
      fs.readFileSync(fencesStatePath(root), "utf8"),
    ) as Record<string, { crossings?: unknown; at?: unknown }>;
    const tally: Record<string, CrossingRecord> = {};
    for (const [id, entry] of Object.entries(raw ?? {})) {
      const crossings = Number(entry?.crossings);
      if (!Number.isFinite(crossings) || crossings < 0) continue;
      const at = Number(entry?.at);
      tally[id] = { crossings, at: Number.isFinite(at) ? at : 0 };
    }
    return tally;
  } catch {
    return {};
  }
}

export function fenceStore(root: string): FenceStorePort {
  return {
    read: async () => readFencesFile(root),
    write: async (all) => writeFencesFile(root, all),
  };
}

export function crossingTally(root: string): CrossingTallyPort {
  return {
    read: async () => readCrossingTally(root),
  };
}

/** `~` is a machine fact the principal speaks in; the rule stores what the
 * enforcing hook can match, which is an absolute path. Expanding it here —
 * in the adapter — keeps the application layer ignorant of whose machine
 * this is. */
export function expandHome(p: string): string {
  return p.replace(/^~(?=\/|$)/, os.homedir());
}
