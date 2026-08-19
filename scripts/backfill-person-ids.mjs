#!/usr/bin/env node
/**
 * Backfill `Moment.personIds` from what history already recorded.
 *
 * Two deterministic signals, both additive and idempotent:
 *   1. `person-<key>` tags on a moment, matched against person-habit
 *      names/aliases (slugged).
 *   2. A person's name or alias appearing as a whole word in the moment's
 *      name ("Padel w/ Ada" → Ada's habit id). Exact, case-insensitive,
 *      word-boundary — conservative by design; no fuzzy matching.
 *
 * A moment whose `habitId` IS the person needs nothing — that link already
 * exists; this script fills the with-whom for moments anchored elsewhere.
 *
 *   node scripts/backfill-person-ids.mjs            # dry-run: prints the diff
 *   node scripts/backfill-person-ids.mjs --apply    # writes moments.json (atomic)
 *
 * Reads the person roster live from habits.json (`kind: "person"`), so no
 * names live in this file. Run with the desktop app closed, or let the
 * watcher pick up the edit.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const APPLY = process.argv.includes("--apply");
const VAULT = process.env.KAIROS_HOME ?? path.join(os.homedir(), ".kairos");

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(VAULT, `${name}.json`), "utf8"));

const slug = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const habits = Object.values(readJson("habits"));
const momentsById = readJson("moments");

const people = habits.filter((h) => h.kind === "person");
if (people.length === 0) {
  console.error(
    'No habits with kind:"person" found — has the people migration run?',
  );
  process.exit(1);
}

// key → person id, from slugged names and aliases
const byKey = new Map();
for (const p of people) {
  for (const name of [p.name, ...(p.aliases ?? [])])
    byKey.set(slug(name), p.id);
}
// word-boundary regex per person, longest names first so "Jean Michel" wins over "Jean"
const namePatterns = people
  .flatMap((p) =>
    [p.name, ...(p.aliases ?? [])].map((n) => ({ name: n, id: p.id })),
  )
  .sort((a, b) => b.name.length - a.name.length)
  .map(({ name, id }) => ({
    re: new RegExp(
      `(?:^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^\\p{L}]|$)`,
      "iu",
    ),
    id,
  }));

let touched = 0;
let viaTag = 0;
let viaName = 0;

for (const m of Object.values(momentsById)) {
  const found = new Set(m.personIds ?? []);
  const before = found.size;

  for (const t of m.tags ?? []) {
    if (!t.startsWith("person-")) continue;
    const id = byKey.get(t.slice("person-".length));
    if (id && id !== m.habitId && !found.has(id)) {
      found.add(id);
      viaTag += 1;
    }
  }
  for (const { re, id } of namePatterns) {
    if (id === m.habitId || found.has(id)) continue;
    if (re.test(m.name)) {
      found.add(id);
      viaName += 1;
    }
  }

  if (found.size === before) continue;
  momentsById[m.id] = {
    ...m,
    personIds: Array.from(found),
    updatedAt: new Date().toISOString(),
  };
  touched += 1;
  if (!APPLY) {
    const names = Array.from(found).map(
      (id) => people.find((p) => p.id === id)?.name ?? id,
    );
    console.log(
      `  + ${m.day ?? "(unallocated)"} ${m.name} ← ${names.join(", ")}`,
    );
  }
}

console.log(`\n${APPLY ? "Applied" : "Dry-run"} against ${VAULT}`);
console.log(
  `  ${touched} moments${APPLY ? " written" : " would change"} (${viaTag} links via person- tags, ${viaName} via name match)`,
);

if (APPLY && touched > 0) {
  const target = path.join(VAULT, "moments.json");
  const tmp = path.join(VAULT, `.moments.json.tmp-${process.pid}`);
  fs.writeFileSync(tmp, `${JSON.stringify(momentsById, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, target);
  console.log("  moments.json written atomically.");
}
