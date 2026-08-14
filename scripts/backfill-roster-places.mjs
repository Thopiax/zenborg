#!/usr/bin/env node
/**
 * Normalize the roster's informal place vocabulary into canonical `place-`
 * tags on habits — additive and idempotent; informal tags are kept (they are
 * the human vocabulary; the canonical tag is the machine key).
 *
 * Mapping lives OUTSIDE version control: scripts/place-normalize.local.json
 * (or --map <path>). Shape (fictional example):
 *   { "atl": "place-atlantis", "av": "place-avalon" }
 *
 *   node scripts/backfill-roster-places.mjs            # dry-run
 *   node scripts/backfill-roster-places.mjs --apply    # writes habits.json (atomic)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const APPLY = process.argv.includes('--apply');
const VAULT = process.env.KAIROS_HOME ?? path.join(os.homedir(), '.kairos');

const mapArgIdx = process.argv.indexOf('--map');
const MAP_PATH =
  mapArgIdx !== -1
    ? process.argv[mapArgIdx + 1]
    : path.join(import.meta.dirname, 'place-normalize.local.json');
if (!fs.existsSync(MAP_PATH)) {
  console.error(`No mapping file at ${MAP_PATH} — create it (see header) or pass --map <path>.`);
  process.exit(1);
}
const INFORMAL_TO_PLACE = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

const habitsPath = path.join(VAULT, 'habits.json');
const habitsById = JSON.parse(fs.readFileSync(habitsPath, 'utf8'));

let touched = 0;
for (const h of Object.values(habitsById)) {
  const current = h.tags ?? [];
  const missing = current
    .map((t) => INFORMAL_TO_PLACE[t])
    .filter((p) => p && !current.includes(p));
  if (missing.length === 0) continue;
  habitsById[h.id] = { ...h, tags: [...current, ...missing], updatedAt: new Date().toISOString() };
  touched += 1;
  if (!APPLY) console.log(`  + ${h.name}${h.kind === 'person' ? ' (person)' : ''} ← ${missing.join(', ')}`);
}

console.log(`\n${APPLY ? 'Applied' : 'Dry-run'} against ${VAULT}`);
console.log(`  ${touched} habits${APPLY ? ' written' : ' would change'}`);

if (APPLY && touched > 0) {
  const tmp = path.join(VAULT, `.habits.json.tmp-${process.pid}`);
  fs.writeFileSync(tmp, `${JSON.stringify(habitsById, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, habitsPath);
  console.log('  habits.json written atomically.');
}
