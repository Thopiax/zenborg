/**
 * Validation helpers — mirror src/domain invariants.
 *
 * The MCP server is a separate pnpm workspace, so we cannot import from
 * `@/domain/*` directly. We port the small set of invariants that cross
 * collection boundaries (referential integrity, phase cap, cascades).
 * Entity-shape validation lives in zod schemas on the tool layer.
 */
import type {
  Area,
  Cycle,
  CyclePlan,
  Habit,
  Moment,
  Phase,
} from './vault.js';

// ────────────────────────────────────────────────────────────────────────
// Name validation (1–3 words) — used by Habit and Moment
// ────────────────────────────────────────────────────────────────────────

export function validateOneToThreeWords(
  name: string,
  subject: string,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return `${subject} name cannot be empty`;
  }
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 1) {
    return `${subject} name must contain at least 1 word`;
  }
  if (words.length > 3) {
    return `${subject} name cannot exceed 3 words`;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────
// Tag normalization (mirrors src/domain/services/TagService)
// ────────────────────────────────────────────────────────────────────────

const TAG_VALID = /^[a-z0-9-]{1,20}$/;

function normalizeSingleTag(tag: string): string | null {
  if (!tag || typeof tag !== 'string') return null;
  const normalized = tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 20);
  return TAG_VALID.test(normalized) ? normalized : null;
}

export function normalizeTags(tags: readonly string[] | undefined): string[] {
  if (!tags) return [];
  const normalized: string[] = [];
  for (const raw of tags) {
    const n = normalizeSingleTag(raw);
    if (n !== null) normalized.push(n);
  }
  return Array.from(new Set(normalized));
}

/**
 * Normalizes habit aliases: trims, drops empties, drops any alias
 * case-insensitively equal to the habit name, dedupes case-insensitively,
 * and preserves the original casing of the first occurrence.
 */
export function normalizeAliases(
  aliases: readonly string[] | undefined,
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

// ────────────────────────────────────────────────────────────────────────
// Phase cap (max 3 per day/phase)
// TODO(moment-cap): Rafa flagged this will evolve. When the domain loosens
// the per-phase cap in src/domain/entities/Moment.ts::canAllocateToPhase,
// update this helper to match — otherwise MCP and app will disagree.
// ────────────────────────────────────────────────────────────────────────

export const MAX_MOMENTS_PER_PHASE = 3;

export function canAllocateToPhase(
  moments: readonly Moment[],
  day: string,
  phase: Phase,
  excludeMomentId?: string,
): boolean {
  let count = 0;
  for (const m of moments) {
    if (excludeMomentId && m.id === excludeMomentId) continue;
    if (m.day === day && m.phase === phase) count++;
  }
  return count < MAX_MOMENTS_PER_PHASE;
}

// ────────────────────────────────────────────────────────────────────────
// Referential integrity
// ────────────────────────────────────────────────────────────────────────

export function findArea(areas: Record<string, Area>, id: string): Area | null {
  return areas[id] ?? null;
}

export function findAreaByIdOrName(
  areas: Record<string, Area>,
  ref: string,
): Area | null {
  if (areas[ref]) return areas[ref];
  const matches = Object.values(areas).filter(
    (a) => !a.isArchived && a.name.toLowerCase() === ref.toLowerCase(),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function findHabitByIdOrName(
  habits: Record<string, Habit>,
  ref: string,
): Habit | null {
  if (habits[ref]) return habits[ref];
  const matches = Object.values(habits).filter(
    (h) => !h.isArchived && h.name.toLowerCase() === ref.toLowerCase(),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function findCycleByIdOrName(
  cycles: Record<string, Cycle>,
  ref: string,
): Cycle | null {
  if (cycles[ref]) return cycles[ref];
  const matches = Object.values(cycles).filter(
    (c) => c.name.toLowerCase() === ref.toLowerCase(),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function requireActiveArea(
  areas: Record<string, Area>,
  areaId: string,
): string | Area {
  const area = findArea(areas, areaId);
  if (!area) return `Area not found: ${areaId}`;
  if (area.isArchived) return `Area is archived: ${area.name}`;
  return area;
}

export function requireActiveHabit(
  habits: Record<string, Habit>,
  habitId: string,
): string | Habit {
  const habit = habits[habitId] ?? null;
  if (!habit) return `Habit not found: ${habitId}`;
  if (habit.isArchived) return `Habit is archived: ${habit.name}`;
  return habit;
}

export function requireCycle(
  cycles: Record<string, Cycle>,
  cycleId: string,
): string | Cycle {
  const cycle = cycles[cycleId] ?? null;
  if (!cycle) return `Cycle not found: ${cycleId}`;
  return cycle;
}

// ────────────────────────────────────────────────────────────────────────
// CyclePlan uniqueness (one plan per (cycleId, habitId))
// ────────────────────────────────────────────────────────────────────────

export function findCyclePlan(
  plans: Record<string, CyclePlan>,
  cycleId: string,
  habitId: string,
): CyclePlan | null {
  for (const plan of Object.values(plans)) {
    if (plan.cycleId === cycleId && plan.habitId === habitId) {
      return plan;
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────
// Cascade computations
// ────────────────────────────────────────────────────────────────────────

export interface HabitCascade {
  momentIdsToDelete: string[];
  planIdsToDelete: string[];
}

/**
 * Archive-habit cascade: delete unallocated moments belonging to this habit,
 * plus all cycle plans pointing to it. Allocated moments are kept (they're
 * historical record).
 */
export function computeHabitCascade(
  habitId: string,
  moments: Record<string, Moment>,
  plans: Record<string, CyclePlan>,
): HabitCascade {
  const momentIdsToDelete: string[] = [];
  for (const m of Object.values(moments)) {
    if (m.habitId === habitId && m.day === null) {
      momentIdsToDelete.push(m.id);
    }
  }
  const planIdsToDelete: string[] = [];
  for (const p of Object.values(plans)) {
    if (p.habitId === habitId) {
      planIdsToDelete.push(p.id);
    }
  }
  return { momentIdsToDelete, planIdsToDelete };
}

export interface CycleCascade {
  momentIdsToDelete: string[];
  planIdsToDelete: string[];
}

/**
 * Delete-cycle cascade: all moments and plans scoped to the cycle.
 */
export function computeCycleCascade(
  cycleId: string,
  moments: Record<string, Moment>,
  plans: Record<string, CyclePlan>,
): CycleCascade {
  const momentIdsToDelete: string[] = [];
  for (const m of Object.values(moments)) {
    if (m.cycleId === cycleId) {
      momentIdsToDelete.push(m.id);
    }
  }
  const planIdsToDelete: string[] = [];
  for (const p of Object.values(plans)) {
    if (p.cycleId === cycleId) {
      planIdsToDelete.push(p.id);
    }
  }
  return { momentIdsToDelete, planIdsToDelete };
}

// ────────────────────────────────────────────────────────────────────────
// Moment filter predicates (mirror isAllocated / isInDeck / etc.)
// ────────────────────────────────────────────────────────────────────────

export function isAllocated(m: Moment): boolean {
  return m.day !== null && m.phase !== null;
}

export function isInDeck(m: Moment): boolean {
  return !isAllocated(m) && m.cyclePlanId !== null;
}

export function isBudgeted(m: Moment): boolean {
  return m.cyclePlanId !== null;
}

export function isSpontaneous(m: Moment): boolean {
  return m.cyclePlanId === null;
}

export function isUnallocated(m: Moment): boolean {
  // "Drawing board": not allocated AND not in a cycle deck
  return m.day === null && m.cyclePlanId === null;
}

// ────────────────────────────────────────────────────────────────────────
// Area deletion precondition
// ────────────────────────────────────────────────────────────────────────

export function areaHasMoments(
  areaId: string,
  moments: Record<string, Moment>,
): boolean {
  for (const m of Object.values(moments)) {
    if (m.areaId === areaId) return true;
  }
  return false;
}
