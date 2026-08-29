#!/usr/bin/env node
/**
 * garmin-report — read-only by default.
 *
 * Three questions, one command:
 *   1. Which Garmin activities does the garden already have a habit for?
 *   2. Have the phase bands drifted away from the sleep actually being slept?
 *   3. (--plant-sleep) Plant sleep nights as moments so the calendar sidecar
 *      publishes them to Apple Calendar.
 *
 * The domain logic is pure and lives in `src/domain/garmin/`. This file is the
 * I/O edge: it reads files, prints a report, and — only behind `--apply` —
 * writes phase bands back.
 *
 * ## Why it reads payloads from disk instead of calling Garmin
 *
 * Garmin is reachable through an MCP server, which is an agent-facing
 * transport, not an HTTP API this script can call. Rather than smuggle in a
 * second auth path, the script takes the payloads as input. That keeps the
 * whole thing deterministic and testable, and keeps credentials out of it.
 * An agent (or a cron that shells out to one) fetches and pipes in. See
 * README.md for the two calls.
 *
 * Usage:
 *   node scripts/garmin/garmin-report.ts --activities acts.json --sleep sleep.json
 *   node scripts/garmin/garmin-report.ts --sleep sleep.json --apply
 *
 *   --activities <file|->   get_activities_by_date payload
 *   --sleep <file|->        get_sleep_summary payloads, keyed by date or an array
 *   --map <file>            habit map (default $KAIROS_HOME/integrations/garmin/habit-map.json)
 *   --vault <dir>           default $KAIROS_HOME or ~/.kairos
 *   --threshold <minutes>   drift threshold (default 45)
 *   --min-nights <n>        refuse to propose below this many nights (default 7)
 *   --tz <zone>             IANA zone (default: host zone)
 *   --apply                 WRITE the proposed bands to phaseConfigs.json
 *   --plant-sleep           WRITE sleep nights as moments to moments.json
 *   --json                  machine-readable output
 */

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { plantSleep } from "../../src/application/use-cases/plantSleep.ts";
import {
  checkMapIntegrity,
  coverage,
  type GarminActivity,
  parseHabitMap,
  resolveActivities,
} from "../../src/domain/garmin/GarminHabitMap.ts";
import {
  DEFAULT_DRIFT_THRESHOLD_MINUTES,
  DEFAULT_MIN_NIGHTS,
  detectDrift,
  formatHour,
  formatMinutes,
  type PhaseBand,
  type SleepNight,
  summarizeNights,
} from "../../src/domain/garmin/SleepPhaseService.ts";
import {
  findBinding,
  parseIntegrationConfig,
} from "../../src/domain/integration/IntegrationBinding.ts";

// ---------------------------------------------------------------- args

interface Args {
  activities?: string;
  sleep?: string;
  map?: string;
  vault: string;
  threshold: number;
  minNights: number;
  tz?: string;
  apply: boolean;
  plantSleep: boolean;
  json: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const vault =
    get("--vault") ?? process.env.KAIROS_HOME ?? join(homedir(), ".kairos");
  return {
    activities: get("--activities"),
    sleep: get("--sleep"),
    map: get("--map") ?? process.env.GARMIN_HABIT_MAP,
    vault,
    threshold: Number(get("--threshold") ?? DEFAULT_DRIFT_THRESHOLD_MINUTES),
    minNights: Number(get("--min-nights") ?? DEFAULT_MIN_NIGHTS),
    tz: get("--tz"),
    apply: argv.includes("--apply"),
    plantSleep: argv.includes("--plant-sleep"),
    json: argv.includes("--json"),
  };
}

// ---------------------------------------------------------------- io

function readMaybe(path: string | undefined): unknown {
  if (path === undefined) return undefined;
  const text =
    path === "-"
      ? readFileSync(0, "utf8")
      : existsSync(path)
        ? readFileSync(path, "utf8")
        : "";
  if (text.trim().length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Fail soft to `{}` — the vault's rule is that a missing or malformed
 * collection means empty, never an error. */
function readVaultCollection(
  vault: string,
  name: string,
): Record<string, unknown> {
  try {
    const raw = JSON.parse(readFileSync(join(vault, name), "utf8"));
    return typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** The MCP tool returns `{ result: "<json string>" }`; a saved payload may be
 * that envelope, the decoded object, or the bare array. Accept all three. */
function unwrap(payload: unknown): unknown {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }
  if (typeof payload === "object" && payload !== null && "result" in payload) {
    return unwrap((payload as { result: unknown }).result);
  }
  return payload;
}

/** Narrow an unknown to an indexable record without reaching for `any`. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readActivities(payload: unknown): readonly GarminActivity[] {
  const data = unwrap(payload);
  const envelope = asRecord(data);
  const list: unknown[] = Array.isArray(data)
    ? data
    : envelope !== null && Array.isArray(envelope.activities)
      ? envelope.activities
      : [];
  return list.filter((a: unknown): a is GarminActivity => {
    const record = asRecord(a);
    return record !== null && typeof record.type === "string";
  });
}

/** Sleep arrives as one payload per night. Accept an array, or an object
 * keyed by date (which is how you would naturally save a week of them). */
function readNights(payload: unknown): readonly SleepNight[] {
  const data = unwrap(payload);
  if (Array.isArray(data)) return data.map((n) => unwrap(n) as SleepNight);
  if (typeof data === "object" && data !== null) {
    return Object.values(data as Record<string, unknown>).map(
      (n) => unwrap(n) as SleepNight,
    );
  }
  return [];
}

function readBands(vault: string): readonly PhaseBand[] {
  const raw = readVaultCollection(vault, "phaseConfigs.json");
  return Object.values(raw)
    .filter((b): b is Record<string, unknown> => {
      const record = asRecord(b);
      return record !== null && typeof record.phase === "string";
    })
    .map((b) => ({
      id: String(b.id),
      phase: b.phase as PhaseBand["phase"],
      startHour: Number(b.startHour),
      endHour: Number(b.endHour),
    }));
}

// ---------------------------------------------------------------- apply

/**
 * Write the proposed bands back.
 *
 * Three obligations, all from the vault contract:
 *  - **Preserve unknown fields**, or an older build silently deletes a newer
 *    one's data. Only startHour/endHour/updatedAt are touched.
 *  - **One writer per collection.** zenborg owns phaseConfigs. If the app is
 *    running, its 2-second debounce will overwrite anything written behind its
 *    back, so refuse rather than lose the edit.
 *  - **Atomic.** tmp + rename, after a timestamped backup.
 */
function applyProposal(
  vault: string,
  proposal: readonly { id: string; toStartHour: number; toEndHour: number }[],
): string {
  let running = false;
  try {
    execFileSync("pgrep", ["-x", "zenborg"], { stdio: "pipe" });
    running = true;
  } catch {
    running = false;
  }
  if (running) {
    throw new Error(
      "zenborg is running and is the writer for phaseConfigs — quit it first, or edit the bands in the app.",
    );
  }

  const path = join(vault, "phaseConfigs.json");
  const current = readVaultCollection(vault, "phaseConfigs.json");
  if (Object.keys(current).length === 0) {
    throw new Error(`no phase bands found at ${path}`);
  }

  const backup = `${path}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
  copyFileSync(path, backup);

  const now = new Date().toISOString();
  const next: Record<string, unknown> = { ...current };
  for (const p of proposal) {
    const existing = next[p.id];
    if (typeof existing !== "object" || existing === null) continue;
    next[p.id] = {
      ...(existing as Record<string, unknown>), // unknown fields survive
      startHour: p.toStartHour,
      endHour: p.toEndHour,
      updatedAt: now,
    };
  }

  const tmp = `${path}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
  return backup;
}

// ---------------------------------------------------------------- integrations config

const GARMIN_SLEEP_SOURCE = "garmin.sleep";

function readIntegrationsConfig(vault: string) {
  const configPath = join(vault, "integrations.json");
  if (!existsSync(configPath)) return parseIntegrationConfig(null);
  try {
    return parseIntegrationConfig(JSON.parse(readFileSync(configPath, "utf8")));
  } catch {
    return parseIntegrationConfig(null);
  }
}

// ---------------------------------------------------------------- write seeds

function isZenborgRunning(): boolean {
  try {
    execFileSync("pgrep", ["-x", "zenborg"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function readMoments(vault: string): Record<string, Record<string, unknown>> {
  const moments: Record<string, Record<string, unknown>> = {};
  try {
    const raw = JSON.parse(readFileSync(join(vault, "moments.json"), "utf8"));
    if (typeof raw === "object" && raw !== null) {
      for (const [id, val] of Object.entries(raw)) {
        if (typeof val === "object" && val !== null) {
          moments[id] = val as Record<string, unknown>;
        }
      }
    }
  } catch {
    // empty collection
  }
  return moments;
}

function plantedDaysForHabit(
  moments: Record<string, Record<string, unknown>>,
  habitId: string,
): Set<string> {
  const days = new Set<string>();
  for (const m of Object.values(moments)) {
    if (m.habitId === habitId && typeof m.day === "string") {
      days.add(m.day);
    }
  }
  return days;
}

/**
 * Stamp seeds with ids and timestamps and write atomically.
 *
 * Same vault obligations as `applyProposal`: preserve unknown fields, atomic
 * write via tmp + rename, refuse while zenborg is running.
 */
function writeSeedsToVault(
  vault: string,
  moments: Record<string, Record<string, unknown>>,
  seeds: readonly import("../../src/domain/garmin/SleepMomentService.ts").SleepMomentFields[],
): void {
  const now = new Date().toISOString();
  for (const seed of seeds) {
    const id = crypto.randomUUID();
    moments[id] = {
      id,
      name: seed.name,
      areaId: seed.areaId,
      habitId: seed.habitId,
      cycleId: null,
      cyclePlanId: null,
      phase: seed.phase,
      day: seed.day,
      order: 0,
      startTime: seed.startTime,
      durationMin: seed.durationMin,
      tags: seed.tags.length > 0 ? seed.tags : null,
      createdAt: now,
      updatedAt: now,
    };
  }
  const momentsPath = join(vault, "moments.json");
  const tmp = `${momentsPath}.tmp`;
  mkdirSync(dirname(momentsPath), { recursive: true });
  writeFileSync(tmp, `${JSON.stringify(moments, null, 2)}\n`, "utf8");
  renameSync(tmp, momentsPath);
}

// ---------------------------------------------------------------- report

const BULLET = "  ";

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const mapPath =
    args.map ?? join(args.vault, "integrations", "garmin", "habit-map.json");
  const out: string[] = [];
  const json: Record<string, unknown> = {};

  out.push("");
  out.push("  garmin -> garden");
  out.push(`  vault ${args.vault}`);
  out.push("");

  // ---- deliverable 1: activity -> habit
  const map = parseHabitMap(readMaybe(mapPath));
  const mapExists = existsSync(mapPath);
  const activities = readActivities(readMaybe(args.activities));

  out.push("  ── activity → habit ──────────────────────────────────");
  out.push(
    `${BULLET}map   ${mapPath}${mapExists ? "" : "   (not found — nothing is mapped)"}`,
  );
  out.push(
    `${BULLET}      ${Object.keys(map.mappings).length} decided, ${Object.keys(map.pending).length} pending`,
  );

  const habits = Object.values(
    readVaultCollection(args.vault, "habits.json"),
  ).filter((h): h is { id: string; name?: string; isArchived?: boolean } => {
    const record = asRecord(h);
    return record !== null && typeof record.id === "string";
  });
  const issues = checkMapIntegrity(map, habits);
  json.integrity = issues;

  if (activities.length > 0) {
    const rows = coverage(resolveActivities(map, activities));
    const mappedCount = rows
      .filter((r) => r.status === "mapped")
      .reduce((n, r) => n + r.count, 0);
    out.push(
      `${BULLET}sample ${activities.length} activities · ${mappedCount} would plant a moment (${Math.round((mappedCount / activities.length) * 100)}%)`,
    );
    out.push("");
    for (const r of rows) {
      const badge =
        r.status === "mapped" ? "→" : r.status === "pending" ? "?" : "·";
      const dest =
        r.status === "mapped"
          ? r.habitName
          : r.status === "pending"
            ? "NEEDS DECISION"
            : "unmapped";
      out.push(
        `${BULLET}${badge} ${r.type.padEnd(30)} ${String(r.count).padStart(3)}  ${dest}`,
      );
    }
    json.coverage = rows;
  } else {
    out.push(`${BULLET}(no --activities payload given)`);
  }

  if (issues.length > 0) {
    out.push("");
    out.push(`${BULLET}INTEGRITY`);
    for (const i of issues) out.push(`${BULLET}  ! ${i.type}: ${i.detail}`);
  }

  const pendingEntries = Object.entries(map.pending);
  if (pendingEntries.length > 0) {
    out.push("");
    out.push("  ── needs decision ────────────────────────────────────");
    for (const [type, p] of pendingEntries) {
      out.push(`${BULLET}${type}`);
      out.push(`${BULLET}  why   ${p.reason}`);
      out.push(
        `${BULLET}  rec   ${wrapText(p.recommendation, 68, `${BULLET}        `)}`,
      );
      if (p.candidates !== undefined && p.candidates.length > 0) {
        out.push(
          `${BULLET}  cand  ${p.candidates.map((c) => c.habitName).join(" · ")}`,
        );
      }
      out.push("");
    }
  }

  // ---- deliverable 2: sleep -> phase bands
  out.push("  ── sleep → phase bands ───────────────────────────────");
  const nights = readNights(readMaybe(args.sleep));
  const bands = readBands(args.vault);

  if (nights.length === 0) {
    out.push(`${BULLET}(no --sleep payload given)`);
  } else {
    const summary = summarizeNights(nights, args.tz);
    const verdict = detectDrift(summary, bands, {
      thresholdMinutes: args.threshold,
      minNights: args.minNights,
    });
    json.sleep = summary;
    json.verdict = verdict;

    out.push(
      `${BULLET}nights ${summary.nightsUsed} used, ${summary.nightsMissing} with no data`,
    );
    out.push(
      `${BULLET}sleep  ${formatHour(summary.medianOnsetHour)} → ${formatHour(summary.medianWakeHour)}  (median ${summary.medianSleepHours.toFixed(2)}h)`,
    );
    out.push(
      `${BULLET}bands  ${bands.map((b) => `${b.phase[0]}${b.startHour}`).join(" ")}`,
    );
    out.push("");

    switch (verdict.kind) {
      case "insufficient-data":
        out.push(
          `${BULLET}NO VERDICT — ${verdict.nightsUsed} nights, needs ${verdict.minNights}.`,
        );
        break;
      case "aligned":
        out.push(
          `${BULLET}ALIGNED — wake ${formatMinutes(verdict.wakeDriftMinutes)}, onset ${formatMinutes(verdict.onsetDriftMinutes)}, both inside ${args.threshold}min.`,
        );
        break;
      case "stretch":
        out.push(
          `${BULLET}STRETCH — wake ${formatMinutes(verdict.wakeDriftMinutes)}, onset ${formatMinutes(verdict.onsetDriftMinutes)}.`,
        );
        out.push(`${BULLET}${wrapText(verdict.detail, 68, BULLET)}`);
        out.push(
          `${BULLET}No proposal: choosing band widths is yours, not the watch's.`,
        );
        break;
      case "shift": {
        out.push(
          `${BULLET}DRIFT — wake ${formatMinutes(verdict.wakeDriftMinutes)}, onset ${formatMinutes(verdict.onsetDriftMinutes)}, past ${args.threshold}min.`,
        );
        out.push(
          `${BULLET}Proposed: shift every band by ${verdict.shiftHours > 0 ? "+" : ""}${verdict.shiftHours}h (widths unchanged).`,
        );
        out.push("");
        for (const p of verdict.proposal) {
          const from = `${String(p.fromStartHour).padStart(2, "0")}–${String(p.fromEndHour).padStart(2, "0")}`;
          const to = `${String(p.toStartHour).padStart(2, "0")}–${String(p.toEndHour).padStart(2, "0")}`;
          const changed = from !== to;
          out.push(
            `${BULLET}  ${changed ? "~" : " "} ${p.phase.padEnd(10)} ${from}  →  ${to}`,
          );
        }
        out.push("");
        if (args.apply) {
          try {
            const backup = applyProposal(args.vault, verdict.proposal);
            out.push(`${BULLET}APPLIED. Backup: ${backup}`);
          } catch (e) {
            out.push(`${BULLET}APPLY FAILED — ${(e as Error).message}`);
            out.push("");
            console.log(out.join("\n"));
            return 1;
          }
        } else {
          out.push(
            `${BULLET}Not applied. This is a proposal. Re-run with --apply to write it.`,
          );
        }
        break;
      }
    }
  }

  // ---- deliverable 3: sleep -> moments (calendar)
  if (args.plantSleep) {
    out.push("");
    out.push("  ── sleep → moments (calendar) ────────────────────────");
    const integrations = readIntegrationsConfig(args.vault);
    const sleepBinding = findBinding(integrations, GARMIN_SLEEP_SOURCE);
    if (sleepBinding === null) {
      out.push(
        `${BULLET}SKIPPED — no "${GARMIN_SLEEP_SOURCE}" binding in $KAIROS_HOME/integrations.json`,
      );
      out.push(
        `${BULLET}Add: { "version": 1, "bindings": [{ "source": "garmin.sleep", "areaId": "...", "habitId": "..." }] }`,
      );
    } else if (nights.length === 0) {
      out.push(`${BULLET}SKIPPED — no sleep data (pass --sleep <file>)`);
    } else {
      try {
        if (isZenborgRunning()) {
          throw new Error(
            "zenborg is running and is the writer for moments — quit it first.",
          );
        }
        const moments = readMoments(args.vault);
        const planted = plantedDaysForHabit(moments, sleepBinding.habitId);
        const result = plantSleep({
          nights,
          binding: sleepBinding,
          plantedDays: planted,
          timeZone: args.tz,
        });
        if (result.seeds.length > 0) {
          writeSeedsToVault(args.vault, moments, result.seeds);
        }
        out.push(
          `${BULLET}${result.seeds.length} moments planted, ${result.skipped} skipped (${nights.length} nights)`,
        );
        json.sleepPlant = {
          planted: result.seeds.length,
          skipped: result.skipped,
          total: nights.length,
        };
      } catch (e) {
        out.push(`${BULLET}FAILED — ${(e as Error).message}`);
        out.push("");
        console.log(out.join("\n"));
        return 1;
      }
    }
  }

  out.push("");
  if (args.json) {
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log(out.join("\n"));
  }
  return 0;
}

function wrapText(text: string, width: number, indent: string): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line.length + w.length + 1 > width) {
      lines.push(line);
      line = w;
    } else {
      line = line.length === 0 ? w : `${line} ${w}`;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.join(`\n${indent}`);
}

process.exit(main());
