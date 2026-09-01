/**
 * Watchlist mirror — the browser's copy of the observe tier.
 *
 * The manual watchlist is retired (2026-08-26): the observe tier a sensor
 * arm checks against is now *derived*, not maintained — `derivedObserveDomains`
 * reads `fenceCache` ∪ `areaMap` and merges them with `deriveObserveSet`
 * (`./derived.ts`). Domains on that set get DEEP sensors (key-action
 * completions); everything else gets coarse activity-writer logging only.
 *
 * `observeDomains` itself stays as a raw mirror the host still pushes to
 * (`replaceObserveDomains`, called from the relay) for backwards compat, but
 * nothing in the sensor arm flow reads it anymore — read `derivedObserveDomains()`
 * instead.
 *
 * Self-authored like the voice: kairos never ships entries. The one standing
 * exception is explicitly-consented and now lives in `~/.kairos/keel/rules/*.json`,
 * not in any shipped code.
 */

import { storage } from "wxt/storage";
import { normalizeDomain } from "../domains";
import { fenceCache } from "../fence/store";
import { areaMap } from "../friction/policy/store";
import { deriveObserveSet } from "./derived";

/** Observe-tier domains (normalized registrable hosts). */
export const observeDomains = storage.defineItem<string[]>(
  "local:watchlist:observe",
  { fallback: [] }
);

/**
 * The live observe tier: fence domains ∪ area-map domains, read fresh from
 * storage on every call. Replaces `observeDomains.getValue()` everywhere the
 * sensor arm flow decides what to watch — the gate itself stays in code, only
 * the membership list is now automatic.
 */
export async function derivedObserveDomains(): Promise<readonly string[]> {
  const [fences, map] = await Promise.all([fenceCache.getValue(), areaMap.getValue()]);
  return deriveObserveSet(fences, map);
}

/** Replace the whole observe list from the relay (config.json is source of
 * truth). Normalizes + dedupes; ignores malformed entries. */
export async function replaceObserveDomains(domains: readonly string[]): Promise<void> {
  const clean = [...new Set(domains.map((d) => normalizeDomain(d)).filter((d): d is string => !!d))];
  await observeDomains.setValue(clean);
}
