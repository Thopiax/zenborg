/**
 * Vault access for the MCP server.
 *
 * The Tauri desktop app writes canonical JSON collection files at
 * `{vaultRoot}/{collection}.json` (keyed by camelCase collection name). The
 * MCP server reads and writes the same files directly — the Rust watcher
 * picks up our edits and refreshes the desktop observables.
 *
 * Resolution order:
 *   1. `--vault /path/to/vault` CLI arg
 *   2. `$ZENBORG_VAULT_DIR` env var
 *   3. `$HOME/.zenborg/` (release default)
 *
 * Writes are atomic: temp file in the same directory, then rename. This
 * matches the Tauri adapter's semantics so concurrent readers never see a
 * half-written file.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────
// Types — mirror src/domain (standalone; no cross-workspace imports)
// ────────────────────────────────────────────────────────────────────────

export const ATTITUDES = [
  'BEGINNING',
  'KEEPING',
  'BUILDING',
  'PUSHING',
  'BEING',
] as const;
export const AttitudeSchema = z.enum(ATTITUDES);
export type Attitude = z.infer<typeof AttitudeSchema>;

export const PHASES = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'] as const;
export const PhaseSchema = z.enum(PHASES);
export type Phase = z.infer<typeof PhaseSchema>;

export const CustomMetricSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  target: z.number().optional(),
});
export type CustomMetric = z.infer<typeof CustomMetricSchema>;

export interface Area {
  id: string;
  name: string;
  attitude?: Attitude | null;
  tags?: string[];
  color: string;
  emoji: string;
  isDefault: boolean;
  isArchived?: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  areaId: string;
  attitude: Attitude | null;
  phase: Phase | null;
  tags: string[];
  emoji: string | null;
  isArchived: boolean;
  order: number;
  description?: string;
  guidance?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Cycle {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  intention?: string;
  reflection?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CyclePlan {
  id: string;
  cycleId: string;
  habitId: string;
  budgetedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Moment {
  id: string;
  name: string;
  areaId: string;
  habitId: string | null;
  cycleId: string | null;
  cyclePlanId: string | null;
  phase: Phase | null;
  day: string | null; // YYYY-MM-DD
  order: number;
  emoji?: string | null;
  customMetric?: CustomMetric;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhaseConfig {
  id: string;
  phase: Phase;
  label: string;
  emoji: string;
  color: string;
  startHour: number;
  endHour: number;
  isVisible: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface MetricLog {
  id: string;
  momentId: string;
  date: string;
  value: number;
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────
// Collection registry (mirrors src/domain/registry.ts)
// ────────────────────────────────────────────────────────────────────────

export const COLLECTION_NAMES = [
  'moments',
  'areas',
  'habits',
  'cycles',
  'cyclePlans',
  'phaseConfigs',
  'metricLogs',
] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];

export interface CollectionTypeMap {
  moments: Moment;
  areas: Area;
  habits: Habit;
  cycles: Cycle;
  cyclePlans: CyclePlan;
  phaseConfigs: PhaseConfig;
  metricLogs: MetricLog;
}

// ────────────────────────────────────────────────────────────────────────
// Vault path resolution
// ────────────────────────────────────────────────────────────────────────

export const VAULT_DIR_ENV = 'ZENBORG_VAULT_DIR';
export const DEFAULT_VAULT_FOLDER = '.zenborg';
export const DEV_VAULT_FOLDER = '.zenborg-dev';

export interface ResolvedVault {
  root: string;
  source: 'cli' | 'env' | 'default';
}

/**
 * Resolve the vault root. Priority: --vault CLI > $ZENBORG_VAULT_DIR > ~/.zenborg
 */
export function resolveVault(argv: readonly string[] = process.argv): ResolvedVault {
  const vaultArg = argv.find((_, i, a) => a[i - 1] === '--vault');
  if (vaultArg) {
    return { root: path.resolve(vaultArg), source: 'cli' };
  }

  const envPath = process.env[VAULT_DIR_ENV];
  if (envPath && envPath.trim().length > 0) {
    return { root: path.resolve(envPath), source: 'env' };
  }

  return {
    root: path.join(os.homedir(), DEFAULT_VAULT_FOLDER),
    source: 'default',
  };
}

/**
 * Log resolved vault + warn if a dev vault exists but isn't what we targeted.
 * Log lines go to stderr so they don't pollute the MCP stdio transport.
 */
export function logVaultBanner(resolved: ResolvedVault): void {
  const exists = fs.existsSync(resolved.root);
  process.stderr.write(
    `[zenborg-mcp] vault=${resolved.root} source=${resolved.source} exists=${exists}\n`,
  );

  const devRoot = path.join(os.homedir(), DEV_VAULT_FOLDER);
  if (resolved.root !== devRoot && fs.existsSync(devRoot)) {
    process.stderr.write(
      `[zenborg-mcp] WARNING: dev vault exists at ${devRoot} but MCP is not targeting it. ` +
        `If you're running the debug desktop app, point MCP there with --vault ${devRoot}.\n`,
    );
  }
}

/**
 * Absolute path to a collection's JSON file.
 */
export function collectionPath(root: string, collection: CollectionName): string {
  return path.join(root, `${collection}.json`);
}

// ────────────────────────────────────────────────────────────────────────
// Atomic I/O
// ────────────────────────────────────────────────────────────────────────

/**
 * Read a collection. Returns an empty record if the file doesn't exist
 * (first boot / collection never written).
 */
export function readCollection<K extends CollectionName>(
  root: string,
  collection: K,
): Record<string, CollectionTypeMap[K]> {
  const file = collectionPath(root, collection);
  if (!fs.existsSync(file)) {
    return {};
  }
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, CollectionTypeMap[K]>;
  } catch (error) {
    throw new Error(
      `Malformed JSON in ${collection}.json at ${file}: ${(error as Error).message}`,
    );
  }
}

/**
 * Atomic write: temp file in the same directory, then rename.
 * Matches the Tauri adapter so external watchers see a single event.
 */
export function writeCollection<K extends CollectionName>(
  root: string,
  collection: K,
  value: Record<string, CollectionTypeMap[K]>,
): void {
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  const file = collectionPath(root, collection);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
