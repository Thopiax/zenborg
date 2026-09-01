#!/usr/bin/env node
/**
 * Coverage report for cycle reflections — AGGREGATES ONLY.
 *
 * Prints counts, coverage, eras, and length statistics. Never prints the
 * reflection text: reflections are journal-derived analyses and live in the
 * private tier (kernel/entities.md). Read the prose in the Observatory.
 *
 *   node scripts/reflection-status.mjs
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const VAULT = process.env.ZENBORG_HOME ?? process.env.KAIROS_HOME ?? path.join(os.homedir(), ".zenborg");
const cycles = Object.values(
  JSON.parse(fs.readFileSync(path.join(VAULT, "cycles.json"), "utf8")),
).sort((a, b) => a.startDate.localeCompare(b.startDate));

// --since <minutes> scopes the lint to freshly written reflections, so a
// prompt or guard change is measurable without legacy output drowning it.
const sinceArg = process.argv.indexOf("--since");
const SINCE = sinceArg !== -1 ? Number(process.argv[sinceArg + 1]) : null;
const cutoff = SINCE ? Date.now() - SINCE * 60000 : null;

const withRefl = cycles.filter(
  (c) =>
    c.reflection?.trim() &&
    (!cutoff || new Date(c.updatedAt).getTime() >= cutoff),
);
if (SINCE)
  console.log(`\n(scoped to reflections written in the last ${SINCE} min)`);
const twoRung = withRefl.filter((c) => c.reflection.includes("\n\n"));
const era = (d) =>
  d < "2024-01-01"
    ? "pre-2024 (saperene)"
    : d < "2025-10-18"
      ? "2024→zenborg"
      : "zenborg era";

const byEra = new Map();
for (const c of cycles) {
  const k = era(c.startDate);
  const e = byEra.get(k) ?? { total: 0, done: 0 };
  e.total += 1;
  if (c.reflection?.trim()) e.done += 1;
  byEra.set(k, e);
}

const lens = withRefl
  .map((c) => c.reflection.trim().length)
  .sort((a, b) => a - b);
const l0words = withRefl.map(
  (c) => c.reflection.split("\n")[0].trim().split(/\s+/).length,
);
const med = (a) => (a.length ? a[Math.floor(a.length / 2)] : 0);
const avg = (a) =>
  a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;

console.log(`\nCYCLE REFLECTIONS — coverage\n`);
console.log(
  `  ${withRefl.length} of ${cycles.length} cycles (${Math.round((withRefl.length / cycles.length) * 100)}%)`,
);
console.log(`  ${twoRung.length} carry both rungs (L0 sentence + L1 tldr)\n`);
for (const [k, e] of byEra)
  console.log(
    `  ${k.padEnd(22)} ${String(e.done).padStart(3)} / ${String(e.total).padEnd(4)} ${"█".repeat(Math.round((e.done / e.total) * 20)).padEnd(20, "·")}`,
  );
console.log(
  `\n  length: median ${med(lens)} chars (min ${lens[0] ?? 0}, max ${lens[lens.length - 1] ?? 0})`,
);
console.log(`  L0: average ${avg(l0words)} words\n`);
// L0 shape lint — structure only (word counts, punctuation, label leaks).
let leak = 0,
  multi = 0,
  long = 0;
const buckets = {};
for (const c of withRefl) {
  const l0 = c.reflection.split("\n")[0].trim();
  const w = l0.split(/\s+/).length;
  const b = Math.min(50, Math.round(w / 10) * 10);
  buckets[b] = (buckets[b] ?? 0) + 1;
  if (/^(line ?1|l0|sentence|summary|reflection)\s*:/i.test(l0)) leak += 1;
  if ((l0.match(/[.!?]/g) ?? []).length > 1) multi += 1;
  if (w > 28) long += 1;
}
console.log(
  `  L0 shape: ${leak} label leaks · ${multi} multi-sentence · ${long} over 28 words`,
);
console.log(`  L0 word buckets: ${JSON.stringify(buckets)}\n`);

console.log(`  most recent 8 summarized seasons:`);
for (const c of withRefl.slice(-8).reverse())
  console.log(
    `    ${c.startDate}  ${c.name.padEnd(22)} ${String(c.reflection.trim().length).padStart(4)} chars`,
  );
console.log(
  `\n  Read the reflections at http://localhost:8748 (Journey mode).\n`,
);
