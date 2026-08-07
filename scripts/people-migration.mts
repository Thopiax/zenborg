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
 *
 * Safe to run twice: records already marked kind "person" are skipped, and a
 * sibling is only created when no live record of that name exists in the area.
 *
 * Usage:
 *   node scripts/people-migration.mts                     # dry run, report only
 *   node scripts/people-migration.mts --write             # apply
 *   KAIROS_HOME=/tmp/copy node scripts/people-migration.mts --write
 *
 * See docs/decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md
 */

import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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

/** 2026-08-07T17:20:30.123Z -> 20260807-172030, matching the vault's .bak style. */
const backupStamp = (iso: string): string => {
  const [date, time] = iso.split("T");
  return `${date.replace(/-/g, "")}-${(time ?? "").slice(0, 8).replace(/:/g, "")}`;
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
        "",
        "  Reads $KAIROS_HOME (default ~/.kairos). Close the Tauri app first:",
        "  zenborg is the sole writer of habits.json.",
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

  if (values.write !== true) {
    process.stdout.write(
      "\nDRY RUN — nothing written. Re-run with --write to apply.\n",
    );
    return 0;
  }

  if (plan.marked.length === 0 && plan.created.length === 0) {
    process.stdout.write("\nnothing to do — habits.json left untouched.\n");
    return 0;
  }

  const backup = `${habitsPath}.bak.${backupStamp(now)}`;
  copyFileSync(habitsPath, backup);
  writeFileSync(habitsPath, `${JSON.stringify(habits, null, 2)}\n`, "utf8");
  process.stdout.write(`\nbackup: ${backup}\nwritten: ${habitsPath}\n`);
  return 0;
};

process.exitCode = main();
