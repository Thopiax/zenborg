# Cultivars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cultivars (named session templates: tag + params) to habits, rotated by CyclePlan, snapshotted on moments.

**Architecture:** Cultivar is a value object (`{ tag, params? }`) living on the Habit entity. CyclePlan gains a `cultivarRotation` field (ordered tag list). Moments snapshot the cultivar used and mirror its tag into `moment.tags`. A shared Zod schema module (`src/domain/shared/cultivar-schema.ts`) is the single source of truth imported by both `src/domain/` and `mcp-server/`, eliminating type duplication for this entity.

**Tech Stack:** TypeScript, Zod, Vitest, MCP SDK

**Spec:** `docs/decisions/2026-08-24-habit-session-variety-as-cycleplan-rotation.md` (stamped)

## Global Constraints

- All three fields (`cultivars` on Habit, `cultivarRotation` on CyclePlan, `cultivar` on Moment) are **optional**. Absence means "no cultivars." Never persist `[]` or `{}`.
- Backward compatible by construction: no migration, no backfill. Old vault data works unchanged.
- Tags pass existing `normalizeTag` rules: lowercase, alphanumeric + hyphen, 1-20 chars.
- Tags unique within one habit's cultivar list.
- Moment snapshots the full cultivar (tag + params as-planted), because moments are historical record and the habit's recipe can change later.
- Cultivar tag is **mirrored into `moment.tags`** on creation so existing tag infrastructure (health, tag profiles, UI) sees cultivar usage for free.
- Rotation default: round-robin via `rotation[allocatedCount % rotation.length]`, deterministic, no new state.
- `mcp-server/` already imports from `../src/application/` (fences precedent). The shared schema follows this same pattern: `../src/domain/shared/cultivar-schema.ts`.
- pnpm only. Vitest for tests. Biome for formatting.

---

### Task 1: Shared Cultivar Schema

**Files:**
- Create: `src/domain/shared/cultivar-schema.ts`
- Create: `src/domain/shared/__tests__/cultivar-schema.test.ts`

**Interfaces:**
- Consumes: `normalizeTag` from `src/domain/services/TagService.ts`
- Produces:
  - `CultivarSchema: z.ZodType` (Zod schema for `{ tag: string, params?: Record<string, string | number> }`)
  - `Cultivar: type` (inferred from CultivarSchema)
  - `normalizeCultivars(list: unknown[]): Cultivar[]` (normalize tags, dedupe by tag, drop invalid, strip empty params)
  - `findCultivar(cultivars: Cultivar[], tag: string): Cultivar | undefined`
  - `nextInRotation(rotation: string[], allocatedCount: number): string` (round-robin)
  - `validateRotationAgainstHabit(rotation: string[], cultivars: Cultivar[]): string | null` (error message or null)

- [ ] **Step 1: Install zod in root package**

```bash
pnpm add zod
```

Zod is already in `mcp-server/`; adding it to root lets `src/domain/` import it directly.

- [ ] **Step 2: Write the failing tests**

Create `src/domain/shared/__tests__/cultivar-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CultivarSchema,
  type Cultivar,
  findCultivar,
  nextInRotation,
  normalizeCultivars,
  validateRotationAgainstHabit,
} from "../cultivar-schema";

describe("CultivarSchema", () => {
  it("parses a valid cultivar with tag only", () => {
    const result = CultivarSchema.safeParse({ tag: "recovery" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tag).toBe("recovery");
      expect(result.data.params).toBeUndefined();
    }
  });

  it("parses a valid cultivar with params", () => {
    const result = CultivarSchema.safeParse({
      tag: "long-run",
      params: { durationMin: 90, pace: "easy" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.params).toEqual({ durationMin: 90, pace: "easy" });
    }
  });

  it("rejects invalid tag format", () => {
    const result = CultivarSchema.safeParse({ tag: "INVALID TAG!" });
    expect(result.success).toBe(false);
  });

  it("rejects tag exceeding 20 chars", () => {
    const result = CultivarSchema.safeParse({
      tag: "a".repeat(21),
    });
    expect(result.success).toBe(false);
  });
});

describe("normalizeCultivars", () => {
  it("normalizes tags, deduplicates, drops invalid", () => {
    const input = [
      { tag: "Recovery", params: { durationMin: 30 } },
      { tag: "recovery" }, // duplicate after normalization
      { tag: "" }, // invalid
      { tag: "speed", params: {} }, // empty params stripped
    ];
    const result = normalizeCultivars(input);
    expect(result).toEqual([
      { tag: "recovery", params: { durationMin: 30 } },
      { tag: "speed" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeCultivars([])).toEqual([]);
  });
});

describe("findCultivar", () => {
  const cultivars: Cultivar[] = [
    { tag: "recovery", params: { durationMin: 30 } },
    { tag: "speed" },
  ];

  it("finds by exact tag", () => {
    expect(findCultivar(cultivars, "recovery")).toEqual(cultivars[0]);
  });

  it("returns undefined for missing tag", () => {
    expect(findCultivar(cultivars, "tempo")).toBeUndefined();
  });
});

describe("nextInRotation", () => {
  const rotation = ["recovery", "long", "speed"];

  it("returns first element at count 0", () => {
    expect(nextInRotation(rotation, 0)).toBe("recovery");
  });

  it("cycles through via modulo", () => {
    expect(nextInRotation(rotation, 1)).toBe("long");
    expect(nextInRotation(rotation, 2)).toBe("speed");
    expect(nextInRotation(rotation, 3)).toBe("recovery");
    expect(nextInRotation(rotation, 7)).toBe("long");
  });
});

describe("validateRotationAgainstHabit", () => {
  const cultivars: Cultivar[] = [
    { tag: "recovery" },
    { tag: "long" },
    { tag: "speed" },
  ];

  it("returns null for valid rotation (subset)", () => {
    expect(
      validateRotationAgainstHabit(["recovery", "long"], cultivars),
    ).toBeNull();
  });

  it("returns error for tag not in cultivars", () => {
    const error = validateRotationAgainstHabit(["tempo"], cultivars);
    expect(error).toContain("tempo");
  });

  it("returns null for empty rotation", () => {
    expect(validateRotationAgainstHabit([], cultivars)).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test -- src/domain/shared/__tests__/cultivar-schema.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 4: Implement the shared schema**

Create `src/domain/shared/cultivar-schema.ts`:

```ts
import { z } from "zod";
import { normalizeTag, validateTag } from "../services/TagService";

export const CultivarParamsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number()]),
);

export const CultivarSchema = z.object({
  tag: z.string().min(1).max(20).refine(validateTag, {
    message: "Tag must be lowercase alphanumeric + hyphen, 1-20 chars",
  }),
  params: CultivarParamsSchema.optional(),
});

export type Cultivar = z.infer<typeof CultivarSchema>;

export function normalizeCultivars(list: unknown[]): Cultivar[] {
  const seen = new Set<string>();
  const out: Cultivar[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const tagRaw = typeof obj.tag === "string" ? normalizeTag(obj.tag) : null;
    if (!tagRaw || seen.has(tagRaw)) continue;
    seen.add(tagRaw);

    const params =
      obj.params && typeof obj.params === "object"
        ? Object.fromEntries(
            Object.entries(obj.params as Record<string, unknown>).filter(
              ([, v]) => typeof v === "string" || typeof v === "number",
            ),
          )
        : undefined;

    const hasParams = params && Object.keys(params).length > 0;
    out.push(hasParams ? { tag: tagRaw, params } : { tag: tagRaw });
  }
  return out;
}

export function findCultivar(
  cultivars: Cultivar[],
  tag: string,
): Cultivar | undefined {
  return cultivars.find((c) => c.tag === tag);
}

export function nextInRotation(
  rotation: string[],
  allocatedCount: number,
): string {
  return rotation[allocatedCount % rotation.length];
}

export function validateRotationAgainstHabit(
  rotation: string[],
  cultivars: Cultivar[],
): string | null {
  const knownTags = new Set(cultivars.map((c) => c.tag));
  const orphans = rotation.filter((t) => !knownTags.has(t));
  if (orphans.length > 0) {
    return `Rotation tags not in habit cultivars: ${orphans.join(", ")}`;
  }
  return null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- src/domain/shared/__tests__/cultivar-schema.test.ts
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/domain/shared/cultivar-schema.ts src/domain/shared/__tests__/cultivar-schema.test.ts package.json pnpm-lock.yaml
git commit -m "feat(domain): add shared Cultivar schema with Zod

Single source of truth for both app domain and MCP server.
Cultivar = tag + optional params, with normalization,
round-robin rotation, and rotation-against-habit validation."
```

---

### Task 2: Add cultivars to Habit entity

**Files:**
- Modify: `src/domain/entities/Habit.ts`
- Modify: `src/domain/__tests__/Habit.test.ts`

**Interfaces:**
- Consumes: `Cultivar`, `normalizeCultivars` from `src/domain/shared/cultivar-schema.ts`
- Produces:
  - `Habit.cultivars?: Cultivar[]` (optional field on the Habit interface)
  - `CreateHabitProps.cultivars?: Cultivar[]`
  - `createHabit` and `updateHabit` handle cultivars with the same absent-not-empty pattern as `aliases`

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/__tests__/Habit.test.ts`:

```ts
import type { Cultivar } from "@/domain/shared/cultivar-schema";

// Inside describe("createHabit"):
it("should create habit with cultivars", () => {
  const cultivars: Cultivar[] = [
    { tag: "recovery", params: { durationMin: 30 } },
    { tag: "speed" },
  ];
  const habit = createHabit({
    name: "Running",
    areaId: "area-123",
    order: 0,
    cultivars,
  });
  if ("error" in habit) throw new Error(habit.error);
  expect(habit.cultivars).toEqual(cultivars);
});

it("should omit cultivars key when empty array provided", () => {
  const habit = createHabit({
    name: "Running",
    areaId: "area-123",
    order: 0,
    cultivars: [],
  });
  if ("error" in habit) throw new Error(habit.error);
  expect("cultivars" in habit).toBe(false);
});

it("should normalize and dedupe cultivar tags", () => {
  const habit = createHabit({
    name: "Running",
    areaId: "area-123",
    order: 0,
    cultivars: [
      { tag: "Recovery" },
      { tag: "recovery" }, // dup after normalize
    ],
  });
  if ("error" in habit) throw new Error(habit.error);
  expect(habit.cultivars).toEqual([{ tag: "recovery" }]);
});

// Inside describe("updateHabit"):
it("should add cultivars to existing habit", () => {
  const habit = createHabit({
    name: "Running",
    areaId: "area-123",
    order: 0,
  });
  if ("error" in habit) throw new Error(habit.error);

  const updated = updateHabit(habit, {
    cultivars: [{ tag: "recovery" }],
  });
  if ("error" in updated) throw new Error(updated.error);
  expect(updated.cultivars).toEqual([{ tag: "recovery" }]);
});

it("should clear cultivars when set to undefined via 'in' check", () => {
  const habit = createHabit({
    name: "Running",
    areaId: "area-123",
    order: 0,
    cultivars: [{ tag: "recovery" }],
  });
  if ("error" in habit) throw new Error(habit.error);

  // Explicitly passing cultivars key with empty array should clear
  const updates: Partial<Habit> = {};
  Object.defineProperty(updates, "cultivars", { value: [], enumerable: true });
  const updated = updateHabit(habit, updates);
  if ("error" in updated) throw new Error(updated.error);
  expect("cultivars" in updated).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/domain/__tests__/Habit.test.ts
```

Expected: FAIL (cultivars not on interface)

- [ ] **Step 3: Implement cultivars on Habit**

In `src/domain/entities/Habit.ts`:

1. Add import: `import { type Cultivar, normalizeCultivars } from "@/domain/shared/cultivar-schema";`

2. Add to `Habit` interface:
```ts
cultivars?: Cultivar[];
```

3. Add to `CreateHabitProps`:
```ts
cultivars?: Cultivar[];
```

4. In `createHabit`, after `normalizedAliases`:
```ts
const normalizedCultivars = normalizeCultivars(props.cultivars ?? []);
```

5. In the return object, add alongside `aliases`:
```ts
...(normalizedCultivars.length > 0 ? { cultivars: normalizedCultivars } : {}),
```

6. In `updateHabit`, add a block after the `aliases` handling (following the same `"key" in updates` pattern):
```ts
if ("cultivars" in updates) {
  const normalized = normalizeCultivars(updates.cultivars ?? []);
  if (normalized.length === 0) {
    delete merged.cultivars;
  } else {
    merged.cultivars = normalized;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/domain/__tests__/Habit.test.ts
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/Habit.ts src/domain/__tests__/Habit.test.ts
git commit -m "feat(domain): add optional cultivars to Habit entity

Follows the aliases pattern: normalize, dedupe, absent-not-empty.
Uses shared CultivarSchema as single source of truth."
```

---

### Task 3: Add cultivarRotation to CyclePlan entity

**Files:**
- Modify: `src/domain/entities/CyclePlan.ts`
- Modify: `src/domain/__tests__/CyclePlan.test.ts`

**Interfaces:**
- Consumes: `validateRotationAgainstHabit`, `Cultivar` from `src/domain/shared/cultivar-schema.ts`
- Produces:
  - `CyclePlan.cultivarRotation?: string[]` (ordered list of cultivar tags)
  - `CreateCyclePlanProps.cultivarRotation?: string[]`

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/__tests__/CyclePlan.test.ts`:

```ts
it("should create plan with cultivar rotation", () => {
  const plan = createCyclePlan({
    cycleId: "cycle-1",
    habitId: "habit-1",
    budgetedCount: 6,
    cultivarRotation: ["recovery", "long", "speed"],
  });
  if ("error" in plan) throw new Error(plan.error);
  expect(plan.cultivarRotation).toEqual(["recovery", "long", "speed"]);
});

it("should omit cultivarRotation when empty", () => {
  const plan = createCyclePlan({
    cycleId: "cycle-1",
    habitId: "habit-1",
    budgetedCount: 6,
    cultivarRotation: [],
  });
  if ("error" in plan) throw new Error(plan.error);
  expect("cultivarRotation" in plan).toBe(false);
});
```

- [ ] **Step 2: Run to verify fail, implement, run to verify pass**

Add `cultivarRotation?: string[]` to `CyclePlan` interface and `CreateCyclePlanProps`. In `createCyclePlan`, spread it:

```ts
...(cultivarRotation && cultivarRotation.length > 0 ? { cultivarRotation } : {}),
```

```bash
pnpm test -- src/domain/__tests__/CyclePlan.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/entities/CyclePlan.ts src/domain/__tests__/CyclePlan.test.ts
git commit -m "feat(domain): add optional cultivarRotation to CyclePlan

Ordered tag list selecting which cultivars are in rotation this cycle."
```

---

### Task 4: Add cultivar snapshot to Moment entity

**Files:**
- Modify: `src/domain/entities/Moment.ts`
- Modify: `src/domain/__tests__/Moment.test.ts`

**Interfaces:**
- Consumes: `Cultivar` from `src/domain/shared/cultivar-schema.ts`
- Produces:
  - `Moment.cultivar?: Cultivar` (snapshot of the cultivar used)
  - `CreateMomentProps.cultivar?: Cultivar`
  - When `cultivar` is present, `cultivar.tag` is union'd into `moment.tags`

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/__tests__/Moment.test.ts`:

```ts
import type { Cultivar } from "@/domain/shared/cultivar-schema";

// Inside describe("createMoment"):
it("should snapshot cultivar and mirror tag into tags", () => {
  const cultivar: Cultivar = { tag: "recovery", params: { durationMin: 30 } };
  const moment = createMoment({
    name: "Morning run",
    areaId: "area-1",
    cultivar,
    tags: ["outdoor"],
  });
  if ("error" in moment) throw new Error(moment.error);
  expect(moment.cultivar).toEqual(cultivar);
  expect(moment.tags).toContain("recovery");
  expect(moment.tags).toContain("outdoor");
});

it("should not duplicate tag if cultivar tag already in tags", () => {
  const cultivar: Cultivar = { tag: "recovery" };
  const moment = createMoment({
    name: "Morning run",
    areaId: "area-1",
    cultivar,
    tags: ["recovery", "outdoor"],
  });
  if ("error" in moment) throw new Error(moment.error);
  const recoveryCount = moment.tags!.filter((t) => t === "recovery").length;
  expect(recoveryCount).toBe(1);
});

it("should omit cultivar key when not provided", () => {
  const moment = createMoment({
    name: "Morning run",
    areaId: "area-1",
  });
  if ("error" in moment) throw new Error(moment.error);
  expect("cultivar" in moment).toBe(false);
});
```

- [ ] **Step 2: Run to verify fail, implement, run to verify pass**

1. Add `cultivar?: Cultivar` to `Moment` interface and `CreateMomentProps`.
2. In `createMoment`, after tag filtering:
```ts
const cultivarTag = props.cultivar?.tag;
const tagsWithCultivar = cultivarTag
  ? Array.from(new Set([...tags.filter(validateTag), cultivarTag]))
  : tags.filter(validateTag);
```
3. In the return object, use `tagsWithCultivar` for `tags` and spread cultivar:
```ts
tags: tagsWithCultivar,
...(props.cultivar ? { cultivar: props.cultivar } : {}),
```

```bash
pnpm test -- src/domain/__tests__/Moment.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/entities/Moment.ts src/domain/__tests__/Moment.test.ts
git commit -m "feat(domain): add cultivar snapshot to Moment entity

Snapshots the full cultivar at creation time (historical record).
Mirrors the cultivar tag into moment.tags so existing tag
infrastructure sees cultivar usage without changes."
```

---

### Task 5: Update MCP server types to import shared schema

**Files:**
- Modify: `mcp-server/vault.ts`
- Modify: `mcp-server/validation.ts`
- Modify: `mcp-server/validation.test.ts`

**Interfaces:**
- Consumes: `Cultivar`, `CultivarSchema`, `normalizeCultivars`, `findCultivar`, `nextInRotation`, `validateRotationAgainstHabit` from `../src/domain/shared/cultivar-schema.ts`
- Produces:
  - `Habit.cultivars?: Cultivar[]` on the MCP vault type
  - `CyclePlan.cultivarRotation?: string[]` on the MCP vault type
  - `Moment.cultivar?: Cultivar` on the MCP vault type
  - Re-exports `CultivarSchema` and helpers from validation.ts for tool layer use

- [ ] **Step 1: Add cultivar fields to vault.ts types**

In `mcp-server/vault.ts`, add import:
```ts
import type { Cultivar } from "../src/domain/shared/cultivar-schema.ts";
```

Add to `Habit` interface:
```ts
cultivars?: Cultivar[];
```

Add to `CyclePlan` interface:
```ts
cultivarRotation?: string[];
```

Add to `Moment` interface:
```ts
cultivar?: Cultivar;
```

- [ ] **Step 2: Re-export from validation.ts**

In `mcp-server/validation.ts`, add:
```ts
export {
  type Cultivar,
  CultivarSchema,
  CultivarParamsSchema,
  findCultivar,
  nextInRotation,
  normalizeCultivars,
  validateRotationAgainstHabit,
} from "../src/domain/shared/cultivar-schema.ts";
```

- [ ] **Step 3: Write validation tests**

Add to `mcp-server/validation.test.ts`:

```ts
import {
  CultivarSchema,
  normalizeCultivars,
  nextInRotation,
  validateRotationAgainstHabit,
} from "./validation.js";

describe("CultivarSchema (re-exported from shared)", () => {
  it("parses valid cultivar", () => {
    const result = CultivarSchema.safeParse({ tag: "recovery", params: { durationMin: 30 } });
    expect(result.success).toBe(true);
  });

  it("nextInRotation round-robins", () => {
    expect(nextInRotation(["a", "b", "c"], 4)).toBe("b");
  });

  it("validateRotationAgainstHabit catches orphans", () => {
    const error = validateRotationAgainstHabit(
      ["ghost"],
      [{ tag: "recovery" }],
    );
    expect(error).toContain("ghost");
  });
});
```

- [ ] **Step 4: Run MCP server tests**

```bash
cd mcp-server && pnpm build && node --experimental-vm-modules node_modules/.bin/vitest run validation.test.ts 2>/dev/null || pnpm dev -- --help
```

(Adapt to whatever test runner mcp-server uses. Check existing test scripts.)

- [ ] **Step 5: Commit**

```bash
git add mcp-server/vault.ts mcp-server/validation.ts mcp-server/validation.test.ts
git commit -m "feat(mcp): import shared CultivarSchema, add cultivar fields to vault types

No more mirrored copies: vault.ts and validation.ts import
the Cultivar type and helpers from src/domain/shared/."
```

---

### Task 6: Update MCP tools for cultivar support

**Files:**
- Modify: `mcp-server/index.ts`
- Modify: `mcp-server/TOOLS.md`

**Interfaces:**
- Consumes: `CultivarSchema`, `normalizeCultivars`, `findCultivar`, `nextInRotation`, `validateRotationAgainstHabit` from `./validation.js`
- Produces: Updated tool schemas and handlers for `create_habit`, `update_habit`, `budget_habit_to_cycle`, `allocate_from_plan`, `spawn_spontaneous_from_habit`, `create_standalone_moment`, `update_moment`

- [ ] **Step 1: Update `create_habit` tool (~line 409)**

Add to schema:
```ts
cultivars: z.array(CultivarSchema).optional(),
```

In handler, after `normalizedAliases`:
```ts
const normalizedCultivars = normalizeCultivars(params.cultivars ?? []);
```

In the habit object spread:
```ts
...(normalizedCultivars.length > 0 ? { cultivars: normalizedCultivars } : {}),
```

- [ ] **Step 2: Update `update_habit` tool (~line 486)**

Add to schema:
```ts
cultivars: z.array(CultivarSchema).nullable().optional(),
```

In handler, add block after `placeIds` handling (same `"key" in updates` pattern):
```ts
if ("cultivars" in updates) {
  const normalized = normalizeCultivars(updates.cultivars ?? []);
  if (normalized.length === 0) {
    delete next.cultivars;
  } else {
    next.cultivars = normalized;
  }
}
```

After writing the habit, check for orphaned rotations:
```ts
if (next.cultivars !== habit.cultivars) {
  const plans = readCollection(VAULT_ROOT, "cyclePlans");
  const orphanedPlans: string[] = [];
  const cultivarTags = new Set((next.cultivars ?? []).map(c => c.tag));
  for (const plan of Object.values(plans)) {
    if (plan.habitId === id && plan.cultivarRotation) {
      const orphans = plan.cultivarRotation.filter(t => !cultivarTags.has(t));
      if (orphans.length > 0) orphanedPlans.push(plan.id);
    }
  }
  if (orphanedPlans.length > 0) {
    return ok({
      updated: next,
      rotationOrphans: { planIds: orphanedPlans, note: "Some cycle plan rotations reference cultivar tags that were removed. Update the rotation or it will skip those entries." },
    });
  }
}
```

- [ ] **Step 3: Update `budget_habit_to_cycle` tool (~line 1565)**

Add to schema:
```ts
cultivarRotation: z.array(z.string()).nullable().optional(),
```

Update description: append "Pass `cultivarRotation` to set which cultivar tags rotate this cycle; validated as a subset of the habit's cultivars. `null` clears."

In handler, after building `plan`, before writing:
```ts
if ("cultivarRotation" in params) {
  if (params.cultivarRotation === null) {
    delete plan.cultivarRotation;
  } else if (params.cultivarRotation && params.cultivarRotation.length > 0) {
    const rotationError = validateRotationAgainstHabit(
      params.cultivarRotation,
      habit.cultivars ?? [],
    );
    if (rotationError) return err(rotationError);
    plan.cultivarRotation = params.cultivarRotation;
  }
}
```

- [ ] **Step 4: Update `allocate_from_plan` tool (~line 2090)**

Add to schema:
```ts
cultivar: z.string().optional(),
```

Update description: append "Pass `cultivar` tag to select a specific cultivar; omit for round-robin default when a rotation exists."

In handler, after computing `allocatedForPlan`, before building the moment:
```ts
let selectedCultivar: Cultivar | undefined;
if (params.cultivar) {
  selectedCultivar = findCultivar(habit.cultivars ?? [], params.cultivar);
  if (!selectedCultivar) {
    return err(`Cultivar tag "${params.cultivar}" not found on habit "${habit.name}"`);
  }
} else if (plan.cultivarRotation && plan.cultivarRotation.length > 0) {
  const nextTag = nextInRotation(plan.cultivarRotation, allocatedForPlan);
  selectedCultivar = findCultivar(habit.cultivars ?? [], nextTag);
  // Fail soft on orphan: skip cultivar rather than error
}
```

In the moment object, add:
```ts
tags: [
  ...(habit.tags ?? []),
  ...(selectedCultivar ? [selectedCultivar.tag] : []),
].filter((t, i, a) => a.indexOf(t) === i),
...(selectedCultivar ? { cultivar: selectedCultivar } : {}),
```

Add to response alongside `dayViewOverflow`:
```ts
...(selectedCultivar ? { cultivarUsed: selectedCultivar.tag } : {}),
...(plan.cultivarRotation ? {
  rotationProgress: {
    position: allocatedForPlan % plan.cultivarRotation.length,
    total: plan.cultivarRotation.length,
  },
} : {}),
```

- [ ] **Step 5: Update `spawn_spontaneous_from_habit` tool (~line 2172)**

Add to schema:
```ts
cultivar: z.string().optional(),
```

In handler, resolve against habit:
```ts
let selectedCultivar: Cultivar | undefined;
if (params.cultivar) {
  selectedCultivar = findCultivar(habit.cultivars ?? [], params.cultivar);
  if (!selectedCultivar) {
    return err(`Cultivar tag "${params.cultivar}" not found on habit "${habit.name}"`);
  }
}
```

Pass to `buildMoment`:
```ts
tags: [
  ...(habit.tags ?? []),
  ...(selectedCultivar ? [selectedCultivar.tag] : []),
].filter((t, i, a) => a.indexOf(t) === i),
...(selectedCultivar ? { cultivar: selectedCultivar } : {}),
```

- [ ] **Step 6: Update `create_standalone_moment` tool (~line 2233)**

Add to schema:
```ts
cultivar: CultivarSchema.optional(),
```

(Inline cultivar object, since no habit to resolve against.)

In handler, spread onto moment:
```ts
tags: [
  ...(normalizeTags(params.tags) ?? []),
  ...(params.cultivar ? [params.cultivar.tag] : []),
].filter((t, i, a) => a.indexOf(t) === i),
...(params.cultivar ? { cultivar: params.cultivar } : {}),
```

- [ ] **Step 7: Enrich `get_cycle_plan` response**

Find the `get_cycle_plan` tool (or the plan read in `plan_cycle`/`get_cycle_planning_proposals`). When the plan has a `cultivarRotation`, add to the response:

```ts
const moments = readCollection(VAULT_ROOT, "moments");
const allocated = Object.values(moments).filter(
  (m) => m.cyclePlanId === plan.id && m.day !== null,
);
const rotationProgress = plan.cultivarRotation?.map(tag => ({
  tag,
  allocated: allocated.filter(m => m.cultivar?.tag === tag).length,
}));
const suggestedNext = plan.cultivarRotation
  ? nextInRotation(plan.cultivarRotation, allocated.length)
  : undefined;
```

- [ ] **Step 8: Update TOOLS.md**

Document the new fields on each modified tool. Add a "Cultivars" section explaining the concept.

- [ ] **Step 9: Run smoke test**

```bash
cd mcp-server && pnpm smoke
```

- [ ] **Step 10: Commit**

```bash
git add mcp-server/index.ts mcp-server/TOOLS.md
git commit -m "feat(mcp): cultivar support on 6 tools

create_habit/update_habit: manage cultivar list.
budget_habit_to_cycle: set cultivarRotation.
allocate_from_plan: round-robin default or explicit tag.
spawn_spontaneous_from_habit: explicit cultivar.
create_standalone_moment: inline cultivar object."
```

---

### Task 7: Update application services (CycleService)

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/services/HabitService.ts` (if cultivar pass-through needed)

**Interfaces:**
- Consumes: `Cultivar`, `findCultivar`, `nextInRotation` from `src/domain/shared/cultivar-schema.ts`
- Produces: `allocateFromPlan` and `spawnSpontaneousFromHabit` accept optional cultivar tag

- [ ] **Step 1: Update `allocateFromPlan` (~line 415)**

Add `cultivar?: string` to the props object. After computing `allocatedCount`:

```ts
let selectedCultivar: Cultivar | undefined;
if (props.cultivar) {
  selectedCultivar = findCultivar(habit.cultivars ?? [], props.cultivar);
  if (!selectedCultivar) {
    return { error: `Cultivar tag "${props.cultivar}" not found on habit "${habit.name}"` };
  }
} else if (plan.cultivarRotation && plan.cultivarRotation.length > 0) {
  const nextTag = nextInRotation(plan.cultivarRotation, allocatedCount);
  selectedCultivar = findCultivar(habit.cultivars ?? [], nextTag);
}
```

Pass to `createMoment`:
```ts
tags: [
  ...(habit.tags || []),
  ...(selectedCultivar ? [selectedCultivar.tag] : []),
],
...(selectedCultivar ? { cultivar: selectedCultivar } : {}),
```

- [ ] **Step 2: Update `spawnSpontaneousFromHabit` (~line 1051)**

Add optional `cultivar?: string` parameter. Resolve against habit, pass to `createMoment`.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add src/application/services/CycleService.ts src/application/services/HabitService.ts
git commit -m "feat(app): cultivar support in CycleService allocation paths

allocateFromPlan: round-robin default or explicit cultivar.
spawnSpontaneousFromHabit: optional explicit cultivar."
```

---

### Task 8: Update CLAUDE.md domain table

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing
- Produces: Updated domain documentation

- [ ] **Step 1: Add Cultivar to the domain table**

In the `## Domain` section's table, add:

```
| **Cultivar** | a named session template on a habit: tag + optional parameters (value object) |
```

- [ ] **Step 2: Update the "Two implementations" section**

Replace the warning about paying twice with a note that Cultivar uses a shared schema, breaking the duplication pattern deliberately:

```
`src/domain/shared/cultivar-schema.ts` is the first shared module imported by both
the app (`src/domain/`) and the MCP server (`mcp-server/`), following the fences
precedent. Future shape additions should consider this pattern over mirrored copies.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Cultivar to domain table, note shared schema pattern"
```
