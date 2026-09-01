/**
 * The fence cache, on disk in `chrome.storage.local`.
 *
 * `parse.ts` decides what is well-formed; this file decides what persists. Two
 * items and one rule:
 *
 *   **A malformed push leaves the cache alone; an empty one lifts.**
 *
 * That asymmetry is the whole reliability claim. A dead or downgraded host must
 * not read as "nothing is armed" — the fences would drop exactly when the
 * machine is least healthy — but taking a fence down has to land, or the person
 * is trapped by a mirror nobody can edit. `parseFences` returns `null` for the
 * first case and `{}` for the second, and `replaceFences` honours both.
 *
 * `fencePushedAt` records freshness rather than validity: the cache is
 * authoritative whatever its age, and the timestamp exists so a surface can say
 * how long it has been since the app last spoke.
 */

import { storage } from "wxt/storage";
import { parseFences } from "./parse";
import { writeInspection } from "./inspect";
import type { Fences, Refusal } from "./types";

/** What is in force right now, keyed by fence id. */
export const fenceCache = storage.defineItem<Fences>("local:fence:record", { fallback: {} });

/** When the app last pushed. 0 means never — not "stale", just never. */
export const fencePushedAt = storage.defineItem<number>("local:fence:pushedAt", { fallback: 0 });

/**
 * Entries the last push was refused for, kept so the failure is visible.
 *
 * An invariant-6 refusal is a bug in the rule that armed it, and a bug nobody
 * can see is one that ships. This is the surface that lets the manage page —
 * or a person reading storage — find out why a fence they declared is not
 * holding, instead of concluding the extension is broken.
 */
export const fenceRefusals = storage.defineItem<Refusal[]>("local:fence:refused", {
  fallback: [],
});

export interface FenceWriteResult {
  readonly accepted: number;
  readonly refused: readonly Refusal[];
  /** False when the push was malformed and the previous cache was kept. */
  readonly applied: boolean;
}

/** Apply a pushed fences record. Returns what landed, for logging. */
export async function replaceFences(
  raw: unknown,
  now: number = Date.now()
): Promise<FenceWriteResult> {
  const parsed = parseFences(raw);
  if (parsed === null) {
    // Not a record collection. Keep what we have — see the rule above.
    return { accepted: 0, refused: [], applied: false };
  }
  await fenceCache.setValue(parsed.fences);
  await fenceRefusals.setValue([...parsed.refused]);
  await fencePushedAt.setValue(now);
  await writeInspection();
  return {
    accepted: Object.keys(parsed.fences).length,
    refused: parsed.refused,
    applied: true,
  };
}
