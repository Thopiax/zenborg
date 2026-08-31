import type { Cadence } from "../value-objects/Cadence";

export interface Person {
  id: string;
  name: string;
  key: string;
  aliases?: string[];
  cadence: Cadence | null;
  tags: string[];
  basePlace: string | null;
  emoji: string | null;
  isArchived: boolean;
  isSelf?: boolean;
  createdAt: string;
  updatedAt: string;
}

export function displayName(person: Pick<Person, "name" | "aliases">): string {
  return person.aliases?.[0] ?? person.name;
}

export function normalizeAliases(
  aliases: string[] | undefined,
  name: string,
): string[] {
  if (!aliases) return [];
  const lowerName = name.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of aliases) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (lower === lowerName) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(trimmed);
  }
  return out;
}

export function createPerson(props: {
  name: string;
  key: string;
  aliases?: string[];
  emoji?: string | null;
  tags?: string[];
  cadence?: Cadence | null;
  basePlace?: string | null;
}): Person {
  const now = new Date().toISOString();
  const normalized = normalizeAliases(props.aliases, props.name);
  return {
    id: crypto.randomUUID(),
    name: props.name.trim(),
    key: props.key,
    ...(normalized.length > 0 ? { aliases: normalized } : {}),
    cadence: props.cadence ?? null,
    tags: props.tags ?? [],
    basePlace: props.basePlace ?? null,
    emoji: props.emoji ?? null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}
