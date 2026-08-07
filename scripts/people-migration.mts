#!/usr/bin/env node
/**
 * people-migration — one-shot: mark person-shaped habits with kind "person"
 * and split the two fused pair records.
 *
 * People are every non-archived habit in the Family, Friends and Sensitive
 * areas except a small set of named rituals. Two records fuse two people; each
 * keeps its original id for the first-named person — so existing moments
 * referencing that id stay attached — and gains a sibling with a fresh UUID.
 *
 * DRY-RUN BY DEFAULT. Nothing is written unless --write is passed, and even
 * then a timestamped .bak is copied beside habits.json first.
 *
 * The Tauri app MUST be closed for the write: zenborg is the sole writer of
 * habits.json, and a running app would overwrite this from its in-memory store.
 * The script checks for a running app and refuses (exit 2) unless --force. The
 * check fails OPEN: if it detects nothing it proceeds, so an unreliable match
 * can never block the user.
 *
 * The write is atomic: the new JSON goes to habits.json.tmp, is fsync'd, then
 * renamed over the target. Rename is atomic within a filesystem, so an
 * interrupted run leaves the vault as either the old file or the new one, never
 * a truncated half-write. Mirrors src-tauri/src/vault/fs.rs write_collection.
 *
 * Safe to run twice: records already marked kind "person" are skipped, and a
 * sibling is only created when no live record of that name exists in the area.
 *
 * Usage:
 *   node scripts/people-migration.mts                     # dry run, report only
 *   node scripts/people-migration.mts --write             # apply
 *   node scripts/people-migration.mts --write --force     # apply despite a running app
 *   KAIROS_HOME=/tmp/copy node scripts/people-migration.mts --write
 *
 * See docs/decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------- types

/**
 * Structurally minimal views of the vault records. Deliberately open: the
 * script mutates records in place and never rebuilds one from a whitelist of
 * keys, so every field it does not know about survives untouched.
 */
type AreaRecord = {
  name?: string;
  isArchived?: boolean;
  [key: string]: unknown;
};

type HabitRecord = {
  id: string;
  name: string;
  areaId: string;
  order: number;
  isArchived?: boolean;
  kind?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type Plan = {
  readonly marked: readonly string[];
  readonly created: readonly string[];
  readonly alreadyPerson: readonly string[];
  readonly skippedRituals: readonly string[];
  readonly skippedArchived: readonly string[];
  readonly problems: readonly string[];
};

// ---------------------------------------------------------------- constants

const PERSON_AREAS: ReadonlySet<string> = new Set([
  "Family",
  "Friends",
  "Sensitive",
]);

/**
 * Rituals, not people. Matched by exact habit name. Kept complete even though
 * "colloc auber" and "family breakfast" are archived today — harmless now, and
 * correct if either is ever unarchived.
 */
const NOT_PEOPLE: ReadonlySet<string> = new Set([
  "family breakfast",
  "colloc auber",
  "poetry",
  "tantric",
]);

/** fused name -> [keeps the original id, gets a fresh record] */
const SPLITS: Readonly<Record<string, readonly [string, string]>> = {
  "Ben & Dee": ["Ben", "Dee"],
  "Ada & Cal": ["Ada", "Cal"],
};

// ---------------------------------------------------------------- paths

const kairosHome = (): string =>
  process.env.KAIROS_HOME ?? join(homedir(), ".kairos");

const readJson = <T,>(path: string): T => {
  if (!existsSync(path)) {
    throw new Error(`not found: ${path} (set KAIROS_HOME?)`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
};

// ---------------------------------------------------------------- pure helpers

/** Habit names are 1-3 words. Guards both renames and created siblings. */
const wordCountOk = (name: string): boolean => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return words.length >= 1 && words.length <= 3;
};

/**
 * 2026-08-07T17:20:30.123Z -> 20260807-172030-123.
 *
 * Extends the vault's existing .bak style (20260430-005649) with milliseconds
 * so two writes in the same second cannot silently clobber each other's backup.
 * Still lexicographically sortable.
 */
const backupStamp = (iso: string): string => {
  const [date, time] = iso.split("T");
  const clock = (time ?? "").replace("Z", "");
  const [hms, millis] = clock.split(".");
  return `${(date ?? "").replace(/-/g, "")}-${(hms ?? "").replace(/:/g, "")}-${millis ?? "000"}`;
};

// ---------------------------------------------------------------- the running app

/**
 * Command-line patterns for a running zenborg DESKTOP app.
 *
 * Verified against the live process table, not guessed. tauri.conf.json sets
 * productName "zenborg", so the bundle is zenborg.app — but the executable
 * inside it is the Cargo crate name, "app":
 *
 *   /Applications/zenborg.app/Contents/MacOS/app          <- the desktop app
 *   /Applications/zenborg.app/Contents/MacOS/zenborg-mcp  <- NOT the app
 *
 * The zenborg-mcp sidecar (bundle.externalBin) sits in the same directory and
 * usually has several instances running. It is deliberately excluded: it reads
 * each collection fresh with readFileSync per call and writes through its own
 * temp-then-rename (mcp-server/vault.ts), so it holds no in-memory store that
 * could overwrite this migration. The desktop app is the one that would.
 */
const APP_PROCESS_PATTERNS: readonly RegExp[] = [
  // Installed bundle, any executable inside it except the mcp sidecar.
  /zenborg\.app\/Contents\/MacOS\/(?!zenborg-mcp)[^/\s]+/,
  // Local dev or release build run straight from the repo (tauri dev/build).
  /src-tauri\/target\/(?:debug|release)\/app(?:\s|$)/,
];

/**
 * Full command lines of anything that looks like the running desktop app.
 *
 * FAILS OPEN by design: any error listing processes returns an empty list, so
 * a broken or unavailable `ps` degrades to today's behaviour (proceed) rather
 * than blocking a legitimate migration.
 */
const runningAppProcesses = (): readonly string[] => {
  let stdout: string;
  try {
    stdout = execFileSync("/bin/ps", ["-Ao", "pid=,command="], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return [];
  }
  const hits: string[] = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) {
      continue;
    }
    // Never match this very process, whatever it was invoked as.
    if (line.startsWith(`${process.pid} `)) {
      continue;
    }
    for (const pattern of APP_PROCESS_PATTERNS) {
      if (pattern.test(line)) {
        hits.push(line);
        break;
      }
    }
  }
  return hits;
};

// ---------------------------------------------------------------- atomic write

/**
 * Write `json` over `path` atomically: temp file -> fsync -> rename.
 *
 * Mirrors src-tauri/src/vault/fs.rs::write_collection (create .tmp, write_all,
 * sync_all, rename), which is the invariant the vault already documents. A
 * plain writeFileSync truncates in place, so a kill or a full disk mid-write
 * would leave the user's vault as unparseable JSON. Rename is atomic within a
 * filesystem, so a reader sees either the whole old file or the whole new one.
 */
const writeAtomic = (path: string, json: string): string => {
  const tmp = `${path}.tmp`;
  let fd: number | undefined;
  try {
    fd = openSync(tmp, "w");
    writeSync(fd, json);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, path);
  } catch (error) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // already closed or never opened cleanly — nothing to recover
      }
    }
    rmSync(tmp, { force: true });
    throw error;
  }
  return tmp;
};

const maxOrderByArea = (
  habits: readonly HabitRecord[],
): Map<string, number> => {
  const out = new Map<string, number>();
  for (const h of habits) {
    const current = out.get(h.areaId) ?? -1;
    if (h.order > current) {
      out.set(h.areaId, h.order);
    }
  }
  return out;
};

// ---------------------------------------------------------------- migration

/**
 * Mutates `habits` in place and returns what it did. Every touched record is
 * mutated field-by-field, never rebuilt, so unknown fields are preserved.
 */
const migrate = (
  habits: Record<string, HabitRecord>,
  personAreaIds: ReadonlySet<string>,
  now: string,
): Plan => {
  const marked: string[] = [];
  const created: string[] = [];
  const alreadyPerson: string[] = [];
  const skippedRituals: string[] = [];
  const skippedArchived: string[] = [];
  const problems: string[] = [];

  // Snapshot before iterating: siblings are inserted into `habits` as we go.
  const records = Object.values(habits);
  const orders = maxOrderByArea(records);

  /** Live names already present per area — guards against a double-create. */
  const liveNamesByArea = new Map<string, Set<string>>();
  for (const h of records) {
    if (h.isArchived === true) {
      continue;
    }
    const bucket = liveNamesByArea.get(h.areaId) ?? new Set<string>();
    bucket.add(h.name);
    liveNamesByArea.set(h.areaId, bucket);
  }

  for (const h of records) {
    if (!personAreaIds.has(h.areaId)) {
      continue;
    }
    if (h.isArchived === true) {
      skippedArchived.push(h.name);
      continue;
    }
    if (NOT_PEOPLE.has(h.name)) {
      skippedRituals.push(h.name);
      continue;
    }

    const split = SPLITS[h.name];
    if (split !== undefined) {
      const [keeps, sibling] = split;
      const fusedName = h.name;
      const siblings = liveNamesByArea.get(h.areaId) ?? new Set<string>();

      for (const name of [keeps, sibling]) {
        if (!wordCountOk(name)) {
          problems.push(`"${name}" is not 1-3 words`);
        }
      }

      h.name = keeps;
      h.kind = "person";
      h.updatedAt = now;
      marked.push(`${keeps} (renamed from "${fusedName}", id ${h.id} kept)`);
      siblings.add(keeps);

      if (siblings.has(sibling)) {
        problems.push(
          `sibling "${sibling}" already exists in that area — not created again`,
        );
        liveNamesByArea.set(h.areaId, siblings);
        continue;
      }

      const nextOrder = (orders.get(h.areaId) ?? 0) + 1;
      orders.set(h.areaId, nextOrder);
      const id = randomUUID();
      habits[id] = {
        ...h,
        id,
        name: sibling,
        order: nextOrder,
        createdAt: now,
        updatedAt: now,
      };
      siblings.add(sibling);
      liveNamesByArea.set(h.areaId, siblings);
      created.push(`${sibling} (new id ${id}, order ${nextOrder})`);
      continue;
    }

    if (h.kind === "person") {
      alreadyPerson.push(h.name);
      continue;
    }

    if (!wordCountOk(h.name)) {
      problems.push(`"${h.name}" is not 1-3 words`);
    }

    h.kind = "person";
    h.updatedAt = now;
    marked.push(h.name);
  }

  return {
    marked,
    created,
    alreadyPerson,
    skippedRituals,
    skippedArchived,
    problems,
  };
};

// ---------------------------------------------------------------- main

const main = (): number => {
  const { values } = parseArgs({
    options: {
      write: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help === true) {
    process.stdout.write(
      [
        "people-migration — mark person-shaped habits and split the fused pairs",
        "",
        "  (no flags)   dry run: report what would change, write nothing",
        "  --write      apply, after copying habits.json to a timestamped .bak",
        "  --force      with --write, proceed even if the zenborg app looks open",
        "",
        "  Reads $KAIROS_HOME (default ~/.kairos). Close the zenborg desktop app",
        "  first: it is the sole writer of habits.json and would overwrite this",
        "  migration from its in-memory store.",
        "",
      ].join("\n"),
    );
    return 0;
  }

  const vault = kairosHome();
  const habitsPath = join(vault, "habits.json");

  const areas = readJson<Record<string, AreaRecord>>(join(vault, "areas.json"));
  const habits = readJson<Record<string, HabitRecord>>(habitsPath);

  const personAreaIds = new Set(
    Object.entries(areas)
      .filter(([, a]) => typeof a.name === "string" && PERSON_AREAS.has(a.name))
      .map(([id]) => id),
  );

  if (personAreaIds.size !== PERSON_AREAS.size) {
    process.stderr.write(
      `expected ${PERSON_AREAS.size} person areas, resolved ${personAreaIds.size} — refusing to run\n`,
    );
    return 2;
  }

  const before = Object.keys(habits).length;
  const now = new Date().toISOString();
  const plan = migrate(habits, personAreaIds, now);
  const after = Object.keys(habits).length;
  const people = Object.values(habits).filter((h) => h.kind === "person");

  const out: string[] = [];
  const line = (s = "") => out.push(s);

  line("people-migration");
  line("================");
  line(`  vault           ${vault}`);
  line(`  habits          ${before} before → ${after} after`);
  line(
    `  social areas    ${personAreaIds.size} resolved (${[...PERSON_AREAS].join(", ")})`,
  );
  line();
  line(`marked kind="person": ${plan.marked.length}`);
  for (const n of plan.marked) {
    line(`  · ${n}`);
  }
  line();
  line(`created from splits: ${plan.created.length}`);
  for (const n of plan.created) {
    line(`  + ${n}`);
  }
  line();
  line(`already kind="person" (untouched): ${plan.alreadyPerson.length}`);
  for (const n of plan.alreadyPerson) {
    line(`  = ${n}`);
  }
  line();
  line(
    `skipped — archived: ${plan.skippedArchived.length} [${plan.skippedArchived.join(", ")}]`,
  );
  line(
    `skipped — rituals:  ${plan.skippedRituals.length} [${plan.skippedRituals.join(", ")}]`,
  );
  line();
  line(`people in file after this run: ${people.length}`);
  line(
    `  of which carry a rhythm: ${people.filter((p) => p.rhythm !== undefined).length}`,
  );

  if (plan.problems.length > 0) {
    line();
    line("PROBLEMS");
    for (const p of plan.problems) {
      line(`  [error] ${p}`);
    }
  }

  process.stdout.write(`${out.join("\n")}\n`);

  if (plan.problems.length > 0) {
    process.stderr.write("\nrefusing to write — resolve the problems above\n");
    return 2;
  }

  // The app check runs in both modes, but only blocks a write. A dry run
  // changes nothing, so it warns instead — the user learns before they commit.
  const appProcesses = runningAppProcesses();

  if (values.write !== true) {
    if (appProcesses.length > 0) {
      process.stdout.write(
        `\nNOTE: the zenborg desktop app looks like it is running (${appProcesses.length} process${appProcesses.length === 1 ? "" : "es"}).\n` +
          "Close it before --write, or the app will overwrite this migration from\n" +
          "its in-memory store.\n",
      );
    }
    process.stdout.write(
      "\nDRY RUN — nothing written. Re-run with --write to apply.\n",
    );
    return 0;
  }

  if (plan.marked.length === 0 && plan.created.length === 0) {
    process.stdout.write("\nnothing to do — habits.json left untouched.\n");
    return 0;
  }

  if (appProcesses.length > 0 && values.force !== true) {
    process.stderr.write(
      [
        "",
        "REFUSING TO WRITE — the zenborg desktop app appears to be running:",
        ...appProcesses.map((p) => `  ${p}`),
        "",
        "zenborg is the sole writer of habits.json. It holds the garden in an",
        "in-memory store and rewrites the file on its own schedule, so it would",
        "overwrite this migration and the change would silently vanish.",
        "",
        "Quit the zenborg app, then run this again.",
        "If this detection is wrong, re-run with --force to override.",
        "",
      ].join("\n"),
    );
    return 2;
  }

  if (appProcesses.length > 0) {
    process.stdout.write(
      `\nWARNING: --force given with ${appProcesses.length} apparent zenborg process(es) running.\n` +
        "If that is the desktop app, it may overwrite this migration.\n",
    );
  }

  const backup = `${habitsPath}.bak.${backupStamp(now)}`;
  copyFileSync(habitsPath, backup);
  const tmp = writeAtomic(habitsPath, `${JSON.stringify(habits, null, 2)}\n`);
  process.stdout.write(
    `\nbackup:  ${backup}\nvia tmp: ${tmp}\nwritten: ${habitsPath}\n`,
  );
  return 0;
};

process.exitCode = main();
