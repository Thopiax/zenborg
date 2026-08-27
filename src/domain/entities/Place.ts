export interface Place {
  id: string;
  name: string;
  key: string;
  parentKey: string | null;
  emoji: string | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

export function createPlace(props: {
  name: string;
  key: string;
  emoji?: string | null;
  parentKey?: string | null;
  url?: string | null;
}): Place {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: props.name.trim(),
    key: props.key,
    parentKey: props.parentKey ?? null,
    emoji: props.emoji ?? null,
    url: props.url ?? null,
    createdAt: now,
    updatedAt: now,
  };
}
