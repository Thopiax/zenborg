#!/usr/bin/env node
/**
 * Zenborg MCP server — the gardener's voice.
 *
 * Exposes the full CRUD surface + service-level orchestration over the
 * Zenborg vault (JSON collections at `{vaultRoot}/{collection}.json`).
 * See TOOLS.md for the scoped tool inventory.
 *
 * Vault path resolution: --vault CLI > $ZENBORG_VAULT_DIR > ~/.zenborg.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as crypto from 'node:crypto';
import { z } from 'zod';

import {
  AttitudeSchema,
  CustomMetricSchema,
  PhaseSchema,
  RhythmSchema,
  logVaultBanner,
  readCollection,
  resolveVault,
  rhythmToCycleBudget,
  writeCollection,
  type Area,
  type Cycle,
  type CyclePlan,
  type Habit,
  type Moment,
  type Phase,
  type PhaseConfig,
  type Rhythm,
} from './vault.js';
import {
  areaHasMoments,
  canAllocateToPhase,
  computeCycleCascade,
  computeHabitCascade,
  findAreaByIdOrName,
  findCycleByIdOrName,
  findCyclePlan,
  findHabitByIdOrName,
  isAllocated,
  isBudgeted,
  isInDeck,
  isSpontaneous,
  normalizeTags,
  requireActiveArea,
  requireActiveHabit,
  requireCycle,
  validateOneToThreeWords,
} from './validation.js';

// ────────────────────────────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────────────────────────────

const vault = resolveVault();
logVaultBanner(vault);
const VAULT_ROOT = vault.root;

// ────────────────────────────────────────────────────────────────────────
// Result helpers
// ────────────────────────────────────────────────────────────────────────

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
};

function ok(payload: unknown): ToolResult {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function err(message: string): ToolResult {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }] };
}

function nowIso(): string {
  return new Date().toISOString();
}

// ────────────────────────────────────────────────────────────────────────
// Server
// ────────────────────────────────────────────────────────────────────────

const server = new McpServer(
  { name: 'zenborg-mcp', version: '0.3.0' },
  {
    instructions: `Zenborg is an intention-cultivation garden. The vault at \`${VAULT_ROOT}\` stores the garden state as JSON collections written by the Tauri app.

## Metaphor

Your life is the garden. You are the gardener. Zenborg is the toolshed.

- **Area** — a plot of the garden (a life domain you cultivate)
- **Habit** — a perennial (a recurring moment template, lives inside an area)
- **Moment** — what you plant today (a 1–3 word intention)
- **Cycle** — a season (a time container with an intention)
- **CyclePlan** — a plot's budget for the season (how many moments of this habit this cycle)
- **Phase** — time-of-day band (MORNING / AFTERNOON / EVENING / NIGHT)
- **Attitude** — relationship mode: BEGINNING → KEEPING → BUILDING → PUSHING → BEING

## Vault layout

\`areas.json\`, \`habits.json\`, \`cycles.json\`, \`cyclePlans.json\`, \`moments.json\`, \`phaseConfigs.json\`, \`metricLogs.json\` — each keyed by entity id.

## Typical workflows

1. \`list_areas\` to orient yourself, then \`list_habits\` in an area.
2. \`plan_cycle\` to open a season, \`budget_habit_to_cycle\` to allocate perennial slots.
3. \`allocate_moment_from_deck\` to place a budgeted moment on a day/phase.
4. \`spawn_spontaneous_from_habit\` for ad-hoc moments; \`create_standalone_moment\` for one-offs.

## Invariants the MCP enforces

- Moment and habit names are **1–3 words**.
- Max **3 moments per (day, phase)** — evolving; check TOOLS.md.
- One \`CyclePlan\` per (cycleId, habitId) — \`budget_habit_to_cycle\` upserts.
- \`archive_habit\` cascades: deletes unallocated moments + all plans for that habit.
- \`delete_cycle\` cascades: deletes all moments + plans scoped to the cycle.
- Active cycle is **derived from dates**, not a mutation. To activate a cycle, move its dates.
`,
  },
);

// ────────────────────────────────────────────────────────────────────────
// AREAS
// ────────────────────────────────────────────────────────────────────────

server.tool(
  'list_areas',
  'List active (non-archived) areas, sorted by order. Pass includeArchived=true to include archived.',
  { includeArchived: z.boolean().optional() },
  async ({ includeArchived }): Promise<ToolResult> => {
    const areas = readCollection(VAULT_ROOT, 'areas');
    const list = Object.values(areas)
      .filter((a) => includeArchived || !a.isArchived)
      .sort((a, b) => a.order - b.order);
    return ok(list);
  },
);

server.tool(
  'get_area',
  'Get a single area by id or exact name.',
  { idOrName: z.string() },
  async ({ idOrName }): Promise<ToolResult> => {
    const areas = readCollection(VAULT_ROOT, 'areas');
    const area = findAreaByIdOrName(areas, idOrName);
    if (!area) return err(`Area not found or ambiguous: ${idOrName}`);
    return ok(area);
  },
);

server.tool(
  'create_area',
  'Create a new area (plot of the garden).',
  {
    name: z.string().min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex like #aabbcc'),
    emoji: z.string().min(1),
    order: z.number().int().nonnegative(),
    attitude: AttitudeSchema.nullable().optional(),
    tags: z.array(z.string()).optional(),
  },
  async ({ name, color, emoji, order, attitude, tags }): Promise<ToolResult> => {
    const areas = readCollection(VAULT_ROOT, 'areas');
    const now = nowIso();
    const area: Area = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
      emoji: emoji.trim(),
      isDefault: false,
      isArchived: false,
      order,
      attitude: attitude ?? null,
      tags: normalizeTags(tags),
      createdAt: now,
      updatedAt: now,
    };
    areas[area.id] = area;
    writeCollection(VAULT_ROOT, 'areas', areas);
    return ok({ created: area });
  },
);

server.tool(
  'update_area',
  'Partially update an area. Pass only fields you want to change.',
  {
    idOrName: z.string(),
    name: z.string().min(1).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    emoji: z.string().min(1).optional(),
    order: z.number().int().nonnegative().optional(),
    attitude: AttitudeSchema.nullable().optional(),
    tags: z.array(z.string()).optional(),
  },
  async (params): Promise<ToolResult> => {
    const { idOrName, ...updates } = params;
    const areas = readCollection(VAULT_ROOT, 'areas');
    const area = findAreaByIdOrName(areas, idOrName);
    if (!area) return err(`Area not found or ambiguous: ${idOrName}`);
    const next: Area = {
      ...area,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.color !== undefined ? { color: updates.color } : {}),
      ...(updates.emoji !== undefined ? { emoji: updates.emoji.trim() } : {}),
      ...(updates.order !== undefined ? { order: updates.order } : {}),
      ...('attitude' in updates ? { attitude: updates.attitude ?? null } : {}),
      ...(updates.tags !== undefined ? { tags: normalizeTags(updates.tags) } : {}),
      updatedAt: nowIso(),
    };
    areas[area.id] = next;
    writeCollection(VAULT_ROOT, 'areas', areas);
    return ok({ updated: next });
  },
);

server.tool(
  'archive_area',
  'Soft-delete an area (hides from active lists; moments preserved).',
  { idOrName: z.string() },
  async ({ idOrName }): Promise<ToolResult> => {
    const areas = readCollection(VAULT_ROOT, 'areas');
    const area = findAreaByIdOrName(areas, idOrName);
    if (!area) return err(`Area not found or ambiguous: ${idOrName}`);
    areas[area.id] = { ...area, isArchived: true, updatedAt: nowIso() };
    writeCollection(VAULT_ROOT, 'areas', areas);
    return ok({ archived: area.id });
  },
);

server.tool(
  'unarchive_area',
  'Restore an archived area.',
  { idOrName: z.string() },
  async ({ idOrName }): Promise<ToolResult> => {
    const areas = readCollection(VAULT_ROOT, 'areas');
    const area =
      areas[idOrName] ??
      Object.values(areas).find(
        (a) => a.isArchived && a.name.toLowerCase() === idOrName.toLowerCase(),
      );
    if (!area) return err(`Archived area not found: ${idOrName}`);
    areas[area.id] = { ...area, isArchived: false, updatedAt: nowIso() };
    writeCollection(VAULT_ROOT, 'areas', areas);
    return ok({ unarchived: area.id });
  },
);

server.tool(
  'delete_area',
  'Permanently delete an archived area. Only allowed if the area has no moments.',
  { idOrName: z.string() },
  async ({ idOrName }): Promise<ToolResult> => {
    const areas = readCollection(VAULT_ROOT, 'areas');
    const area =
      areas[idOrName] ??
      Object.values(areas).find(
        (a) => a.name.toLowerCase() === idOrName.toLowerCase(),
      );
    if (!area) return err(`Area not found: ${idOrName}`);
    if (!area.isArchived) return err(`Area must be archived first: ${area.name}`);
    const moments = readCollection(VAULT_ROOT, 'moments');
    if (areaHasMoments(area.id, moments)) {
      return err(`Area has moments; cannot delete. Reassign or delete moments first.`);
    }
    delete areas[area.id];
    writeCollection(VAULT_ROOT, 'areas', areas);
    return ok({ deleted: area.id });
  },
);

// ────────────────────────────────────────────────────────────────────────
// HABITS
// ────────────────────────────────────────────────────────────────────────

server.tool(
  'list_habits',
  'List habits. Filter by areaId and/or includeArchived.',
  {
    areaId: z.string().optional(),
    includeArchived: z.boolean().optional(),
  },
  async ({ areaId, includeArchived }): Promise<ToolResult> => {
    const habits = readCollection(VAULT_ROOT, 'habits');
    const list = Object.values(habits)
      .filter((h) => includeArchived || !h.isArchived)
      .filter((h) => (areaId ? h.areaId === areaId : true))
      .sort((a, b) => a.order - b.order);
    return ok(list);
  },
);

server.tool(
  'get_habit',
  'Get a habit by id or exact name.',
  { idOrName: z.string() },
  async ({ idOrName }): Promise<ToolResult> => {
    const habits = readCollection(VAULT_ROOT, 'habits');
    const habit = findHabitByIdOrName(habits, idOrName);
    if (!habit) return err(`Habit not found or ambiguous: ${idOrName}`);
    return ok(habit);
  },
);

server.tool(
  'create_habit',
  'Create a habit (perennial) inside an area. Name must be 1–3 words.',
  {
    name: z.string(),
    areaId: z.string(),
    order: z.number().int().nonnegative(),
    attitude: AttitudeSchema.nullable().optional(),
    phase: PhaseSchema.nullable().optional(),
    tags: z.array(z.string()).optional(),
    emoji: z.string().nullable().optional(),
    description: z.string().max(2000).optional(),
    guidance: z.string().optional(),
    rhythm: RhythmSchema.optional(),
  },
  async (params): Promise<ToolResult> => {
    const nameError = validateOneToThreeWords(params.name, 'Habit');
    if (nameError) return err(nameError);

    const areas = readCollection(VAULT_ROOT, 'areas');
    const areaCheck = requireActiveArea(areas, params.areaId);
    if (typeof areaCheck === 'string') return err(areaCheck);

    const habits = readCollection(VAULT_ROOT, 'habits');
    const now = nowIso();
    const habit: Habit = {
      id: crypto.randomUUID(),
      name: params.name.trim(),
      areaId: params.areaId,
      attitude: params.attitude ?? null,
      phase: params.phase ?? null,
      tags: normalizeTags(params.tags),
      emoji: params.emoji ? params.emoji.trim() : null,
      isArchived: false,
      order: params.order,
      ...(params.description?.trim()
        ? { description: params.description.trim() }
        : {}),
      ...(params.guidance?.trim() ? { guidance: params.guidance.trim() } : {}),
      ...(params.rhythm ? { rhythm: params.rhythm } : {}),
      createdAt: now,
      updatedAt: now,
    };
    habits[habit.id] = habit;
    writeCollection(VAULT_ROOT, 'habits', habits);
    return ok({ created: habit });
  },
);

server.tool(
  'update_habit',
  'Partially update a habit.',
  {
    id: z.string(),
    name: z.string().optional(),
    areaId: z.string().optional(),
    order: z.number().int().nonnegative().optional(),
    attitude: AttitudeSchema.nullable().optional(),
    phase: PhaseSchema.nullable().optional(),
    tags: z.array(z.string()).optional(),
    emoji: z.string().nullable().optional(),
    description: z.string().max(2000).optional(),
    guidance: z.string().optional(),
    rhythm: RhythmSchema.nullable().optional(),
  },
  async (params): Promise<ToolResult> => {
    const { id, ...updates } = params;
    const habits = readCollection(VAULT_ROOT, 'habits');
    const habit = habits[id];
    if (!habit) return err(`Habit not found: ${id}`);

    if (updates.name !== undefined) {
      const nameError = validateOneToThreeWords(updates.name, 'Habit');
      if (nameError) return err(nameError);
    }

    if (updates.areaId !== undefined) {
      const areas = readCollection(VAULT_ROOT, 'areas');
      const areaCheck = requireActiveArea(areas, updates.areaId);
      if (typeof areaCheck === 'string') return err(areaCheck);
    }

    const next: Habit = {
      ...habit,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.areaId !== undefined ? { areaId: updates.areaId } : {}),
      ...(updates.order !== undefined ? { order: updates.order } : {}),
      ...('attitude' in updates ? { attitude: updates.attitude ?? null } : {}),
      ...('phase' in updates ? { phase: updates.phase ?? null } : {}),
      ...(updates.tags !== undefined
        ? { tags: normalizeTags(updates.tags) }
        : {}),
      ...('emoji' in updates
        ? { emoji: updates.emoji ? updates.emoji.trim() : null }
        : {}),
      ...(updates.description !== undefined
        ? { description: updates.description.trim() }
        : {}),
      ...(updates.guidance !== undefined
        ? { guidance: updates.guidance.trim() }
        : {}),
      updatedAt: nowIso(),
    };
    if ('rhythm' in updates) {
      if (updates.rhythm === null) {
        delete next.rhythm;
      } else if (updates.rhythm !== undefined) {
        next.rhythm = updates.rhythm;
      }
    }
    habits[id] = next;
    writeCollection(VAULT_ROOT, 'habits', habits);
    return ok({ updated: next });
  },
);

server.tool(
  'archive_habit',
  'Archive a habit. Cascades: deletes unallocated moments + all cycle plans for this habit. Allocated moments are preserved as historical record.',
  { id: z.string() },
  async ({ id }): Promise<ToolResult> => {
    const habits = readCollection(VAULT_ROOT, 'habits');
    const habit = habits[id];
    if (!habit) return err(`Habit not found: ${id}`);

    const moments = readCollection(VAULT_ROOT, 'moments');
    const plans = readCollection(VAULT_ROOT, 'cyclePlans');
    const cascade = computeHabitCascade(id, moments, plans);

    for (const mId of cascade.momentIdsToDelete) delete moments[mId];
    for (const pId of cascade.planIdsToDelete) delete plans[pId];
    habits[id] = { ...habit, isArchived: true, updatedAt: nowIso() };

    writeCollection(VAULT_ROOT, 'habits', habits);
    writeCollection(VAULT_ROOT, 'moments', moments);
    writeCollection(VAULT_ROOT, 'cyclePlans', plans);

    return ok({
      archived: id,
      deletedMoments: cascade.momentIdsToDelete.length,
      deletedPlans: cascade.planIdsToDelete.length,
    });
  },
);

server.tool(
  'unarchive_habit',
  'Restore an archived habit. Does not restore cascaded moments/plans.',
  { id: z.string() },
  async ({ id }): Promise<ToolResult> => {
    const habits = readCollection(VAULT_ROOT, 'habits');
    const habit = habits[id];
    if (!habit) return err(`Habit not found: ${id}`);
    habits[id] = { ...habit, isArchived: false, updatedAt: nowIso() };
    writeCollection(VAULT_ROOT, 'habits', habits);
    return ok({ unarchived: id });
  },
);

// ────────────────────────────────────────────────────────────────────────
// CYCLES
// ────────────────────────────────────────────────────────────────────────

function isCycleActive(cycle: Cycle, todayMs: number): boolean {
  const startMs = Date.parse(cycle.startDate);
  if (Number.isNaN(startMs) || startMs > todayMs) return false;
  if (cycle.endDate === null) return true;
  const endMs = Date.parse(cycle.endDate);
  return !Number.isNaN(endMs) && endMs >= todayMs;
}

server.tool(
  'list_cycles',
  'List cycles. filter: "active"/"current" = contains today (derived from dates), "upcoming" = starts in future, "all" = everything. Default "all".',
  {
    filter: z.enum(['active', 'upcoming', 'current', 'all']).optional(),
  },
  async ({ filter = 'all' }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const list = Object.values(cycles)
      .filter((c) => {
        switch (filter) {
          case 'active':
          case 'current':
            return isCycleActive(c, todayMs);
          case 'upcoming': {
            const start = Date.parse(c.startDate);
            return !Number.isNaN(start) && start > todayMs;
          }
          case 'all':
            return true;
        }
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return ok(list);
  },
);

server.tool(
  'get_cycle',
  'Get a cycle by id or exact name.',
  { idOrName: z.string() },
  async ({ idOrName }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const cycle = findCycleByIdOrName(cycles, idOrName);
    if (!cycle) return err(`Cycle not found or ambiguous: ${idOrName}`);
    return ok(cycle);
  },
);

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

server.tool(
  'plan_cycle',
  'Create a new cycle (season). If startDate is omitted, defaults to today. If endDate is omitted, cycle is open-ended.',
  {
    name: z.string().min(1),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD')
      .nullable()
      .optional(),
    intention: z.string().optional(),
  },
  async ({ name, startDate, endDate, intention }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const now = nowIso();
    const resolvedStart = startDate ?? new Date().toISOString().slice(0, 10);
    const cycle: Cycle = {
      id: crypto.randomUUID(),
      name: name.trim(),
      startDate: resolvedStart,
      endDate: endDate ?? null,
      ...(intention?.trim() ? { intention: intention.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    };
    cycles[cycle.id] = cycle;
    writeCollection(VAULT_ROOT, 'cycles', cycles);
    return ok({ created: cycle });
  },
);

server.tool(
  'quick_create_cycle',
  'Shortcut for common cycle templates. template: "week" (7 days), "month" (28 days), "quarter" (90 days).',
  {
    name: z.string().min(1),
    template: z.enum(['week', 'month', 'quarter']),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    intention: z.string().optional(),
  },
  async ({ name, template, startDate, intention }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const now = nowIso();
    const resolvedStart = startDate ?? new Date().toISOString().slice(0, 10);
    const days = template === 'week' ? 7 : template === 'month' ? 28 : 90;
    const resolvedEnd = addDays(resolvedStart, days - 1);
    const cycle: Cycle = {
      id: crypto.randomUUID(),
      name: name.trim(),
      startDate: resolvedStart,
      endDate: resolvedEnd,
      ...(intention?.trim() ? { intention: intention.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    };
    cycles[cycle.id] = cycle;
    writeCollection(VAULT_ROOT, 'cycles', cycles);
    return ok({ created: cycle });
  },
);

server.tool(
  'update_cycle',
  'Partially update a cycle (name, dates, intention, reflection).',
  {
    id: z.string(),
    name: z.string().min(1).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    intention: z.string().optional(),
    reflection: z.string().optional(),
  },
  async (params): Promise<ToolResult> => {
    const { id, ...updates } = params;
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const cycle = cycles[id];
    if (!cycle) return err(`Cycle not found: ${id}`);
    const next: Cycle = {
      ...cycle,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.startDate !== undefined ? { startDate: updates.startDate } : {}),
      ...('endDate' in updates ? { endDate: updates.endDate ?? null } : {}),
      ...(updates.intention !== undefined
        ? { intention: updates.intention.trim() }
        : {}),
      ...(updates.reflection !== undefined
        ? { reflection: updates.reflection.trim() }
        : {}),
      updatedAt: nowIso(),
    };
    cycles[id] = next;
    writeCollection(VAULT_ROOT, 'cycles', cycles);
    return ok({ updated: next });
  },
);

server.tool(
  'end_cycle',
  "Set a cycle's endDate (defaults to today).",
  {
    id: z.string(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  },
  async ({ id, endDate }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const cycle = cycles[id];
    if (!cycle) return err(`Cycle not found: ${id}`);
    const next: Cycle = {
      ...cycle,
      endDate: endDate ?? new Date().toISOString().slice(0, 10),
      updatedAt: nowIso(),
    };
    cycles[id] = next;
    writeCollection(VAULT_ROOT, 'cycles', cycles);
    return ok({ ended: id, endDate: next.endDate });
  },
);

server.tool(
  'delete_cycle',
  'Permanently delete a cycle. Cascades: deletes all moments + cycle plans scoped to this cycle.',
  { id: z.string() },
  async ({ id }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const cycle = cycles[id];
    if (!cycle) return err(`Cycle not found: ${id}`);

    const moments = readCollection(VAULT_ROOT, 'moments');
    const plans = readCollection(VAULT_ROOT, 'cyclePlans');
    const cascade = computeCycleCascade(id, moments, plans);

    for (const mId of cascade.momentIdsToDelete) delete moments[mId];
    for (const pId of cascade.planIdsToDelete) delete plans[pId];
    delete cycles[id];

    writeCollection(VAULT_ROOT, 'cycles', cycles);
    writeCollection(VAULT_ROOT, 'moments', moments);
    writeCollection(VAULT_ROOT, 'cyclePlans', plans);

    return ok({
      deleted: id,
      deletedMoments: cascade.momentIdsToDelete.length,
      deletedPlans: cascade.planIdsToDelete.length,
    });
  },
);

// ────────────────────────────────────────────────────────────────────────
// CYCLE PLANS
// ────────────────────────────────────────────────────────────────────────

server.tool(
  'list_cycle_plans',
  'List cycle plans. Optionally filter by cycleId.',
  { cycleId: z.string().optional() },
  async ({ cycleId }): Promise<ToolResult> => {
    const plans = readCollection(VAULT_ROOT, 'cyclePlans');
    const list = Object.values(plans).filter(
      (p) => !cycleId || p.cycleId === cycleId,
    );
    return ok(list);
  },
);

server.tool(
  'get_cycle_plan',
  'Get a cycle plan by id.',
  { id: z.string() },
  async ({ id }): Promise<ToolResult> => {
    const plans = readCollection(VAULT_ROOT, 'cyclePlans');
    const plan = plans[id];
    if (!plan) return err(`Cycle plan not found: ${id}`);
    return ok(plan);
  },
);

server.tool(
  'budget_habit_to_cycle',
  'Upsert a cycle plan: allocate N moments of a habit to a cycle. If count is omitted, derives it from rhythmOverride ?? habit.rhythm across the cycle length. If a plan for (cycleId, habitId) already exists, updates its budgetedCount.',
  {
    cycleId: z.string(),
    habitId: z.string(),
    count: z.number().int().nonnegative().optional(),
    rhythmOverride: RhythmSchema.optional(),
  },
  async ({ cycleId, habitId, count, rhythmOverride }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const cycleCheck = requireCycle(cycles, cycleId);
    if (typeof cycleCheck === 'string') return err(cycleCheck);
    const cycle = cycleCheck;

    const habits = readCollection(VAULT_ROOT, 'habits');
    const habitCheck = requireActiveHabit(habits, habitId);
    if (typeof habitCheck === 'string') return err(habitCheck);
    const habit = habitCheck;

    const effectiveRhythm: Rhythm | null =
      rhythmOverride ?? habit.rhythm ?? null;

    let resolvedCount: number;
    if (count !== undefined) {
      resolvedCount = count;
    } else {
      if (!effectiveRhythm) {
        return err(
          'Cannot derive budget: no explicit count and no rhythm on habit or override',
        );
      }
      const start = new Date(cycle.startDate);
      const end = cycle.endDate ? new Date(cycle.endDate) : new Date();
      const cycleDays = Math.max(
        1,
        Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1,
      );
      resolvedCount = rhythmToCycleBudget(effectiveRhythm, cycleDays);
    }

    const plans = readCollection(VAULT_ROOT, 'cyclePlans');
    const existing = findCyclePlan(plans, cycleId, habitId);
    const now = nowIso();
    const plan: CyclePlan = existing
      ? { ...existing, budgetedCount: resolvedCount, updatedAt: now }
      : {
          id: crypto.randomUUID(),
          cycleId,
          habitId,
          budgetedCount: resolvedCount,
          createdAt: now,
          updatedAt: now,
        };
    plans[plan.id] = plan;

    if (rhythmOverride !== undefined) {
      plan.rhythmOverride = rhythmOverride;
      plan.updatedAt = nowIso();
      plans[plan.id] = plan;
    }

    writeCollection(VAULT_ROOT, 'cyclePlans', plans);
    return ok({ upserted: plan });
  },
);

server.tool(
  'increment_habit_budget',
  'Increment the budgeted count for a (cycle, habit) plan by 1. Creates the plan if absent.',
  { cycleId: z.string(), habitId: z.string() },
  async ({ cycleId, habitId }): Promise<ToolResult> => {
    const plans = readCollection(VAULT_ROOT, 'cyclePlans');
    const existing = findCyclePlan(plans, cycleId, habitId);
    const now = nowIso();
    const plan: CyclePlan = existing
      ? { ...existing, budgetedCount: existing.budgetedCount + 1, updatedAt: now }
      : {
          id: crypto.randomUUID(),
          cycleId,
          habitId,
          budgetedCount: 1,
          createdAt: now,
          updatedAt: now,
        };
    plans[plan.id] = plan;
    writeCollection(VAULT_ROOT, 'cyclePlans', plans);
    return ok({ upserted: plan });
  },
);

server.tool(
  'decrement_habit_budget',
  'Decrement the budgeted count for a (cycle, habit) plan by 1 (floor at 0).',
  { cycleId: z.string(), habitId: z.string() },
  async ({ cycleId, habitId }): Promise<ToolResult> => {
    const plans = readCollection(VAULT_ROOT, 'cyclePlans');
    const existing = findCyclePlan(plans, cycleId, habitId);
    if (!existing) return err('No plan to decrement');
    const next: CyclePlan = {
      ...existing,
      budgetedCount: Math.max(0, existing.budgetedCount - 1),
      updatedAt: nowIso(),
    };
    plans[next.id] = next;
    writeCollection(VAULT_ROOT, 'cyclePlans', plans);
    return ok({ updated: next });
  },
);

server.tool(
  'remove_habit_from_deck',
  'Remove a (cycle, habit) plan entirely, plus any budgeted-but-unallocated moments tied to it.',
  { cycleId: z.string(), habitId: z.string() },
  async ({ cycleId, habitId }): Promise<ToolResult> => {
    const plans = readCollection(VAULT_ROOT, 'cyclePlans');
    const plan = findCyclePlan(plans, cycleId, habitId);
    if (!plan) return err('No plan to remove');

    const moments = readCollection(VAULT_ROOT, 'moments');
    const deletedMomentIds: string[] = [];
    for (const m of Object.values(moments)) {
      if (m.cyclePlanId === plan.id && m.day === null) {
        deletedMomentIds.push(m.id);
        delete moments[m.id];
      }
    }
    delete plans[plan.id];

    writeCollection(VAULT_ROOT, 'cyclePlans', plans);
    writeCollection(VAULT_ROOT, 'moments', moments);

    return ok({
      removedPlan: plan.id,
      deletedDeckMoments: deletedMomentIds.length,
    });
  },
);

// ────────────────────────────────────────────────────────────────────────
// MOMENTS
// ────────────────────────────────────────────────────────────────────────

const MomentAllocationFilter = z.enum([
  'unallocated',
  'deck',
  'allocated',
  'budgeted',
  'spontaneous',
]);

server.tool(
  'list_moments',
  'List moments with optional structured filters.',
  {
    filter: z
      .object({
        areaId: z.string().optional(),
        habitId: z.string().optional(),
        cycleId: z.string().optional(),
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        phase: PhaseSchema.optional(),
        allocation: MomentAllocationFilter.optional(),
      })
      .optional(),
  },
  async ({ filter }): Promise<ToolResult> => {
    const moments = readCollection(VAULT_ROOT, 'moments');
    const list = Object.values(moments).filter((m) => {
      if (!filter) return true;
      if (filter.areaId && m.areaId !== filter.areaId) return false;
      if (filter.habitId && m.habitId !== filter.habitId) return false;
      if (filter.cycleId && m.cycleId !== filter.cycleId) return false;
      if (filter.day && m.day !== filter.day) return false;
      if (filter.phase && m.phase !== filter.phase) return false;
      if (filter.allocation) {
        switch (filter.allocation) {
          case 'unallocated':
            if (!(m.day === null && m.cyclePlanId === null)) return false;
            break;
          case 'deck':
            if (!isInDeck(m)) return false;
            break;
          case 'allocated':
            if (!isAllocated(m)) return false;
            break;
          case 'budgeted':
            if (!isBudgeted(m)) return false;
            break;
          case 'spontaneous':
            if (!(isAllocated(m) && isSpontaneous(m))) return false;
            break;
        }
      }
      return true;
    });
    return ok(list);
  },
);

server.tool(
  'get_moment',
  'Get a moment by id.',
  { id: z.string() },
  async ({ id }): Promise<ToolResult> => {
    const moments = readCollection(VAULT_ROOT, 'moments');
    const moment = moments[id];
    if (!moment) return err(`Moment not found: ${id}`);
    return ok(moment);
  },
);

function buildMoment(params: {
  name: string;
  areaId: string;
  habitId?: string | null;
  cycleId?: string | null;
  cyclePlanId?: string | null;
  phase?: Phase | null;
  day?: string | null;
  order?: number;
  emoji?: string | null;
  tags?: string[] | null;
  customMetric?: Moment['customMetric'];
}): Moment {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    name: params.name.trim(),
    areaId: params.areaId,
    habitId: params.habitId ?? null,
    cycleId: params.cycleId ?? null,
    cyclePlanId: params.cyclePlanId ?? null,
    phase: params.phase ?? null,
    day: params.day ?? null,
    order: params.order ?? 0,
    emoji: params.emoji ?? null,
    tags: normalizeTags(params.tags ?? undefined),
    ...(params.customMetric ? { customMetric: params.customMetric } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

server.tool(
  'create_moment',
  'Create an unallocated moment (lives in the drawing board). Name must be 1–3 words.',
  {
    name: z.string(),
    areaId: z.string(),
    phase: PhaseSchema.nullable().optional(),
    emoji: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    customMetric: CustomMetricSchema.optional(),
  },
  async (params): Promise<ToolResult> => {
    const nameError = validateOneToThreeWords(params.name, 'Moment');
    if (nameError) return err(nameError);

    const areas = readCollection(VAULT_ROOT, 'areas');
    const areaCheck = requireActiveArea(areas, params.areaId);
    if (typeof areaCheck === 'string') return err(areaCheck);

    const moments = readCollection(VAULT_ROOT, 'moments');
    const moment = buildMoment(params);
    moments[moment.id] = moment;
    writeCollection(VAULT_ROOT, 'moments', moments);
    return ok({ created: moment });
  },
);

server.tool(
  'update_moment',
  'Partially update a moment. Does NOT change day/phase allocation — use allocate_moment / unallocate_moment for that.',
  {
    id: z.string(),
    name: z.string().optional(),
    areaId: z.string().optional(),
    emoji: z.string().nullable().optional(),
    phase: PhaseSchema.nullable().optional(),
    tags: z.array(z.string()).optional(),
    customMetric: CustomMetricSchema.optional(),
  },
  async (params): Promise<ToolResult> => {
    const { id, ...updates } = params;
    const moments = readCollection(VAULT_ROOT, 'moments');
    const moment = moments[id];
    if (!moment) return err(`Moment not found: ${id}`);

    if (updates.name !== undefined) {
      const nameError = validateOneToThreeWords(updates.name, 'Moment');
      if (nameError) return err(nameError);
    }
    if (updates.areaId !== undefined) {
      const areas = readCollection(VAULT_ROOT, 'areas');
      const areaCheck = requireActiveArea(areas, updates.areaId);
      if (typeof areaCheck === 'string') return err(areaCheck);
    }

    const next: Moment = {
      ...moment,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.areaId !== undefined ? { areaId: updates.areaId } : {}),
      ...('emoji' in updates ? { emoji: updates.emoji ?? null } : {}),
      ...('phase' in updates ? { phase: updates.phase ?? null } : {}),
      ...(updates.tags !== undefined
        ? { tags: normalizeTags(updates.tags) }
        : {}),
      ...(updates.customMetric !== undefined
        ? { customMetric: updates.customMetric }
        : {}),
      updatedAt: nowIso(),
    };
    moments[id] = next;
    writeCollection(VAULT_ROOT, 'moments', moments);
    return ok({ updated: next });
  },
);

server.tool(
  'delete_moment',
  'Permanently delete a moment.',
  { id: z.string() },
  async ({ id }): Promise<ToolResult> => {
    const moments = readCollection(VAULT_ROOT, 'moments');
    if (!moments[id]) return err(`Moment not found: ${id}`);
    delete moments[id];
    writeCollection(VAULT_ROOT, 'moments', moments);
    return ok({ deleted: id });
  },
);

server.tool(
  'allocate_moment',
  'Allocate a moment to a specific (day, phase). Enforces max 3 per phase.',
  {
    id: z.string(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    phase: PhaseSchema,
    order: z.number().int().min(0).max(2).optional(),
  },
  async ({ id, day, phase, order }): Promise<ToolResult> => {
    const moments = readCollection(VAULT_ROOT, 'moments');
    const moment = moments[id];
    if (!moment) return err(`Moment not found: ${id}`);
    const allMoments = Object.values(moments);
    if (!canAllocateToPhase(allMoments, day, phase, id)) {
      return err(`Phase is full: max 3 moments on ${day} ${phase}.`);
    }
    const next: Moment = {
      ...moment,
      day,
      phase,
      order: order ?? 0,
      updatedAt: nowIso(),
    };
    moments[id] = next;
    writeCollection(VAULT_ROOT, 'moments', moments);
    return ok({ allocated: next });
  },
);

server.tool(
  'unallocate_moment',
  'Return an allocated moment to the drawing board (clears day/phase).',
  { id: z.string() },
  async ({ id }): Promise<ToolResult> => {
    const moments = readCollection(VAULT_ROOT, 'moments');
    const moment = moments[id];
    if (!moment) return err(`Moment not found: ${id}`);
    const next: Moment = {
      ...moment,
      day: null,
      phase: null,
      order: 0,
      updatedAt: nowIso(),
    };
    moments[id] = next;
    writeCollection(VAULT_ROOT, 'moments', moments);
    return ok({ unallocated: next });
  },
);

server.tool(
  'allocate_moment_from_deck',
  'Allocate a deck moment (budgeted, not yet placed) to a (day, phase). Fails if the moment is not in a cycle deck.',
  {
    momentId: z.string(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    phase: PhaseSchema,
    order: z.number().int().min(0).max(2).optional(),
  },
  async ({ momentId, day, phase, order }): Promise<ToolResult> => {
    const moments = readCollection(VAULT_ROOT, 'moments');
    const moment = moments[momentId];
    if (!moment) return err(`Moment not found: ${momentId}`);
    if (!isInDeck(moment)) {
      return err(
        `Moment is not in a cycle deck (cyclePlanId required, day must be null).`,
      );
    }
    const allMoments = Object.values(moments);
    if (!canAllocateToPhase(allMoments, day, phase, momentId)) {
      return err(`Phase is full: max 3 moments on ${day} ${phase}.`);
    }
    const next: Moment = {
      ...moment,
      day,
      phase,
      order: order ?? 0,
      updatedAt: nowIso(),
    };
    moments[momentId] = next;
    writeCollection(VAULT_ROOT, 'moments', moments);
    return ok({ allocatedFromDeck: next });
  },
);

server.tool(
  'spawn_spontaneous_from_habit',
  'Create an ad-hoc moment from a habit template and allocate it. Inherits name/area/emoji/tags. Spontaneous = no cyclePlanId. If a cycle contains the day, inherits its cycleId.',
  {
    habitId: z.string(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    phase: PhaseSchema,
    order: z.number().int().min(0).max(2).optional(),
  },
  async ({ habitId, day, phase, order }): Promise<ToolResult> => {
    const habits = readCollection(VAULT_ROOT, 'habits');
    const habitCheck = requireActiveHabit(habits, habitId);
    if (typeof habitCheck === 'string') return err(habitCheck);
    const habit = habitCheck;

    const areas = readCollection(VAULT_ROOT, 'areas');
    const areaCheck = requireActiveArea(areas, habit.areaId);
    if (typeof areaCheck === 'string') return err(areaCheck);

    const moments = readCollection(VAULT_ROOT, 'moments');
    if (!canAllocateToPhase(Object.values(moments), day, phase)) {
      return err(`Phase is full: max 3 moments on ${day} ${phase}.`);
    }

    // Inherit cycleId if a cycle contains `day`.
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const dayMs = Date.parse(day);
    let cycleId: string | null = null;
    for (const c of Object.values(cycles)) {
      const startMs = Date.parse(c.startDate);
      const endMs = c.endDate ? Date.parse(c.endDate) : Infinity;
      if (!Number.isNaN(startMs) && dayMs >= startMs && dayMs <= endMs) {
        cycleId = c.id;
        break;
      }
    }

    const moment = buildMoment({
      name: habit.name,
      areaId: habit.areaId,
      habitId: habit.id,
      cycleId,
      cyclePlanId: null, // spontaneous
      phase,
      day,
      order: order ?? 0,
      emoji: habit.emoji,
      tags: habit.tags,
    });
    moments[moment.id] = moment;
    writeCollection(VAULT_ROOT, 'moments', moments);
    return ok({ created: moment });
  },
);

server.tool(
  'create_standalone_moment',
  'Create a new moment and allocate it in one op. For ad-hoc day moments not tied to a habit.',
  {
    name: z.string(),
    areaId: z.string(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    phase: PhaseSchema,
    order: z.number().int().min(0).max(2).optional(),
    emoji: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  },
  async (params): Promise<ToolResult> => {
    const nameError = validateOneToThreeWords(params.name, 'Moment');
    if (nameError) return err(nameError);

    const areas = readCollection(VAULT_ROOT, 'areas');
    const areaCheck = requireActiveArea(areas, params.areaId);
    if (typeof areaCheck === 'string') return err(areaCheck);

    const moments = readCollection(VAULT_ROOT, 'moments');
    if (!canAllocateToPhase(Object.values(moments), params.day, params.phase)) {
      return err(`Phase is full: max 3 moments on ${params.day} ${params.phase}.`);
    }

    const moment = buildMoment({
      name: params.name,
      areaId: params.areaId,
      phase: params.phase,
      day: params.day,
      order: params.order ?? 0,
      emoji: params.emoji ?? null,
      tags: params.tags,
    });
    moments[moment.id] = moment;
    writeCollection(VAULT_ROOT, 'moments', moments);
    return ok({ created: moment });
  },
);

// ────────────────────────────────────────────────────────────────────────
// PHASE CONFIGS (Should-have)
// ────────────────────────────────────────────────────────────────────────

server.tool(
  'list_phase_configs',
  'List phase configurations, sorted by order.',
  {},
  async (): Promise<ToolResult> => {
    const configs = readCollection(VAULT_ROOT, 'phaseConfigs');
    const list = Object.values(configs).sort((a, b) => a.order - b.order);
    return ok(list);
  },
);

server.tool(
  'update_phase_config',
  'Update a phase configuration (label, emoji, color, hours, visibility, order).',
  {
    id: z.string(),
    label: z.string().min(1).optional(),
    emoji: z.string().min(1).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    startHour: z.number().int().min(0).max(23).optional(),
    endHour: z.number().int().min(0).max(23).optional(),
    isVisible: z.boolean().optional(),
    order: z.number().int().nonnegative().optional(),
  },
  async (params): Promise<ToolResult> => {
    const { id, ...updates } = params;
    const configs = readCollection(VAULT_ROOT, 'phaseConfigs');
    const config = configs[id];
    if (!config) return err(`Phase config not found: ${id}`);
    const next: PhaseConfig = {
      ...config,
      ...(updates.label !== undefined ? { label: updates.label } : {}),
      ...(updates.emoji !== undefined ? { emoji: updates.emoji } : {}),
      ...(updates.color !== undefined ? { color: updates.color } : {}),
      ...(updates.startHour !== undefined ? { startHour: updates.startHour } : {}),
      ...(updates.endHour !== undefined ? { endHour: updates.endHour } : {}),
      ...(updates.isVisible !== undefined ? { isVisible: updates.isVisible } : {}),
      ...(updates.order !== undefined ? { order: updates.order } : {}),
      updatedAt: nowIso(),
    };
    configs[id] = next;
    writeCollection(VAULT_ROOT, 'phaseConfigs', configs);
    return ok({ updated: next });
  },
);

// ────────────────────────────────────────────────────────────────────────
// Connect
// ────────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[zenborg-mcp] connected (vault: ${VAULT_ROOT})\n`);
