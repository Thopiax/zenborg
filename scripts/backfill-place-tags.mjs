#!/usr/bin/env node
/**
 * Backfill `place-` / `person-` tags onto historical moments, inferred from
 * the cycle each moment belongs to.
 *
 * A moment is matched to a cycle by `cycleId` when set, otherwise by its
 * `day` falling inside a cycle's [startDate, endDate]. Tags are ADDITIVE and
 * the run is idempotent — a moment already carrying the tag is untouched.
 *
 *   node scripts/backfill-place-tags.mjs            # dry-run (default): prints the diff
 *   node scripts/backfill-place-tags.mjs --apply    # writes moments.json (atomic)
 *
 * Vault resolution mirrors mcp-server/vault.ts: $KAIROS_HOME, else ~/.kairos.
 * Zenborg is the writer for moments.json — run this while the desktop app is
 * closed, or let the Rust watcher pick up the external edit.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ── The mapping: cycle name → tags every moment of that cycle inherits ──
// Edit freely; unknown cycles are listed at the end of every run.
const CYCLE_TAGS = {
  'SP cycle': ['place-sao-paulo'],
  Minas: ['place-minas'],
  RJ: ['place-rio'],
  Sampa: ['place-sao-paulo'],
  sampa: ['place-sao-paulo'],
  'itacaré': ['place-itacare'],
  ilhabela: ['place-ilhabela'],
  'SP - last cycle': ['place-sao-paulo'],
  Paris: ['place-paris'],
  'Paris - bday': ['place-paris'],
  'back 2 barna': ['place-barcelona'],
  'bye bye barna': ['place-barcelona'],
  Aiguablava: ['place-aiguablava'],
  'official parisian': ['place-paris'],
  'bad bunny marseille': ['place-marseille'],
  'paris pitstop': ['place-paris'],
  chindrieux: ['place-chindrieux'],
  'SP bdays + Kim': ['place-sao-paulo', 'person-lena'],
  // ── Needs Rafa's call — where were these? ──
  // 'First Cycle': [],
  // Christmas: [],
  // Reveillon: [],
  // carnaval: [],
  // Vipassana: [],
  // 'baemish wedding': [],
  // 'stefan wedding': [],
};

// Mirrors normalizeSingleTag in mcp-server/validation.ts.
const TAG_VALID = /^[a-z0-9][a-z0-9-]{0,19}$/;

const APPLY = process.argv.includes('--apply');
const VAULT = process.env.KAIROS_HOME ?? path.join(os.homedir(), '.kairos');

for (const [cycle, tags] of Object.entries(CYCLE_TAGS)) {
  for (const tag of tags) {
    if (!TAG_VALID.test(tag)) {
      console.error(`Invalid tag "${tag}" on cycle "${cycle}" — lowercase letters/digits/dashes, max 20 chars.`);
      process.exit(1);
    }
  }
}

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(VAULT, `${name}.json`), 'utf8'));

const cycles = Object.values(readJson('cycles'));
const momentsById = readJson('moments');

const cycleById = new Map(cycles.map((c) => [c.id, c]));
const cycleForDay = (day) =>
  cycles.find((c) => day >= c.startDate && (c.endDate === null || day <= c.endDate));

let touched = 0;
let skippedNoCycle = 0;
const unknownCycles = new Map(); // name → moment count
const perCycle = new Map(); // name → tagged count

for (const m of Object.values(momentsById)) {
  const cycle = m.cycleId !== null ? cycleById.get(m.cycleId) : m.day !== null ? cycleForDay(m.day) : undefined;
  if (!cycle) {
    skippedNoCycle += 1;
    continue;
  }
  const inherit = CYCLE_TAGS[cycle.name];
  if (!inherit) {
    unknownCycles.set(cycle.name, (unknownCycles.get(cycle.name) ?? 0) + 1);
    continue;
  }
  const current = m.tags ?? [];
  const missing = inherit.filter((t) => !current.includes(t));
  if (missing.length === 0) continue;
  momentsById[m.id] = { ...m, tags: [...current, ...missing], updatedAt: new Date().toISOString() };
  perCycle.set(cycle.name, (perCycle.get(cycle.name) ?? 0) + 1);
  touched += 1;
  if (!APPLY) console.log(`  + ${m.day ?? '(unallocated)'} ${m.name} ← ${missing.join(', ')}`);
}

console.log(`\n${APPLY ? 'Applied' : 'Dry-run'} against ${VAULT}`);
for (const [name, n] of perCycle) console.log(`  ${name}: ${n} moments tagged`);
console.log(`  total: ${touched} moments${APPLY ? ' written' : ' would change'}, ${skippedNoCycle} without cycle or day`);
if (unknownCycles.size > 0) {
  console.log('  unmapped cycles (add to CYCLE_TAGS):');
  for (const [name, n] of unknownCycles) console.log(`    "${name}" — ${n} moments`);
}

if (APPLY && touched > 0) {
  const target = path.join(VAULT, 'moments.json');
  const tmp = path.join(VAULT, `.moments.json.tmp-${process.pid}`);
  fs.writeFileSync(tmp, `${JSON.stringify(momentsById, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, target);
  console.log('  moments.json written atomically.');
}
