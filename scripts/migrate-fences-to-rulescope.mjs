#!/usr/bin/env node
/**
 * Migrate legacy fences from flat domains/matches/areas to RuleScope.
 *
 * Reads $ZENBORG_HOME/fences.json (default ~/.zenborg/fences.json), converts
 * every entry that has a flat `domains` field but no `scope` into a
 * browser-scoped RuleScope, and writes back atomically.
 *
 * Usage:
 *   node scripts/migrate-fences-to-rulescope.mjs [--dry-run]
 *
 * --dry-run  prints what would change without writing.
 *
 * content-break is special: it used `areas` (resolved at serve time via the
 * now-removed area-map) with empty `domains`. The script cannot resolve those
 * areas to domains automatically — pass the domains as a comma-separated
 * CONTENT_BREAK_DOMAINS env var, or the script will warn and skip it.
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ZENBORG_HOME =
  process.env.ZENBORG_HOME || process.env.KAIROS_HOME || join(process.env.HOME, ".zenborg");
const FENCES_PATH = join(ZENBORG_HOME, "fences.json");
const dryRun = process.argv.includes("--dry-run");

function readFences() {
  const raw = JSON.parse(readFileSync(FENCES_PATH, "utf8"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("fences.json is not a keyed object");
  }
  return raw;
}

function writeAtomic(path, data) {
  const tmp = join(tmpdir(), `fences-migrate-${Date.now()}.json`);
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmp, path);
}

const contentBreakDomains = process.env.CONTENT_BREAK_DOMAINS
  ? process.env.CONTENT_BREAK_DOMAINS.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const fences = readFences();
let migrated = 0;
let skipped = 0;

for (const [id, rule] of Object.entries(fences)) {
  if (!rule || typeof rule !== "object") continue;

  // Already has RuleScope — skip
  if (rule.scope && typeof rule.scope === "object" && "surface" in rule.scope) {
    continue;
  }

  const flatDomains = rule.domains ?? [];
  const flatMatches = rule.matches ?? [];
  const flatAreas = rule.areas ?? [];

  // content-break: areas-based, needs explicit domains
  if (id === "content-break" && flatDomains.length === 0 && flatAreas.length > 0) {
    if (!contentBreakDomains) {
      console.warn(
        `⚠  ${id}: uses areas ${JSON.stringify(flatAreas)} with no domains.` +
        `\n   Set CONTENT_BREAK_DOMAINS="dom1,dom2,..." to provide them. Skipping.`
      );
      skipped++;
      continue;
    }
    const matches = contentBreakDomains.flatMap((d) => [
      `*://${d}/*`,
      `*://*.${d}/*`,
    ]);
    rule.scope = {
      surface: "browser",
      domain: contentBreakDomains.length === 1 ? contentBreakDomains[0] : contentBreakDomains,
      matches,
    };
    delete rule.domains;
    delete rule.matches;
    console.log(`✓  ${id}: scope.domain = ${JSON.stringify(rule.scope.domain)}`);
    migrated++;
    continue;
  }

  if (flatDomains.length === 0) {
    console.warn(`⚠  ${id}: no domains and no areas — skipping`);
    skipped++;
    continue;
  }

  const matches =
    flatMatches.length > 0
      ? flatMatches
      : flatDomains.flatMap((d) => [`*://${d}/*`, `*://*.${d}/*`]);

  rule.scope = {
    surface: "browser",
    domain: flatDomains.length === 1 ? flatDomains[0] : flatDomains,
    matches,
  };
  delete rule.domains;
  delete rule.matches;

  console.log(`✓  ${id}: scope.domain = ${JSON.stringify(rule.scope.domain)}`);
  migrated++;
}

if (dryRun) {
  console.log(`\n-- dry run: ${migrated} would migrate, ${skipped} skipped --`);
} else if (migrated > 0) {
  writeAtomic(FENCES_PATH, fences);
  console.log(`\n${migrated} migrated, ${skipped} skipped. Written to ${FENCES_PATH}`);
} else {
  console.log(`\nNothing to migrate (${skipped} skipped).`);
}
