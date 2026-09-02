export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;
  name: string;
  key: string;
  parentKey: string | null;
  tags: string[];
  aliases?: string[];
  address: string | null;
  coordinates: Coordinates | null;
  emoji: string | null;
  url: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
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

export function createPlace(props: {
  name: string;
  key: string;
  emoji?: string | null;
  parentKey?: string | null;
  tags?: string[];
  aliases?: string[];
  address?: string | null;
  coordinates?: Coordinates | null;
  url?: string | null;
}): Place {
  const now = new Date().toISOString();
  const normalized = normalizeAliases(props.aliases, props.name);
  return {
    id: crypto.randomUUID(),
    name: props.name.trim(),
    key: props.key,
    parentKey: props.parentKey ?? null,
    tags: props.tags ?? [],
    ...(normalized.length > 0 ? { aliases: normalized } : {}),
    address: props.address ?? null,
    coordinates: props.coordinates ?? null,
    emoji: props.emoji ?? null,
    url: props.url ?? null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}
