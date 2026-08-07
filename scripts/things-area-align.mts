#!/usr/bin/env node
/**
 * things-area-align — align Things 3 areas with kairos/zenborg areas.
 *
 * Reads both taxonomies live:
 *   - zenborg areas from $KAIROS_HOME/areas.json (default ~/.kairos)
 *   - Things areas from the Things 3 SQLite database, opened via a mode=ro URI
 *
 * Reports matched / needs-decision / unmapped in both directions, and
 * validates an existing mapping file for staleness (renamed, deleted, or
 * newly-added areas on either side).
 *
 * READ-ONLY BY DEFAULT. The only thing this script can ever write is the
 * mapping file, and only when --write is passed. It never touches the Things
 * database (mode=ro) and never touches any other file under ~/.kairos.
 *
 * Usage:
 *   node scripts/things-area-align.mts                       # report + validate
 *   node scripts/things-area-align.mts --json                 # machine-readable
 *   node scripts/things-area-align.mts --strict               # exit 1 on drift
 *   node scripts/things-area-align.mts --write                # write the map
 *   node scripts/things-area-align.mts --write --seed scripts/things-area-map.seed.json
 *   node scripts/things-area-align.mts --map /tmp/other.json  # alternate map path
 *   node scripts/things-area-align.mts --write --prune        # drop dead entries
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------- types

type ThingsArea = {
  readonly uuid: string;
  readonly title: string;
  readonly order: number;
};

type ZenborgArea = {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly archived: boolean;
};

/**
 * One mapping decision.
 *   zenborg: string  -> decided, maps to that zenborg area id
 *   zenborg: null + "?" present -> proposed, awaiting the user's decision
 *   zenborg: null, no "?"       -> deliberately unmapped, quiet
 * "//" is a comments-in-data label, regenerated on --write.
 */
type MapEntry = {
  readonly "//"?: string;
  readonly zenborg: string | null;
  readonly "?"?: string;
};

type MapFile = {
  readonly note?: string;
  readonly version: number;
  readonly entries: Readonly<Record<string, MapEntry>>;
};

type Suggestion = {
  readonly area: ZenborgArea;
  readonly reason: string;
};

type Finding = {
  readonly level: "error" | "warn" | "info";
  readonly text: string;
};

// ---------------------------------------------------------------- readers

const kairosHome = (): string =>
  process.env.KAIROS_HOME ?? join(homedir(), ".kairos");

const defaultMapPath = (): string => join(kairosHome(), "things-area-map.json");

const readZenborgAreas = (): readonly ZenborgArea[] => {
  const path = join(kairosHome(), "areas.json");
  if (!existsSync(path)) {
    throw new Error(`zenborg areas not found at ${path} (set KAIROS_HOME?)`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    {
      id?: string;
      name?: string;
      emoji?: string;
      isArchived?: boolean;
      order?: number;
    }
  >;
  const areas: ZenborgArea[] = [];
  for (const [key, value] of Object.entries(raw)) {
    areas.push({
      id: value.id ?? key,
      name: value.name ?? "(unnamed)",
      emoji: value.emoji ?? "",
      archived: value.isArchived === true,
    });
  }
  return areas.sort((a, b) => a.name.localeCompare(b.name));
};

const findThingsDb = (): string => {
  const base = join(
    homedir(),
    "Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac",
  );
  if (!existsSync(base)) {
    throw new Error(`Things container not found at ${base}`);
  }
  for (const dir of readdirSync(base)) {
    if (!dir.startsWith("ThingsData-")) {
      continue;
    }
    const candidate = join(
      base,
      dir,
      "Things Database.thingsdatabase",
      "main.sqlite",
    );
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`no main.sqlite under ${base}/ThingsData-*`);
};

/**
 * Read the Things areas. The database is opened through a `mode=ro` SQLite URI,
 * so the connection is physically incapable of writing to the user's Things
 * data — any statement that tried would fail with SQLITE_READONLY.
 */
const readThingsAreas = (): readonly ThingsArea[] => {
  const uri = `file:${findThingsDb()}?mode=ro`;
  const stdout = execFileSync(
    "/usr/bin/sqlite3",
    [
      uri,
      "-json",
      "SELECT uuid, title, `index` AS ord FROM TMArea ORDER BY `index`",
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  ).trim();
  if (stdout.length === 0) {
    return [];
  }
  const rows = JSON.parse(stdout) as ReadonlyArray<{
    uuid: string;
    title: string | null;
    ord: number;
  }>;
  return rows.map((r) => ({
    uuid: r.uuid,
    title: (r.title ?? "").trim(),
    order: r.ord,
  }));
};

const readMapFile = (path: string): MapFile | null => {
  if (!existsSync(path)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<MapFile>;
  return {
    note: parsed.note,
    version: parsed.version ?? 1,
    entries: parsed.entries ?? {},
  };
};

// ---------------------------------------------------------------- pure helpers

// Alternation, not a character class: skin-tone modifiers and ZWJ sequences
// must be matched as separate alternatives to stay well-defined.
const EMOJI_LIKE = /\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|️|‍|⃣/gu;

/** Lowercased alphanumeric core of a title — emoji, punctuation, spacing gone. */
const normalize = (title: string): string =>
  title
    .replace(EMOJI_LIKE, "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Leading non-alphanumeric glyph cluster of a Things title ("🚀 Vitality" -> "🚀"). */
const leadingGlyph = (title: string): string => {
  const match = title.match(/^[^\p{L}\p{N}\s]+/u);
  return (match?.[0] ?? "").replace(/️/g, "").trim();
};

const stripVs16 = (s: string): string => s.replace(/️/g, "").trim();

const zenborgLabel = (a: ZenborgArea): string =>
  `${a.emoji ? `${a.emoji} ` : ""}${a.name}${a.archived ? " (archived)" : ""}`;

/** Best-effort automatic suggestion. Name match first, then leading-glyph match. */
const suggestFor = (
  thing: ThingsArea,
  zenborg: readonly ZenborgArea[],
): Suggestion | null => {
  const live = zenborg.filter((z) => !z.archived);
  const target = normalize(thing.title);
  if (target.length > 0) {
    const byName = live.filter((z) => normalize(z.name) === target);
    if (byName.length === 1) {
      return { area: byName[0], reason: "name match" };
    }
  }
  const glyph = leadingGlyph(thing.title);
  if (glyph.length > 0) {
    const byGlyph = live.filter((z) => stripVs16(z.emoji) === glyph);
    if (byGlyph.length === 1) {
      return { area: byGlyph[0], reason: "emoji match" };
    }
  }
  return null;
};

const entryLabel = (
  thing: ThingsArea,
  zenborgById: ReadonlyMap<string, ZenborgArea>,
  zenborgId: string | null,
): string => {
  if (zenborgId === null) {
    return `${thing.title}  →  (unmapped)`;
  }
  const area = zenborgById.get(zenborgId);
  return `${thing.title}  →  ${area ? zenborgLabel(area) : `(missing zenborg area ${zenborgId})`}`;
};

const isDecided = (e: MapEntry): boolean => typeof e.zenborg === "string";
const isPending = (e: MapEntry): boolean =>
  e.zenborg === null && typeof e["?"] === "string";
const isDeliberateNull = (e: MapEntry): boolean =>
  e.zenborg === null && typeof e["?"] !== "string";

// ---------------------------------------------------------------- report

type Report = {
  readonly matched: ReadonlyArray<{
    readonly thing: ThingsArea;
    readonly area: ZenborgArea | null;
    readonly zenborgId: string;
  }>;
  readonly needsDecision: ReadonlyArray<{
    readonly thing: ThingsArea;
    readonly note: string;
  }>;
  readonly deliberatelyUnmapped: readonly ThingsArea[];
  readonly zenborgFanIn: ReadonlyMap<string, readonly ThingsArea[]>;
  readonly zenborgOrphans: readonly ZenborgArea[];
  readonly findings: readonly Finding[];
};

const buildReport = (
  things: readonly ThingsArea[],
  zenborg: readonly ZenborgArea[],
  map: MapFile | null,
): Report => {
  const zenborgById = new Map(zenborg.map((z) => [z.id, z]));
  const thingsByUuid = new Map(things.map((t) => [t.uuid, t]));
  const entries = map?.entries ?? {};

  const matched: Array<{
    thing: ThingsArea;
    area: ZenborgArea | null;
    zenborgId: string;
  }> = [];
  const needsDecision: Array<{ thing: ThingsArea; note: string }> = [];
  const deliberatelyUnmapped: ThingsArea[] = [];
  const fanIn = new Map<string, ThingsArea[]>();
  const findings: Finding[] = [];

  for (const thing of things) {
    const entry = entries[thing.uuid];

    if (entry === undefined) {
      const suggestion = suggestFor(thing, zenborg);
      needsDecision.push({
        thing,
        note: suggestion
          ? `new — no entry yet; suggest ${suggestion.area.id} (${zenborgLabel(suggestion.area)}) by ${suggestion.reason}`
          : "new — no entry yet; no automatic suggestion",
      });
      findings.push({
        level: "warn",
        text: `NEW Things area not in the map: ${thing.title} (${thing.uuid})`,
      });
      continue;
    }

    // Label drift has two very different causes, so name them differently:
    // a real rename on one side, versus a label that merely needs regenerating
    // because someone hand-edited the "zenborg" value.
    const expected = entryLabel(thing, zenborgById, entry.zenborg);
    const stored = entry["//"];
    if (typeof stored === "string" && stored !== expected) {
      const storedThingsTitle = stored.split("  →  ")[0];
      const renamed = storedThingsTitle !== thing.title;
      findings.push({
        level: "warn",
        text: renamed
          ? `RENAMED in Things — ${thing.uuid}\n      was: ${storedThingsTitle}\n      now: ${thing.title}`
          : `LABEL STALE — ${thing.title}; run --write to regenerate\n      stored: ${stored}\n      live:   ${expected}`,
      });
    }

    if (isDecided(entry)) {
      const zid = entry.zenborg as string;
      const area = zenborgById.get(zid) ?? null;
      if (area === null) {
        findings.push({
          level: "error",
          text: `DELETED zenborg area — ${thing.title} maps to ${zid}, which no longer exists in areas.json`,
        });
      } else if (area.archived) {
        findings.push({
          level: "warn",
          text: `ARCHIVED zenborg area — ${thing.title} maps to ${zenborgLabel(area)}`,
        });
      }
      matched.push({ thing, area, zenborgId: zid });
      const bucket = fanIn.get(zid) ?? [];
      bucket.push(thing);
      fanIn.set(zid, bucket);
      continue;
    }

    if (isPending(entry)) {
      needsDecision.push({ thing, note: entry["?"] as string });
      continue;
    }

    if (isDeliberateNull(entry)) {
      deliberatelyUnmapped.push(thing);
    }
  }

  // entries pointing at Things areas that no longer exist
  for (const uuid of Object.keys(entries)) {
    if (!thingsByUuid.has(uuid)) {
      findings.push({
        level: "error",
        text: `DELETED Things area — map entry ${uuid} has no live Things area (${entries[uuid]["//"] ?? "no label"})`,
      });
    }
  }

  const zenborgOrphans = zenborg
    .filter((z) => !z.archived && !fanIn.has(z.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    matched,
    needsDecision,
    deliberatelyUnmapped,
    zenborgFanIn: fanIn,
    zenborgOrphans,
    findings,
  };
};

// ---------------------------------------------------------------- merge (write path)

const mergeMap = (
  things: readonly ThingsArea[],
  zenborg: readonly ZenborgArea[],
  existing: MapFile | null,
  seed: MapFile | null,
  prune: boolean,
): MapFile => {
  const zenborgById = new Map(zenborg.map((z) => [z.id, z]));
  const entries: Record<string, MapEntry> = {};

  for (const thing of things) {
    const prior = existing?.entries[thing.uuid] ?? seed?.entries[thing.uuid];
    const zenborgId = prior?.zenborg ?? null;
    const pending =
      prior?.["?"] ??
      (zenborgId === null && prior === undefined
        ? (() => {
            const s = suggestFor(thing, zenborg);
            return s
              ? `suggest ${s.area.id} (${zenborgLabel(s.area)}) — ${s.reason}; confirm or replace, then delete this "?" line`
              : 'no automatic suggestion — set "zenborg" to an area id, or delete this "?" line to record "deliberately unmapped"';
          })()
        : undefined);

    entries[thing.uuid] = {
      "//": entryLabel(thing, zenborgById, zenborgId),
      zenborg: zenborgId,
      ...(pending === undefined ? {} : { "?": pending }),
    };
  }

  if (!prune) {
    const live = new Set(things.map((t) => t.uuid));
    for (const [uuid, entry] of Object.entries(existing?.entries ?? {})) {
      if (!live.has(uuid)) {
        entries[uuid] = entry;
      }
    }
  }

  return {
    note:
      existing?.note ??
      seed?.note ??
      'Things 3 area uuid -> kairos/zenborg area id. Hand-editable. "//" is a label, regenerated by scripts/things-area-align.mts --write. "?" means undecided: set "zenborg" then delete the "?" line. zenborg:null with no "?" means deliberately unmapped.',
    version: existing?.version ?? seed?.version ?? 1,
    entries,
  };
};

// ---------------------------------------------------------------- rendering

const renderText = (
  report: Report,
  things: readonly ThingsArea[],
  zenborg: readonly ZenborgArea[],
  mapPath: string,
  mapExists: boolean,
): string => {
  const zenborgById = new Map(zenborg.map((z) => [z.id, z]));
  const liveZenborg = zenborg.filter((z) => !z.archived);
  const out: string[] = [];
  const line = (s = "") => out.push(s);

  line("things-area-align");
  line("=================");
  line(
    `  zenborg areas  ${liveZenborg.length} live (${zenborg.length - liveZenborg.length} archived)  ${join(kairosHome(), "areas.json")}`,
  );
  line(
    `  Things areas   ${things.length}  ${findThingsDb().replace(homedir(), "~")}`,
  );
  line(
    `  mapping file   ${mapExists ? "found" : "MISSING"}  ${mapPath.replace(homedir(), "~")}`,
  );
  line();
  line(
    `  matched ${report.matched.length}   needs decision ${report.needsDecision.length}   unmapped by choice ${report.deliberatelyUnmapped.length}   zenborg with no Things source ${report.zenborgOrphans.length}`,
  );
  line();

  line("MATCHED  (Things → zenborg)");
  if (report.matched.length === 0) {
    line("  (none)");
  }
  for (const m of report.matched) {
    const fan = report.zenborgFanIn.get(m.zenborgId) ?? [];
    const many = fan.length > 1 ? `   [${fan.length}→1]` : "";
    line(
      `  ${m.thing.title.padEnd(20)} →  ${m.area ? zenborgLabel(m.area) : `(missing ${m.zenborgId})`}${many}`,
    );
  }
  line();

  line("NEEDS DECISION  (left for you — nothing was picked silently)");
  if (report.needsDecision.length === 0) {
    line("  (none)");
  }
  for (const n of report.needsDecision) {
    line(`  ${n.thing.title}`);
    line(`      ${n.note}`);
  }
  line();

  if (report.deliberatelyUnmapped.length > 0) {
    line(
      "UNMAPPED BY CHOICE  (Things areas with no zenborg counterpart, decided)",
    );
    for (const t of report.deliberatelyUnmapped) {
      line(`  ${t.title}`);
    }
    line();
  }

  line("ZENBORG AREAS WITH NO THINGS SOURCE  (nothing files in from Things)");
  if (report.zenborgOrphans.length === 0) {
    line("  (none)");
  }
  for (const z of report.zenborgOrphans) {
    line(`  ${zenborgLabel(z)}`);
  }
  line();

  line("MANY-TO-ONE  (zenborg areas receiving more than one Things area)");
  const manyToOne = [...report.zenborgFanIn.entries()].filter(
    ([, v]) => v.length > 1,
  );
  if (manyToOne.length === 0) {
    line("  (none)");
  }
  for (const [zid, sources] of manyToOne) {
    const area = zenborgById.get(zid);
    line(
      `  ${area ? zenborgLabel(area) : zid}  ←  ${sources.map((s) => s.title).join(", ")}`,
    );
  }
  line();

  line("STALENESS");
  if (report.findings.length === 0) {
    line(
      "  clean — no renames, deletions, or new areas since the map was written",
    );
  }
  for (const f of report.findings) {
    line(`  [${f.level}] ${f.text}`);
  }

  return out.join("\n");
};

// ---------------------------------------------------------------- main

const main = (): number => {
  const { values } = parseArgs({
    options: {
      map: { type: "string" },
      seed: { type: "string" },
      write: { type: "boolean", default: false },
      prune: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help === true) {
    process.stdout.write(
      [
        "things-area-align — align Things 3 areas with kairos/zenborg areas",
        "",
        "  (no flags)        report + validate, read-only",
        "  --json            machine-readable report",
        "  --strict          exit 1 when anything needs a decision or is stale",
        "  --map <path>      mapping file (default $KAIROS_HOME/things-area-map.json)",
        "  --seed <path>     seed decisions, lowest precedence (write path only)",
        "  --write           write the mapping file — the ONLY write this script does",
        "  --prune           with --write, drop entries for deleted Things areas",
        "",
      ].join("\n"),
    );
    return 0;
  }

  const mapPath = values.map ?? defaultMapPath();
  const things = readThingsAreas();
  const zenborg = readZenborgAreas();
  const existing = readMapFile(mapPath);

  if (values.write === true) {
    const seed =
      typeof values.seed === "string" ? readMapFile(values.seed) : null;
    if (typeof values.seed === "string" && seed === null) {
      process.stderr.write(`seed file not found: ${values.seed}\n`);
      return 2;
    }
    const merged = mergeMap(
      things,
      zenborg,
      existing,
      seed,
      values.prune === true,
    );
    writeFileSync(mapPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${mapPath}\n\n`);
  }

  const map = values.write === true ? readMapFile(mapPath) : existing;
  const report = buildReport(things, zenborg, map);

  if (values.json === true) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mapPath,
          mapExists: map !== null,
          matched: report.matched.map((m) => ({
            thingsUuid: m.thing.uuid,
            thingsTitle: m.thing.title,
            zenborgId: m.zenborgId,
            zenborgName: m.area?.name ?? null,
          })),
          needsDecision: report.needsDecision.map((n) => ({
            thingsUuid: n.thing.uuid,
            thingsTitle: n.thing.title,
            note: n.note,
          })),
          deliberatelyUnmapped: report.deliberatelyUnmapped.map((t) => ({
            thingsUuid: t.uuid,
            thingsTitle: t.title,
          })),
          zenborgOrphans: report.zenborgOrphans.map((z) => ({
            id: z.id,
            name: z.name,
          })),
          findings: report.findings,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(
      `${renderText(report, things, zenborg, mapPath, map !== null)}\n`,
    );
  }

  if (values.strict === true) {
    const dirty =
      report.findings.some((f) => f.level !== "info") ||
      report.needsDecision.length > 0;
    return dirty ? 1 : 0;
  }
  return 0;
};

process.exitCode = main();
