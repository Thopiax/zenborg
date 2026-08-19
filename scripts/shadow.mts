#!/usr/bin/env node
/**
 * shadow — migration step 2, run against the real log.
 *
 * Derives discrepancy from keel's activity log and writes `discrepancy.json`.
 * Nothing reads that file: readers arrive at step 5. This is the step the spec
 * calls the one to protect, because it carries all the epistemic weight. The
 * model looked obviously right twice before and was wrong both times.
 *
 * Read-only apart from a single write, and `--dry` removes that too.
 *
 * Usage:
 *   node scripts/shadow.mts                today, and write the record
 *   node scripts/shadow.mts --days 14      the last fortnight
 *   node scripts/shadow.mts --dry          derive and report, write nothing
 *   node scripts/shadow.mts --gap 20       idle gap in minutes (default 15)
 *   node scripts/shadow.mts --init-map     propose an area map and exit
 *
 * The vault is resolved by `resolveVault`, so `--vault` and `KAIROS_HOME` work
 * exactly as they do for the MCP server. The area map lives beside the other
 * collections as `area-map.json`; without it nothing resolves, so `--init-map`
 * proposes one from the areas already in the garden and leaves it to be edited.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveVault } from "../mcp-server/vault.ts";
import type {
  ActivityLogPort,
  ClockPort,
  DiscrepancyRecord,
  DiscrepancyStorePort,
  GardenPort,
  Planting,
  ShadowDeps,
} from "../src/application/ports.ts";
import { runShadowMode } from "../src/application/use-cases/deriveDiscrepancies.ts";
import type { ActivityEvent } from "../src/domain/attention/ActivityEvent.ts";
import type { AreaMap } from "../src/domain/attention/AreaMap.ts";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string, fallback: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
};

const VAULT = resolveVault(process.argv).root;
const DAYS = Math.max(1, Number(opt("days", "1")));
const GAP_MINUTES = Math.max(1, Number(opt("gap", "15")));
const DRY = flag("dry");

if (!existsSync(VAULT)) {
  console.error(`vault not found: ${VAULT} (set KAIROS_HOME?)`);
  process.exit(1);
}

const readJson = <T,>(path: string, fallback: T): T => {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    console.error(`unreadable, treating as absent: ${path} (${String(error)})`);
    return fallback;
  }
};

const AREA_MAP_PATH = join(VAULT, "area-map.json");

interface VaultArea {
  readonly id: string;
  readonly name: string;
  readonly archived?: boolean;
}

/**
 * Propose a map by matching area names against directory names.
 *
 * A proposal, never a decision. Every row carries `guessed: true` so an
 * unreviewed guess cannot quietly become the thing drift is measured against.
 * A wrong prefix invents discrepancies for weeks and nothing downstream can
 * tell them from real ones.
 */
function proposeAreaMap(): void {
  const areas = Object.values(
    readJson<Record<string, VaultArea>>(join(VAULT, "areas.json"), {}),
  ).filter((a) => a.archived !== true);

  const dirs: string[] = [];
  const root = join(homedir(), "Developer");
  if (existsSync(root)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const here = join(root, entry.name);
      dirs.push(here);
      for (const sub of readdirSync(here, { withFileTypes: true })) {
        if (sub.isDirectory() && !sub.name.startsWith(".")) {
          dirs.push(join(here, sub.name));
        }
      }
    }
  }

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const paths = areas.map((area) => {
    const hit = dirs.find(
      (d) => slug(d.split("/").pop() ?? "") === slug(area.name),
    );
    return {
      prefix: hit ?? `TODO absolute path for ${area.name}`,
      areaId: area.id,
      areaName: area.name,
      guessed: true,
    };
  });

  console.log(JSON.stringify({ paths, hosts: [] }, null, 2));
  console.error(
    `\n${paths.length} area(s) proposed. Review every prefix, drop "guessed",` +
      `\nand save to ${AREA_MAP_PATH}. Rows left as TODO resolve to nothing.`,
  );
}

if (flag("init-map")) {
  proposeAreaMap();
  process.exit(0);
}

const areaMapFile = readJson<AreaMap | null>(AREA_MAP_PATH, null);
if (areaMapFile === null) {
  console.error(
    `no area map at ${AREA_MAP_PATH}.\n` +
      `Run: node scripts/shadow.mts --init-map > "${AREA_MAP_PATH}"`,
  );
  process.exit(1);
}
const areaMap: AreaMap = {
  paths: areaMapFile.paths ?? [],
  hosts: areaMapFile.hosts ?? [],
};
const unreviewed = areaMap.paths.filter(
  (p) =>
    (p as { guessed?: boolean }).guessed === true ||
    p.prefix.startsWith("TODO"),
);

const LOG_DIR = join(VAULT, "keel", "log");

const localDate = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Every daily bucket overlapping the window, on every surface keel writes. */
function readLog(from: number, to: number): readonly ActivityEvent[] {
  if (!existsSync(LOG_DIR)) return [];
  const events: ActivityEvent[] = [];
  for (let ts = from; ts <= to + DAY; ts += DAY) {
    for (const surface of ["agent", "browser"] as const) {
      const file = join(LOG_DIR, `${localDate(ts)}.${surface}.jsonl`);
      if (!existsSync(file)) continue;
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (line.trim() === "") continue;
        try {
          const parsed = JSON.parse(line) as ActivityEvent;
          // Older lines predate the surface field; the filename still carries it.
          events.push(parsed.surface ? parsed : { ...parsed, surface });
        } catch {
          // A torn line is one lost observation, not a reason to abandon the run.
        }
      }
    }
  }
  return events.filter((e) => e.ts >= from && e.ts < to);
}

interface VaultMoment {
  readonly id: string;
  readonly areaId: string;
  readonly day: string | null;
  readonly phase: string | null;
  /** "HH:MM", 24h. Absent on ambient moments. */
  readonly startTime?: string;
  readonly durationMin?: number;
}
interface VaultPhaseConfig {
  readonly phase: string;
  readonly startHour: number;
  readonly endHour: number;
}

const moments = Object.values(
  readJson<Record<string, VaultMoment>>(join(VAULT, "moments.json"), {}),
);
const phaseConfigs = Object.values(
  readJson<Record<string, VaultPhaseConfig>>(
    join(VAULT, "phaseConfigs.json"),
    {},
  ),
);

function phaseAt(instant: number): string | null {
  const hour = new Date(instant).getHours();
  for (const config of phaseConfigs) {
    const { startHour, endHour } = config;
    const inBand =
      endHour <= startHour
        ? hour >= startHour || hour < endHour
        : hour >= startHour && hour < endHour;
    if (inBand) return config.phase;
  }
  return null;
}

/** What the (day, phase) cell containing `instant` held. A set: a cell plants a lane. */
function plantingsAt(instant: number): Planting {
  const day = localDate(instant);
  const phase = phaseAt(instant);
  const planted = moments.filter((m) => m.day === day && m.phase === phase);
  return {
    momentIds: planted.map((m) => m.id),
    areaIds: [...new Set(planted.map((m) => m.areaId))],
  };
}

/**
 * Where the plan says one stretch ended and another began.
 *
 * Phase-band edges for every day in the window, plus the start and end of any
 * moment planted with a clock time. A therapy session in the afternoon ends the
 * morning's work whether or not the log went quiet across it, and nothing in
 * the log can know that. The plan can.
 */
function boundariesIn(from: number, to: number): readonly number[] {
  const out = new Set<number>();

  const atHour = (dayStart: Date, hour: number) => {
    const d = new Date(dayStart);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };

  for (let ts = from; ts <= to + DAY; ts += DAY) {
    const dayStart = new Date(ts);
    for (const config of phaseConfigs) {
      out.add(atHour(dayStart, config.startHour % 24));
      out.add(atHour(dayStart, config.endHour % 24));
    }
  }

  for (const moment of moments) {
    if (moment.day === null || moment.startTime === undefined) continue;
    const [h, m] = moment.startTime.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    const [y, mo, d] = moment.day.split("-").map(Number);
    const start = new Date(y, mo - 1, d, h, m, 0, 0).getTime();
    out.add(start);
    if (moment.durationMin !== undefined && moment.durationMin > 0) {
      out.add(start + moment.durationMin * MINUTE);
    }
  }

  return [...out].filter((b) => b >= from && b < to).sort((a, b) => a - b);
}

const now = Date.now();
const window = { from: now - DAYS * DAY, to: now };

const log: ActivityLogPort = { read: async (from, to) => readLog(from, to) };
const garden: GardenPort = {
  areaMap: async () => areaMap,
  plantingsAt: async (instant) => plantingsAt(instant),
  boundaries: async (from, to) => boundariesIn(from, to),
};
const store: DiscrepancyStorePort = {
  write: async (record: DiscrepancyRecord) => {
    if (DRY) return;
    writeFileSync(
      join(VAULT, "discrepancy.json"),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  },
};
const deps: ShadowDeps = {
  log,
  garden,
  store,
  clock: { now: () => now } satisfies ClockPort,
  span: { idleGapMs: GAP_MINUTES * MINUTE },
};

const record = await runShadowMode(deps, window);

const events = readLog(window.from, window.to);
const byArea = new Map<string, { count: number; magnitude: number }>();
for (const d of record.discrepancies) {
  const key = d.observedAreaId ?? "(unresolved)";
  const seen = byArea.get(key) ?? { count: 0, magnitude: 0 };
  byArea.set(key, {
    count: seen.count + 1,
    magnitude: seen.magnitude + d.magnitude,
  });
}

console.log(
  `window     ${localDate(window.from)} to ${localDate(window.to)} (${DAYS}d)`,
);
console.log(`events     ${events.length}`);
console.log(`idle gap   ${GAP_MINUTES}m`);
console.log(`boundaries ${boundariesIn(window.from, window.to).length}`);
console.log(`drifts     ${record.discrepancies.length}`);
console.log(`per day    ${(record.discrepancies.length / DAYS).toFixed(1)}`);

if (byArea.size > 0) {
  console.log("\nby observed area");
  const rows = [...byArea.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [area, s] of rows) {
    console.log(
      `  ${String(s.count).padStart(4)}  ${area}  (magnitude ${s.magnitude})`,
    );
  }
}

const magnitudes = record.discrepancies
  .map((d) => d.magnitude)
  .sort((a, b) => a - b);
if (magnitudes.length > 0) {
  const at = (q: number) => magnitudes[Math.floor(q * (magnitudes.length - 1))];
  console.log(
    `\nmagnitude  min ${magnitudes[0]}  p50 ${at(0.5)}  p90 ${at(0.9)}  max ${magnitudes.at(-1)}`,
  );
  console.log("no cut is applied: step 3 chooses one from this distribution.");
}

if (events.length === 0) {
  console.log(
    "\nno events in the window. Nothing to conclude from an empty log.",
  );
}
if (unreviewed.length > 0) {
  console.log(
    `\n${unreviewed.length} area-map row(s) still guessed or TODO. Every drift above is` +
      "\nsuspect until they are reviewed: a wrong prefix invents discrepancies.",
  );
}
console.log(
  DRY
    ? "\ndry run: the record was not written."
    : "\nwrote discrepancy.json. Nothing reads it, and that is the point.",
);
