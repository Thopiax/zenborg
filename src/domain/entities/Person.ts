import type { Cadence } from "../value-objects/Cadence";

export interface Person {
  id: string;
  name: string;
  key: string;
  cadence: Cadence | null;
  status: "active" | "paused";
  category: string | null;
  basePlace: string | null;
  emoji: string | null;
  isSelf?: boolean;
  createdAt: string;
  updatedAt: string;
}

export function createPerson(props: {
  name: string;
  key: string;
  emoji?: string | null;
  category?: string | null;
  cadence?: Cadence | null;
  basePlace?: string | null;
}): Person {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: props.name.trim(),
    key: props.key,
    cadence: props.cadence ?? null,
    status: "active",
    category: props.category ?? null,
    basePlace: props.basePlace ?? null,
    emoji: props.emoji ?? null,
    createdAt: now,
    updatedAt: now,
  };
}
