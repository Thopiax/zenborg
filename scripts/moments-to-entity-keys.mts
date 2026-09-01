#!/usr/bin/env node
/**
 * moments-to-entity-keys — move people and places out of habits and tags.
 *
 * Spec migration steps 3, 5, 6 and 7
 * (docs/superpowers/specs/2026-08-18-people-and-places-as-entities-design.md).
 *
 * Four changes, one pass, because they are one change seen from four sides:
 *
 *   1. A moment pointing at a person-habit becomes `habitId: null` with the
 *      person's key in `personIds`. This drops a false claim — that a Sunday
 *      was an instance of a perennial named after a person — and keeps the
 *      true one, that he saw her.
 *   2. The person-habits are archived. Archive, not delete, so nothing dangles
 *      if step 1 missed a row.
 *   3. `place-<key>` on a moment becomes `placeIds: [<key>]`, and the
 *      short-form duplicates go, each of which duplicates a `place-` tag that
 *      is already there.
 *   4. `place-<key>` on a HABIT becomes `Habit.placeIds`, which is what the
 *      gap roster now reads. Until this runs, `placesOf` falls back to the tag,
 *      so the roster keeps working either side of the migration.
 *
 * ── The inherited lie ───────────────────────────────────────────────────
 *
 * A `place-` tag that arrived on a moment by inheritance from a person-habit
 * is NOT converted. Where a person lives is a fact about the person — a
 * registry edge — not a fact about the moment. A breakfast that inherited the
 * city its guest lives in claims a location nobody recorded, and once it is in
 * `placeIds` it is indistinguishable from a place actually observed.
 *
 * A moment left with no `placeIds` is honest: zenborg never knew where it
 * happened. One carrying the wrong city is not. This is the single reason this
 * script is more than a find-and-replace.
 *
 * ── Running it ──────────────────────────────────────────────────────────
 *
 *   (no flags)   dry run: report what would change, write nothing
 *   --write      apply, after copying each touched file to a timestamped .bak
 *   --force      with --write, proceed even if the zenborg app looks open
 *
 * Reads and writes $ZENBORG_HOME (default ~/.zenborg). **Close the desktop app
 * first**: it is the sole writer of these collections and would overwrite this
 * migration from its in-memory store. Every step is reversible only from the
 * backup this script takes, which is why it takes one.
 */
import { execFileSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------- shapes

/** A habit as it sits on disk. `kind` is gone from the domain, not the vault. */
export type HabitRecord = {
  id: string;
  name: string;
  areaId: string;
  tags?: string[];
  placeIds?: string[];
  isArchived?: boolean;
  kind?: "person";
  updatedAt?: string;
};

export type MomentRecord = {
  id: string;
  name: string;
  areaId: string;
  habitId: string | null;
  tags?: string[] | null;
  personIds?: string[];
  placeIds?: string[];
  updatedAt?: string;
};

export type Plan = {
  /** Moments repointed from a person-habit to a personIds key. */
  personRewrites: number;
  /** Moments that gained placeIds from their own place- tags. */
  placeConversions: number;
  /** place- tags left unconverted because they were inherited. */
  inheritedPlacesDropped: number;
  /** Short-form city tags removed, each duplicating a place- tag. */
  shortFormsDropped: number;
  /** Person-habits archived. */
  habitsArchived: number;
  /** Habits whose place- tags became placeIds. */
  habitPlacesMigrated: number;
  /** Anything that must be resolved by hand before writing. */
  problems: string[];
};

// ---------------------------------------------------------------- constants

const PLACE_PREFIX = "place-";

/**
 * Short-form city tags, dropped rather than converted.
 *
 * Each duplicates a `place-` tag already present on the same moment, so
 * dropping them loses nothing. They are listed rather than pattern-matched
 * because a three-letter tag is otherwise indistinguishable from an ordinary
 * one, and guessing here would silently delete a real tag.
 */
const SHORT_FORMS: ReadonlySet<string> = new Set([
  "sp",
  "bcn",
  "nyc",
  "london",
  "paris",
  "madrid",
]);

// ---------------------------------------------------------------- pure helpers

/** The contract's key rule. Third copy, same tests. See people-to-registry.mts. */
export const slugify = (label: string): string =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/** The place keys a tag list names, in order of first appearance. */
export const placeKeysOf = (tags: readonly string[]): string[] => {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (!tag.startsWith(PLACE_PREFIX)) continue;
    const key = tag.slice(PLACE_PREFIX.length);
    if (key.length > 0 && !out.includes(key)) out.push(key);
  }
  return out;
};

const isPlaceTag = (tag: string): boolean =>
  tag.trim().toLowerCase().startsWith(PLACE_PREFIX);

/**
 * The whole migration, as a pure function.
 *
 * Takes the two collections as they are on disk and returns new ones plus a
 * plan. Nothing here reads a clock, a filesystem or a process table, so every
 * decision — especially the inherited-place one — is testable from synthetic
 * records, which matters because the real input is the principal's own life.
 */
export const migrate = (
  habitsIn: Readonly<Record<string, HabitRecord>>,
  momentsIn: Readonly<Record<string, MomentRecord>>,
  now: string,
): {
  habits: Record<string, HabitRecord>;
  moments: Record<string, MomentRecord>;
  plan: Plan;
} => {
  const habits: Record<string, HabitRecord> = structuredClone(
    habitsIn,
  ) as Record<string, HabitRecord>;
  const moments: Record<string, MomentRecord> = structuredClone(
    momentsIn,
  ) as Record<string, MomentRecord>;
  const plan: Plan = {
    personRewrites: 0,
    placeConversions: 0,
    inheritedPlacesDropped: 0,
    shortFormsDropped: 0,
    habitsArchived: 0,
    habitPlacesMigrated: 0,
    problems: [],
  };

  const personKeyByHabitId = new Map<string, string>();
  const personPlacesByKey = new Map<string, readonly string[]>();
  const claimedKeys = new Map<string, string>();

  for (const habit of Object.values(habits)) {
    if (habit.kind !== "person") continue;
    const key = slugify(habit.name);
    if (key.length === 0) {
      plan.problems.push(`person habit ${habit.id} slugs to an empty key`);
      continue;
    }
    const owner = claimedKeys.get(key);
    if (owner !== undefined && owner !== habit.id) {
      // Two people to one key would merge two histories into one person.
      plan.problems.push(
        `two person habits slug to "${key}": ${owner} and ${habit.id}`,
      );
      continue;
    }
    claimedKeys.set(key, habit.id);
    personKeyByHabitId.set(habit.id, key);
    personPlacesByKey.set(key, placeKeysOf(habit.tags ?? []));
  }

  // ── moments ──────────────────────────────────────────────────────────
  for (const moment of Object.values(moments)) {
    let touched = false;
    const tags = moment.tags ?? [];
    const personKey =
      moment.habitId === null
        ? undefined
        : personKeyByHabitId.get(moment.habitId);

    // 1. A moment pointing at a person is a moment WITH that person.
    if (personKey !== undefined) {
      const existing = moment.personIds ?? [];
      moment.personIds = existing.includes(personKey)
        ? existing
        : [...existing, personKey];
      moment.habitId = null;
      plan.personRewrites += 1;
      touched = true;
    }

    // 3 + 7. Convert this moment's own places; refuse the inherited ones.
    // Where the person lives, which this moment may have inherited rather
    // than observed. Only a moment that pointed AT the person can inherit —
    // one that merely mentions the same city recorded it for itself.
    const inherited =
      personKey === undefined ? [] : (personPlacesByKey.get(personKey) ?? []);

    const present = placeKeysOf(tags);
    const own = present.filter((k) => !inherited.includes(k));
    plan.inheritedPlacesDropped += present.length - own.length;

    if (own.length > 0) {
      const existing = moment.placeIds ?? [];
      const merged = [...existing];
      for (const k of own) if (!merged.includes(k)) merged.push(k);
      moment.placeIds = merged;
      plan.placeConversions += 1;
      touched = true;
    }

    // Every place- tag goes, converted or refused: the tag namespace is
    // retired either way, and leaving the refused ones behind would leave the
    // lie readable by anything still parsing tags.
    const shortForms = tags.filter((t) =>
      SHORT_FORMS.has(t.trim().toLowerCase()),
    );
    plan.shortFormsDropped += shortForms.length;

    const kept = tags.filter(
      (t) => !isPlaceTag(t) && !SHORT_FORMS.has(t.trim().toLowerCase()),
    );
    if (kept.length !== tags.length) {
      moment.tags = kept.length > 0 ? kept : null;
      touched = true;
    }

    if (touched) moment.updatedAt = now;
  }

  // ── habits ───────────────────────────────────────────────────────────
  for (const habit of Object.values(habits)) {
    let touched = false;

    // 4. A practice's place becomes a field, which is what the roster reads.
    // Person-habits are skipped: their place is the person's base place, and
    // it belongs in the registry, not on a record about to be archived.
    if (habit.kind !== "person") {
      const keys = placeKeysOf(habit.tags ?? []);
      if (keys.length > 0) {
        const existing = habit.placeIds ?? [];
        const merged = [...existing];
        for (const k of keys) if (!merged.includes(k)) merged.push(k);
        habit.placeIds = merged;
        habit.tags = (habit.tags ?? []).filter((t) => !isPlaceTag(t));
        plan.habitPlacesMigrated += 1;
        touched = true;
      }
    }

    // 5. Archive, never delete, so nothing dangles if a moment was missed.
    if (habit.kind === "person" && habit.isArchived !== true) {
      habit.isArchived = true;
      plan.habitsArchived += 1;
      touched = true;
    }

    if (touched) habit.updatedAt = now;
  }

  return { habits, moments, plan };
};

// ---------------------------------------------------------------- io

const vaultHome = (): string =>
  process.env.ZENBORG_HOME ?? process.env.KAIROS_HOME ?? join(homedir(), ".zenborg");

const readJson = <T,>(path: string): T => {
  if (!existsSync(path)) {
    throw new Error(`not found: ${path} (set ZENBORG_HOME?)`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
};

/** Copied from people-migration.mts, which documents the reasoning. */
const backupStamp = (iso: string): string => {
  const [date, time] = iso.split("T");
  const clock = (time ?? "").replace("Z", "");
  const [hms, millis] = clock.split(".");
  return `${(date ?? "").replace(/-/g, "")}-${(hms ?? "").replace(/:/g, "")}-${millis ?? "000"}`;
};

/**
 * The running DESKTOP app, not the mcp sidecar.
 *
 * Verbatim from people-migration.mts, including why the sidecar is excluded:
 * it reads each collection fresh per call and writes through temp-then-rename,
 * so it holds no in-memory store that could overwrite this. The desktop app
 * would. Fails open — a broken `ps` degrades to proceeding, not blocking.
 */
const APP_PROCESS_PATTERNS: readonly RegExp[] = [
  /zenborg\.app\/Contents\/MacOS\/(?!zenborg-mcp)[^/\s]+/,
  /src-tauri\/target\/(?:debug|release)\/app(?:\s|$)/,
];

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
    if (line.length === 0) continue;
    if (line.startsWith(`${process.pid} `)) continue;
    for (const pattern of APP_PROCESS_PATTERNS) {
      if (pattern.test(line)) {
        hits.push(line);
        break;
      }
    }
  }
  return hits;
};

/** temp -> fsync -> rename. Mirrors src-tauri/src/vault/fs.rs. */
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
        // already closed or never opened cleanly
      }
    }
    rmSync(tmp, { force: true });
    throw error;
  }
  return tmp;
};

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
        "moments-to-entity-keys — people and places become references",
        "",
        "  (no flags)   dry run: report what would change, write nothing",
        "  --write      apply, after backing up habits.json and moments.json",
        "  --force      with --write, proceed even if the zenborg app looks open",
        "",
        "  Close the zenborg desktop app first. It is the sole writer of these",
        "  collections and would overwrite this migration from memory.",
        "",
        "  Reports counts only — no moment name or person key reaches stdout.",
        "",
      ].join("\n"),
    );
    return 0;
  }

  const vault = vaultHome();
  const habitsPath = join(vault, "habits.json");
  const momentsPath = join(vault, "moments.json");

  const habitsIn = readJson<Record<string, HabitRecord>>(habitsPath);
  const momentsIn = readJson<Record<string, MomentRecord>>(momentsPath);
  const now = new Date().toISOString();
  const { habits, moments, plan } = migrate(habitsIn, momentsIn, now);

  const out: string[] = [];
  const line = (s = "") => out.push(s);

  line("moments-to-entity-keys");
  line("======================");
  line(`  vault                  ${vault}`);
  line(`  habits                 ${Object.keys(habitsIn).length}`);
  line(`  moments                ${Object.keys(momentsIn).length}`);
  line();
  line(`moments repointed        ${plan.personRewrites}`);
  line(`moments gaining a place  ${plan.placeConversions}`);
  line(`inherited places refused ${plan.inheritedPlacesDropped}`);
  line(`short-form tags dropped  ${plan.shortFormsDropped}`);
  line(`person habits archived   ${plan.habitsArchived}`);
  line(`habit places migrated    ${plan.habitPlacesMigrated}`);

  if (plan.problems.length > 0) {
    line();
    line("PROBLEMS");
    for (const p of plan.problems) line(`  [error] ${p}`);
  }

  process.stdout.write(`${out.join("\n")}\n`);

  if (plan.problems.length > 0) {
    process.stderr.write("\nrefusing to write — resolve the problems above\n");
    return 2;
  }

  const appProcesses = runningAppProcesses();

  if (values.write !== true) {
    if (appProcesses.length > 0) {
      process.stdout.write(
        `\nNOTE: the zenborg desktop app looks like it is running (${appProcesses.length}).\n` +
          "Close it before --write, or it will overwrite this migration.\n",
      );
    }
    process.stdout.write(
      "\nDRY RUN — nothing written. Re-run with --write to apply.\n",
    );
    return 0;
  }

  const changed =
    plan.personRewrites +
    plan.placeConversions +
    plan.shortFormsDropped +
    plan.habitsArchived +
    plan.habitPlacesMigrated;
  if (changed === 0) {
    process.stdout.write("\nnothing to do — the vault is left untouched.\n");
    return 0;
  }

  if (appProcesses.length > 0 && values.force !== true) {
    process.stderr.write(
      [
        "",
        "REFUSING TO WRITE — the zenborg desktop app appears to be running:",
        ...appProcesses.map((p) => `  ${p}`),
        "",
        "zenborg is the sole writer of these collections. It holds the garden",
        "in an in-memory store and rewrites the files on its own schedule, so",
        "it would overwrite this migration and the change would vanish.",
        "",
        "Quit the zenborg app, then run this again.",
        "If this detection is wrong, re-run with --force to override.",
        "",
      ].join("\n"),
    );
    return 2;
  }

  const stamp = backupStamp(now);
  const written: string[] = [];
  for (const [path, data] of [
    [habitsPath, habits],
    [momentsPath, moments],
  ] as const) {
    const backup = `${path}.bak.${stamp}`;
    copyFileSync(path, backup);
    writeAtomic(path, `${JSON.stringify(data, null, 2)}\n`);
    written.push(`  ${path}\n    backup ${backup}`);
  }
  process.stdout.write(`\nwritten:\n${written.join("\n")}\n`);
  return 0;
};

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
