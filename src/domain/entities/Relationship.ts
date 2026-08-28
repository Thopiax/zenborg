export const ENTITY_TYPES = ["person", "place", "habit", "area"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface Relationship {
  id: string;
  fromType: EntityType;
  fromId: string;
  toType: EntityType;
  toId: string;
  label: string;
  direction: "directed" | "mutual";
  createdAt: string;
  updatedAt: string;
}

export function createRelationship(props: {
  fromType: EntityType;
  fromId: string;
  toType: EntityType;
  toId: string;
  label: string;
  direction?: "directed" | "mutual";
}): Relationship {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    fromType: props.fromType,
    fromId: props.fromId,
    toType: props.toType,
    toId: props.toId,
    label: props.label,
    direction: props.direction ?? "mutual",
    createdAt: now,
    updatedAt: now,
  };
}
