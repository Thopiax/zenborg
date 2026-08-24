#!/usr/bin/env -S node --experimental-transform-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
/**
 * seed-people-places — populate people.json and places.json from observatory,
 * then sweep moments converting place-/person- tags and bare aliases to entity
 * refs (placeIds/personIds).
 *
 * Dry run by default. Pass --write to apply.
 *
 * Data sources:
 *   observatory/scripts/people.local.json    -> people.json
 *   observatory/scripts/places.local.json    -> places.json
 *   observatory/scripts/place-normalize.local.json  -> bare tag aliases (sp -> sao-paulo)
 *
 * Moment tag sweep:
 *   - `place-<key>` tag -> placeIds, tag removed
 *   - `person-<key>` tag -> personIds, tag removed
 *   - bare alias (`sp`, `bcn`, etc.) -> placeIds, tag removed
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const WRITE = process.argv.includes("--write");
const VAULT = process.env.KAIROS_HOME ?? path.join(process.env.HOME!, ".kairos");
const OBSERVATORY = path.resolve(
  import.meta.dirname!,
  "../../observatory/scripts",
);

function readJson(p: string): Record<string, any> {
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p: string, data: Record<string, any>): void {
  const tmp = `${p}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, p);
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Load observatory data ──

const obsPeople = readJson(path.join(OBSERVATORY, "people.local.json"));
const obsPlaces = readJson(path.join(OBSERVATORY, "places.local.json"));
const placeNormalize = readJson(
  path.join(OBSERVATORY, "place-normalize.local.json"),
);

delete obsPeople._comment;
delete obsPlaces._comment;

// ── Load or create vault collections ──

const peoplePath = path.join(VAULT, "people.json");
const placesPath = path.join(VAULT, "places.json");
const momentsPath = path.join(VAULT, "moments.json");

const people: Record<string, any> = readJson(peoplePath);
const places: Record<string, any> = readJson(placesPath);
const moments: Record<string, any> = readJson(momentsPath);

// ── Seed people ──

const peopleByKey = new Map(Object.values(people).map((p: any) => [p.key, p]));
let peopleCreated = 0;
let peopleSkipped = 0;

for (const [key, entry] of Object.entries(obsPeople)) {
  if (peopleByKey.has(key)) {
    peopleSkipped++;
    continue;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  people[id] = {
    id,
    name: (entry as any).display,
    key,
    cadence: null,
    status: (entry as any).status === "paused" ? "paused" : "active",
    category: null,
    basePlace: null,
    emoji: null,
    createdAt: now,
    updatedAt: now,
  };
  peopleByKey.set(key, people[id]);
  peopleCreated++;
}

// ── Seed places ──

const placesByKey = new Map(Object.values(places).map((p: any) => [p.key, p]));
let placesCreated = 0;
let placesSkipped = 0;

for (const [key, entry] of Object.entries(obsPlaces)) {
  if (placesByKey.has(key)) {
    placesSkipped++;
    continue;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  places[id] = {
    id,
    name: (entry as any).display,
    key,
    parentKey: (entry as any).within ?? null,
    emoji: null,
    url: null,
    createdAt: now,
    updatedAt: now,
  };
  placesByKey.set(key, places[id]);
  placesCreated++;
}

// ── Build alias map: bare tag -> place key ──

const aliasToPlace = new Map<string, string>();
for (const [alias, target] of Object.entries(placeNormalize)) {
  const placeKey = (target as string).replace(/^place-/, "");
  aliasToPlace.set(alias, placeKey);
}

// ── Sweep moments: convert tags to entity refs ──

let momentsUpdated = 0;
let tagsConverted = 0;

for (const m of Object.values(moments) as any[]) {
  if (!m.tags || !Array.isArray(m.tags) || m.tags.length === 0) continue;

  const personIds = new Set<string>(m.personIds ?? []);
  const placeIds = new Set<string>(m.placeIds ?? []);
  const keepTags: string[] = [];
  let changed = false;

  for (const tag of m.tags) {
    if (tag.startsWith("place-")) {
      const key = tag.slice(6);
      if (placesByKey.has(key)) {
        placeIds.add(key);
        changed = true;
        tagsConverted++;
        continue;
      }
    }
    if (tag.startsWith("person-")) {
      const key = tag.slice(7);
      if (peopleByKey.has(key)) {
        personIds.add(key);
        changed = true;
        tagsConverted++;
        continue;
      }
    }
    if (aliasToPlace.has(tag)) {
      const placeKey = aliasToPlace.get(tag)!;
      if (placesByKey.has(placeKey)) {
        placeIds.add(placeKey);
        changed = true;
        tagsConverted++;
        continue;
      }
    }
    keepTags.push(tag);
  }

  if (changed) {
    m.tags = keepTags.length > 0 ? keepTags : null;
    if (personIds.size > 0) m.personIds = [...personIds];
    if (placeIds.size > 0) m.placeIds = [...placeIds];
    m.updatedAt = new Date().toISOString();
    momentsUpdated++;
  }
}

// ── Report ──

console.log(`
seed-people-places
==================
  vault              ${VAULT}
  observatory        ${OBSERVATORY}

people
  created            ${peopleCreated}
  skipped (exists)   ${peopleSkipped}

places
  created            ${placesCreated}
  skipped (exists)   ${placesSkipped}

moment tag sweep
  moments updated    ${momentsUpdated}
  tags converted     ${tagsConverted}
  alias map entries  ${aliasToPlace.size}
`);

if (WRITE) {
  writeJson(peoplePath, people);
  writeJson(placesPath, places);
  writeJson(momentsPath, moments);
  console.log("WRITTEN to vault.");
} else {
  console.log("DRY RUN — pass --write to apply.");
}
