#!/usr/bin/env node
/**
 * Backfill cycle reflections from journal entries — LOCAL inference only.
 *
 * For each cycle with an empty `reflection`, gathers the journal entries
 * whose dates fall inside the cycle, asks a local ollama model for a short
 * first-person reflection, and writes it to the cycle. A reflection the
 * gardener wrote is NEVER overwritten. Journal prose flows journal → local
 * model → vault and nowhere else (privacy = locality, as wake dive).
 *
 *   node scripts/summarize-cycles.mjs                          # dry-run: cycle → entry count
 *   node scripts/summarize-cycles.mjs --apply --limit 5        # write 5, newest first
 *   node scripts/summarize-cycles.mjs --apply                  # the full batch (hours on 35b)
 *
 * Flags: --journal <dir>  (default: the saperene obsidian backup Journal)
 *        --model <name>   (default: qwen3.6:35b — wake dive's model)
 *        --limit <n>      (default: all)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply');
const VAULT = process.env.KAIROS_HOME ?? path.join(os.homedir(), '.kairos');
// Era routing is natural: every journal dir contributes the dated entries in
// a cycle's window — supernote carries recent seasons, saperene the old ones.
const JOURNALS = arg('journal')
  ? [arg('journal')]
  : [
      path.join(os.homedir(), 'Documents/Supernote/journals'),
      path.join(os.homedir(), 'Developer/sandbox/saperene-obsidian-backup/Journal'),
    ].filter((d) => fs.existsSync(d));
const MODEL = arg('model') ?? 'qwen3.6:35b';
const LIMIT = Number(arg('limit') ?? Infinity);
const PER_ENTRY_CAP = 1500, TOTAL_CAP = 12000;

const cyclesPath = path.join(VAULT, 'cycles.json');
const cycles = JSON.parse(fs.readFileSync(cyclesPath, 'utf8'));

// index journal entries by day — filename date in YYYY-MM-DD or YYYYMMDD form
const byDay = new Map();
for (const dir of JOURNALS) {
  let count = 0;
  for (const fn of fs.readdirSync(dir)) {
    if (!fn.endsWith('.md') && !fn.endsWith('.txt')) continue;
    const m = fn.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
    if (!m) continue;
    const day = `${m[1]}-${m[2]}-${m[3]}`;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(path.join(dir, fn));
    count += 1;
  }
  console.log(`  pond ${path.basename(path.dirname(dir))}/${path.basename(dir)}: ${count} dated entries`);
}

const entriesFor = (c) => {
  const files = [];
  for (const [day, fns] of byDay) {
    if (day >= c.startDate && day <= (c.endDate ?? c.startDate)) files.push(...fns);
  }
  return files.sort();
};

const stripFm = (t) =>
  t.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

async function summarize(c, files) {
  let corpus = '';
  for (const fp of files) {
    const body = stripFm(fs.readFileSync(fp, 'utf8')).slice(0, PER_ENTRY_CAP);
    if (!body) continue;
    corpus += `\n\n## ${path.basename(fp).replace(/\.(md|txt)$/, '')}\n${body}`;
    if (corpus.length > TOTAL_CAP) break;
  }
  if (!corpus.trim()) return null;
  const prompt = `These are my journal entries from a season of my life called "${c.name}" (${c.startDate} → ${c.endDate ?? 'open'}). Write, in the first person and past tense:
LINE 1: one single sentence — the season in a breath (no dates, no lists).
Then a blank line.
Then 2 to 4 sentences: what this season was about — themes, people, the feeling of it.
Reply with exactly that, no preamble, no labels.\n${corpus}`;
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const out = (await res.json()).response ?? '';
  return out.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || null;
}

const candidates = Object.values(cycles)
  .filter((c) => !c.reflection?.trim())
  .map((c) => ({ c, files: entriesFor(c) }))
  .filter((x) => x.files.length > 0)
  .sort((a, b) => b.c.startDate.localeCompare(a.c.startDate))
  .slice(0, LIMIT);

console.log(`${candidates.length} cycles with entries and no reflection (model: ${MODEL})`);
if (!APPLY) {
  for (const { c, files } of candidates)
    console.log(`  ${c.startDate}  ${c.name} — ${files.length} entries`);
  process.exit(0);
}

let written = 0;
for (const { c, files } of candidates) {
  try {
    const reflection = await summarize(c, files);
    if (!reflection) { console.log(`  ~ ${c.name}: empty corpus, skipped`); continue; }
    cycles[c.id] = { ...c, reflection, updatedAt: new Date().toISOString() };
    written += 1;
    console.log(`  ✓ ${c.startDate} ${c.name} — ${files.length} entries → ${reflection.length} chars`);
    // write incrementally so a long batch survives interruption
    const tmp = path.join(VAULT, `.cycles.json.tmp-${process.pid}`);
    fs.writeFileSync(tmp, `${JSON.stringify(cycles, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, cyclesPath);
  } catch (e) {
    console.error(`  ✗ ${c.name}: ${e.message}`);
  }
}
console.log(`${written} reflections written.`);
