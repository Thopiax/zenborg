#!/usr/bin/env node
/**
 * Migrate legacy place tags on habits to proper `placeIds` references.
 *
 * Tags migrated:
 *   place-paris, place-sao-paulo, place-london, place-barcelona,
 *   place-new-york, place-madrid              (long-form)
 *   paris, sp, london, bcn, nyc, madrid       (shorthands)
 *
 * For each habit carrying one of these tags:
 *   1. Add the corresponding place UUID to `placeIds` (deduped)
 *   2. Remove the tag
 *
 * Idempotent — a habit already carrying the placeId is not doubled.
 *
 *   node scripts/migrate-place-tags-to-ids.mjs            # dry-run
 *   node scripts/migrate-place-tags-to-ids.mjs --apply    # writes habits.json
 *
 * Run while the desktop app is closed, or let the Rust watcher pick up
 * the external edit.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const APPLY = process.argv.includes("--apply");
const VAULT = process.env.KAIROS_HOME ?? path.join(os.homedir(), ".kairos");

// tag → place key (resolved to UUID at runtime from places.json)
const TAG_TO_PLACE_KEY = {
  "place-paris":      "paris",
  "place-sao-paulo":  "sao-paulo",
  "place-london":     "london",
  "place-barcelona":  "barcelona",
  "place-new-york":   "new-york",
  "place-madrid":     "madrid",
  "paris":            "paris",
  "sp":               "sao-paulo",
  "london":           "london",
  "bcn":              "barcelona",
  "nyc":              "new-york",
  "madrid":           "madrid",
};

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(VAULT, `${name}.json`), "utf8"));

const places = readJson("places");
const habitsById = readJson("habits");

// Build key → UUID lookup
const placeIdByKey = new Map();
for (const p of Object.values(places)) {
  placeIdByKey.set(p.key, p.id);
}

// Validate all mappings resolve
for (const [tag, key] of Object.entries(TAG_TO_PLACE_KEY)) {
  if (!placeIdByKey.has(key)) {
    console.error(`Tag "${tag}" maps to place key "${key}" which does not exist in places.json`);
    process.exit(1);
  }
}

let touched = 0;
let tagsRemoved = 0;
let idsAdded = 0;

for (const h of Object.values(habitsById)) {
  const tags = h.tags ?? [];
  const matchingTags = tags.filter((t) => t in TAG_TO_PLACE_KEY);
  if (matchingTags.length === 0) continue;

  const existingPlaceIds = new Set(h.placeIds ?? []);
  const newTags = tags.filter((t) => !(t in TAG_TO_PLACE_KEY));
  let addedForHabit = 0;

  for (const tag of matchingTags) {
    const placeId = placeIdByKey.get(TAG_TO_PLACE_KEY[tag]);
    if (!existingPlaceIds.has(placeId)) {
      existingPlaceIds.add(placeId);
      addedForHabit++;
    }
  }

  habitsById[h.id] = {
    ...h,
    tags: newTags,
    placeIds: [...existingPlaceIds],
    updatedAt: new Date().toISOString(),
  };

  touched++;
  tagsRemoved += matchingTags.length;
  idsAdded += addedForHabit;

  if (!APPLY) {
    const removedStr = matchingTags.join(", ");
    const addedStr = addedForHabit > 0 ? ` +${addedForHabit} placeIds` : " (already had ids)";
    console.log(`  ${h.name}: -[${removedStr}]${addedStr}`);
  }
}

console.log(`\n${APPLY ? "Applied" : "Dry-run"} against ${VAULT}`);
console.log(`  habits touched: ${touched}`);
console.log(`  tags removed: ${tagsRemoved}`);
console.log(`  placeIds added: ${idsAdded}`);

if (APPLY && touched > 0) {
  const target = path.join(VAULT, "habits.json");
  const tmp = path.join(VAULT, `.habits.json.tmp-${process.pid}`);
  fs.writeFileSync(tmp, `${JSON.stringify(habitsById, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, target);
  console.log("  habits.json written atomically.");
}
