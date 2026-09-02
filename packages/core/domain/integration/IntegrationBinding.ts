/**
 * IntegrationBinding — the contract between an external source and the garden.
 *
 * One file (`integrations.json`) maps source types to (area, habit) pairs.
 * Unbound sources are ignored. This is the value object the contract names;
 * the vault config is its persistence, and each integration's CLI edge is
 * its consumer.
 *
 * Pure. No filesystem, no network.
 */

export interface IntegrationBinding {
  readonly source: string;
  readonly areaId: string;
  readonly habitId: string;
}

export interface IntegrationConfig {
  readonly version: 1;
  readonly bindings: readonly IntegrationBinding[];
}

const EMPTY: IntegrationConfig = { version: 1, bindings: [] };

export function parseIntegrationConfig(raw: unknown): IntegrationConfig {
  if (typeof raw !== "object" || raw === null) return EMPTY;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.bindings)) return EMPTY;

  const bindings: IntegrationBinding[] = [];
  for (const entry of obj.bindings) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (
      typeof e.source !== "string" ||
      typeof e.areaId !== "string" ||
      typeof e.habitId !== "string"
    ) {
      continue;
    }
    bindings.push({
      source: e.source,
      areaId: e.areaId,
      habitId: e.habitId,
    });
  }

  return { version: 1, bindings };
}

export function findBinding(
  config: IntegrationConfig,
  source: string,
): IntegrationBinding | null {
  return config.bindings.find((b) => b.source === source) ?? null;
}
