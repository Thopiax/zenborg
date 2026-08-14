#!/usr/bin/env node
/**
 * The Observatory — a local WebGL globe over the garden's people and places.
 *
 *   node scripts/globe.mjs          # serves http://localhost:8748 and stays up
 *
 * GET  /api/network  → cities (with coords), people per city (via canonical
 *                      place- tags), each person's most recent allocation.
 * POST /api/person   → { name, city } — plants a kind:"person" habit in the
 *                      Friends plot, tagged with the city. Atomic write; the
 *                      app's watcher picks it up live.
 *
 * All data stays on localhost. The page pulls the globe library + earth
 * texture from a CDN (generic assets); no personal data ever leaves.
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';

const PORT = Number(process.env.PORT ?? 8748);
const VAULT = process.env.KAIROS_HOME ?? path.join(os.homedir(), '.kairos');
const HTML = fs.readFileSync(path.join(import.meta.dirname, 'globe.html'));

const CITY_COORDS = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'city-coords.local.json'), 'utf8'),
); // gitignored — the cities of a life are its trace
const HOME = 'place-paris';

function cycleJourney() {
  const cycles = Object.values(readJson('cycles')).sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const areasById = readJson('areas');
  const moments = Object.values(readJson('moments'));
  let mapping = {};
  try {
    mapping = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, 'backfill-tags.local.json'), 'utf8'),
    );
  } catch { /* mapping optional */ }
  const stops = [];
  const skipped = [];
  for (const c of cycles) {
    const placeTag = (mapping[c.name] ?? []).find((t) => CITY_COORDS[t]);
    if (!placeTag) { skipped.push(c.name); continue; }
    // The season's allocation mix, colored by area — the one sanctioned use
    // of color in the design grammar (kernel areas.md).
    const byArea = new Map();
    for (const m of moments) {
      if (m.day === null) continue;
      const inCycle = m.cycleId === c.id ||
        (m.day >= c.startDate && (c.endDate === null || m.day <= c.endDate));
      if (!inCycle) continue;
      byArea.set(m.areaId, (byArea.get(m.areaId) ?? 0) + 1);
    }
    const areas = Array.from(byArea.entries())
      .map(([id, count]) => {
        const a = areasById[id];
        return { name: a?.name ?? '?', color: a?.color ?? '#93a4f5', emoji: a?.emoji ?? '', count };
      })
      .sort((x, y) => y.count - x.count);
    stops.push({
      n: stops.length + 1, cycle: c.name, place: CITY_COORDS[placeTag].name,
      lat: CITY_COORDS[placeTag].lat, lng: CITY_COORDS[placeTag].lng,
      start: c.startDate, end: c.endDate, intention: c.intention ?? null,
      l0: c.reflection?.split('\n')[0]?.trim() ?? null,
      areas, momentCount: areas.reduce((s, a) => s + a.count, 0),
    });
  }
  const arcs = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (a.lat === b.lat && a.lng === b.lng) continue;
    arcs.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng, order: i });
  }
  return { stops, arcs, skipped };
}

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(VAULT, `${name}.json`), 'utf8'));

function network() {
  const habits = Object.values(readJson('habits'));
  const moments = Object.values(readJson('moments'));
  const people = habits.filter((h) => h.kind === 'person' && !h.isArchived);

  const lastSeen = new Map();
  for (const m of moments) {
    if (m.day === null) continue;
    const involved = new Set(m.personIds ?? []);
    if (m.habitId !== null) involved.add(m.habitId);
    for (const id of involved) {
      const cur = lastSeen.get(id);
      if (!cur || m.day > cur.day) lastSeen.set(id, { day: m.day, what: m.name });
    }
  }

  const areasById = readJson('areas');
  const cities = new Map();
  const unplaced = [];
  for (const p of people) {
    const cityTag = (p.tags ?? []).find((t) => CITY_COORDS[t]);
    const area = areasById[p.areaId];
    const entry = { name: p.name, last: lastSeen.get(p.id) ?? null,
      area: { name: area?.name ?? '?', color: area?.color ?? '#93a4f5' } };
    if (!cityTag) {
      unplaced.push(entry);
      continue;
    }
    if (!cities.has(cityTag)) cities.set(cityTag, { tag: cityTag, ...CITY_COORDS[cityTag], people: [] });
    cities.get(cityTag).people.push(entry);
  }
  for (const c of cities.values())
    c.people.sort((a, b) => (b.last?.day ?? '').localeCompare(a.last?.day ?? ''));

  return { home: HOME, cities: Array.from(cities.values()), unplaced, cityOptions: Object.entries(CITY_COORDS).map(([tag, c]) => ({ tag, name: c.name })) };
}

function addPerson(name, cityTag) {
  if (!name?.trim()) throw new Error('name required');
  if (!CITY_COORDS[cityTag]) throw new Error(`unknown city tag: ${cityTag}`);
  const areas = readJson('areas');
  const friends = Object.values(areas).find((a) => a.name === 'Friends');
  if (!friends) throw new Error('Friends area not found');
  const habits = readJson('habits');
  const clean = name.trim();
  if (Object.values(habits).some((h) => h.name.toLowerCase() === clean.toLowerCase() && !h.isArchived))
    throw new Error(`"${clean}" already exists in the garden`);
  const now = new Date().toISOString();
  const habit = {
    id: crypto.randomUUID(),
    name: clean,
    areaId: friends.id,
    attitude: null,
    phase: null,
    tags: [cityTag],
    emoji: '🤝',
    isArchived: false,
    order: Object.values(habits).filter((h) => h.areaId === friends.id).length,
    createdAt: now,
    updatedAt: now,
    kind: 'person',
  };
  habits[habit.id] = habit;
  const target = path.join(VAULT, 'habits.json');
  const tmp = path.join(VAULT, `.habits.json.tmp-${process.pid}`);
  fs.writeFileSync(tmp, `${JSON.stringify(habits, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, target);
  return habit.name;
}

// Journal dirs, newest pond first — supernote carries recent seasons, the
// saperene backup the older eras.
const JOURNAL_DIRS = [
  path.join(os.homedir(), 'Documents/Supernote/journals'),
  path.join(os.homedir(), 'Developer/sandbox/saperene-obsidian-backup/Journal'),
].filter((d) => fs.existsSync(d));
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ENTRY_CAP = 20000;

function entriesInWindow(cycle) {
  const end = cycle.endDate ?? cycle.startDate;
  const out = [];
  for (const dir of JOURNAL_DIRS) {
    for (const fn of fs.readdirSync(dir)) {
      if (!fn.endsWith('.md') && !fn.endsWith('.txt')) continue;
      const m = fn.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
      if (!m) continue;
      const day = `${m[1]}-${m[2]}-${m[3]}`;
      if (day < cycle.startDate || day > end) continue;
      const text = fs
        .readFileSync(path.join(dir, fn), 'utf8')
        .replace(/^﻿/, '').replace(/\r\n/g, '\n')
        .replace(/^---\n[\s\S]*?\n---\n?/, '')
        .trim()
        .slice(0, ENTRY_CAP);
      if (!text) continue;
      out.push({
        day,
        weekday: WEEKDAYS[new Date(`${day}T12:00:00`).getDay()],
        source: path.basename(dir) === 'journals' ? 'supernote' : 'saperene',
        file: fn,
        text,
      });
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.file.localeCompare(b.file));
}

// ── Photos: the Apple library, read-only, thumbnails served to the page ──
const PHOTOS_LIB = path.join(os.homedir(), 'Pictures/Photos Library.photoslibrary');
const PHOTOS_DB = path.join(PHOTOS_LIB, 'database/Photos.sqlite');
const DERIVATIVES = path.join(PHOTOS_LIB, 'resources/derivatives');
let photoCache = null;

function loadPhotos() {
  if (photoCache) return photoCache;
  if (!fs.existsSync(PHOTOS_DB)) return (photoCache = []);
  const tmp = path.join(os.tmpdir(), `obs-photos-${process.pid}.sqlite`);
  fs.copyFileSync(PHOTOS_DB, tmp);
  for (const ext of ['-wal', '-shm']) {
    try { fs.copyFileSync(PHOTOS_DB + ext, tmp + ext); } catch {}
  }
  const rows = execFileSync('sqlite3', [tmp, `
    select ZUUID, date(datetime(ZDATECREATED + 978307200, 'unixepoch')),
           coalesce(ZLATITUDE, -999), coalesce(ZLONGITUDE, -999)
    from ZASSET where ZDATECREATED is not null and ZTRASHEDSTATE = 0;`],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
    .trim().split('\n').filter(Boolean)
    .map((l) => { const [uuid, day, lat, lng] = l.split('|');
      return { uuid, day, lat: +lat, lng: +lng }; });
  for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(tmp + ext); } catch {} }
  return (photoCache = rows.sort((a, b) => a.day.localeCompare(b.day)));
}

const thumbPath = (uuid) =>
  path.join(DERIVATIVES, uuid[0], `${uuid}_1_105_c.jpeg`);

// Evenly spread picks across a window read better than the first N.
function spread(list, n) {
  if (list.length <= n) return list;
  const step = list.length / n;
  return Array.from({ length: n }, (_, i) => list[Math.floor(i * step)]);
}

// Ponds from ~/.wake/sources.yaml — searched via `wake search` so journal
// prose renders only in the local page, never in any agent context.
const PONDS = [
  { name: 'supernote', path: path.join(os.homedir(), 'Documents/Supernote/journals') },
  { name: 'saperene', path: path.join(os.homedir(), 'Developer/saperene/journals') },
  { name: 'saperene-pages', path: path.join(os.homedir(), 'Developer/saperene/pages') },
  { name: 'journals', path: path.join(os.homedir(), 'journals') },
];
// Full display names from the (gitignored) registry seed widen search recall.
let DISPLAYS = {};
try {
  const seed = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, 'people.local.json'), 'utf8'),
  );
  for (const p of Object.values(seed))
    if (p.zenborg && p.display) DISPLAYS[p.zenborg.replace(' (archived)', '')] = p.display;
} catch { /* seed optional */ }

const wakeSearch = (pond, query) =>
  new Promise((resolve) => {
    execFile('wake', ['search', pond.path, query], { timeout: 20000 }, (err, stdout, stderr) => {
      resolve({ pond: pond.name, output: err ? `(no results / no index)` : stdout.trim() || '(no results)' });
    });
  });

async function references(name) {
  const display = DISPLAYS[name];
  const query = display && display !== name ? `"${name}" OR "${display}"` : `"${name}"`;
  const results = await Promise.all(PONDS.map((p) => wakeSearch(p, query)));
  return { name, display: display ?? name, query, results };
}

http
  .createServer((req, res) => {
    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'content-type': type });
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html'))
      return send(200, HTML, 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/api/network') {
      try { return send(200, network()); } catch (e) { return send(500, { error: String(e.message ?? e) }); }
    }
    if (req.method === 'GET' && req.url === '/api/reflections') {
      try {
        const cycles = Object.values(readJson('cycles'))
          .filter((c) => c.reflection?.trim())
          .sort((a, b) => b.startDate.localeCompare(a.startDate))
          .map((c) => {
            const [l0, ...rest] = c.reflection.trim().split('\n');
            return { name: c.name, start: c.startDate, end: c.endDate,
              l0: l0.trim(), l1: rest.join('\n').trim() };
          });
        return send(200, { count: cycles.length, cycles });
      } catch (e) { return send(500, { error: String(e.message ?? e) }); }
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/photos')) {
      try {
        const q = new URL(req.url, 'http://localhost').searchParams;
        const start = q.get('start');
        const limit = Math.min(60, Number(q.get('limit') ?? 8));
        const cycle = Object.values(readJson('cycles')).find((c) => c.startDate === start);
        if (!cycle) return send(400, { error: 'unknown cycle' });
        const end = cycle.endDate ?? cycle.startDate;
        const inWindow = loadPhotos().filter((p) => p.day >= cycle.startDate && p.day <= end);
        // Over-fetch candidates: not every asset has a rendered derivative, and
        // a strip with holes reads as an error rather than a life.
        const shown = spread(inWindow, limit * 5)
          .filter((p) => fs.existsSync(thumbPath(p.uuid)))
          .slice(0, limit);
        return send(200, { total: inWindow.length, photos: shown.map((p) => ({ uuid: p.uuid, day: p.day })) });
      } catch (e) { return send(500, { error: String(e.message ?? e) }); }
    }
    if (req.method === 'GET' && req.url?.startsWith('/thumb/')) {
      const uuid = decodeURIComponent(req.url.slice('/thumb/'.length));
      if (!/^[0-9A-F-]{36}$/i.test(uuid)) return send(400, { error: 'bad id' });
      const fp = thumbPath(uuid);
      if (!fs.existsSync(fp)) return send(404, { error: 'no thumbnail' });
      res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'max-age=86400' });
      return fs.createReadStream(fp).pipe(res);
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/entries')) {
      // The raw material behind a reflection: the journal entries in the
      // cycle's window. Read by this local server, rendered in the browser,
      // never returned into an agent's context.
      try {
        const start = new URL(req.url, 'http://localhost').searchParams.get('start');
        const cycle = Object.values(readJson('cycles')).find((c) => c.startDate === start);
        if (!cycle) return send(400, { error: 'unknown cycle' });
        return send(200, { cycle: cycle.name, entries: entriesInWindow(cycle) });
      } catch (e) { return send(500, { error: String(e.message ?? e) }); }
    }
    if (req.method === 'GET' && req.url === '/api/cycles') {
      try { return send(200, cycleJourney()); } catch (e) { return send(500, { error: String(e.message ?? e) }); }
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/references')) {
      const requested = new URL(req.url, 'http://localhost').searchParams.get('name');
      // Allowlist: only names that exist in the garden roster are searchable —
      // the pond query is never arbitrary input.
      const roster = Object.values(readJson('habits')).filter((h) => h.kind === 'person');
      const person = roster.find((h) => h.name === requested);
      if (!person) return send(400, { error: 'unknown person' });
      references(person.name).then((r) => send(200, r)).catch((e) => send(500, { error: String(e) }));
      return;
    }
    if (req.method === 'POST' && req.url === '/api/person') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { name, city } = JSON.parse(body);
          return send(200, { created: addPerson(name, city) });
        } catch (e) { return send(400, { error: String(e.message ?? e) }); }
      });
      return;
    }
    send(404, { error: 'not found' });
  })
  .listen(PORT, '127.0.0.1', () =>
    console.log(`[observatory] http://localhost:${PORT} (vault: ${VAULT})`),
  );
