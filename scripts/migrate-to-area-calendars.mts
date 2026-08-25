#!/usr/bin/env tsx
/**
 * One-time migration: clear externalRefs pointing at the old single "Zenborg"
 * calendar so the next reconcile-once republishes each moment into its area's
 * dedicated calendar.
 *
 * Usage:
 *   tsx scripts/migrate-to-area-calendars.mts          # dry run
 *   tsx scripts/migrate-to-area-calendars.mts --write   # apply
 *
 * After --write, run:
 *   ./calendar-sidecar/dist/zenborg-calendar reconcile-once
 *
 * Then delete the old "Zenborg" calendar in Calendar.app.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const write = process.argv.includes("--write");
const vaultRoot =
  process.env.ZENBORG_VAULT ?? path.join(os.homedir(), ".kairos");

const momentsPath = path.join(vaultRoot, "moments.json");
const configPath = path.join(vaultRoot, "calendarSync.json");

const moments: Record<string, Record<string, unknown>> = JSON.parse(
  fs.readFileSync(momentsPath, "utf-8"),
);

const config: Record<string, unknown> = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf-8"))
  : {};

const areaCalendars = (config.areaCalendars ?? {}) as Record<string, string>;
const areaCalendarIds = new Set(Object.values(areaCalendars));

// Also check for the legacy field
const legacyId = config.zenborgCalendarId as string | undefined;

let cleared = 0;
let skipped = 0;

for (const [id, moment] of Object.entries(moments)) {
  const ref = moment.externalRef as
    | { calendarId: string; [k: string]: unknown }
    | undefined;
  if (!ref) continue;

  if (areaCalendarIds.has(ref.calendarId)) {
    skipped++;
    continue;
  }

  console.log(
    `  ${id}: "${moment.name}" — clearing ref to calendar ${ref.calendarId}`,
  );
  delete moment.externalRef;
  moment.updatedAt = new Date().toISOString();
  cleared++;
}

console.log(
  `\n${cleared} externalRefs cleared, ${skipped} already on area calendars`,
);

if (legacyId) {
  console.log(`\nLegacy zenborgCalendarId found: ${legacyId}`);
  if (write) {
    delete (config as Record<string, unknown>).zenborgCalendarId;
  }
}

if (!write) {
  console.log("\nDRY RUN — re-run with --write to apply.");
} else {
  const tmpPath = `${momentsPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(moments, null, 2));
  fs.renameSync(tmpPath, momentsPath);
  console.log(`\nWrote ${momentsPath}`);

  if (legacyId) {
    const tmpConfig = `${configPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpConfig, JSON.stringify(config, null, 2));
    fs.renameSync(tmpConfig, configPath);
    console.log(`Wrote ${configPath} (removed legacy zenborgCalendarId)`);
  }

  console.log(
    "\nNext: run reconcile-once, then delete the old 'Zenborg' calendar in Calendar.app.",
  );
}
