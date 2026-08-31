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
  address: string | null;
  coordinates: Coordinates | null;
  emoji: string | null;
  url: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export function createPlace(props: {
  name: string;
  key: string;
  emoji?: string | null;
  parentKey?: string | null;
  tags?: string[];
  address?: string | null;
  coordinates?: Coordinates | null;
  url?: string | null;
}): Place {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: props.name.trim(),
    key: props.key,
    parentKey: props.parentKey ?? null,
    tags: props.tags ?? [],
    address: props.address ?? null,
    coordinates: props.coordinates ?? null,
    emoji: props.emoji ?? null,
    url: props.url ?? null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}
