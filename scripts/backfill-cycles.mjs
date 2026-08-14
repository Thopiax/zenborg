#!/usr/bin/env node
/**
 * Backfill historical cycles from a travel-log CSV (Notion export shape:
 * Name, Country, "Month D, YYYY → Month D, YYYY", Days, Place).
 *
 * Only stays that END before the garden's first real cycle are created —
 * the zenborg era already has its own cycles; the log's overlapping rows
 * are used to *resolve places* for existing cycles, never to duplicate them.
 * Idempotent: a cycle with the same startDate is never created twice.
 *
 *   node scripts/backfill-cycles.mjs                # dry-run
 *   node scripts/backfill-cycles.mjs --apply        # writes cycles.json (atomic)
 *
 * CSV lives OUTSIDE version control: scripts/travel-log.local.csv (or --csv).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const VAULT = process.env.KAIROS_HOME ?? path.join(os.homedir(), '.kairos');
const csvArg = process.argv.indexOf('--csv');
const CSV_PATH =
  csvArg !== -1 ? process.argv[csvArg + 1] : path.join(import.meta.dirname, 'travel-log.local.csv');
if (!fs.existsSync(CSV_PATH)) {
  console.error(`No travel log at ${CSV_PATH} — copy the export there or pass --csv <path>.`);
  process.exit(1);
}

const MONTHS = { January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
  July: '07', August: '08', September: '09', October: '10', November: '11', December: '12' };
const parseDay = (s) => {
  const m = s.trim().match(/^(\w+) (\d+), (\d+)$/);
  return m ? `${m[3]}-${MONTHS[m[1]]}-${String(m[2]).padStart(2, '0')}` : null;
};

// Minimal CSV parse (quoted fields with commas).
function parseCsv(text) {
  return text.replace(/^﻿/, '').split('\n').filter(Boolean).slice(1).map((line) => {
    const fields = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { fields.push(cur); cur = ''; }
      else cur += ch;
    }
    fields.push(cur);
    return fields;
  });
}

const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8')).map(([name, country, dates]) => {
  const [a, b] = dates.split('→').map((s) => parseDay(s));
  return { name: name.trim(), country: country.trim(), start: a, end: b ?? a };
}).filter((r) => r.start).sort((a, b) => a.start.localeCompare(b.start));

const cycles = readVault('cycles');
const existingStarts = new Set(Object.values(cycles).map((c) => c.startDate));
const firstRealCycle = Object.values(cycles)
  .map((c) => c.startDate).sort()[0] ?? '9999-12-31';

let created = 0, skippedOverlap = 0, skippedDup = 0;
for (const r of rows) {
  if (r.end >= firstRealCycle) { skippedOverlap += 1; continue; }
  if (existingStarts.has(r.start)) { skippedDup += 1; continue; }
  const now = new Date().toISOString();
  const cycle = { id: crypto.randomUUID(), name: r.name, startDate: r.start, endDate: r.end,
    intention: null, reflection: null, createdAt: now, updatedAt: now };
  cycles[cycle.id] = cycle;
  existingStarts.add(r.start);
  created += 1;
  if (!APPLY) console.log(`  + ${r.start} → ${r.end}  ${r.name}`);
}

console.log(`\n${APPLY ? 'Applied' : 'Dry-run'} against ${VAULT}`);
console.log(`  ${created} historical cycles${APPLY ? ' written' : ' would be created'} (era before ${firstRealCycle})`);
console.log(`  ${skippedOverlap} rows overlap the zenborg era (place evidence only), ${skippedDup} already present`);

if (APPLY && created > 0) {
  const target = path.join(VAULT, 'cycles.json');
  const tmp = path.join(VAULT, `.cycles.json.tmp-${process.pid}`);
  fs.writeFileSync(tmp, `${JSON.stringify(cycles, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, target);
  console.log('  cycles.json written atomically.');
}

function readVault(name) {
  return JSON.parse(fs.readFileSync(path.join(VAULT, `${name}.json`), 'utf8'));
}
