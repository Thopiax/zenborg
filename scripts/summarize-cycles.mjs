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
const PER_ENTRY_CAP = 1500, TOTAL_CAP = 12000, L0_MAX_WORDS = 20;

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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Weekday is context every extraction gets: a Tuesday entry and a Saturday
// entry mean different things, and the rhythm of a season is legible in them.
const weekdayOf = (day) => WEEKDAYS[new Date(`${day}T12:00:00`).getDay()];

async function summarize(c, files) {
  let corpus = '';
  for (const fp of files) {
    const body = stripFm(fs.readFileSync(fp, 'utf8')).slice(0, PER_ENTRY_CAP);
    if (!body) continue;
    const stem = path.basename(fp).replace(/\.(md|txt)$/, '');
    const day = stem.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
    const label = day ? `${stem} (${weekdayOf(`${day[1]}-${day[2]}-${day[3]}`)})` : stem;
    corpus += `\n\n## ${label}\n${body}`;
    if (corpus.length > TOTAL_CAP) break;
  }
  if (!corpus.trim()) return null;
  // Smart Brevity: the lede carries the one thing worth remembering; the body
  // says what happened and why it mattered. Prosody rules are constraints the
  // small local model can actually follow.
  const prompt = `These are my journal entries from a season of my life called "${c.name}" (${weekdayOf(c.startDate)} ${c.startDate} → ${c.endDate ? `${weekdayOf(c.endDate)} ${c.endDate}` : 'open'}). Each entry is headed by its date and weekday — weekdays carry the rhythm of the season (weekday work, weekend life). Write my reflection on this season, first person, past tense.

FIRST LINE — the lede. ONE sentence, AT MOST 20 WORDS: the single thing I should remember about this season. One thought, one period.

BLANK LINE.

THEN 2 to 4 sentences: what the season actually held — the people, the work, the places — and, in the last sentence, why it mattered.

How to write it:
- Strong verbs. Active voice. Short words over long ones.
- Concrete over abstract: name the people, the places, the work.
- No hedging adverbs (somewhat, fairly, perhaps), no stacked adjectives.
- Nothing the entries do not support. If a season was thin, say so plainly.

Reply with exactly the lede, a blank line, and the body. No preamble, no labels, no headings.\n${corpus}`;
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const out = (await res.json()).response ?? '';
  const text = out.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (!text) return null;

  // The lede budget is enforced, not requested: bigger models drift long even
  // when told not to, so an over-budget L0 goes back for one compression pass.
  const [l0, ...rest] = text.split('\n');
  if (l0.trim().split(/\s+/).length <= L0_MAX_WORDS) return text;
  const tighter = await ask(
    `Compress this to ONE sentence of at most ${L0_MAX_WORDS} words, first person, past tense, keeping the specifics. Reply with the sentence only.\n\n${l0.trim()}`,
  );
  const clean = tighter?.split('\n')[0]?.trim();
  return clean && clean.split(/\s+/).length < l0.trim().split(/\s+/).length
    ? [clean, ...rest].join('\n')
    : text;
}

async function ask(prompt) {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  });
  if (!res.ok) return null;
  return ((await res.json()).response ?? '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

// --redo regenerates model-written reflections (e.g. after a prompt fix).
// Human-written ones are protected. Provenance is now stamped explicitly at
// write time (`reflectionSource`), so the blank-line heuristic below is only
// the fallback for the reflections written before the field existed.
const REDO = process.argv.includes('--redo');
const modelWritten = (c) => {
  if (c.reflectionSource === 'human') return false; // your words win
  if (c.reflectionSource === 'machine') return true; // stamped, no guessing
  const r = c.reflection?.trim();
  return !!r && r.includes('\n\n');
};

// --only <startDate> regenerates exactly one cycle, whatever its state.
const ONLY = arg('only');

const candidates = Object.values(cycles)
  .filter((c) => (ONLY ? c.startDate === ONLY
    : REDO ? !c.reflection?.trim() || modelWritten(c) : !c.reflection?.trim()))
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
    // Stamp the draft as a draft. Harvest renders it differently from your
    // own words, and a later --redo can tell the two apart without guessing.
    cycles[c.id] = {
      ...c,
      reflection,
      reflectionSource: 'machine',
      updatedAt: new Date().toISOString(),
    };
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
