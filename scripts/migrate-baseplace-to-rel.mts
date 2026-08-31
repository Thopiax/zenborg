#!/usr/bin/env node
/**
 * migrate-baseplace-to-rel — convert legacy person.basePlace strings to
 * proper "based-in" relationships.
 *
 * For each person with a non-null basePlace key and no existing based-in
 * relationship: creates a directed relationship from person→place and
 * clears the basePlace field.
 *
 * DRY-RUN BY DEFAULT. Pass --write to apply.
 *
 * Usage:
 *   node scripts/migrate-baseplace-to-rel.mts              # dry run
 *   node scripts/migrate-baseplace-to-rel.mts --write      # apply
 */

import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { write: { type: "boolean" } } });
const write = values.write === true;

const VAULT = process.env.KAIROS_HOME ?? join(homedir(), ".kairos");
const BASED_IN = "based-in";

type Person = { id: string; name: string; basePlace?: string | null; [k: string]: unknown };
type Place = { id: string; key: string; name: string; [k: string]: unknown };
type Rel = {
  id: string;
  fromType: string; fromId: string;
  toType: string; toId: string;
  label: string; direction: string;
  [k: string]: unknown;
};

function readJson<T>(name: string): Record<string, T> {
  const p = join(VAULT, `${name}.json`);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf-8"));
}

function atomicWrite(name: string, data: Record<string, unknown>) {
  const target = join(VAULT, `${name}.json`);
  const tmp = `${target}.tmp`;
  const fd = openSync(tmp, "w");
  writeSync(fd, JSON.stringify(data, null, 2));
  fsyncSync(fd);
  closeSync(fd);
  renameSync(tmp, target);
}

const people = readJson<Person>("people");
const places = readJson<Place>("places");
const rels = readJson<Rel>("relationships");

const placeByKey = new Map<string, Place>();
for (const p of Object.values(places)) placeByKey.set(p.key, p);

function hasBasedInRel(personId: string): boolean {
  return Object.values(rels).some(
    (r) =>
      r.label === BASED_IN &&
      ((r.fromType === "person" && r.fromId === personId && r.toType === "place") ||
       (r.toType === "person" && r.toId === personId && r.fromType === "place")),
  );
}

const now = new Date().toISOString();
let migrated = 0;
let alreadyHasRel = 0;
let noMatchingPlace = 0;
let noBasePlace = 0;

for (const person of Object.values(people)) {
  if (!person.basePlace) {
    noBasePlace++;
    continue;
  }
  if (hasBasedInRel(person.id)) {
    alreadyHasRel++;
    continue;
  }
  const place = placeByKey.get(person.basePlace);
  if (!place) {
    noMatchingPlace++;
    console.log(`  ⚠ ${person.name}: basePlace="${person.basePlace}" has no matching place entity`);
    continue;
  }

  const relId = randomUUID();
  rels[relId] = {
    id: relId,
    fromType: "person",
    fromId: person.id,
    toType: "place",
    toId: place.id,
    label: BASED_IN,
    direction: "directed",
    createdAt: now,
    updatedAt: now,
  };
  person.basePlace = null;
  person.updatedAt = now;
  migrated++;
  console.log(`  ✓ ${person.name} → ${place.name}`);
}

console.log(`\nmigrate-baseplace-to-rel`);
console.log(`========================`);
console.log(`  vault              ${VAULT}`);
console.log(`  people             ${Object.keys(people).length}`);
console.log(`  places             ${Object.keys(places).length}`);
console.log(`  no basePlace       ${noBasePlace}`);
console.log(`  already has rel    ${alreadyHasRel}`);
console.log(`  no matching place  ${noMatchingPlace}`);
console.log(`  migrated           ${migrated}`);

if (!write) {
  console.log(`\nDRY RUN — nothing written. Re-run with --write to apply.`);
} else if (migrated > 0) {
  atomicWrite("people", people);
  atomicWrite("relationships", rels);
  console.log(`\nWritten: people.json, relationships.json`);
} else {
  console.log(`\nNothing to migrate.`);
}
