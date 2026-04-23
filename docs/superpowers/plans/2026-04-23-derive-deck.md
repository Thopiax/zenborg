# Derive Deck from Plans — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate materialize-on-budget paradigm. Deck becomes a derived view of cycle plans; moments are only created on allocation.

**Architecture:** Domain entities unchanged. `CycleService` gains `allocateFromPlan` + `unallocateMoment` + `reconcileLegacyDeckMoments`; loses `materializeCyclePlanMoments`. New `virtualDeckCards$` reactive computed in infrastructure. `CycleDeck` UI switches source. MCP gets new `allocate_from_plan` tool and drops `allocate_moment_from_deck`. One-shot migration via new `~/.zenborg/meta.json`.

**Tech Stack:** TypeScript, Next.js 15 (App Router), `@legendapp/state`, Tauri (Rust vault watcher), Vitest, Playwright, `@modelcontextprotocol/sdk`, Zod.

**Spec:** `docs/superpowers/specs/2026-04-23-derive-deck-design.md`

---

## File Structure

**Create:**
- `src/domain/entities/Meta.ts` — Meta type + default factory.
- `src/infrastructure/vault/meta-repository.ts` — read/write `meta.json`.
- `src/infrastructure/state/virtualDeckCards.ts` — computed: `virtualDeckCards$(cycleId)`.
- `src/infrastructure/__tests__/meta-repository.test.ts`
- `src/infrastructure/__tests__/virtualDeckCards.test.ts`

**Modify:**
- `src/application/services/CycleService.ts` — delete `materializeCyclePlanMoments` (lines 759-819); remove call site (line 504); add `allocateFromPlan`, `unallocateMoment`, `countAllocatedForPlan`, `reconcileLegacyDeckMoments`; update `decrementHabitBudget`, `archiveHabit`.
- `src/application/__tests__/CycleService.test.ts` — add suites for new methods; update existing suites affected by semantics changes.
- `src/infrastructure/state/store.ts` — add boot hook for reconciler; export `meta$` observable.
- `src/components/CycleDeck.tsx` — read from `virtualDeckCards$`; drag handlers use new service methods.
- `src/components/CycleDeckColumn.tsx` — handle virtual-card drag payload.
- `src/components/__tests__/CycleDeck.test.tsx` — update for virtual-card rendering.
- `mcp-server/index.ts` — remove `allocate_moment_from_deck`, add `allocate_from_plan`, update `unallocate_moment` + `archive_habit` semantics.
- `mcp-server/smoke-test.mjs` — cover new tool.

**Delete:**
- None as files (only function removals inside CycleService).

---

## Task 1: Meta entity + repository

**Files:**
- Create: `src/domain/entities/Meta.ts`
- Create: `src/infrastructure/vault/meta-repository.ts`
- Test: `src/infrastructure/__tests__/meta-repository.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/infrastructure/__tests__/meta-repository.test.ts
// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultMeta,
  readMeta,
  writeMeta,
  clearMetaCache,
} from "../vault/meta-repository";

describe("meta-repository", () => {
  beforeEach(() => {
    localStorage.clear();
    clearMetaCache();
  });

  it("returns defaultMeta when nothing persisted", () => {
    const meta = readMeta();
    expect(meta).toEqual(defaultMeta());
    expect(meta.migrations.derivedDeck).toBe(false);
  });

  it("persists a written meta and returns it on read", () => {
    const meta = defaultMeta();
    meta.migrations.derivedDeck = true;
    writeMeta(meta);
    clearMetaCache();
    expect(readMeta().migrations.derivedDeck).toBe(true);
  });

  it("merges unknown legacy keys into defaults without crashing", () => {
    localStorage.setItem(
      "zenborg:meta",
      JSON.stringify({ migrations: { oldThing: true } }),
    );
    clearMetaCache();
    const meta = readMeta();
    expect(meta.migrations.derivedDeck).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/infrastructure/__tests__/meta-repository.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `Meta` entity**

```typescript
// src/domain/entities/Meta.ts
export interface Meta {
  migrations: {
    derivedDeck: boolean;
  };
}

export function defaultMeta(): Meta {
  return { migrations: { derivedDeck: false } };
}
```

- [ ] **Step 4: Create repository**

```typescript
// src/infrastructure/vault/meta-repository.ts
import { defaultMeta, type Meta } from "@/domain/entities/Meta";

const STORAGE_KEY = "zenborg:meta";
let cached: Meta | null = null;

export { defaultMeta } from "@/domain/entities/Meta";

export function readMeta(): Meta {
  if (cached) return cached;
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cached = {
      migrations: {
        derivedDeck: Boolean(parsed?.migrations?.derivedDeck),
      },
    };
  } catch {
    cached = defaultMeta();
  }
  return cached;
}

export function writeMeta(meta: Meta): void {
  cached = meta;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  }
}

export function clearMetaCache(): void {
  cached = null;
}
```

> **Note:** Legend State persists to IndexedDB through its own plugin; this repository uses `localStorage` because the meta file is small and needs synchronous reads during boot. If a project convention says "always IndexedDB", revisit with the user before substituting — the semantics differ.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/infrastructure/__tests__/meta-repository.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/Meta.ts src/infrastructure/vault/meta-repository.ts src/infrastructure/__tests__/meta-repository.test.ts
git commit -m "feat(meta): add Meta entity + repository for migration flags"
```

---

## Task 2: `CycleService.countAllocatedForPlan`

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/__tests__/CycleService.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the existing `describe("CycleService", ...)` block near the end:

```typescript
describe("countAllocatedForPlan", () => {
  it("returns 0 when no moments link to plan", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(service.countAllocatedForPlan("plan-1")).toBe(0);
  });

  it("counts only allocated moments (day + phase set)", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    moments$["m-1"].set({
      id: "m-1",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: "2026-04-24",
      phase: "MORNING",
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    moments$["m-2"].set({
      id: "m-2",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: null,
      phase: null,
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(service.countAllocatedForPlan("plan-1")).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t countAllocatedForPlan`
Expected: FAIL — `service.countAllocatedForPlan is not a function`.

- [ ] **Step 3: Implement**

In `src/application/services/CycleService.ts`, add below `getCyclePlan`:

```typescript
  /**
   * Count moments allocated (day + phase set) for a cycle plan.
   * Unallocated rows are ignored — deck size is derived, not stored.
   */
  countAllocatedForPlan(cyclePlanId: string): number {
    const moments = Object.values(moments$.get());
    return moments.filter(
      (m) =>
        m.cyclePlanId === cyclePlanId &&
        m.day !== null &&
        m.phase !== null,
    ).length;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t countAllocatedForPlan`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/application/services/CycleService.ts src/application/__tests__/CycleService.test.ts
git commit -m "feat(cycle): add countAllocatedForPlan helper"
```

---

## Task 3: `CycleService.allocateFromPlan`

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/__tests__/CycleService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe("allocateFromPlan", () => {
  const cycle = {
    id: "c-1",
    name: "Cycle",
    startDate: "2026-04-23",
    endDate: "2026-05-06",
    intention: null,
    reflection: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const habit = {
    id: "h-1",
    name: "fiction",
    areaId: "a-1",
    attitude: null,
    phase: null,
    tags: [],
    emoji: "📖",
    isArchived: false,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    cycles$[cycle.id].set(cycle);
    habits$[habit.id].set(habit);
  });

  it("errors when no plan exists", () => {
    const service = new CycleService();
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect(result).toEqual({
      error: expect.stringContaining("No budget"),
    });
  });

  it("creates an allocated moment and increases plan's allocated count", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.name).toBe("fiction");
    expect(result.day).toBe("2026-04-24");
    expect(result.phase).toBe("MORNING");
    expect(result.cyclePlanId).toBe("plan-1");
    expect(service.countAllocatedForPlan("plan-1")).toBe(1);
  });

  it("errors when already over budget", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const first = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect("error" in first).toBe(false);
    const second = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-25",
      phase: "MORNING",
    });
    expect(second).toEqual({
      error: expect.stringContaining("Over budget"),
    });
  });

  it("errors when slot already has 3 moments", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    for (let i = 0; i < 3; i++) {
      moments$[`m-${i}`].set({
        id: `m-${i}`,
        name: "other",
        areaId: "a-1",
        habitId: null,
        cycleId: "c-1",
        cyclePlanId: null,
        day: "2026-04-24",
        phase: "MORNING",
        order: i,
        tags: [],
        emoji: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect(result).toEqual({ error: expect.stringContaining("Slot") });
  });

  it("errors when day outside cycle range (endDate set)", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-06-01",
      phase: "MORNING",
    });
    expect(result).toEqual({ error: expect.stringContaining("outside") });
  });

  it("errors when habit archived", () => {
    const service = new CycleService();
    habits$[habit.id].set({ ...habit, isArchived: true });
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.allocateFromPlan({
      cycleId: "c-1",
      habitId: "h-1",
      day: "2026-04-24",
      phase: "MORNING",
    });
    expect(result).toEqual({
      error: expect.stringContaining("archived"),
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t allocateFromPlan`
Expected: FAIL — method not defined.

- [ ] **Step 3: Implement**

Add below `countAllocatedForPlan` in `CycleService.ts`:

```typescript
  /**
   * Allocate a virtual deck card into a specific day/phase slot by
   * materializing a new Moment. Enforces plan existence, budget ceiling,
   * slot capacity (max 3 per phase), and cycle date range.
   */
  allocateFromPlan(props: {
    cycleId: string;
    habitId: string;
    day: string;
    phase: Phase;
  }): Moment | { error: string } {
    const { cycleId, habitId, day, phase } = props;

    const cycle = cycles$[cycleId].get();
    if (!cycle) return { error: `Cycle ${cycleId} not found` };

    const habit = habits$[habitId].get();
    if (!habit) return { error: `Habit ${habitId} not found` };
    if (habit.isArchived) {
      return { error: `Habit ${habitId} is archived` };
    }

    const plan = this.findCyclePlan(cycleId, habitId);
    if (!plan) {
      return { error: "No budget: habit not planned for cycle" };
    }

    const allocatedCount = this.countAllocatedForPlan(plan.id);
    if (allocatedCount >= plan.budgetedCount) {
      return {
        error: `Over budget: ${allocatedCount}/${plan.budgetedCount} already allocated`,
      };
    }

    if (cycle.endDate) {
      if (day < cycle.startDate || day > cycle.endDate) {
        return {
          error: `Day ${day} outside cycle range ${cycle.startDate}..${cycle.endDate}`,
        };
      }
    } else if (day < cycle.startDate) {
      return { error: `Day ${day} before cycle start ${cycle.startDate}` };
    }

    const slotMoments = Object.values(moments$.get()).filter(
      (m) => m.day === day && m.phase === phase,
    );
    if (slotMoments.length >= 3) {
      return { error: `Slot ${day} ${phase} full (3/3)` };
    }

    const created = createMoment({
      name: habit.name,
      areaId: habit.areaId,
      emoji: habit.emoji,
      habitId: habit.id,
      cycleId,
      cyclePlanId: plan.id,
      tags: habit.tags || [],
      phase,
    });
    if ("error" in created) return created;

    const allocated = allocateMoment(created, {
      day,
      phase,
      order: slotMoments.length,
    });

    moments$[allocated.id].set(allocated);
    return allocated;
  }
```

Ensure imports at top of file include `allocateMoment` and `createMoment`:

```typescript
import {
  allocateMoment,
  createMoment,
  type Moment,
} from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t allocateFromPlan`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/application/services/CycleService.ts src/application/__tests__/CycleService.test.ts
git commit -m "feat(cycle): add allocateFromPlan — materialize on allocation"
```

---

## Task 4: `CycleService.unallocateMoment`

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/__tests__/CycleService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe("unallocateMoment", () => {
  it("deletes plan-linked moment row", () => {
    const service = new CycleService();
    moments$["m-1"].set({
      id: "m-1",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: "2026-04-24",
      phase: "MORNING",
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.unallocateMoment("m-1");
    expect(result).toEqual({ ok: true });
    expect(moments$["m-1"].get()).toBeUndefined();
  });

  it("errors when moment not found", () => {
    const service = new CycleService();
    expect(service.unallocateMoment("missing")).toEqual({
      error: expect.stringContaining("not found"),
    });
  });

  it("rejects spontaneous moments (cyclePlanId === null)", () => {
    const service = new CycleService();
    moments$["m-1"].set({
      id: "m-1",
      name: "spontaneous",
      areaId: "a-1",
      habitId: null,
      cycleId: "c-1",
      cyclePlanId: null,
      day: "2026-04-24",
      phase: "MORNING",
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(service.unallocateMoment("m-1")).toEqual({
      error: expect.stringContaining("spontaneous"),
    });
    expect(moments$["m-1"].get()?.id).toBe("m-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t unallocateMoment`
Expected: FAIL — method not defined.

- [ ] **Step 3: Implement**

```typescript
  /**
   * Unallocate a plan-linked moment by deleting its row.
   * In the derive paradigm, a moment only exists because it was allocated;
   * unallocation removes the row and the virtual ghost in the deck auto-
   * reappears as a consequence of `allocatedCount` dropping.
   *
   * Rejects spontaneous / standalone moments — those use `delete_moment`.
   */
  unallocateMoment(momentId: string): { ok: true } | { error: string } {
    const moment = moments$[momentId].get();
    if (!moment) return { error: `Moment ${momentId} not found` };
    if (moment.cyclePlanId === null) {
      return {
        error:
          "Cannot unallocate spontaneous moment; use delete_moment instead",
      };
    }
    moments$[momentId].delete();
    return { ok: true };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t unallocateMoment`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/application/services/CycleService.ts src/application/__tests__/CycleService.test.ts
git commit -m "feat(cycle): add unallocateMoment — delete row on unallocation"
```

---

## Task 5: `CycleService.reconcileLegacyDeckMoments`

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/__tests__/CycleService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe("reconcileLegacyDeckMoments", () => {
  it("deletes plan-linked moments with day + phase null", () => {
    const service = new CycleService();
    moments$["m-1"].set({
      id: "m-1",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: null,
      phase: null,
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.reconcileLegacyDeckMoments();
    expect(result.deleted).toBe(1);
    expect(moments$["m-1"].get()).toBeUndefined();
  });

  it("preserves allocated moments and spontaneous moments", () => {
    const service = new CycleService();
    moments$["allocated"].set({
      id: "allocated",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: "2026-04-24",
      phase: "MORNING",
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    moments$["spontaneous"].set({
      id: "spontaneous",
      name: "ad-hoc",
      areaId: "a-1",
      habitId: null,
      cycleId: "c-1",
      cyclePlanId: null,
      day: null,
      phase: null,
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.reconcileLegacyDeckMoments();
    expect(result.deleted).toBe(0);
    expect(moments$["allocated"].get()?.id).toBe("allocated");
    expect(moments$["spontaneous"].get()?.id).toBe("spontaneous");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t reconcileLegacyDeckMoments`
Expected: FAIL — method not defined.

- [ ] **Step 3: Implement**

```typescript
  /**
   * One-shot migration: delete leftover unallocated plan-linked moments
   * from the old materialize-on-budget paradigm. Safe to call repeatedly —
   * on a clean vault, deletes zero.
   *
   * Safety: only deletes moments with cyclePlanId !== null
   *         AND day === null AND phase === null.
   */
  reconcileLegacyDeckMoments(): { deleted: number } {
    const all = Object.entries(moments$.get());
    let deleted = 0;
    for (const [id, m] of all) {
      if (m.cyclePlanId !== null && m.day === null && m.phase === null) {
        moments$[id].delete();
        deleted++;
      }
    }
    return { deleted };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t reconcileLegacyDeckMoments`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/application/services/CycleService.ts src/application/__tests__/CycleService.test.ts
git commit -m "feat(cycle): add reconcileLegacyDeckMoments migration helper"
```

---

## Task 6: Update `decrementHabitBudget` floor

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/__tests__/CycleService.test.ts`

- [ ] **Step 1: Find existing test(s) + write new failing test**

Add new test (keep existing `decrementHabitBudget` tests for now):

```typescript
describe("decrementHabitBudget (floored at allocatedCount)", () => {
  beforeEach(() => {
    cycles$["c-1"].set({
      id: "c-1",
      name: "Cycle",
      startDate: "2026-04-23",
      endDate: "2026-05-06",
      intention: null,
      reflection: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    habits$["h-1"].set({
      id: "h-1",
      name: "fiction",
      areaId: "a-1",
      attitude: null,
      phase: null,
      tags: [],
      emoji: null,
      isArchived: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it("no-ops when decrement would dip below allocatedCount", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    moments$["m-1"].set({
      id: "m-1",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: "2026-04-24",
      phase: "MORNING",
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    moments$["m-2"].set({
      id: "m-2",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: "2026-04-25",
      phase: "MORNING",
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.decrementHabitBudget("c-1", "h-1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.budgetedCount).toBe(2); // unchanged
  });

  it("decrements when allocatedCount leaves headroom", () => {
    const service = new CycleService();
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    moments$["m-1"].set({
      id: "m-1",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: "2026-04-24",
      phase: "MORNING",
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = service.decrementHabitBudget("c-1", "h-1");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.budgetedCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t "floored at allocatedCount"`
Expected: FAIL — current implementation removes moments instead of checking floor.

- [ ] **Step 3: Replace implementation**

Replace the body of `decrementHabitBudget` in `CycleService.ts`:

```typescript
  /**
   * Decrements the budget by 1, floored at the number of already-allocated
   * moments. No-op (returns the current plan unchanged) when the floor is
   * already reached — allocated work is sunk cost and survives.
   */
  decrementHabitBudget(cycleId: string, habitId: string): CyclePlanResult {
    const plan = this.findCyclePlan(cycleId, habitId);
    if (!plan) {
      return { error: `No plan for cycle ${cycleId}, habit ${habitId}` };
    }
    const allocated = this.countAllocatedForPlan(plan.id);
    if (plan.budgetedCount - 1 < allocated) {
      return plan; // floor reached; no-op
    }
    return this.budgetHabitToCycle(cycleId, habitId, plan.budgetedCount - 1);
  }
```

- [ ] **Step 4: Run full CycleService test file to catch regressions**

Run: `pnpm test src/application/__tests__/CycleService.test.ts`
Expected: PASS — all tests, including new floor tests. If any prior `decrementHabitBudget` test was coupled to the old "remove unallocated moment" behavior, update its assertions to match the new semantics (plan-level decrement only; moments unchanged unless budget moves).

- [ ] **Step 5: Commit**

```bash
git add src/application/services/CycleService.ts src/application/__tests__/CycleService.test.ts
git commit -m "refactor(cycle): decrementHabitBudget floors at allocatedCount"
```

---

## Task 7: Update `archiveHabit` cascade

**Files:**
- Modify: `src/application/services/HabitService.ts` (likely holds `archiveHabit`; if not, `CycleService.ts`)
- Modify: `src/application/__tests__/HabitService.test.ts` (or wherever cascade tests live)

- [ ] **Step 1: Locate current `archiveHabit` cascade**

Run: `grep -n 'archiveHabit\|archive_habit' src/application/services/*.ts src/application/__tests__/*.ts`
Confirm which file implements cascade + which test exercises it. (If it lives inside `HabitService`, all subsequent steps use `HabitService.ts`.)

- [ ] **Step 2: Write failing test**

In the cascade test file, add:

```typescript
describe("archiveHabit (derive paradigm)", () => {
  it("deletes plans but preserves allocated moments (orphan via habitId)", () => {
    const habitService = new HabitService();
    habits$["h-1"].set({
      id: "h-1",
      name: "fiction",
      areaId: "a-1",
      attitude: null,
      phase: null,
      tags: [],
      emoji: null,
      isArchived: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "c-1",
      habitId: "h-1",
      budgetedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    moments$["m-allocated"].set({
      id: "m-allocated",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: "2026-04-24",
      phase: "MORNING",
      order: 0,
      tags: [],
      emoji: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    habitService.archiveHabit("h-1");
    expect(habits$["h-1"].get()?.isArchived).toBe(true);
    expect(cyclePlans$["plan-1"].get()).toBeUndefined();
    expect(moments$["m-allocated"].get()?.id).toBe("m-allocated");
  });
});
```

- [ ] **Step 3: Run tests to verify it fails**

Run: `pnpm test -t "archiveHabit (derive paradigm)"`
Expected: FAIL — current code also deletes the allocated moment.

- [ ] **Step 4: Update implementation**

In `archiveHabit` (wherever located): after setting `isArchived = true` and deleting the habit's plans, **remove** any loop that deletes moments. Keep only plan deletion. If existing code also deleted `moments where cyclePlanId IN plansBeingDeleted`, remove that branch. Do not delete `moments where habitId === habitId`.

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: PASS. If prior tests asserted moment deletion on archive, update them to match the new semantics.

- [ ] **Step 6: Commit**

```bash
git add src/application/services/ src/application/__tests__/
git commit -m "refactor(habit): archiveHabit no longer cascades to moments"
```

---

## Task 8: Remove materialize call from `budgetHabitToCycle`; delete dead function

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/__tests__/CycleService.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe("budgetHabitToCycle (derive paradigm)", () => {
  it("writes plan only; moments.json untouched", () => {
    const service = new CycleService();
    cycles$["c-1"].set({
      id: "c-1",
      name: "Cycle",
      startDate: "2026-04-23",
      endDate: "2026-05-06",
      intention: null,
      reflection: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    habits$["h-1"].set({
      id: "h-1",
      name: "fiction",
      areaId: "a-1",
      attitude: null,
      phase: null,
      tags: [],
      emoji: null,
      isArchived: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const before = Object.keys(moments$.get()).length;
    const result = service.budgetHabitToCycle("c-1", "h-1", 5);
    expect("error" in result).toBe(false);
    const after = Object.keys(moments$.get()).length;
    expect(after).toBe(before); // no new moments spawned
    if ("error" in result) return;
    expect(result.budgetedCount).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/application/__tests__/CycleService.test.ts -t "budgetHabitToCycle (derive paradigm)"`
Expected: FAIL — current code materializes 5 moments.

- [ ] **Step 3: Remove `materializeCyclePlanMoments` call + delete the function**

In `src/application/services/CycleService.ts`:
- Remove line `this.materializeCyclePlanMoments(plan.id);` (around line 504).
- Delete the entire `materializeCyclePlanMoments` private method (roughly lines 759-819).
- If any caller still references it, remove that call too (rare — the one call site was line 504).

- [ ] **Step 4: Run all CycleService tests**

Run: `pnpm test src/application/__tests__/CycleService.test.ts`
Expected: PASS. Existing tests that checked for materialized moments must be updated to the new "plan-only" semantics — they were asserting the bug, not a requirement. Update each to assert `moments$` unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/application/services/CycleService.ts src/application/__tests__/CycleService.test.ts
git commit -m "refactor(cycle): budgetHabitToCycle writes plan only; drop materialize"
```

---

## Task 9: `virtualDeckCards$` computed view

**Files:**
- Create: `src/infrastructure/state/virtualDeckCards.ts`
- Test: `src/infrastructure/__tests__/virtualDeckCards.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/infrastructure/__tests__/virtualDeckCards.test.ts
// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { computeVirtualDeckCards } from "../state/virtualDeckCards";
import type { Habit } from "@/domain/entities/Habit";
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Moment } from "@/domain/entities/Moment";
import type { Area } from "@/domain/entities/Area";

const area = (id: string, order: number): Area => ({
  id,
  name: `area-${id}`,
  color: "#000",
  emoji: "🟢",
  isDefault: false,
  order,
  createdAt: "",
  updatedAt: "",
  tags: [],
});

const habit = (id: string, areaId: string, order = 0): Habit => ({
  id,
  name: `habit-${id}`,
  areaId,
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order,
  createdAt: "",
  updatedAt: "",
});

const plan = (id: string, habitId: string, cycleId: string, budgetedCount: number): CyclePlan => ({
  id,
  cycleId,
  habitId,
  budgetedCount,
  createdAt: "",
  updatedAt: "",
});

const allocatedMoment = (id: string, planId: string, day: string): Moment => ({
  id,
  name: "x",
  areaId: "a",
  habitId: "h",
  cycleId: "c",
  cyclePlanId: planId,
  day,
  phase: "MORNING",
  order: 0,
  tags: [],
  emoji: null,
  createdAt: "",
  updatedAt: "",
});

describe("computeVirtualDeckCards", () => {
  it("returns full ghost count when nothing allocated", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 4)],
      habits: [habit("h-1", "a-1")],
      areas: [area("a-1", 0)],
      moments: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].ghosts).toBe(4);
  });

  it("subtracts allocated moments from ghost count", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 4)],
      habits: [habit("h-1", "a-1")],
      areas: [area("a-1", 0)],
      moments: [allocatedMoment("m-1", "p-1", "2026-04-24")],
    });
    expect(result[0].ghosts).toBe(3);
  });

  it("clamps ghosts to 0 when allocated exceeds budget", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 1)],
      habits: [habit("h-1", "a-1")],
      areas: [area("a-1", 0)],
      moments: [
        allocatedMoment("m-1", "p-1", "2026-04-24"),
        allocatedMoment("m-2", "p-1", "2026-04-25"),
      ],
    });
    expect(result[0].ghosts).toBe(0);
  });

  it("orders by area.order then habit.order", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [
        plan("p-B", "h-B", "c-1", 1),
        plan("p-A2", "h-A2", "c-1", 1),
        plan("p-A1", "h-A1", "c-1", 1),
      ],
      habits: [
        habit("h-A1", "a-1", 0),
        habit("h-A2", "a-1", 1),
        habit("h-B", "a-2", 0),
      ],
      areas: [area("a-1", 0), area("a-2", 1)],
      moments: [],
    });
    expect(result.map((c) => c.habit.id)).toEqual(["h-A1", "h-A2", "h-B"]);
  });

  it("filters plans by cycleId", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 2), plan("p-2", "h-2", "c-2", 2)],
      habits: [habit("h-1", "a-1"), habit("h-2", "a-1")],
      areas: [area("a-1", 0)],
      moments: [],
    });
    expect(result.map((c) => c.plan.id)).toEqual(["p-1"]);
  });

  it("omits plans whose habit is archived", () => {
    const result = computeVirtualDeckCards({
      cycleId: "c-1",
      plans: [plan("p-1", "h-1", "c-1", 2)],
      habits: [{ ...habit("h-1", "a-1"), isArchived: true }],
      areas: [area("a-1", 0)],
      moments: [],
    });
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/infrastructure/__tests__/virtualDeckCards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/infrastructure/state/virtualDeckCards.ts
import type { Area } from "@/domain/entities/Area";
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";

export interface VirtualDeckCard {
  plan: CyclePlan;
  habit: Habit;
  ghosts: number;
}

export interface ComputeInput {
  cycleId: string;
  plans: CyclePlan[];
  habits: Habit[];
  areas: Area[];
  moments: Moment[];
}

export function computeVirtualDeckCards(input: ComputeInput): VirtualDeckCard[] {
  const { cycleId, plans, habits, areas, moments } = input;
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const cards: VirtualDeckCard[] = [];
  for (const plan of plans) {
    if (plan.cycleId !== cycleId) continue;
    const habit = habitById.get(plan.habitId);
    if (!habit || habit.isArchived) continue;
    const allocated = moments.filter(
      (m) =>
        m.cyclePlanId === plan.id &&
        m.day !== null &&
        m.phase !== null,
    ).length;
    const ghosts = Math.max(0, plan.budgetedCount - allocated);
    cards.push({ plan, habit, ghosts });
  }

  cards.sort((a, b) => {
    const areaA = areaById.get(a.habit.areaId)?.order ?? Number.MAX_SAFE_INTEGER;
    const areaB = areaById.get(b.habit.areaId)?.order ?? Number.MAX_SAFE_INTEGER;
    if (areaA !== areaB) return areaA - areaB;
    return a.habit.order - b.habit.order;
  });

  return cards;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/infrastructure/__tests__/virtualDeckCards.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/state/virtualDeckCards.ts src/infrastructure/__tests__/virtualDeckCards.test.ts
git commit -m "feat(store): add virtualDeckCards derivation"
```

---

## Task 10: Store boot hook — run reconciler once

**Files:**
- Modify: `src/infrastructure/state/store.ts`
- Modify: `src/infrastructure/__tests__/store.test.ts`

- [ ] **Step 1: Find boot/hydrate location**

Run: `grep -n 'storeHydrated\|hydrate\|onHydrat' src/infrastructure/state/store.ts`
Locate the point where hydration completes (likely a `storeHydrated$.set(true)` call or a `onHydrate` callback).

- [ ] **Step 2: Write failing test**

```typescript
// Add to src/infrastructure/__tests__/store.test.ts

import { defaultMeta } from "@/domain/entities/Meta";
import { clearMetaCache, readMeta } from "@/infrastructure/vault/meta-repository";

describe("boot reconciler", () => {
  beforeEach(() => {
    localStorage.clear();
    clearMetaCache();
  });

  it("deletes legacy deck moments + sets migration flag on first boot", async () => {
    moments$["legacy"].set({
      id: "legacy",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: null,
      phase: null,
      order: 0,
      tags: [],
      emoji: null,
      createdAt: "",
      updatedAt: "",
    });
    await runBootReconciler();
    expect(moments$["legacy"].get()).toBeUndefined();
    expect(readMeta().migrations.derivedDeck).toBe(true);
  });

  it("is a no-op on subsequent boots", async () => {
    const meta = defaultMeta();
    meta.migrations.derivedDeck = true;
    import("@/infrastructure/vault/meta-repository").then((m) => m.writeMeta(meta));
    moments$["sneaky-legacy"].set({
      id: "sneaky-legacy",
      name: "fiction",
      areaId: "a-1",
      habitId: "h-1",
      cycleId: "c-1",
      cyclePlanId: "plan-1",
      day: null,
      phase: null,
      order: 0,
      tags: [],
      emoji: null,
      createdAt: "",
      updatedAt: "",
    });
    await runBootReconciler();
    expect(moments$["sneaky-legacy"].get()?.id).toBe("sneaky-legacy");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test src/infrastructure/__tests__/store.test.ts -t "boot reconciler"`
Expected: FAIL — `runBootReconciler` not exported.

- [ ] **Step 4: Export `runBootReconciler` and wire it to hydration**

In `src/infrastructure/state/store.ts`, add near the other imports:

```typescript
import { readMeta, writeMeta } from "@/infrastructure/vault/meta-repository";
import { CycleService } from "@/application/services/CycleService";
```

Add the exported boot hook:

```typescript
export async function runBootReconciler(): Promise<void> {
  const meta = readMeta();
  if (meta.migrations.derivedDeck) return;
  const service = new CycleService();
  const { deleted } = service.reconcileLegacyDeckMoments();
  if (deleted > 0) {
    console.log(`[migration] reconciled ${deleted} legacy deck moment(s)`);
  }
  meta.migrations.derivedDeck = true;
  writeMeta(meta);
}
```

Call `runBootReconciler()` after hydration completes — for example right after the code that sets `storeHydrated$.set(true)`. If hydration is synchronous in the browser, call it inline; if there is an `onHydrate` hook from `@legendapp/state/persist`, register it there.

- [ ] **Step 5: Run tests**

Run: `pnpm test src/infrastructure/__tests__/store.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/state/store.ts src/infrastructure/__tests__/store.test.ts
git commit -m "feat(store): run legacy deck reconciler once on boot"
```

---

## Task 11: `CycleDeck` UI switches to virtual cards

**Files:**
- Modify: `src/components/CycleDeck.tsx`
- Modify: `src/components/CycleDeckColumn.tsx`
- Modify: `src/components/__tests__/CycleDeck.test.tsx`

- [ ] **Step 1: Identify current deck data source**

Run: `grep -n 'moments\$\|moments\.filter\|allocation === "deck"' src/components/CycleDeck.tsx src/components/CycleDeckColumn.tsx`
Locate the lines that currently list unallocated moments. These are the lines to replace.

- [ ] **Step 2: Write/refit failing component test**

In `src/components/__tests__/CycleDeck.test.tsx`, add or modify a test:

```typescript
it("renders one virtual card per ghost slot", () => {
  cycles$["c-1"].set({
    id: "c-1",
    name: "Cycle",
    startDate: "2026-04-23",
    endDate: "2026-05-06",
    intention: null,
    reflection: null,
    createdAt: "",
    updatedAt: "",
  });
  habits$["h-1"].set({
    id: "h-1",
    name: "fiction",
    areaId: "a-1",
    attitude: null,
    phase: null,
    tags: [],
    emoji: "📖",
    isArchived: false,
    order: 0,
    createdAt: "",
    updatedAt: "",
  });
  areas$["a-1"].set({
    id: "a-1",
    name: "Playful",
    color: "#eab308",
    emoji: "😄",
    isDefault: true,
    order: 0,
    createdAt: "",
    updatedAt: "",
    tags: [],
  });
  cyclePlans$["plan-1"].set({
    id: "plan-1",
    cycleId: "c-1",
    habitId: "h-1",
    budgetedCount: 3,
    createdAt: "",
    updatedAt: "",
  });
  render(<CycleDeck cycleId="c-1" />);
  expect(screen.getAllByTestId("deck-card")).toHaveLength(3);
});
```

(Adjust imports + `data-testid` based on existing test conventions.)

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test src/components/__tests__/CycleDeck.test.tsx`
Expected: FAIL — deck still queries moments, finds zero.

- [ ] **Step 4: Switch source**

In `CycleDeck.tsx` (and `CycleDeckColumn.tsx`), replace the observable read that filtered unallocated moments with a call to `computeVirtualDeckCards`. Example sketch (adapt to the actual hook pattern used — `use$` from `@legendapp/state/react`):

```typescript
import { computeVirtualDeckCards } from "@/infrastructure/state/virtualDeckCards";
// ...
const plans = use$(cyclePlans$);
const habits = use$(habits$);
const areas = use$(areas$);
const moments = use$(moments$);
const cards = computeVirtualDeckCards({
  cycleId,
  plans: Object.values(plans),
  habits: Object.values(habits),
  areas: Object.values(areas),
  moments: Object.values(moments),
});
```

Render one card per unit of `card.ghosts` (loop `card.ghosts` times, rendering a draggable bound to `{ cycleId, habitId: card.habit.id }` for drag-end). Remove any code path that expected `moment.id` for deck items.

- [ ] **Step 5: Update drag payload**

Drag source now carries `{ type: "deck-card", cycleId, habitId }` instead of `{ type: "deck-moment", momentId }`. Drop target (day/phase slot) calls:

```typescript
const service = new CycleService();
const result = service.allocateFromPlan({ cycleId, habitId, day, phase });
if ("error" in result) alert(result.error);
```

- [ ] **Step 6: Update "drag allocated back to deck" handler**

When an allocated moment is dragged back to the deck container, call:

```typescript
const service = new CycleService();
const result = service.unallocateMoment(momentId);
if ("error" in result) alert(result.error);
```

- [ ] **Step 7: Run component tests**

Run: `pnpm test src/components/__tests__/CycleDeck.test.tsx`
Expected: PASS — plus any neighboring tests that were updated. Run the full `pnpm test` suite too to catch ripples.

- [ ] **Step 8: Commit**

```bash
git add src/components/CycleDeck.tsx src/components/CycleDeckColumn.tsx src/components/__tests__/CycleDeck.test.tsx
git commit -m "feat(deck): render virtual cards from plans; materialize on allocate"
```

---

## Task 12: MCP `allocate_from_plan`

**Files:**
- Modify: `mcp-server/index.ts`
- Modify: `mcp-server/smoke-test.mjs`

- [ ] **Step 1: Read current MCP file layout**

Run: `grep -n "^server\.tool\|allocate_moment_from_deck\|unallocate_moment\|archive_habit" mcp-server/index.ts`
Note the surrounding patterns for `readCollection` / `writeCollection` and error helpers (`err`, `ok`).

- [ ] **Step 2: Replace `allocate_moment_from_deck` with `allocate_from_plan`**

Remove the entire `server.tool('allocate_moment_from_deck', ...)` block and insert:

```typescript
server.tool(
  "allocate_from_plan",
  "Allocate a virtual deck card into a specific day/phase slot. Creates a new Moment linked to the cycle plan. Errors if no plan exists, budget is exhausted, slot is full (3/3), habit is archived, or day is outside cycle range.",
  {
    cycleId: z.string(),
    habitId: z.string(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    phase: z.enum(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]),
  },
  async ({ cycleId, habitId, day, phase }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, "cycles");
    const cycle = cycles[cycleId];
    if (!cycle) return err(`Cycle ${cycleId} not found`);

    const habits = readCollection(VAULT_ROOT, "habits");
    const habit = habits[habitId];
    if (!habit) return err(`Habit ${habitId} not found`);
    if (habit.isArchived) return err(`Habit ${habitId} is archived`);

    const plans = readCollection(VAULT_ROOT, "cyclePlans");
    const plan = Object.values(plans).find(
      (p: CyclePlan) => p.cycleId === cycleId && p.habitId === habitId,
    ) as CyclePlan | undefined;
    if (!plan) return err("No budget: habit not planned for cycle");

    const allMoments = readCollection(VAULT_ROOT, "moments");
    const allocatedForPlan = Object.values(allMoments).filter(
      (m: Moment) =>
        m.cyclePlanId === plan.id && m.day !== null && m.phase !== null,
    ).length;
    if (allocatedForPlan >= plan.budgetedCount) {
      return err(
        `Over budget: ${allocatedForPlan}/${plan.budgetedCount} already allocated`,
      );
    }

    if (cycle.endDate) {
      if (day < cycle.startDate || day > cycle.endDate) {
        return err(
          `Day ${day} outside cycle range ${cycle.startDate}..${cycle.endDate}`,
        );
      }
    } else if (day < cycle.startDate) {
      return err(`Day ${day} before cycle start ${cycle.startDate}`);
    }

    const slotMoments = Object.values(allMoments).filter(
      (m: Moment) => m.day === day && m.phase === phase,
    );
    if (slotMoments.length >= 3) {
      return err(`Slot ${day} ${phase} full (3/3)`);
    }

    const nowIsoStr = nowIso();
    const moment: Moment = {
      id: crypto.randomUUID(),
      name: habit.name,
      areaId: habit.areaId,
      habitId: habit.id,
      cycleId,
      cyclePlanId: plan.id,
      day,
      phase,
      order: slotMoments.length,
      emoji: habit.emoji ?? null,
      tags: habit.tags ?? [],
      createdAt: nowIsoStr,
      updatedAt: nowIsoStr,
    };

    allMoments[moment.id] = moment;
    writeCollection(VAULT_ROOT, "moments", allMoments);
    return ok({ allocated: moment });
  },
);
```

Import `Moment` + `CyclePlan` types if not already imported (match existing style in the file).

- [ ] **Step 3: Add a smoke-test entry**

In `mcp-server/smoke-test.mjs`, add a section that (a) creates a cycle, habit, and plan via the existing smoke-test helpers, (b) calls `allocate_from_plan`, (c) asserts a new moment was written with `cyclePlanId` set and the slot populated.

- [ ] **Step 4: Run smoke-test**

Run: `node mcp-server/smoke-test.mjs`
Expected: `allocate_from_plan` scenario passes.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/index.ts mcp-server/smoke-test.mjs
git commit -m "feat(mcp): replace allocate_moment_from_deck with allocate_from_plan"
```

---

## Task 13: MCP `unallocate_moment` and `archive_habit` semantics

**Files:**
- Modify: `mcp-server/index.ts`
- Modify: `mcp-server/smoke-test.mjs`

- [ ] **Step 1: Locate current handlers**

Run: `grep -n "'unallocate_moment'\|'archive_habit'" mcp-server/index.ts`
Record line ranges for each handler.

- [ ] **Step 2: Rewrite `unallocate_moment`**

Replace the body with: reject if `cyclePlanId === null`, otherwise `delete allMoments[momentId]; write`.

```typescript
server.tool(
  "unallocate_moment",
  "Delete the moment row for a previously-allocated plan-linked moment. Virtual deck ghost reappears automatically as allocatedCount drops. Spontaneous moments (cyclePlanId === null) must use delete_moment instead.",
  { momentId: z.string() },
  async ({ momentId }): Promise<ToolResult> => {
    const moments = readCollection(VAULT_ROOT, "moments");
    const moment = moments[momentId];
    if (!moment) return err(`Moment ${momentId} not found`);
    if (moment.cyclePlanId === null) {
      return err(
        "Cannot unallocate spontaneous moment; use delete_moment instead",
      );
    }
    delete moments[momentId];
    writeCollection(VAULT_ROOT, "moments", moments);
    return ok({ unallocated: momentId });
  },
);
```

- [ ] **Step 3: Update `archive_habit` to stop deleting moments**

Within `archive_habit`:
- Keep: set `habit.isArchived = true`; write habits.
- Keep: find and delete every `cyclePlan` with `habitId === habitId`; write plans.
- **Remove:** any code block that deletes moments (look for `delete moments[...]` or a similar loop over moments). Allocated moments with the now-archived `habitId` must survive.

- [ ] **Step 4: Update smoke-test scenarios**

- Assert `unallocate_moment` removes the row entirely.
- Assert `archive_habit` keeps allocated moments whose `habitId` matches the archived habit.

- [ ] **Step 5: Run smoke-test**

Run: `node mcp-server/smoke-test.mjs`
Expected: all scenarios pass.

- [ ] **Step 6: Commit**

```bash
git add mcp-server/index.ts mcp-server/smoke-test.mjs
git commit -m "refactor(mcp): derive-model semantics for unallocate + archive"
```

---

## Task 14: Playwright E2E

**Files:**
- Modify (or create): `e2e/derive-deck.spec.ts` (adjust path to match project e2e dir)

- [ ] **Step 1: Locate e2e dir + base URL convention**

Run: `find . -maxdepth 4 -path ./node_modules -prune -o -name 'playwright.config.*' -print`
and `find . -maxdepth 3 -type d -name 'e2e' -o -name 'tests-e2e'`
Use the existing spec structure as a template.

- [ ] **Step 2: Write scenario — drag virtual card to slot**

Seed the vault (or use a dev API/shortcut the project already exposes for fixtures) with one cycle, one habit, one plan of `budgetedCount: 2`. Navigate to `/cultivate` (or the deck route). Drag one deck card onto Today's Morning slot. Assert:
- deck now shows 1 card (ghost count dropped).
- timeline Morning shows the new allocated moment.

- [ ] **Step 3: Write scenario — drag allocated back to deck**

From the previous state, drag the allocated moment back onto the deck container. Assert:
- timeline slot empty.
- deck shows 2 cards again.

- [ ] **Step 4: Write scenario — budget then immediate deck appearance**

Use the project's existing dev mechanism (console command, `:budget 3`, or MCP shim) to set `budgetedCount: 3`. Assert deck shows 3 cards without restarting the app.

- [ ] **Step 5: Write scenario — decrement below allocated is no-op**

Allocate 2 of a plan with `budgetedCount: 3`. Trigger decrement twice: first produces 2, second is a no-op (stays at 2 because allocated=2). Assert deck keeps 0 ghosts and budget stays at 2.

- [ ] **Step 6: Run e2e**

Run the project's standard e2e command (e.g. `pnpm exec playwright test e2e/derive-deck.spec.ts` — adjust to the repo's convention).
Expected: all four scenarios pass.

- [ ] **Step 7: Commit**

```bash
git add e2e/derive-deck.spec.ts
git commit -m "test(e2e): cover derive-deck flows"
```

---

## Task 15: Manual QA + cleanup

**Files:** none (verification only)

- [ ] **Step 1: Verify dead code is gone**

Run: `grep -rn "materializeCyclePlanMoments\|allocate_moment_from_deck" src/ mcp-server/`
Expected: zero matches.

- [ ] **Step 2: Type-check and full suite**

Run: `pnpm tsc --noEmit`
Run: `pnpm test`
Expected: clean, all pass.

- [ ] **Step 3: Manual smoke in Tauri app**

Ask the user to run `pnpm dev:tauri` and confirm:
- Existing legacy unallocated deck moments vanish on first launch (console log shows "reconciled N legacy deck moment(s)").
- `meta.json` (or its storage equivalent) now has `migrations.derivedDeck = true`.
- Budgeting a habit via MCP (e.g. `budget_habit_to_cycle`) makes ghosts appear in the deck without restart.
- Drag ghost → slot materializes a moment; drag back deletes it; ghost count reflects correctly.
- Archiving a habit clears its ghosts from the deck but keeps allocated moments visible on the timeline.

- [ ] **Step 4: Announce completion**

Summarize changes for the user, point to the spec + plan files, and ask for approval to merge the feature branch.

---

## Self-Review

**Spec coverage:**
- Invariant change (`>=`): Tasks 2 + 9 (compute + floor).
- `allocateFromPlan`: Task 3.
- `unallocateMoment`: Task 4.
- `countAllocatedForPlan`: Task 2.
- `reconcileLegacyDeckMoments` + migration flag: Tasks 1, 5, 10.
- `decrementHabitBudget` floor: Task 6.
- `archiveHabit` cascade change: Task 7.
- Delete materialize + remove call site: Task 8.
- `virtualDeckCards$`: Task 9.
- UI switch + drag handlers: Task 11.
- MCP `allocate_from_plan`: Task 12.
- MCP `unallocate_moment` + `archive_habit` semantics: Task 13.
- MCP remove `allocate_moment_from_deck`: Task 12 (removal is part of the same commit as the replacement).
- E2E: Task 14.

All spec sections map to at least one task. No gaps.

**Placeholder scan:** No `TBD`, no "implement later", no "add appropriate error handling". Every code step includes the actual code.

**Type consistency:**
- `allocateFromPlan` returns `Moment | { error: string }` everywhere it appears (Task 3, Task 11 usage, Task 12 MCP mirror).
- `unallocateMoment` returns `{ ok: true } | { error: string }` (Task 4, Task 11 usage, Task 13 MCP mirror).
- `countAllocatedForPlan(cyclePlanId: string): number` called consistently in Tasks 2, 6, 9.
- `computeVirtualDeckCards(input)` name stable between Tasks 9 and 11.
- `runBootReconciler` exported + called identically between Task 10 production code and Task 10 tests.

No inconsistencies found.
