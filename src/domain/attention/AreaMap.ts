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
 * keel writes the raw Claude Code hook stdin, capped per field, so the payload
 * carries `cwd` at the top level and the touched file nested under `tool_input`.
 * Read off `apps/agent/keel.mjs` and its log fixtures rather than off the vault,
 * which a normal session cannot read.
 *
 * The touched file wins over `cwd`, and that ordering is the whole point: a
 * session whose cwd is one repo while its edits land in another is exactly the
 * drift the rule is looking for, and reading `cwd` alone would hide it.
 *
 * A Bash `command` is deliberately not parsed for paths. Guessing a path out of
 * a shell string manufactures false areas, and `cwd` already covers the case.
 */
const TOOL_INPUT_KEYS = ["file_path", "notebook_path"] as const;
const CWD_KEYS = ["cwd"] as const;
const HOST_KEYS = ["host", "domain"] as const;
const URL_KEYS = ["url"] as const;

function firstString(
  source: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function toolInputOf(
  payload: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const raw = payload.tool_input;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  return raw as Readonly<Record<string, unknown>>;
}

/** The path this event touched, or the directory it ran in. */
function pathOf(
  payload: Readonly<Record<string, unknown>>,
): string | undefined {
  return (
    firstString(toolInputOf(payload), TOOL_INPUT_KEYS) ??
    firstString(payload, CWD_KEYS)
  );
}

/** The host this event touched. A malformed url is no locator, never a throw. */
function hostOf(
  payload: Readonly<Record<string, unknown>>,
): string | undefined {
  const direct = firstString(payload, HOST_KEYS);
  if (direct !== undefined) return direct;

  const url = firstString(payload, URL_KEYS);
  if (url === undefined) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
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
  const path = pathOf(event.payload);
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

  const host = hostOf(event.payload);
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
