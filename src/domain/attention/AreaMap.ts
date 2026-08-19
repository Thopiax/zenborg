import type { ActivityEvent } from "./ActivityEvent";
import type { AreaId } from "./ids";

/**
 * Resolves an observation to the plot of the garden it happened in.
 *
 * This is `area-map.json` widened from domains to paths, which is the one input
 * the area-drift rule needs that does not exist yet. Pure: the map is data the
 * caller loads, and this module only reads it.
 *
 * Deliberately conservative. An unresolvable event returns `undefined` rather
 * than a default area, because a wrong area is a false discrepancy and shadow
 * mode is trying to find out how many real ones there are.
 */

export interface PathRule {
  /** An absolute path prefix. Matched on path boundaries, never mid-segment. */
  readonly prefix: string;
  readonly areaId: AreaId;
}

export interface HostRule {
  /** A registrable host. Matched on label boundaries, so subdomains resolve to it. */
  readonly host: string;
  readonly areaId: AreaId;
}

export interface AreaMap {
  readonly paths: readonly PathRule[];
  readonly hosts: readonly HostRule[];
}

/**
 * Where the locator lives in an event payload.
 *
 * These keys are the shape keel's log is expected to carry, and they are the one
 * thing in this slice that could not be checked: the vault is unreadable without
 * a session launched with `KEEL_RAW=1`. Confirm them against a real log line
 * before shadow mode's output is trusted, and widen this list rather than
 * reshaping the resolver if the real keys differ.
 */
const PATH_KEYS = ["path", "cwd"] as const;
const HOST_KEYS = ["host", "domain"] as const;

function firstString(
  payload: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

/** True when `path` is `prefix` itself or sits beneath it. Never a mid-segment match. */
function underPrefix(path: string, prefix: string): boolean {
  if (path === prefix) return true;
  const boundary = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return path.startsWith(boundary);
}

/** True when `host` is `rule` itself or a subdomain of it. Never a lookalike suffix. */
function underHost(host: string, rule: string): boolean {
  return host === rule || host.endsWith(`.${rule}`);
}

/**
 * Resolve an event to an area, or `undefined` when nothing matches.
 *
 * The longest matching path prefix wins, so a repo nested inside another repo
 * resolves to its own plot rather than its parent's.
 */
export function resolveArea(
  map: AreaMap,
  event: ActivityEvent,
): AreaId | undefined {
  const path = firstString(event.payload, PATH_KEYS);
  if (path !== undefined) {
    let best: PathRule | undefined;
    for (const rule of map.paths) {
      if (!underPrefix(path, rule.prefix)) continue;
      if (best === undefined || rule.prefix.length > best.prefix.length) {
        best = rule;
      }
    }
    if (best !== undefined) return best.areaId;
  }

  const host = firstString(event.payload, HOST_KEYS);
  if (host !== undefined) {
    let best: HostRule | undefined;
    for (const rule of map.hosts) {
      if (!underHost(host, rule.host)) continue;
      if (best === undefined || rule.host.length > best.host.length) {
        best = rule;
      }
    }
    if (best !== undefined) return best.areaId;
  }

  return undefined;
}
