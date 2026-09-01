/**
 * Attention analytics — MCP tool handlers for the plan↔trace bridge.
 *
 * Read-only aggregates over keel's activity log. Privacy tier: minutes and
 * counts only, never window titles, URLs, prompts, or file paths beyond cwd.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { AreaMap } from "../src/domain/attention/AreaMap.ts";
import { resolveArea } from "../src/domain/attention/AreaMap.ts";
import {
  agentSessions,
  byArea,
  coverage,
  dwellRows,
  type DwellConfig,
} from "../src/domain/attention/AttentionSummary.ts";
import { logDir, readActivityLog } from "./activity-log.ts";
import type { Area } from "./vault.ts";

const DEFAULT_CAP_MS: Record<string, number> = {
  desktop: 30 * 60_000,
  agent: 5 * 60_000,
  browser: 15 * 60_000,
};

const DAY_START_HOUR = 4;

export function wakingDayWindow(day: string): { from: number; to: number } {
  const [y, m, d] = day.split("-").map(Number);
  const from = new Date(y, m - 1, d, DAY_START_HOUR, 0, 0, 0).getTime();
  const to = from + 24 * 60 * 60_000;
  return { from, to };
}

export function todayStr(): string {
  const now = new Date();
  const h = now.getHours();
  if (h < DAY_START_HOUR) {
    now.setDate(now.getDate() - 1);
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function resolveWindow(params: {
  day?: string;
  from?: string;
  to?: string;
}): { from: number; to: number; fromDay: string; toDay: string } {
  if (params.day) {
    const w = wakingDayWindow(params.day);
    return { ...w, fromDay: params.day, toDay: params.day };
  }
  const fromDay = params.from ?? todayStr();
  const toDay = params.to ?? fromDay;
  const from = wakingDayWindow(fromDay).from;
  const to = wakingDayWindow(toDay).to;
  return { from, to, fromDay, toDay };
}

function msToMin(ms: number): number {
  return Math.round(ms / 60_000);
}

function timeStr(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const AREA_MAP_PATH = "area-map.json";
const LEGACY_AREA_MAP_PATH = path.join("keel", "area-map.json");

export function loadAreaMap(vaultRoot: string): AreaMap {
  const mapFile = path.join(vaultRoot, AREA_MAP_PATH);
  let map: AreaMap = { paths: [], hosts: [], apps: [] };
  if (fs.existsSync(mapFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(mapFile, "utf8"));
      map = {
        paths: raw.paths ?? [],
        hosts: raw.hosts ?? [],
        apps: raw.apps ?? [],
      };
    } catch {
      // malformed map — treat as empty
    }
  }

  // ponytail: fold legacy keel/area-map.json (Record<domain, areaId>) into hosts;
  // delete the fold when the plugin's fence resolver reads the domain map
  const legacyFile = path.join(vaultRoot, LEGACY_AREA_MAP_PATH);
  if (fs.existsSync(legacyFile)) {
    try {
      const legacy = JSON.parse(
        fs.readFileSync(legacyFile, "utf8"),
      ) as Record<string, string>;
      const existingHosts = new Set(map.hosts.map((h) => h.host));
      const extra = Object.entries(legacy)
        .filter(([host]) => !existingHosts.has(host))
        .map(([host, areaId]) => ({ host, areaId }));
      if (extra.length > 0) {
        map = { ...map, hosts: [...map.hosts, ...extra] };
      }
    } catch {
      // legacy map unreadable — skip
    }
  }

  return map;
}

export function writeAreaMap(vaultRoot: string, map: AreaMap): void {
  const file = path.join(vaultRoot, AREA_MAP_PATH);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(map, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export interface AttentionResult {
  window: { from: string; to: string };
  coverage: Array<{
    surface: string;
    first?: string;
    last?: string;
    events: number;
  }>;
  surfaces: Array<{
    surface: string;
    byArea: Array<{
      areaId: string;
      areaName: string;
      minutes: number;
      visits: number;
    }>;
    unmapped: Array<{ locator: string; minutes: number; visits: number }>;
  }>;
  sessions?: Array<{
    sessionId: string;
    cwd?: string;
    start: string;
    end: string;
    minutes: number;
    prompts: number;
  }>;
}

export function getAttention(
  vaultRoot: string,
  areas: Record<string, Area>,
  params: {
    day?: string;
    from?: string;
    to?: string;
    surfaces?: string[];
    pathPrefix?: string;
  },
): AttentionResult {
  const window = resolveWindow(params);
  const areaMap = loadAreaMap(vaultRoot);
  const surfaces = (params.surfaces ?? [
    "desktop",
    "agent",
    "browser",
  ]) as Array<"desktop" | "agent" | "browser">;
  const dir = logDir(vaultRoot);
  const events = readActivityLog(dir, window.from, window.to, surfaces);

  const areaName = (id: string) =>
    areas[id]?.name ?? id;
  const resolver = (e: Parameters<typeof resolveArea>[1]) =>
    resolveArea(areaMap, e);

  const surfaceResults = surfaces.map((surface) => {
    const config: DwellConfig = {
      capMs: DEFAULT_CAP_MS[surface] ?? 30 * 60_000,
    };
    let rows = dwellRows(events, surface, resolver, config);

    if (params.pathPrefix && surface === "agent") {
      const prefix = params.pathPrefix.replace(/^~/, process.env.HOME ?? "~");
      rows = rows.filter(
        (r) => r.locator === prefix || r.locator.startsWith(`${prefix}/`),
      );
    }

    const mapped = byArea(rows);
    const unmapped = rows
      .filter((r) => r.areaId === undefined)
      .slice(0, 10);

    return {
      surface,
      byArea: mapped.map((a) => ({
        areaId: a.areaId,
        areaName: areaName(a.areaId),
        minutes: msToMin(a.ms),
        visits: a.visits,
      })),
      unmapped: unmapped.map((r) => ({
        locator: r.locator,
        minutes: msToMin(r.ms),
        visits: r.visits,
      })),
    };
  });

  const cov = coverage(events, surfaces).map((c) => ({
    surface: c.surface,
    ...(c.first !== undefined ? { first: timeStr(c.first) } : {}),
    ...(c.last !== undefined ? { last: timeStr(c.last) } : {}),
    events: c.events,
  }));

  const result: AttentionResult = {
    window: { from: window.fromDay, to: window.toDay },
    coverage: cov,
    surfaces: surfaceResults,
  };

  if (surfaces.includes("agent")) {
    const sessions = agentSessions(events);
    result.sessions = sessions.map((s) => ({
      sessionId: s.sessionId,
      ...(s.cwd ? { cwd: s.cwd } : {}),
      start: timeStr(s.start),
      end: timeStr(s.end),
      minutes: msToMin(s.end - s.start),
      prompts: s.prompts,
    }));
  }

  return result;
}

export interface AreaMapResult {
  paths: Array<{ prefix: string; areaId: string; areaName: string }>;
  hosts: Array<{ host: string; areaId: string; areaName: string }>;
  apps: Array<{ app: string; areaId: string; areaName: string }>;
  stale: Array<{ kind: string; key: string; areaId: string }>;
}

export function getAreaMap(
  vaultRoot: string,
  areas: Record<string, Area>,
): AreaMapResult {
  const map = loadAreaMap(vaultRoot);
  const areaIds = new Set(Object.keys(areas));
  const areaName = (id: string) => areas[id]?.name ?? id;
  const stale: AreaMapResult["stale"] = [];

  for (const r of map.paths) {
    if (!areaIds.has(r.areaId)) stale.push({ kind: "path", key: r.prefix, areaId: r.areaId });
  }
  for (const r of map.hosts) {
    if (!areaIds.has(r.areaId)) stale.push({ kind: "host", key: r.host, areaId: r.areaId });
  }
  for (const r of map.apps) {
    if (!areaIds.has(r.areaId)) stale.push({ kind: "app", key: r.app, areaId: r.areaId });
  }

  return {
    paths: map.paths.map((r) => ({ prefix: r.prefix, areaId: r.areaId, areaName: areaName(r.areaId) })),
    hosts: map.hosts.map((r) => ({ host: r.host, areaId: r.areaId, areaName: areaName(r.areaId) })),
    apps: map.apps.map((r) => ({ app: r.app, areaId: r.areaId, areaName: areaName(r.areaId) })),
    stale,
  };
}

export function mapArea(
  vaultRoot: string,
  areas: Record<string, Area>,
  params: { kind: string; key: string; area: string | null },
): { ok: boolean; message: string } {
  const map = loadAreaMap(vaultRoot);

  if (params.area === null) {
    let removed = false;
    const filter = <T extends { areaId: string }>(
      rules: readonly T[],
      match: (r: T) => boolean,
    ): T[] => {
      const result = rules.filter((r) => !match(r));
      if (result.length < rules.length) removed = true;
      return result;
    };

    let next: AreaMap;
    if (params.kind === "path") {
      next = { ...map, paths: filter(map.paths, (r) => r.prefix === params.key) };
    } else if (params.kind === "host") {
      next = { ...map, hosts: filter(map.hosts, (r) => r.host === params.key) };
    } else {
      next = { ...map, apps: filter(map.apps, (r) => r.app === params.key) };
    }

    if (!removed) return { ok: false, message: `No ${params.kind} rule for "${params.key}"` };
    writeAreaMap(vaultRoot, next);
    return { ok: true, message: `Removed ${params.kind} rule for "${params.key}"` };
  }

  const area = Object.values(areas).find(
    (a) => a.id === params.area || a.name.toLowerCase() === params.area!.toLowerCase(),
  );
  if (!area) return { ok: false, message: `Area not found: ${params.area}` };

  let next: AreaMap;
  if (params.kind === "path") {
    const filtered = map.paths.filter((r) => r.prefix !== params.key);
    next = { ...map, paths: [...filtered, { prefix: params.key, areaId: area.id }] };
  } else if (params.kind === "host") {
    const filtered = map.hosts.filter((r) => r.host !== params.key);
    next = { ...map, hosts: [...filtered, { host: params.key, areaId: area.id }] };
  } else {
    const filtered = map.apps.filter((r) => r.app !== params.key);
    next = { ...map, apps: [...filtered, { app: params.key, areaId: area.id }] };
  }

  writeAreaMap(vaultRoot, next);
  return { ok: true, message: `Mapped ${params.kind} "${params.key}" → ${area.name}` };
}
