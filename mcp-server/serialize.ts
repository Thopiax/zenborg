import type {
  Area,
  Cycle,
  Habit,
  Moment,
  Person,
  Place,
  Relationship,
} from "./vault.js";

/**
 * Removes null-valued keys and empty-array keys from a plain object (shallow).
 * Preserves `false`, `0`, and `""` — only `null`, `undefined`, and `[]` are dropped.
 */
export function stripNulls<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

export function conciseMoment(m: Moment): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: m.id,
    name: m.name,
    areaId: m.areaId,
    day: m.day,
    phase: m.phase,
  };
  if (m.habitId) base.habitId = m.habitId;
  if (m.cycleId) base.cycleId = m.cycleId;
  if (m.startTime) base.startTime = m.startTime;
  if (m.durationMin) base.durationMin = m.durationMin;
  if (m.tags && m.tags.length > 0) base.tags = m.tags;
  if (m.personIds && m.personIds.length > 0) base.personIds = m.personIds;
  if (m.placeIds && m.placeIds.length > 0) base.placeIds = m.placeIds;
  if (m.status) base.status = m.status;
  return base;
}

export function conciseHabit(h: Habit): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: h.id,
    name: h.name,
    areaId: h.areaId,
    attitude: h.attitude,
  };
  if (h.emoji) base.emoji = h.emoji;
  if (h.phase) base.phase = h.phase;
  if (h.rhythm) base.rhythm = h.rhythm;
  if (h.schedule) base.schedule = h.schedule;
  if (h.tags && h.tags.length > 0) base.tags = h.tags;
  if (h.aliases && h.aliases.length > 0) base.aliases = h.aliases;
  if (h.placeIds && h.placeIds.length > 0) base.placeIds = h.placeIds;
  if (h.isArchived) base.isArchived = true;
  return base;
}

export function conciseArea(a: Area): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: a.id,
    name: a.name,
    emoji: a.emoji,
    color: a.color,
  };
  if (a.attitude) base.attitude = a.attitude;
  if (a.tags && a.tags.length > 0) base.tags = a.tags;
  if (a.isArchived) base.isArchived = true;
  return base;
}

export function conciseCycle(c: Cycle): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: c.id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
  };
  if (c.intention) base.intention = c.intention;
  if (c.placeIds && c.placeIds.length > 0) base.placeIds = c.placeIds;
  return base;
}

export function concisePerson(p: Person): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: p.id,
    name: p.name,
    key: p.key,
  };
  if (p.aliases && p.aliases.length > 0) base.aliases = p.aliases;
  if (p.cadence) base.cadence = p.cadence;
  if (p.tags && p.tags.length > 0) base.tags = p.tags;
  if (p.basePlace) base.basePlace = p.basePlace;
  if (p.emoji) base.emoji = p.emoji;
  if (p.isSelf) base.isSelf = true;
  return base;
}

export function concisePlace(p: Place): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: p.id,
    name: p.name,
    key: p.key,
  };
  if (p.parentKey) base.parentKey = p.parentKey;
  if (p.tags && p.tags.length > 0) base.tags = p.tags;
  if (p.address) base.address = p.address;
  if (p.coordinates) base.coordinates = p.coordinates;
  if (p.emoji) base.emoji = p.emoji;
  if (p.url) base.url = p.url;
  return base;
}

export function conciseRelationship(r: Relationship): Record<string, unknown> {
  return {
    id: r.id,
    fromType: r.fromType,
    fromId: r.fromId,
    toType: r.toType,
    toId: r.toId,
    label: r.label,
    direction: r.direction,
  };
}

/**
 * Write echo for mutations: returns `{ id, name }` plus any explicitly
 * listed changed fields picked from the entity.
 */
export function conciseWriteEcho(
  entity: Record<string, unknown>,
  changedFields?: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: entity.id,
    name: entity.name,
  };
  if (changedFields) {
    for (const f of changedFields) {
      if (f in entity && f !== "id" && f !== "name") {
        out[f] = entity[f];
      }
    }
  }
  return stripNulls(out) as Record<string, unknown>;
}
