#!/usr/bin/env node
/**
 * Photo GPS as ground truth for where a cycle happened.
 *
 * The Apple Photos library knows where you actually were. This reads only
 * (day, lat, lon) — never an image, never a filename — snaps each point to
 * the nearest known place in the registry, and reports per-cycle verdicts:
 * what the photos say vs what the cycle claims.
 *
 *   node scripts/photo-places.mjs                 # verdicts per cycle
 *   node scripts/photo-places.mjs --unknown       # clusters far from any known place
 *   node scripts/photo-places.mjs --fix           # write place tags onto cycles' moments (TODO)
 *
 * Aggregates only: counts and place names come out, coordinates stay in.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const VAULT = process.env.ZENBORG_HOME ?? process.env.KAIROS_HOME ?? path.join(os.homedir(), ".zenborg");
const LIB = path.join(
  os.homedir(),
  "Pictures/Photos Library.photoslibrary/database/Photos.sqlite",
);
const TMP = path.join(os.tmpdir(), `photos-read-${process.pid}.sqlite`);
const SNAP_KM = 120; // a point beyond this from every known place is "unknown"

const coords = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, "city-coords.local.json"),
    "utf8",
  ),
);
const places = Object.entries(coords).map(([tag, c]) => ({ tag, ...c }));

const toRad = (d) => (d * Math.PI) / 180;
function km(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = toRad(bLat - aLat),
    dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const nearest = (lat, lng) =>
  places.reduce((best, p) => {
    const d = km(lat, lng, p.lat, p.lng);
    return !best || d < best.d ? { ...p, d } : best;
  }, null);

fs.copyFileSync(LIB, TMP);
for (const ext of ["-wal", "-shm"]) {
  try {
    fs.copyFileSync(LIB + ext, TMP + ext);
  } catch {
    /* absent is fine */
  }
}
const rows = execFileSync(
  "sqlite3",
  [
    TMP,
    `
  select date(datetime(ZDATECREATED + 978307200, 'unixepoch')), ZLATITUDE, ZLONGITUDE
  from ZASSET
  where ZDATECREATED is not null and ZLATITUDE is not null and ZLATITUDE > -180;`,
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
)
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [day, lat, lng] = l.split("|");
    return { day, lat: +lat, lng: +lng };
  });
for (const ext of ["", "-wal", "-shm"]) {
  try {
    fs.unlinkSync(TMP + ext);
  } catch {}
}

const cycles = Object.values(
  JSON.parse(fs.readFileSync(path.join(VAULT, "cycles.json"), "utf8")),
).sort((a, b) => a.startDate.localeCompare(b.startDate));
let mapping = {};
try {
  mapping = JSON.parse(
    fs.readFileSync(
      path.join(import.meta.dirname, "backfill-tags.local.json"),
      "utf8",
    ),
  );
} catch {}

if (process.argv.includes("--unknown")) {
  const far = rows
    .map((r) => ({ ...r, n: nearest(r.lat, r.lng) }))
    .filter((r) => r.n.d > SNAP_KM);
  const clusters = new Map();
  for (const r of far) {
    const key = `${r.lat.toFixed(1)},${r.lng.toFixed(1)}`;
    const c = clusters.get(key) ?? {
      n: 0,
      first: r.day,
      last: r.day,
      near: r.n.name,
      d: Math.round(r.n.d),
    };
    c.n += 1;
    if (r.day < c.first) c.first = r.day;
    if (r.day > c.last) c.last = r.day;
    clusters.set(key, c);
  }
  console.log(
    `\n${far.length} photos beyond ${SNAP_KM}km of any known place — clusters worth naming:\n`,
  );
  for (const [k, c] of [...clusters.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 25))
    console.log(
      `  ${String(c.n).padStart(4)} photos  ${c.first} → ${c.last}  (${c.d}km from ${c.near})  @${k}`,
    );
  console.log();
  process.exit(0);
}

const byDay = new Map();
for (const r of rows) {
  const n = nearest(r.lat, r.lng);
  if (n.d > SNAP_KM) continue;
  if (!byDay.has(r.day)) byDay.set(r.day, new Map());
  const m = byDay.get(r.day);
  m.set(n.tag, (m.get(n.tag) ?? 0) + 1);
}

let agree = 0,
  disagree = 0,
  unknownClaim = 0,
  noPhotos = 0;
const conflicts = [];
for (const c of cycles) {
  const end = c.endDate ?? c.startDate;
  const tally = new Map();
  for (const [day, m] of byDay) {
    if (day < c.startDate || day > end) continue;
    for (const [tag, n] of m) tally.set(tag, (tally.get(tag) ?? 0) + n);
  }
  if (!tally.size) {
    noPhotos += 1;
    continue;
  }
  const [topTag, topN] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  const claimed = (mapping[c.name] ?? []).find((t) => coords[t]);
  const total = [...tally.values()].reduce((s, x) => s + x, 0);
  if (!claimed) {
    unknownClaim += 1;
    conflicts.push({
      kind: "UNCLAIMED",
      c,
      says: coords[topTag].name,
      n: topN,
      total,
    });
  } else if (claimed === topTag) {
    agree += 1;
  } else {
    disagree += 1;
    conflicts.push({
      kind: "CONFLICT",
      c,
      claims: coords[claimed].name,
      says: coords[topTag].name,
      n: topN,
      total,
    });
  }
}

console.log(
  `\nPHOTO GPS vs CYCLES — ${rows.length} located photos, ${byDay.size} days\n`,
);
console.log(
  `  ${agree} cycles agree · ${disagree} conflict · ${unknownClaim} unclaimed but photos know · ${noPhotos} no photos\n`,
);
for (const x of conflicts.slice(0, 30)) {
  const w = `${x.c.startDate}→${x.c.endDate ?? "open"}`.padEnd(24);
  if (x.kind === "CONFLICT")
    console.log(
      `  ⚠ ${w} "${x.c.name}" claims ${x.claims}, photos say ${x.says} (${x.n}/${x.total})`,
    );
  else
    console.log(
      `  + ${w} "${x.c.name}" has no place; photos say ${x.says} (${x.n}/${x.total})`,
    );
}
console.log();
