#!/usr/bin/env node
/**
 * people-to-registry — export the person-habits to wake's registry.
 *
 * Spec migration steps 2 and 4
 * (docs/superpowers/specs/2026-08-18-people-and-places-as-entities-design.md).
 *
 * Zenborg stops holding people. It holds references, and the registry holds the
 * person. This script produces the file wake ingests to become that registry:
 * one entity per person, keyed by the D6 slug of the habit name, carrying the
 * metadata the habit record and the Notion CRM each hold half of.
 *
 * ── Two sources, one join ───────────────────────────────────────────────
 *
 * The habits know name, aliases, emoji, and the D8 tags (`parent`, `close`,
 * `imperial`) that were never places or rituals but facts about a person. The
 * Notion CRM knows `category`, `cadence`, `status`, `favorite` and `notes`,
 * which no habit ever carried. Neither source alone is the person.
 *
 * They join on the slugged name, and **where they disagree about cadence the
 * CSV wins**: it is the record the principal curated deliberately, and only
 * twelve habits carry a rhythm at all. A name in one source and not the other
 * is reported, never guessed at — a wrong join here writes a wrong fact into
 * the graph that owns facts.
 *
 * ── What is deliberately dropped ────────────────────────────────────────
 *
 * `Time to Chat`, `Share Moment` and `Reasons to chat` were empty in all 46
 * rows: three good ideas never once filled. `Tags` carried one meaningless
 * value. `Last Chat At` and `Next Chat At` are dropped because zenborg derives
 * them from moments for free, and **those two are the whole argument for the
 * port** — the columns that made the Notion version rot stop existing.
 *
 * ── This script reads real contact data ─────────────────────────────────
 *
 * It writes an export file for local ingestion and prints only counts and
 * unmatched keys. No display name reaches stdout, a test fixture, or a commit
 * message. Run it, read the file, hand the file to wake.
 *
 *   (no flags)          dry run: report counts, write nothing
 *   --csv <path>        the Notion export. Without it, habits-only.
 *   --out <path>        where to write. Default $KAIROS_HOME/export/people-registry.json
 *   --write             actually write the export file
 *
 * Reads $KAIROS_HOME (default ~/.kairos). Read-only against the vault: it
 * never writes habits.json or moments.json, so the desktop app may stay open.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------- shapes

/**
 * A habit as it sits on disk, not as `src/domain` types it.
 *
 * `kind` is gone from the domain — a person is not a perennial — but it is
 * still in the vault until this migration and its sibling retire it. The
 * script reads the file, so the script keeps the field.
 */
export type HabitRecord = {
  id: string;
  name: string;
  areaId: string;
  tags?: string[];
  aliases?: string[];
  emoji?: string | null;
  isArchived?: boolean;
  rhythm?: { period: string; count: number };
  kind?: "person";
};

/** One row of the Notion CRM export, already parsed out of the CSV. */
export type CsvRow = {
  Name: string;
  Category?: string;
  Frequency?: string;
  Status?: string;
  Favorite?: string;
  feedbacks?: string;
};

export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

/** A person entity, in the shape D10 settles. */
export type RegistryPerson = {
  key: string;
  display: string;
  aliases?: string[];
  emoji?: string;
  category: string | null;
  cadence: Cadence | null;
  status: "active" | "paused";
  favorite: boolean;
  notes?: string;
  relation?: string;
  closeness?: string;
  metAt?: string;
  basePlace?: string;
};

export type ExportReport = {
  people: RegistryPerson[];
  /** Keys with a habit and no CSV row. */
  habitOnly: string[];
  /** Keys with a CSV row and no habit. */
  csvOnly: string[];
  /** Keys where habit rhythm and CSV frequency disagreed; the CSV won. */
  cadenceConflicts: string[];
  /** Two habits slugging to one key — a join that must not be guessed. */
  keyCollisions: string[];
};

// ---------------------------------------------------------------- pure helpers

/**
 * The contract's key rule (`entities.md`, "Deriving a key from a label").
 *
 * Copied rather than imported: this is a `.mts` script outside the app's
 * module graph, and the same rule already lives twice on purpose — once in
 * `src/domain/entities/Moment.ts`, once in `mcp-server/validation.ts`. All
 * three must agree, so all three carry the same tests.
 */
export const slugify = (label: string): string =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * The four buckets, from whatever the CRM column says.
 *
 * Unrecognised is null, never a guess. A wrong cadence is worse than an absent
 * one: absent reads as `unstated` and the queue stays quiet, while wrong makes
 * it nag on a rhythm nobody chose.
 */
export const parseCadence = (raw: string | undefined): Cadence | null => {
  const v = (raw ?? "").trim().toLowerCase();
  if (v.startsWith("week")) return "weekly";
  if (v.startsWith("month")) return "monthly";
  if (v.startsWith("quarter")) return "quarterly";
  if (v.startsWith("year") || v.startsWith("annual")) return "yearly";
  return null;
};

/** The habit's own rhythm, read as a bucket, for conflict detection only. */
export const cadenceFromRhythm = (
  rhythm: HabitRecord["rhythm"],
): Cadence | null => {
  if (!rhythm) return null;
  const period = rhythm.period.trim().toLowerCase();
  if (period.startsWith("week")) return "weekly";
  if (period.startsWith("month")) return "monthly";
  if (period.startsWith("quarter")) return "quarterly";
  if (period.startsWith("year") || period.startsWith("annual")) return "yearly";
  return null;
};

export const parseStatus = (raw: string | undefined): "active" | "paused" =>
  (raw ?? "").trim().toLowerCase().startsWith("paus") ? "paused" : "active";

export const parseFavorite = (raw: string | undefined): boolean => {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1" || v === "✓";
};

/**
 * The D8 attributes, lifted out of the tag drawer.
 *
 * `parent`, `close` and `imperial` are neither places nor rituals. They are
 * relation, closeness, and where the two of them met — facts about a person,
 * which is the registry's business. Lifting them leaves the tag drawer holding
 * only genuine tags.
 */
const D8_TAGS = {
  parent: ["relation", "parent"],
  close: ["closeness", "close"],
  imperial: ["metAt", "imperial"],
} as const;

const PLACE_PREFIX = "place-";

/**
 * Where a person is based, from a `place-<key>` tag on their habit.
 *
 * Only the prefixed form counts. The short-form duplicates the vault also
 * carries (`sp`, `bcn`, and friends) are ambiguous against ordinary tags, and
 * each one duplicates a `place-` tag that is already present — so reading only
 * the explicit form loses nothing and guesses nothing.
 */
export const basePlaceOf = (tags: readonly string[]): string | undefined => {
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (tag.startsWith(PLACE_PREFIX)) {
      const key = tag.slice(PLACE_PREFIX.length);
      if (key.length > 0) return key;
    }
  }
  return undefined;
};

/**
 * Join the two sources into one registry export.
 *
 * Pure: no filesystem, no clock, no process. Every decision this migration
 * makes is testable from synthetic rows, which matters more here than usual
 * because the real input is contact data that must never enter a fixture.
 */
export const buildRegistryExport = (
  habits: readonly HabitRecord[],
  csvRows: readonly CsvRow[],
): ExportReport => {
  const byKey = new Map<string, CsvRow>();
  const csvSeen = new Set<string>();
  for (const row of csvRows) {
    const key = slugify(row.Name ?? "");
    if (key.length === 0) continue;
    csvSeen.add(key);
    byKey.set(key, row);
  }

  const people: RegistryPerson[] = [];
  const habitOnly: string[] = [];
  const cadenceConflicts: string[] = [];
  const keyCollisions: string[] = [];
  const claimed = new Set<string>();
  const matched = new Set<string>();

  for (const habit of habits) {
    if (habit.kind !== "person") continue;
    // Archived people are excluded from the export: the registry is the
    // active roster wake ingests, not a full history of everyone the garden
    // has ever known.
    if (habit.isArchived === true) continue;

    const key = slugify(habit.name);
    if (key.length === 0) continue;
    if (claimed.has(key)) {
      // Two people slugging to one key is a collision wake must resolve, and
      // silently letting the second overwrite the first would lose a person.
      keyCollisions.push(key);
      continue;
    }
    claimed.add(key);

    const tags = habit.tags ?? [];
    const row = byKey.get(key);
    if (row) matched.add(key);
    else habitOnly.push(key);

    const csvCadence = parseCadence(row?.Frequency);
    const habitCadence = cadenceFromRhythm(habit.rhythm);
    // The CSV wins. It is the record that was curated on purpose; only twelve
    // habits carry a rhythm, and several of those were set once and forgotten.
    if (
      csvCadence !== null &&
      habitCadence !== null &&
      csvCadence !== habitCadence
    ) {
      cadenceConflicts.push(key);
    }

    const notes = (row?.feedbacks ?? "").trim();
    const aliases = (habit.aliases ?? []).filter((a) => a.trim().length > 0);
    const emoji = (habit.emoji ?? "").trim();
    const basePlace = basePlaceOf(tags);

    const person: RegistryPerson = {
      key,
      display: habit.name.trim(),
      ...(aliases.length > 0 ? { aliases } : {}),
      ...(emoji.length > 0 ? { emoji } : {}),
      category: (row?.Category ?? "").trim() || null,
      cadence: csvCadence ?? habitCadence,
      status: parseStatus(row?.Status),
      favorite: parseFavorite(row?.Favorite),
      ...(notes.length > 0 ? { notes } : {}),
      ...(basePlace !== undefined ? { basePlace } : {}),
    };

    for (const [tag, [field]] of Object.entries(D8_TAGS)) {
      if (tags.some((t) => t.trim().toLowerCase() === tag)) {
        (person as Record<string, unknown>)[field] = tag;
      }
    }

    people.push(person);
  }

  const csvOnly = [...csvSeen].filter((k) => !matched.has(k)).sort();

  return {
    people: people.sort((a, b) => a.key.localeCompare(b.key)),
    habitOnly: habitOnly.sort(),
    csvOnly,
    cadenceConflicts: cadenceConflicts.sort(),
    keyCollisions: keyCollisions.sort(),
  };
};

/**
 * A CSV parser that survives quoted fields with commas and newlines in them.
 *
 * `feedbacks` is free text, so a naive `split(",")` corrupts nineteen rows.
 * Small enough to keep here rather than take a dependency for a script that
 * runs once.
 */
export const parseCsv = (text: string): CsvRow[] => {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((r) => r.some((c) => c.trim().length > 0))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        obj[h.trim()] = (r[i] ?? "").trim();
      });
      return obj as unknown as CsvRow;
    });
};

// ---------------------------------------------------------------- io

const kairosHome = (): string =>
  process.env.KAIROS_HOME ?? join(homedir(), ".kairos");

const main = (): number => {
  const { values } = parseArgs({
    options: {
      csv: { type: "string" },
      out: { type: "string" },
      write: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help === true) {
    process.stdout.write(
      [
        "people-to-registry — export person-habits to wake's registry",
        "",
        "  (no flags)     dry run: counts only, writes nothing",
        "  --csv <path>   the Notion CRM export. Without it, habits-only.",
        "  --out <path>   default $KAIROS_HOME/export/people-registry.json",
        "  --write        write the export file",
        "",
        "  Read-only against the vault — it never touches habits.json or",
        "  moments.json, so the desktop app may stay open.",
        "",
        "  Prints counts and unmatched KEYS only. Never display names.",
        "",
      ].join("\n"),
    );
    return 0;
  }

  const vault = kairosHome();
  const habitsPath = join(vault, "habits.json");
  if (!existsSync(habitsPath)) {
    process.stderr.write(`not found: ${habitsPath} (set KAIROS_HOME?)\n`);
    return 2;
  }
  const habits = Object.values(
    JSON.parse(readFileSync(habitsPath, "utf8")) as Record<string, HabitRecord>,
  );

  let csvRows: CsvRow[] = [];
  if (values.csv !== undefined) {
    if (!existsSync(values.csv)) {
      process.stderr.write(`not found: ${values.csv}\n`);
      return 2;
    }
    csvRows = parseCsv(readFileSync(values.csv, "utf8"));
  }

  const report = buildRegistryExport(habits, csvRows);
  const out: string[] = [];
  const line = (s = "") => out.push(s);

  line("people-to-registry");
  line("==================");
  line(`  vault              ${vault}`);
  line(`  habits in file     ${habits.length}`);
  line(`  csv rows           ${csvRows.length}`);
  line();
  line(`people exported      ${report.people.length}`);
  line(
    `  with a cadence     ${report.people.filter((p) => p.cadence !== null).length}`,
  );
  line(
    `  paused             ${report.people.filter((p) => p.status === "paused").length}`,
  );
  line(
    `  with a base place  ${report.people.filter((p) => p.basePlace !== undefined).length}`,
  );
  line(
    `  with notes         ${report.people.filter((p) => p.notes !== undefined).length}`,
  );
  line();
  // Keys, not names — a key is what wake needs to resolve the mismatch, and
  // it is the least identifying thing that still makes the report actionable.
  //
  // Capped, because "the ones that did not match" is only a useful list while
  // it is a short one. Run without a CSV and every person is unmatched, so an
  // uncapped list prints the entire contact roster to a terminal, a scrollback
  // and whatever is reading over its shoulder. The count still tells the truth.
  const LIST_CAP = 10;
  const listed = (label: string, keys: readonly string[]) => {
    line(`${label} ${keys.length}`);
    if (csvRows.length === 0) {
      // No CSV means no join was attempted. Naming every key would describe a
      // mismatch that never happened.
      return;
    }
    for (const k of keys.slice(0, LIST_CAP)) line(`  · ${k}`);
    if (keys.length > LIST_CAP) {
      line(`  … and ${keys.length - LIST_CAP} more (see the export file)`);
    }
  };
  listed("habit with no csv row ", report.habitOnly);
  listed("csv row with no habit ", report.csvOnly);
  listed("cadence conflicts (csv wins)", report.cadenceConflicts);

  if (report.keyCollisions.length > 0) {
    line();
    line("PROBLEMS");
    for (const k of report.keyCollisions) {
      line(`  [error] two habits slug to one key: ${k}`);
    }
  }

  process.stdout.write(`${out.join("\n")}\n`);

  if (report.keyCollisions.length > 0) {
    process.stderr.write(
      "\nrefusing to write — resolve the collisions above\n",
    );
    return 2;
  }

  const outPath = values.out ?? join(vault, "export", "people-registry.json");

  if (values.write !== true) {
    process.stdout.write(
      `\nDRY RUN — nothing written. Re-run with --write to emit ${outPath}\n`,
    );
    return 0;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify({ people: report.people }, null, 2)}\n`,
  );
  process.stdout.write(`\nwritten: ${outPath}\n`);
  return 0;
};

process.exitCode = main();
