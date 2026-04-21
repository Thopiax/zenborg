# Attitude-Driven Rhythm & Health — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the dormant `Attitude` feature by adding a `Rhythm` value object, deriving a computed `Health` state per habit, rendering health ambiently via existing habit-emoji treatment, and exposing it all through MCP for cycle-planning proposals and cycle review.

**Architecture:** Domain-first. New `Rhythm` value object and `Health` enum in `src/domain/value-objects/`. New `HabitHealthService` in `src/domain/services/` owns per-attitude health derivation. `CycleService` gains `getCyclePlanningProposals()` and `getCycleReview()`. MCP server mirrors the types and adds 4 new read tools plus parameter extensions on 3 existing write tools. UI layer adds rhythm fields to the habit form and applies opacity classes to habit emojis based on computed health. No new icons, no new regions.

**Tech Stack:** TypeScript, Next.js 15, Legend State, Vitest, shadcn/ui (Radix), MCP SDK (zod), pnpm.

**Spec reference:** [`docs/plans/2026-04-21-attitude-rhythm-health-design.md`](./2026-04-21-attitude-rhythm-health-design.md)
**Principles reference:** [`docs/principles.md`](../principles.md)

---

## Phase A — Domain Foundations

### Task 1: `Rhythm` value object + helpers

**Files:**
- Create: `src/domain/value-objects/Rhythm.ts`
- Create: `src/domain/value-objects/__tests__/Rhythm.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/value-objects/__tests__/Rhythm.test.ts
import { describe, it, expect } from "vitest";
import {
  PERIOD_DAYS,
  rhythmPerWeek,
  rhythmSilenceThresholdDays,
  rhythmToCycleBudget,
  type Rhythm,
} from "../Rhythm";

describe("Rhythm helpers", () => {
  it("rhythmPerWeek normalizes a weekly rhythm", () => {
    const r: Rhythm = { period: "weekly", count: 3 };
    expect(rhythmPerWeek(r)).toBe(3);
  });

  it("rhythmPerWeek normalizes a monthly rhythm", () => {
    const r: Rhythm = { period: "monthly", count: 2 };
    // 2 per month ≈ 2 × 7 / 30
    expect(rhythmPerWeek(r)).toBeCloseTo((2 * 7) / 30);
  });

  it("rhythmToCycleBudget rounds to integer count", () => {
    // weekly × 3 over 28 days = 12
    expect(
      rhythmToCycleBudget({ period: "weekly", count: 3 }, 28)
    ).toBe(12);
    // monthly × 1 over 90 days = 3
    expect(
      rhythmToCycleBudget({ period: "monthly", count: 1 }, 90)
    ).toBe(3);
  });

  it("rhythmSilenceThresholdDays is period / count", () => {
    expect(
      rhythmSilenceThresholdDays({ period: "quarterly", count: 1 })
    ).toBe(90);
    expect(
      rhythmSilenceThresholdDays({ period: "monthly", count: 2 })
    ).toBe(15);
  });

  it("PERIOD_DAYS covers all RhythmPeriod values", () => {
    expect(PERIOD_DAYS.weekly).toBe(7);
    expect(PERIOD_DAYS.biweekly).toBe(14);
    expect(PERIOD_DAYS.monthly).toBe(30);
    expect(PERIOD_DAYS.quarterly).toBe(90);
    expect(PERIOD_DAYS.annually).toBe(365);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `pnpm test src/domain/value-objects/__tests__/Rhythm.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the value object**

```typescript
// src/domain/value-objects/Rhythm.ts
/**
 * Rhythm — declared cadence for a habit
 *
 * Rhythm expresses how often the habit should recur, as a count over a
 * period. Interpretation depends on the habit's attitude:
 *   - KEEPING: silence threshold (period / count days before the habit wilts)
 *   - BUILDING / PUSHING: target pace within the period
 *   - BEGINNING: loose guide, no wilt
 *   - BEING: no rhythm
 *
 * Period day counts are approximate (30-day months, 90-day quarters). Good
 * enough for mindful cadence; avoids calendar edge cases.
 */

export type RhythmPeriod =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annually";

export interface Rhythm {
  period: RhythmPeriod;
  count: number;
}

export const PERIOD_DAYS: Record<RhythmPeriod, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  annually: 365,
};

export function rhythmPerWeek(r: Rhythm): number {
  return (r.count * 7) / PERIOD_DAYS[r.period];
}

export function rhythmToCycleBudget(r: Rhythm, cycleDays: number): number {
  return Math.round((r.count * cycleDays) / PERIOD_DAYS[r.period]);
}

export function rhythmSilenceThresholdDays(r: Rhythm): number {
  return PERIOD_DAYS[r.period] / r.count;
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `pnpm test src/domain/value-objects/__tests__/Rhythm.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/value-objects/Rhythm.ts \
        src/domain/value-objects/__tests__/Rhythm.test.ts
git commit -m "feat(domain): add Rhythm value object with period-based helpers"
```

---

### Task 2: Extend `Habit` entity with `rhythm?` field

**Files:**
- Modify: `src/domain/entities/Habit.ts`
- Modify: `src/domain/__tests__/Habit.test.ts`

- [ ] **Step 1: Write failing tests for rhythm round-trip**

Append to `src/domain/__tests__/Habit.test.ts`:

```typescript
import type { Rhythm } from "@/domain/value-objects/Rhythm";

describe("Habit rhythm field", () => {
  it("createHabit accepts an optional rhythm", () => {
    const rhythm: Rhythm = { period: "weekly", count: 3 };
    const result = createHabit({
      name: "running",
      areaId: "area-1",
      order: 0,
      rhythm,
    });
    if (isHabitError(result)) throw new Error(result.error);
    expect(result.rhythm).toEqual(rhythm);
  });

  it("createHabit defaults rhythm to undefined", () => {
    const result = createHabit({
      name: "coffee",
      areaId: "area-1",
      order: 0,
    });
    if (isHabitError(result)) throw new Error(result.error);
    expect(result.rhythm).toBeUndefined();
  });

  it("updateHabit can set rhythm", () => {
    const created = createHabit({
      name: "running",
      areaId: "area-1",
      order: 0,
    });
    if (isHabitError(created)) throw new Error(created.error);
    const rhythm: Rhythm = { period: "monthly", count: 2 };
    const updated = updateHabit(created, { rhythm });
    if (isHabitError(updated)) throw new Error(updated.error);
    expect(updated.rhythm).toEqual(rhythm);
  });

  it("updateHabit can clear rhythm with null", () => {
    const created = createHabit({
      name: "running",
      areaId: "area-1",
      order: 0,
      rhythm: { period: "weekly", count: 3 },
    });
    if (isHabitError(created)) throw new Error(created.error);
    const updated = updateHabit(created, { rhythm: undefined });
    if (isHabitError(updated)) throw new Error(updated.error);
    expect(updated.rhythm).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `pnpm test src/domain/__tests__/Habit.test.ts`
Expected: FAIL (Habit has no `rhythm` field).

- [ ] **Step 3: Add `rhythm` to Habit type, CreateHabitProps, and creation logic**

In `src/domain/entities/Habit.ts`:

Add import at top:
```typescript
import type { Rhythm } from "../value-objects/Rhythm";
```

Modify the `Habit` interface to add the field before `createdAt`:
```typescript
export interface Habit {
  readonly id: string;
  name: string;
  areaId: string;
  attitude: Attitude | null;
  phase: Phase | null;
  tags: string[];
  emoji: string | null;
  isArchived: boolean;
  order: number;
  description?: string;
  guidance?: string;
  rhythm?: Rhythm; // NEW: optional cadence declaration
  createdAt: string;
  updatedAt: string;
}
```

Modify `CreateHabitProps`:
```typescript
export interface CreateHabitProps {
  name: string;
  areaId: string;
  order: number;
  attitude?: Attitude | null;
  phase?: Phase | null;
  tags?: string[];
  emoji?: string | null;
  description?: string;
  guidance?: string;
  rhythm?: Rhythm; // NEW
}
```

Inside `createHabit`, destructure and return:
```typescript
const {
  name,
  areaId,
  order,
  attitude = null,
  phase = null,
  tags = [],
  emoji = null,
  description,
  guidance,
  rhythm, // NEW
} = props;
```

And in the returned object, add:
```typescript
return {
  id: crypto.randomUUID(),
  name: name.trim(),
  areaId: areaId.trim(),
  attitude,
  phase,
  tags: normalizedTags,
  emoji: emoji ? emoji.trim() : null,
  isArchived: false,
  order,
  ...(trimmedDescription ? { description: trimmedDescription } : {}),
  ...(trimmedGuidance ? { guidance: trimmedGuidance } : {}),
  ...(rhythm ? { rhythm } : {}), // NEW
  createdAt: now,
  updatedAt: now,
};
```

`updateHabit` already spreads `updates` into the habit, so `rhythm` round-trips automatically. No change needed there beyond the type (already widened via the existing `Partial<Omit<Habit, …>>` pattern).

- [ ] **Step 4: Run tests — expect pass**

Run: `pnpm test src/domain/__tests__/Habit.test.ts`
Expected: PASS (all original tests plus 4 new rhythm tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/Habit.ts src/domain/__tests__/Habit.test.ts
git commit -m "feat(domain): add optional rhythm field to Habit"
```

---

### Task 3: Extend `CyclePlan` entity with `rhythmOverride?` field

**Files:**
- Modify: `src/domain/entities/CyclePlan.ts`
- Create: `src/domain/__tests__/CyclePlan.test.ts` (if missing) or modify if exists

First check if a CyclePlan test file exists:

- [ ] **Step 1: Check for existing test file**

Run: `ls src/domain/__tests__/CyclePlan.test.ts 2>/dev/null || echo MISSING`
If MISSING, create the file below; if present, append the rhythm tests.

- [ ] **Step 2: Write failing tests**

```typescript
// src/domain/__tests__/CyclePlan.test.ts (create or append)
import { describe, it, expect } from "vitest";
import {
  createCyclePlan,
  isCyclePlanError,
  updateCyclePlanBudget,
} from "@/domain/entities/CyclePlan";
import type { Rhythm } from "@/domain/value-objects/Rhythm";

describe("CyclePlan rhythmOverride", () => {
  it("createCyclePlan accepts an optional rhythmOverride", () => {
    const rhythmOverride: Rhythm = { period: "weekly", count: 4 };
    const result = createCyclePlan({
      cycleId: "cycle-1",
      habitId: "habit-1",
      budgetedCount: 12,
      rhythmOverride,
    });
    if (isCyclePlanError(result)) throw new Error(result.error);
    expect(result.rhythmOverride).toEqual(rhythmOverride);
  });

  it("createCyclePlan defaults rhythmOverride to undefined", () => {
    const result = createCyclePlan({
      cycleId: "cycle-1",
      habitId: "habit-1",
      budgetedCount: 6,
    });
    if (isCyclePlanError(result)) throw new Error(result.error);
    expect(result.rhythmOverride).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests — expect failure**

Run: `pnpm test src/domain/__tests__/CyclePlan.test.ts`
Expected: FAIL (no `rhythmOverride` field).

- [ ] **Step 4: Add field to entity**

In `src/domain/entities/CyclePlan.ts`:

Add import at top:
```typescript
import type { Rhythm } from "../value-objects/Rhythm";
```

Modify the `CyclePlan` interface:
```typescript
export interface CyclePlan {
  readonly id: string;
  cycleId: string;
  habitId: string;
  budgetedCount: number;
  rhythmOverride?: Rhythm; // NEW: seasonal rhythm override
  createdAt: string;
  updatedAt: string;
}
```

Modify `CreateCyclePlanProps`:
```typescript
export interface CreateCyclePlanProps {
  cycleId: string;
  habitId: string;
  budgetedCount: number;
  rhythmOverride?: Rhythm; // NEW
}
```

In `createCyclePlan`, destructure and include in the return:
```typescript
const { cycleId, habitId, budgetedCount, rhythmOverride } = props;
// ... existing validation ...
return {
  id: crypto.randomUUID(),
  cycleId: cycleId.trim(),
  habitId: habitId.trim(),
  budgetedCount,
  ...(rhythmOverride ? { rhythmOverride } : {}),
  createdAt: now,
  updatedAt: now,
};
```

- [ ] **Step 5: Run tests — expect pass**

Run: `pnpm test src/domain/__tests__/CyclePlan.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/CyclePlan.ts src/domain/__tests__/CyclePlan.test.ts
git commit -m "feat(domain): add optional rhythmOverride to CyclePlan"
```

---

## Phase B — Health Computation

### Task 4: `Health` value object

**Files:**
- Create: `src/domain/value-objects/Health.ts`

Health is a small enum without behaviour. No separate test file — tests go via `HabitHealthService`.

- [ ] **Step 1: Create the file**

```typescript
// src/domain/value-objects/Health.ts
/**
 * Health — observed state of a habit, computed from attitude + rhythm + history.
 *
 * NOT stored on disk. Re-computed on read. Rendered through opacity treatment
 * of the habit's existing emoji; no additional icons.
 *
 * States:
 *   - seedling:  BEGINNING, low allocation count
 *   - budding:   new rhythm, history forming (first ~3 periods after rhythm set)
 *   - blooming:  on-rhythm, healthy
 *   - wilting:   off-rhythm or past silence threshold
 *   - dormant:   intentionally paused (reserved for v2, not computed in v1)
 *   - evergreen: BEING attitude, crystallized
 *   - unstated:  no attitude set or insufficient signal — pure presence
 */
export type Health =
  | "seedling"
  | "budding"
  | "blooming"
  | "wilting"
  | "dormant"
  | "evergreen"
  | "unstated";
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/value-objects/Health.ts
git commit -m "feat(domain): add Health value object (computed, not stored)"
```

---

### Task 5: `HabitHealthService` — compute health + resolve effective rhythm

**Files:**
- Create: `src/domain/services/HabitHealthService.ts`
- Create: `src/domain/services/__tests__/HabitHealthService.test.ts`

This task is the heart of the feature. Per-attitude logic lives here.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/services/__tests__/HabitHealthService.test.ts
import { describe, it, expect } from "vitest";
import { HabitHealthService } from "../HabitHealthService";
import { Attitude } from "@/domain/value-objects/Attitude";
import type { Habit } from "@/domain/entities/Habit";
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Moment } from "@/domain/entities/Moment";
import type { Rhythm } from "@/domain/value-objects/Rhythm";

const service = new HabitHealthService();

const ISO = (d: Date) => d.toISOString();
const DAY = (d: Date) => d.toISOString().slice(0, 10);

const baseHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: overrides.id ?? "habit-1",
  name: "test habit",
  areaId: "area-1",
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  createdAt: ISO(new Date("2026-01-01")),
  updatedAt: ISO(new Date("2026-01-01")),
  ...overrides,
});

const allocatedMoment = (
  habitId: string,
  day: Date,
  overrides: Partial<Moment> = {}
): Moment => ({
  id: `moment-${day.toISOString()}`,
  name: "m",
  areaId: "area-1",
  habitId,
  cycleId: null,
  cyclePlanId: null,
  phase: "MORNING",
  day: DAY(day),
  order: 0,
  tags: null,
  createdAt: ISO(day),
  updatedAt: ISO(day),
  ...overrides,
});

describe("HabitHealthService.resolveRhythm", () => {
  it("returns cyclePlan override when present", () => {
    const habit = baseHabit({
      rhythm: { period: "weekly", count: 3 },
    });
    const plan: CyclePlan = {
      id: "p1",
      cycleId: "c1",
      habitId: habit.id,
      budgetedCount: 0,
      rhythmOverride: { period: "weekly", count: 5 },
      createdAt: ISO(new Date()),
      updatedAt: ISO(new Date()),
    };
    expect(service.resolveRhythm(habit, plan)).toEqual({
      period: "weekly",
      count: 5,
    });
  });

  it("falls back to habit rhythm when no plan override", () => {
    const habit = baseHabit({ rhythm: { period: "monthly", count: 2 } });
    expect(service.resolveRhythm(habit, null)).toEqual({
      period: "monthly",
      count: 2,
    });
  });

  it("returns null when neither source has rhythm", () => {
    expect(service.resolveRhythm(baseHabit(), null)).toBeNull();
  });
});

describe("HabitHealthService.computeHealth — attitude dispatch", () => {
  it("returns 'unstated' for a habit with no attitude", () => {
    const habit = baseHabit();
    expect(service.computeHealth(habit, null, [], new Date())).toBe(
      "unstated"
    );
  });

  it("returns 'evergreen' for BEING regardless of history", () => {
    const habit = baseHabit({ attitude: Attitude.BEING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe(
      "evergreen"
    );
  });
});

describe("HabitHealthService — BEGINNING", () => {
  it("is 'seedling' when allocation count < 5", () => {
    const habit = baseHabit({ attitude: Attitude.BEGINNING });
    const now = new Date("2026-04-20");
    const moments = [
      allocatedMoment(habit.id, new Date("2026-04-18")),
      allocatedMoment(habit.id, new Date("2026-04-19")),
    ];
    expect(service.computeHealth(habit, null, moments, now)).toBe("seedling");
  });

  it("is 'budding' when allocation count >= 5", () => {
    const habit = baseHabit({ attitude: Attitude.BEGINNING });
    const now = new Date("2026-04-20");
    const moments = [0, 1, 2, 3, 4].map((i) =>
      allocatedMoment(habit.id, new Date(`2026-04-1${i}`))
    );
    expect(service.computeHealth(habit, null, moments, now)).toBe("budding");
  });
});

describe("HabitHealthService — KEEPING", () => {
  it("is 'unstated' when KEEPING has no rhythm", () => {
    const habit = baseHabit({ attitude: Attitude.KEEPING });
    const now = new Date("2026-04-20");
    expect(service.computeHealth(habit, null, [], now)).toBe("unstated");
  });

  it("is 'blooming' when last allocation is within silence threshold", () => {
    const rhythm: Rhythm = { period: "monthly", count: 2 }; // threshold = 15 days
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm,
    });
    const now = new Date("2026-04-20");
    const last = new Date("2026-04-10"); // 10 days ago
    expect(
      service.computeHealth(habit, null, [allocatedMoment(habit.id, last)], now)
    ).toBe("blooming");
  });

  it("is 'wilting' when last allocation is past silence threshold", () => {
    const rhythm: Rhythm = { period: "monthly", count: 2 }; // threshold = 15 days
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm,
    });
    const now = new Date("2026-04-20");
    const last = new Date("2026-04-01"); // 19 days ago
    expect(
      service.computeHealth(habit, null, [allocatedMoment(habit.id, last)], now)
    ).toBe("wilting");
  });

  it("is 'wilting' when no allocations exist and rhythm is set", () => {
    const habit = baseHabit({
      attitude: Attitude.KEEPING,
      rhythm: { period: "quarterly", count: 1 },
    });
    expect(service.computeHealth(habit, null, [], new Date())).toBe("wilting");
  });
});

describe("HabitHealthService — BUILDING", () => {
  it("is 'unstated' when BUILDING has no rhythm", () => {
    const habit = baseHabit({ attitude: Attitude.BUILDING });
    expect(service.computeHealth(habit, null, [], new Date())).toBe(
      "unstated"
    );
  });

  it("is 'budding' when habit was updated less than 3 periods ago", () => {
    const now = new Date("2026-04-20");
    const habit = baseHabit({
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
      updatedAt: ISO(new Date("2026-04-14")), // less than 21 days (3 weeks)
    });
    expect(service.computeHealth(habit, null, [], now)).toBe("budding");
  });

  it("is 'blooming' when on-pace within the current period", () => {
    const now = new Date("2026-04-20"); // Monday-ish; mid-week
    const habit = baseHabit({
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
      updatedAt: ISO(new Date("2026-01-01")), // well past budding window
    });
    // 2 allocations this week is on-pace
    const moments = [
      allocatedMoment(habit.id, new Date("2026-04-14")),
      allocatedMoment(habit.id, new Date("2026-04-16")),
    ];
    expect(service.computeHealth(habit, null, moments, now)).toBe("blooming");
  });

  it("is 'wilting' when below pace beyond tolerance", () => {
    const now = new Date("2026-04-27"); // end of week
    const habit = baseHabit({
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 5 },
      updatedAt: ISO(new Date("2026-01-01")),
    });
    // 1 allocation this week when 5 expected, tolerance max(1, floor(5*0.2))=1
    const moments = [allocatedMoment(habit.id, new Date("2026-04-21"))];
    expect(service.computeHealth(habit, null, moments, now)).toBe("wilting");
  });
});

describe("HabitHealthService — PUSHING", () => {
  it("reuses BUILDING pace logic (wilt on underpace)", () => {
    const now = new Date("2026-04-27");
    const habit = baseHabit({
      attitude: Attitude.PUSHING,
      rhythm: { period: "weekly", count: 3 },
      updatedAt: ISO(new Date("2026-01-01")),
    });
    // 0 allocations this week, expect wilting
    expect(service.computeHealth(habit, null, [], now)).toBe("wilting");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `pnpm test src/domain/services/__tests__/HabitHealthService.test.ts`
Expected: FAIL (service not defined).

- [ ] **Step 3: Implement the service**

```typescript
// src/domain/services/HabitHealthService.ts
import type { CyclePlan } from "@/domain/entities/CyclePlan";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import { Attitude } from "@/domain/value-objects/Attitude";
import type { Health } from "@/domain/value-objects/Health";
import {
  PERIOD_DAYS,
  rhythmSilenceThresholdDays,
  type Rhythm,
} from "@/domain/value-objects/Rhythm";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BUDDING_PERIOD_COUNT = 3;

/**
 * HabitHealthService — pure derivation of per-habit health from
 * attitude, effective rhythm, and allocation history.
 *
 * Health is NEVER stored. Recomputed on every read.
 * Effective rhythm = cyclePlan.rhythmOverride ?? habit.rhythm ?? null.
 */
export class HabitHealthService {
  resolveRhythm(habit: Habit, cyclePlan: CyclePlan | null): Rhythm | null {
    return cyclePlan?.rhythmOverride ?? habit.rhythm ?? null;
  }

  computeHealth(
    habit: Habit,
    cyclePlan: CyclePlan | null,
    moments: Moment[],
    now: Date
  ): Health {
    const attitude = habit.attitude;
    if (attitude === null) return "unstated";
    if (attitude === Attitude.BEING) return "evergreen";

    const rhythm = this.resolveRhythm(habit, cyclePlan);
    const habitMoments = moments.filter((m) => m.habitId === habit.id);

    switch (attitude) {
      case Attitude.BEGINNING:
        return this.computeBeginning(habitMoments);
      case Attitude.KEEPING:
        return this.computeKeeping(rhythm, habitMoments, now);
      case Attitude.BUILDING:
      case Attitude.PUSHING:
        return this.computePaced(habit, rhythm, habitMoments, now);
      default:
        return "unstated";
    }
  }

  private computeBeginning(habitMoments: Moment[]): Health {
    return habitMoments.length >= 5 ? "budding" : "seedling";
  }

  private computeKeeping(
    rhythm: Rhythm | null,
    habitMoments: Moment[],
    now: Date
  ): Health {
    if (!rhythm) return "unstated";
    const threshold = rhythmSilenceThresholdDays(rhythm);

    const lastAllocation = this.latestAllocationDate(habitMoments);
    if (lastAllocation === null) return "wilting";

    const daysSince = (now.getTime() - lastAllocation.getTime()) / MS_PER_DAY;
    return daysSince <= threshold ? "blooming" : "wilting";
  }

  private computePaced(
    habit: Habit,
    rhythm: Rhythm | null,
    habitMoments: Moment[],
    now: Date
  ): Health {
    if (!rhythm) return "unstated";

    const periodDays = PERIOD_DAYS[rhythm.period];
    const buddingWindowDays = periodDays * BUDDING_PERIOD_COUNT;
    const habitUpdatedAt = new Date(habit.updatedAt);
    const daysSinceHabitUpdate =
      (now.getTime() - habitUpdatedAt.getTime()) / MS_PER_DAY;
    if (daysSinceHabitUpdate < buddingWindowDays) return "budding";

    const periodStart = new Date(now.getTime() - periodDays * MS_PER_DAY);
    const countInPeriod = habitMoments.filter((m) => {
      if (m.day === null) return false;
      const dayDate = new Date(m.day);
      return dayDate.getTime() >= periodStart.getTime();
    }).length;

    const daysElapsed = Math.min(periodDays, daysSinceHabitUpdate);
    const expectedByNow = rhythm.count * (daysElapsed / periodDays);
    const tolerance = Math.max(1, Math.floor(rhythm.count * 0.2));

    return countInPeriod + tolerance >= expectedByNow ? "blooming" : "wilting";
  }

  private latestAllocationDate(habitMoments: Moment[]): Date | null {
    let latest: Date | null = null;
    for (const m of habitMoments) {
      if (m.day === null) continue;
      const d = new Date(m.day);
      if (latest === null || d > latest) latest = d;
    }
    return latest;
  }
}

export const habitHealthService = new HabitHealthService();
```

- [ ] **Step 4: Run tests — expect pass**

Run: `pnpm test src/domain/services/__tests__/HabitHealthService.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/value-objects/Health.ts \
        src/domain/services/HabitHealthService.ts \
        src/domain/services/__tests__/HabitHealthService.test.ts
git commit -m "feat(domain): add HabitHealthService for per-attitude health derivation"
```

---

## Phase C — Application Services

### Task 6: `CycleService.budgetHabitToCycle` — accept `rhythmOverride` + auto-derive

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/__tests__/CycleService.test.ts`

The current signature is `budgetHabitToCycle(cycleId, habitId, count)`. We keep it backward-compatible, and add a new variant that accepts options.

- [ ] **Step 1: Write failing tests**

Append to `src/application/__tests__/CycleService.test.ts`. The file already has `makeHabit` and `makeCycle` factories and a `beforeEach` reset pattern — reuse them. Imports to add at the top of the file: `import { rhythmToCycleBudget, type Rhythm } from "@/domain/value-objects/Rhythm";`

```typescript
describe("CycleService.budgetHabitToCycleWithOptions — rhythm derivation", () => {
  let service: CycleService;

  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    habits$.set({});
    // 28-day cycle: 2026-02-01 .. 2026-02-28 inclusive
    cycles$["cycle-1"].set({
      ...makeCycle("cycle-1"),
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
    activeCycleId$.set("cycle-1");
    service = new CycleService();
  });

  it("derives count from habit rhythm when count omitted", () => {
    const rhythm: Rhythm = { period: "weekly", count: 3 };
    habits$["habit-1"].set({ ...makeHabit("habit-1"), rhythm });

    const result = service.budgetHabitToCycleWithOptions(
      "cycle-1",
      "habit-1",
      {}
    );

    expect("error" in result).toBe(false);
    // rhythmToCycleBudget({weekly, 3}, 28) = round(3 * 28 / 7) = 12
    expect(rhythmToCycleBudget(rhythm, 28)).toBe(12);
    const allMoments = Object.values(moments$.get()).filter(
      (m) => m.cyclePlanId !== null
    );
    expect(allMoments).toHaveLength(12);
  });

  it("uses explicit count when both rhythm and count given", () => {
    habits$["habit-1"].set({
      ...makeHabit("habit-1"),
      rhythm: { period: "weekly", count: 3 },
    });

    service.budgetHabitToCycleWithOptions("cycle-1", "habit-1", { count: 5 });

    const planMoments = Object.values(moments$.get()).filter(
      (m) => m.cyclePlanId !== null
    );
    expect(planMoments).toHaveLength(5);
  });

  it("stores rhythmOverride on the CyclePlan", () => {
    habits$["habit-1"].set(makeHabit("habit-1"));
    const override: Rhythm = { period: "monthly", count: 2 };

    const result = service.budgetHabitToCycleWithOptions(
      "cycle-1",
      "habit-1",
      { rhythmOverride: override }
    );

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.rhythmOverride).toEqual(override);
  });

  it("errors when neither count, rhythm, nor override are supplied", () => {
    habits$["habit-1"].set(makeHabit("habit-1"));
    const result = service.budgetHabitToCycleWithOptions(
      "cycle-1",
      "habit-1",
      {}
    );
    expect("error" in result).toBe(true);
  });
});
```

- [ ] **Step 2: Add a new options-based variant of `budgetHabitToCycle`**

In `src/application/services/CycleService.ts`:

Add import at top:
```typescript
import {
  rhythmToCycleBudget,
  type Rhythm,
} from "@/domain/value-objects/Rhythm";
import { differenceInCalendarDays } from "date-fns";
import { fromISODate } from "@/lib/dates";
```

(If the file already imports from these modules, do not duplicate.)

Add a new public method (place it next to the existing `budgetHabitToCycle`):

```typescript
/**
 * Budget a habit into a cycle with optional rhythm override.
 *
 * Precedence for budget count:
 *   1. `options.count` (explicit override) — always wins
 *   2. `options.rhythmOverride` with derived count (cycle-specific rhythm)
 *   3. `habit.rhythm` with derived count
 *   4. Otherwise: error (no count information)
 *
 * `rhythmOverride` is stored on the CyclePlan regardless of whether count is
 * also explicit, because rhythmOverride independently drives health and
 * whispers for that cycle.
 */
budgetHabitToCycleWithOptions(
  cycleId: string,
  habitId: string,
  options: { count?: number; rhythmOverride?: Rhythm }
): CyclePlanResult {
  const cycle = cycles$[cycleId].get();
  if (!cycle) return { error: `Cycle with ID ${cycleId} not found` };

  const habit = habits$[habitId].get();
  if (!habit) return { error: `Habit with ID ${habitId} not found` };

  const effectiveRhythm: Rhythm | null =
    options.rhythmOverride ?? habit.rhythm ?? null;

  let count = options.count;
  if (count === undefined) {
    if (effectiveRhythm === null) {
      return {
        error:
          "Cannot derive budget: no explicit count and no rhythm on habit or override",
      };
    }
    const cycleDays = this.computeCycleDays(cycle);
    count = rhythmToCycleBudget(effectiveRhythm, cycleDays);
  }

  // Delegate count-based budget logic (materialization, existing plan update)
  const result = this.budgetHabitToCycle(cycleId, habitId, count);
  if ("error" in result) return result;

  // Persist rhythmOverride if provided
  if (options.rhythmOverride !== undefined) {
    const updated: CyclePlan = {
      ...result,
      rhythmOverride: options.rhythmOverride,
      updatedAt: new Date().toISOString(),
    };
    cyclePlans$[updated.id].set(updated);
    return updated;
  }

  return result;
}

private computeCycleDays(cycle: Cycle): number {
  const start = fromISODate(cycle.startDate);
  const end = cycle.endDate ? fromISODate(cycle.endDate) : new Date();
  return Math.max(1, differenceInCalendarDays(end, start) + 1);
}
```

- [ ] **Step 3: Run tests — expect pass**

Run: `pnpm test src/application/__tests__/CycleService.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/application/services/CycleService.ts \
        src/application/__tests__/CycleService.test.ts
git commit -m "feat(cycle): budgetHabitToCycleWithOptions supports rhythm derivation"
```

---

### Task 7: `CycleService.getCyclePlanningProposals`

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/__tests__/CycleService.test.ts`

- [ ] **Step 1: Write failing tests**

Append to the test file. Add `import { Attitude } from "@/domain/value-objects/Attitude";` at the top if not already imported.

```typescript
describe("CycleService.getCyclePlanningProposals", () => {
  let service: CycleService;

  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    habits$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    // 28-day cycle
    cycles$["cycle-1"].set({
      ...makeCycle("cycle-1"),
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
    activeCycleId$.set("cycle-1");
    service = new CycleService();
  });

  it("includes KEEPING habits with rhythm (wilting or on-rhythm)", () => {
    habits$["h-keep"].set({
      ...makeHabit("h-keep"),
      attitude: Attitude.KEEPING,
      rhythm: { period: "monthly", count: 1 },
    });
    const proposals = service.getCyclePlanningProposals("cycle-1");
    const row = proposals.find((p) => p.habitId === "h-keep");
    expect(row).toBeDefined();
    expect(row?.reason === "wilting" || row?.reason === "on-rhythm").toBe(true);
  });

  it("includes BUILDING habits with rhythm", () => {
    habits$["h-build"].set({
      ...makeHabit("h-build"),
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
    });
    const proposals = service.getCyclePlanningProposals("cycle-1");
    expect(proposals.find((p) => p.habitId === "h-build")).toBeDefined();
  });

  it("excludes BEING habits", () => {
    habits$["h-being"].set({
      ...makeHabit("h-being"),
      attitude: Attitude.BEING,
    });
    const proposals = service.getCyclePlanningProposals("cycle-1");
    expect(proposals.find((p) => p.habitId === "h-being")).toBeUndefined();
  });

  it("excludes habits without an attitude", () => {
    habits$["h-none"].set(makeHabit("h-none")); // attitude=null
    const proposals = service.getCyclePlanningProposals("cycle-1");
    expect(proposals.find((p) => p.habitId === "h-none")).toBeUndefined();
  });

  it("suggestedCount equals rhythmToCycleBudget for 28-day cycle", () => {
    habits$["h-build"].set({
      ...makeHabit("h-build"),
      attitude: Attitude.BUILDING,
      rhythm: { period: "weekly", count: 3 },
    });
    const proposals = service.getCyclePlanningProposals("cycle-1");
    const row = proposals.find((p) => p.habitId === "h-build")!;
    // weekly × 3 over 28 days = 12
    expect(row.suggestedCount).toBe(12);
  });
});
```

- [ ] **Step 2: Add types and the method**

Add to `src/application/services/CycleService.ts`:

```typescript
import { habitHealthService } from "@/domain/services/HabitHealthService";
import type { Health } from "@/domain/value-objects/Health";
```

Define the proposal type (export from the same service file to keep collocated):

```typescript
export type CyclePlanningProposalReason =
  | "wilting"
  | "on-rhythm"
  | "beginning"
  | "new-habit";

export interface CyclePlanningProposal {
  habitId: string;
  habitName: string;
  areaId: string;
  attitude: Attitude | null;
  suggestedRhythm: Rhythm | null;
  suggestedCount: number;
  reason: CyclePlanningProposalReason;
  currentHealth: Health;
  daysSinceLast: number | null;
}
```

Add the method to the `CycleService` class:

```typescript
/**
 * Compute cycle planning proposals — which habits the system suggests
 * budgeting into this cycle, based on attitude + rhythm + current health.
 *
 * Read-only; does NOT commit anything. Caller (UI or MCP agent) decides
 * which proposals to accept.
 */
getCyclePlanningProposals(cycleId: string): CyclePlanningProposal[] {
  const cycle = cycles$[cycleId].get();
  if (!cycle) return [];

  const allHabits = Object.values(habits$.get()).filter((h) => !h.isArchived);
  const allMoments = Object.values(moments$.get());
  const allPlans = Object.values(cyclePlans$.get());
  const cycleDays = this.computeCycleDays(cycle);
  const now = new Date();

  const proposals: CyclePlanningProposal[] = [];

  for (const habit of allHabits) {
    if (habit.attitude === null) continue;
    if (habit.attitude === Attitude.BEING) continue;

    const plan = allPlans.find(
      (p) => p.cycleId === cycleId && p.habitId === habit.id
    ) ?? null;

    const effectiveRhythm = habitHealthService.resolveRhythm(habit, plan);
    const currentHealth = habitHealthService.computeHealth(
      habit,
      plan,
      allMoments,
      now
    );

    const daysSinceLast = this.computeDaysSinceLastAllocation(
      habit.id,
      allMoments,
      now
    );

    // Inclusion logic per attitude
    if (habit.attitude === Attitude.BEGINNING) {
      const count = allMoments.filter((m) => m.habitId === habit.id).length;
      if (count >= 5) continue; // graduated; leave to user to promote
      proposals.push({
        habitId: habit.id,
        habitName: habit.name,
        areaId: habit.areaId,
        attitude: habit.attitude,
        suggestedRhythm: effectiveRhythm,
        suggestedCount: 0,
        reason: "beginning",
        currentHealth,
        daysSinceLast,
      });
      continue;
    }

    // KEEPING / BUILDING / PUSHING — need rhythm to propose meaningfully
    if (effectiveRhythm === null) continue;

    const suggestedCount = rhythmToCycleBudget(effectiveRhythm, cycleDays);
    const reason: CyclePlanningProposalReason =
      currentHealth === "wilting" ? "wilting" : "on-rhythm";

    proposals.push({
      habitId: habit.id,
      habitName: habit.name,
      areaId: habit.areaId,
      attitude: habit.attitude,
      suggestedRhythm: effectiveRhythm,
      suggestedCount,
      reason,
      currentHealth,
      daysSinceLast,
    });
  }

  return proposals;
}

private computeDaysSinceLastAllocation(
  habitId: string,
  moments: Moment[],
  now: Date
): number | null {
  let latest: Date | null = null;
  for (const m of moments) {
    if (m.habitId !== habitId) continue;
    if (m.day === null) continue;
    const d = new Date(m.day);
    if (latest === null || d > latest) latest = d;
  }
  if (latest === null) return null;
  const ms = now.getTime() - latest.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
```

- [ ] **Step 3: Run tests — expect pass**

Run: `pnpm test src/application/__tests__/CycleService.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/application/services/CycleService.ts \
        src/application/__tests__/CycleService.test.ts
git commit -m "feat(cycle): getCyclePlanningProposals for attitude-driven suggestions"
```

---

### Task 8: `CycleService.getCycleReview`

**Files:**
- Modify: `src/application/services/CycleService.ts`
- Modify: `src/application/__tests__/CycleService.test.ts`

- [ ] **Step 1: Write failing tests**

Append to the test file:

```typescript
describe("CycleService.getCycleReview", () => {
  let service: CycleService;

  const makeMoment = (
    id: string,
    overrides: Partial<ReturnType<typeof makeBaseMoment>> = {}
  ) => ({
    ...makeBaseMoment(id),
    ...overrides,
  });

  const makeBaseMoment = (id: string) => ({
    id,
    name: `moment-${id}`,
    areaId: "area-1",
    habitId: null as string | null,
    cycleId: "cycle-1",
    cyclePlanId: null as string | null,
    phase: "MORNING" as Phase,
    day: null as string | null,
    order: 0,
    emoji: null,
    tags: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    habits$.set({});
    activeCycleId$.set(null);
    storeHydrated$.set(false);
    cycles$["cycle-1"].set({
      ...makeCycle("cycle-1"),
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
    activeCycleId$.set("cycle-1");
    habits$["habit-1"].set(makeHabit("habit-1"));
    cyclePlans$["plan-1"].set({
      id: "plan-1",
      cycleId: "cycle-1",
      habitId: "habit-1",
      budgetedCount: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    service = new CycleService();
  });

  it("returns per-habit actualCount equal to allocated moments", () => {
    moments$["m1"].set(
      makeMoment("m1", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-05",
      })
    );
    moments$["m2"].set(
      makeMoment("m2", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-10",
      })
    );
    moments$["m3"].set(
      makeMoment("m3", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-20",
      })
    );

    const review = service.getCycleReview("cycle-1");
    expect(review).not.toBeNull();
    expect(review!.habits[0].actualCount).toBe(3);
  });

  it("returns unplannedMoments for moments without cyclePlanId", () => {
    moments$["m1"].set(
      makeMoment("m1", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-05",
      })
    );
    moments$["m2"].set(
      makeMoment("m2", {
        habitId: "habit-1",
        cyclePlanId: null,
        day: "2026-02-10",
      })
    );

    const review = service.getCycleReview("cycle-1");
    expect(review!.unplannedMoments).toHaveLength(1);
    expect(review!.unplannedMoments[0].id).toBe("m2");
  });

  it("includes firstAllocation and lastAllocation", () => {
    moments$["m1"].set(
      makeMoment("m1", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-05",
      })
    );
    moments$["m2"].set(
      makeMoment("m2", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-25",
      })
    );

    const review = service.getCycleReview("cycle-1");
    expect(review!.habits[0].firstAllocation).toBe("2026-02-05");
    expect(review!.habits[0].lastAllocation).toBe("2026-02-25");
  });

  it("includes longestGapDays", () => {
    moments$["m1"].set(
      makeMoment("m1", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-01",
      })
    );
    moments$["m2"].set(
      makeMoment("m2", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-05",
      })
    );
    moments$["m3"].set(
      makeMoment("m3", {
        habitId: "habit-1",
        cyclePlanId: "plan-1",
        day: "2026-02-20",
      })
    );

    const review = service.getCycleReview("cycle-1");
    expect(review!.habits[0].longestGapDays).toBe(15);
  });
});
```

- [ ] **Step 2: Add review types and method**

In `src/application/services/CycleService.ts`:

```typescript
export interface CycleReviewHabit {
  habitId: string;
  habitName: string;
  areaId: string;
  attitude: Attitude | null;
  rhythmSnapshot: Rhythm | null;
  budgetedCount: number | null;
  actualCount: number;
  startHealth: Health;
  endHealth: Health;
  firstAllocation: string | null;
  lastAllocation: string | null;
  longestGapDays: number | null;
}

export interface CycleReview {
  cycleId: string;
  cycleName: string;
  startDate: string;
  endDate: string | null;
  habits: CycleReviewHabit[];
  unplannedMoments: Moment[];
  totalMoments: number;
}
```

Add the method:

```typescript
/**
 * Review of a cycle — descriptive, no scores, no aggregate grades.
 * Observational mirror for reflection. Plan and review are separate acts.
 */
getCycleReview(cycleId: string): CycleReview | null {
  const cycle = cycles$[cycleId].get();
  if (!cycle) return null;

  const allMoments = Object.values(moments$.get());
  const allPlans = Object.values(cyclePlans$.get());
  const cyclePlans = allPlans.filter((p) => p.cycleId === cycleId);
  const cycleMoments = allMoments.filter((m) => m.cycleId === cycleId);
  const unplannedMoments = cycleMoments.filter(
    (m) => m.cyclePlanId === null
  );
  const startDate = new Date(cycle.startDate);
  const endDate = cycle.endDate ? new Date(cycle.endDate) : new Date();

  // For each cyclePlan, derive a review row
  const habits: CycleReviewHabit[] = [];
  for (const plan of cyclePlans) {
    const habit = habits$[plan.habitId].get();
    if (!habit) continue;

    const momentsForHabit = cycleMoments.filter(
      (m) => m.habitId === habit.id
    );
    const allocatedMoments = momentsForHabit.filter((m) => m.day !== null);
    const dates = allocatedMoments
      .map((m) => (m.day ? new Date(m.day) : null))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    const first = dates[0] ?? null;
    const last = dates[dates.length - 1] ?? null;

    let longestGap: number | null = null;
    for (let i = 1; i < dates.length; i++) {
      const gap = Math.floor(
        (dates[i].getTime() - dates[i - 1].getTime()) /
          (24 * 60 * 60 * 1000)
      );
      if (longestGap === null || gap > longestGap) longestGap = gap;
    }

    const startHealth = habitHealthService.computeHealth(
      habit,
      plan,
      allMoments.filter(
        (m) => m.day !== null && new Date(m.day) < startDate
      ),
      startDate
    );
    const endHealth = habitHealthService.computeHealth(
      habit,
      plan,
      allMoments,
      endDate
    );

    habits.push({
      habitId: habit.id,
      habitName: habit.name,
      areaId: habit.areaId,
      attitude: habit.attitude,
      rhythmSnapshot: habitHealthService.resolveRhythm(habit, plan),
      budgetedCount: plan.budgetedCount,
      actualCount: allocatedMoments.length,
      startHealth,
      endHealth,
      firstAllocation: first ? first.toISOString().slice(0, 10) : null,
      lastAllocation: last ? last.toISOString().slice(0, 10) : null,
      longestGapDays: longestGap,
    });
  }

  return {
    cycleId: cycle.id,
    cycleName: cycle.name,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    habits,
    unplannedMoments,
    totalMoments: cycleMoments.length,
  };
}
```

- [ ] **Step 3: Run tests — expect pass**

Run: `pnpm test src/application/__tests__/CycleService.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/application/services/CycleService.ts \
        src/application/__tests__/CycleService.test.ts
git commit -m "feat(cycle): getCycleReview for descriptive post-cycle reflection"
```

---

## Phase D — UI: Habit form rhythm

### Task 9: Add rhythm fields to habit form + UI store

**Files:**
- Modify: `src/infrastructure/state/ui-store.ts`
- Modify: `src/components/HabitFormDialog.tsx`
- Create: `src/components/RhythmSelector.tsx`

- [ ] **Step 1: Create the `RhythmSelector` component**

```typescript
// src/components/RhythmSelector.tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERIOD_DAYS,
  type Rhythm,
  type RhythmPeriod,
} from "@/domain/value-objects/Rhythm";

interface RhythmSelectorProps {
  value: Rhythm | null;
  onChange: (rhythm: Rhythm | null) => void;
}

const PERIODS: { value: RhythmPeriod; label: string }[] = [
  { value: "weekly", label: "week" },
  { value: "biweekly", label: "2 weeks" },
  { value: "monthly", label: "month" },
  { value: "quarterly", label: "quarter" },
  { value: "annually", label: "year" },
];

export function RhythmSelector({ value, onChange }: RhythmSelectorProps) {
  const hasRhythm = value !== null;

  return (
    <div className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
      <input
        type="checkbox"
        id="rhythm-on"
        checked={hasRhythm}
        onChange={(e) =>
          onChange(e.target.checked ? { period: "weekly", count: 1 } : null)
        }
        className="accent-stone-700"
      />
      <label htmlFor="rhythm-on" className="select-none">
        rhythm
      </label>

      {hasRhythm && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={31}
            value={value.count}
            onChange={(e) =>
              onChange({ ...value, count: Math.max(1, +e.target.value) })
            }
            className="w-14 px-2 py-1 bg-transparent border border-stone-300 dark:border-stone-700 rounded text-sm"
          />
          <span>×</span>
          <Select
            value={value.period}
            onValueChange={(p: RhythmPeriod) => onChange({ ...value, period: p })}
          >
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(({ value: v, label }) => (
                <SelectItem key={v} value={v}>
                  per {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `rhythm` to `habitFormState$`**

In `src/infrastructure/state/ui-store.ts`, find the `HabitFormState` interface. Add the field:

```typescript
import type { Rhythm } from "@/domain/value-objects/Rhythm";

export interface HabitFormState {
  open: boolean;
  mode: "create" | "edit";
  name: string;
  areaId: string;
  emoji: string | null;
  attitude: Attitude | null;
  phase: Phase | null;
  tags: string[];
  rhythm: Rhythm | null; // NEW
  editingHabitId: string | null;
}
```

Update the `openHabitFormCreate`, `openHabitFormEdit`, and any reset logic to include `rhythm: null` (or the habit's existing rhythm in edit mode). Exact locations depend on the current file contents — find each initialization of `habitFormState$` and add `rhythm`.

- [ ] **Step 3: Use the selector in `HabitFormDialog`**

In `src/components/HabitFormDialog.tsx`, after the `AttitudeSelector` usage, add:

```typescript
import { RhythmSelector } from "@/components/RhythmSelector";

// inside the component, after AttitudeSelector section:
<RhythmSelector
  value={formState.rhythm}
  onChange={(rhythm) => habitFormState$.rhythm.set(rhythm)}
/>
```

When constructing the `CreateHabitProps` / `UpdateHabitProps` passed to `onSave`, include `rhythm: formState.rhythm ?? undefined`.

- [ ] **Step 4: Verify existing tests still pass**

Run: `pnpm test src/components/__tests__/HabitFormDialog.test.ts 2>/dev/null || pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/RhythmSelector.tsx \
        src/components/HabitFormDialog.tsx \
        src/infrastructure/state/ui-store.ts
git commit -m "feat(ui): habit form gains rhythm selector"
```

---

## Phase E — UI: Health rendering

### Task 10: `useHabitHealth` hook + opacity class helper

**Files:**
- Create: `src/hooks/useHabitHealth.ts`
- Create: `src/lib/health-style.ts`

- [ ] **Step 1: Create the opacity class helper**

```typescript
// src/lib/health-style.ts
import type { Health } from "@/domain/value-objects/Health";

/**
 * Opacity class for health treatment of the habit emoji.
 * Monochrome, no hue changes, no new icons.
 */
export function healthEmojiClass(health: Health): string {
  switch (health) {
    case "wilting":
      return "opacity-50";
    case "dormant":
      return "opacity-30 grayscale";
    case "blooming":
    case "budding":
    case "seedling":
    case "evergreen":
    case "unstated":
    default:
      return "opacity-100";
  }
}
```

- [ ] **Step 2: Create the hook**

```typescript
// src/hooks/useHabitHealth.ts
"use client";

import { use$ } from "@legendapp/state/react";
import { habitHealthService } from "@/domain/services/HabitHealthService";
import type { Health } from "@/domain/value-objects/Health";
import {
  activeCycle$,
  cyclePlans$,
  habits$,
  moments$,
} from "@/infrastructure/state/store";

/**
 * Returns the current computed health for a habit.
 * Recomputes whenever habits, moments, active cycle, or plans change.
 */
export function useHabitHealth(habitId: string): Health {
  const habit = use$(habits$[habitId]);
  const allMoments = use$(moments$);
  const allPlans = use$(cyclePlans$);
  const activeCycle = use$(activeCycle$);

  if (!habit) return "unstated";

  const plan = activeCycle
    ? Object.values(allPlans).find(
        (p) => p.cycleId === activeCycle.id && p.habitId === habitId
      ) ?? null
    : null;

  return habitHealthService.computeHealth(
    habit,
    plan,
    Object.values(allMoments),
    new Date()
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHabitHealth.ts src/lib/health-style.ts
git commit -m "feat(ui): add useHabitHealth hook and emoji class helper"
```

---

### Task 11: Apply health treatment to habit emoji in moment cards

**Files:**
- Modify: `src/components/CycleDeckColumn.tsx` (or wherever deck card emoji renders)
- Modify: the moment card component used in Timeline (locate with grep before editing)

- [ ] **Step 1: Locate the card component(s) that render `moment.emoji` or `habit.emoji`**

Run: `grep -rn "moment.emoji\|habit.emoji" src/components --include="*.tsx"`

Identify the specific card component(s). Typically the CycleDeck card and the Timeline moment card.

- [ ] **Step 2: Wrap each emoji render with the treatment**

For each card component that displays a habit or moment emoji, import:

```typescript
import { healthEmojiClass } from "@/lib/health-style";
import { useHabitHealth } from "@/hooks/useHabitHealth";
```

Where the emoji is rendered (assume the moment has a `habitId`):

```typescript
const health = moment.habitId ? useHabitHealth(moment.habitId) : "unstated";

// in JSX, add the class to the emoji span/element
<span className={healthEmojiClass(health)}>
  {moment.emoji ?? habit?.emoji ?? "•"}
</span>
```

Moments without `habitId` (e.g. spontaneous one-offs) get `opacity-100` from the default path — no regression.

- [ ] **Step 3: Manual verification**

With dev server running (user-driven; do not start it automatically), visually confirm:
- Habits with BUILDING + rhythm show full opacity when on-pace
- Habits past silence threshold (e.g. change a test habit to `monthly × 2` with no recent moment) show 50% opacity on their emoji

- [ ] **Step 4: Commit**

```bash
git add src/components/CycleDeckColumn.tsx src/components/<timeline-moment-card>.tsx
git commit -m "feat(ui): moment and deck cards apply health-based emoji opacity"
```

---

### Task 12: Area card aggregate tone

**Files:**
- Modify: the area card component (locate via `src/components/AreaBoardColumn.tsx` or similar)

- [ ] **Step 1: Add aggregate computation**

Inside the area card component, compute how many of its habits are currently Wilting:

```typescript
import { useHabitHealth } from "@/hooks/useHabitHealth";

// inside the component:
const wiltingCount = habits
  .map((h) => useHabitHealth(h.id))
  .filter((h) => h === "wilting").length;

const hasWilting = wiltingCount > 0;
```

(If the area card iterates habits in a way that makes hook-per-habit awkward, refactor to a child component per habit, or compute in a separate selector hook that pulls habits + moments via `use$`.)

- [ ] **Step 2: Apply subtle tone shift when `hasWilting`**

On the area card root element, conditionally add an opacity class:

```typescript
className={cn(
  "…existing classes…",
  hasWilting && "opacity-90" // subtle, monochrome, no hue
)}
```

Do NOT add a count or badge. Ambient signal only.

- [ ] **Step 3: Commit**

```bash
git add src/components/<area-card>.tsx
git commit -m "feat(ui): area card applies subtle tone shift when habits wilt"
```

---

## Phase F — MCP Extensions

### Task 13: Mirror rhythm types in `mcp-server/vault.ts`

**Files:**
- Modify: `mcp-server/vault.ts`

- [ ] **Step 1: Add `Rhythm` + `RhythmSchema`**

At the top, after `CustomMetricSchema`:

```typescript
export const RHYTHM_PERIODS = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "annually",
] as const;
export const RhythmPeriodSchema = z.enum(RHYTHM_PERIODS);
export type RhythmPeriod = z.infer<typeof RhythmPeriodSchema>;

export const RhythmSchema = z.object({
  period: RhythmPeriodSchema,
  count: z.number().int().positive(),
});
export type Rhythm = z.infer<typeof RhythmSchema>;

export const PERIOD_DAYS: Record<RhythmPeriod, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  annually: 365,
};

export function rhythmToCycleBudget(r: Rhythm, cycleDays: number): number {
  return Math.round((r.count * cycleDays) / PERIOD_DAYS[r.period]);
}

export function rhythmSilenceThresholdDays(r: Rhythm): number {
  return PERIOD_DAYS[r.period] / r.count;
}
```

- [ ] **Step 2: Extend `Habit` and `CyclePlan` interfaces**

```typescript
export interface Habit {
  // ... existing fields
  rhythm?: Rhythm; // NEW
}

export interface CyclePlan {
  // ... existing fields
  rhythmOverride?: Rhythm; // NEW
}
```

- [ ] **Step 3: Commit**

```bash
git add mcp-server/vault.ts
git commit -m "feat(mcp): mirror Rhythm types and helpers from domain"
```

---

### Task 14: MCP `create_habit` / `update_habit` accept `rhythm`

**Files:**
- Modify: `mcp-server/index.ts`

- [ ] **Step 1: Add `rhythm` param to `create_habit`**

Find the `server.tool('create_habit', …)` block. Add `rhythm` to the zod schema and to the habit construction:

```typescript
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
    rhythm: RhythmSchema.optional(), // NEW
  },
  async (params): Promise<ToolResult> => {
    // ... existing validation ...
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
      ...(params.rhythm ? { rhythm: params.rhythm } : {}), // NEW
      createdAt: now,
      updatedAt: now,
    };
    // ... existing write ...
  },
);
```

Import `RhythmSchema` from `./vault.js` at the top of the file.

- [ ] **Step 2: Add `rhythm` param to `update_habit`**

Same pattern for `update_habit`. Add to the zod schema and to the spread logic:

```typescript
rhythm: RhythmSchema.nullable().optional(), // NEW (nullable allows clearing)
```

In the merge:
```typescript
...(params.rhythm !== undefined
  ? { rhythm: params.rhythm ?? undefined }
  : {}),
```

- [ ] **Step 3: Smoke-test with `smoke-test.mjs`**

Run: `cd mcp-server && node smoke-test.mjs`
Expected: smoke-test exits 0 (or existing assertions pass; add new ones if the smoke test is the canonical test surface for MCP).

- [ ] **Step 4: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): create_habit/update_habit accept rhythm parameter"
```

---

### Task 15: MCP `budget_habit_to_cycle` accepts `rhythmOverride` + auto-derive count

**Files:**
- Modify: `mcp-server/index.ts`

- [ ] **Step 1: Locate `budget_habit_to_cycle` tool**

Find `server.tool('budget_habit_to_cycle', …)`.

- [ ] **Step 2: Extend the schema and handler**

Schema additions:

```typescript
{
  cycleId: z.string(),
  habitId: z.string(),
  count: z.number().int().nonnegative().optional(), // now optional
  rhythmOverride: RhythmSchema.optional(),           // NEW
}
```

Handler: if `count` is not provided, derive from `rhythmOverride ?? habit.rhythm`. If neither is present, return an error.

```typescript
async ({ cycleId, habitId, count, rhythmOverride }): Promise<ToolResult> => {
  const cycles = readCollection(VAULT_ROOT, 'cycles');
  const cycle = cycles[cycleId];
  if (!cycle) return err(`Cycle not found: ${cycleId}`);

  const habits = readCollection(VAULT_ROOT, 'habits');
  const habit = habits[habitId];
  if (!habit) return err(`Habit not found: ${habitId}`);

  const effectiveRhythm = rhythmOverride ?? habit.rhythm ?? null;

  let resolvedCount = count;
  if (resolvedCount === undefined) {
    if (effectiveRhythm === null) {
      return err(
        'Cannot derive budget: no explicit count and no rhythm on habit or override'
      );
    }
    const start = new Date(cycle.startDate);
    const end = cycle.endDate ? new Date(cycle.endDate) : new Date();
    const cycleDays = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );
    resolvedCount = rhythmToCycleBudget(effectiveRhythm, cycleDays);
  }

  // ... existing plan upsert logic, using resolvedCount ...
  // After the plan is upserted, if rhythmOverride is provided, write it onto
  // the plan record and persist.
},
```

- [ ] **Step 3: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): budget_habit_to_cycle supports rhythmOverride and auto-derive"
```

---

### Task 16: MCP `get_habit_health`

**Files:**
- Modify: `mcp-server/index.ts`

- [ ] **Step 1: Port the health computation to the MCP side**

Since the MCP server is a standalone TS module (no cross-workspace import), add a minimal health computer in `mcp-server/` that mirrors `HabitHealthService`. Create a new file:

```typescript
// mcp-server/health.ts
import type { Habit, CyclePlan, Moment, Rhythm } from './vault.js';
import { PERIOD_DAYS, rhythmSilenceThresholdDays } from './vault.js';

export type Health =
  | 'seedling'
  | 'budding'
  | 'blooming'
  | 'wilting'
  | 'dormant'
  | 'evergreen'
  | 'unstated';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BUDDING_PERIOD_COUNT = 3;

export function resolveRhythm(
  habit: Habit,
  plan: CyclePlan | null
): Rhythm | null {
  return plan?.rhythmOverride ?? habit.rhythm ?? null;
}

export function computeHealth(
  habit: Habit,
  plan: CyclePlan | null,
  moments: Moment[],
  now: Date
): Health {
  if (habit.attitude === null) return 'unstated';
  if (habit.attitude === 'BEING') return 'evergreen';

  const rhythm = resolveRhythm(habit, plan);
  const habitMoments = moments.filter((m) => m.habitId === habit.id);

  if (habit.attitude === 'BEGINNING') {
    return habitMoments.length >= 5 ? 'budding' : 'seedling';
  }

  if (habit.attitude === 'KEEPING') {
    if (!rhythm) return 'unstated';
    const threshold = rhythmSilenceThresholdDays(rhythm);
    const last = latestAllocationDate(habitMoments);
    if (last === null) return 'wilting';
    const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
    return daysSince <= threshold ? 'blooming' : 'wilting';
  }

  if (habit.attitude === 'BUILDING' || habit.attitude === 'PUSHING') {
    if (!rhythm) return 'unstated';
    const periodDays = PERIOD_DAYS[rhythm.period];
    const buddingWindow = periodDays * BUDDING_PERIOD_COUNT;
    const habitUpdated = new Date(habit.updatedAt);
    const daysSinceUpdate =
      (now.getTime() - habitUpdated.getTime()) / MS_PER_DAY;
    if (daysSinceUpdate < buddingWindow) return 'budding';

    const periodStart = new Date(now.getTime() - periodDays * MS_PER_DAY);
    const countInPeriod = habitMoments.filter((m) => {
      if (m.day === null) return false;
      return new Date(m.day).getTime() >= periodStart.getTime();
    }).length;
    const daysElapsed = Math.min(periodDays, daysSinceUpdate);
    const expected = rhythm.count * (daysElapsed / periodDays);
    const tolerance = Math.max(1, Math.floor(rhythm.count * 0.2));
    return countInPeriod + tolerance >= expected ? 'blooming' : 'wilting';
  }

  return 'unstated';
}

function latestAllocationDate(moments: Moment[]): Date | null {
  let latest: Date | null = null;
  for (const m of moments) {
    if (m.day === null) continue;
    const d = new Date(m.day);
    if (latest === null || d > latest) latest = d;
  }
  return latest;
}

export function daysSinceLast(
  habitId: string,
  moments: Moment[],
  now: Date
): number | null {
  const habitMoments = moments.filter((m) => m.habitId === habitId);
  const last = latestAllocationDate(habitMoments);
  if (last === null) return null;
  return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
}
```

- [ ] **Step 2: Add `get_habit_health` tool**

In `mcp-server/index.ts`:

```typescript
import {
  computeHealth,
  daysSinceLast,
  resolveRhythm,
} from './health.js';

server.tool(
  'get_habit_health',
  'Compute health, effective rhythm, and days-since-last-allocation for a habit.',
  { habitId: z.string() },
  async ({ habitId }): Promise<ToolResult> => {
    const habits = readCollection(VAULT_ROOT, 'habits');
    const habit = habits[habitId];
    if (!habit) return err(`Habit not found: ${habitId}`);

    const cyclePlans = readCollection(VAULT_ROOT, 'cyclePlans');
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const moments = readCollection(VAULT_ROOT, 'moments');

    const now = new Date();

    // Prefer an active-matching plan (where cycle contains today)
    const isoToday = now.toISOString().slice(0, 10);
    const activePlan =
      Object.values(cyclePlans).find((p) => {
        if (p.habitId !== habitId) return false;
        const c = cycles[p.cycleId];
        if (!c) return false;
        return (
          c.startDate <= isoToday && (!c.endDate || c.endDate >= isoToday)
        );
      }) ?? null;

    const momentsArr = Object.values(moments);
    const health = computeHealth(habit, activePlan, momentsArr, now);

    return ok({
      habitId,
      health,
      rhythm: resolveRhythm(habit, activePlan),
      daysSinceLast: daysSinceLast(habitId, momentsArr, now),
    });
  },
);
```

- [ ] **Step 3: Commit**

```bash
git add mcp-server/health.ts mcp-server/index.ts
git commit -m "feat(mcp): add get_habit_health read tool"
```

---

### Task 17: MCP `list_wilting_habits`

**Files:**
- Modify: `mcp-server/index.ts`

- [ ] **Step 1: Add the tool**

```typescript
server.tool(
  'list_wilting_habits',
  'List habits whose current health is "wilting". Optionally filter by areaId or attitude.',
  {
    areaId: z.string().optional(),
    attitude: AttitudeSchema.optional(),
  },
  async ({ areaId, attitude }): Promise<ToolResult> => {
    const habits = readCollection(VAULT_ROOT, 'habits');
    const cyclePlans = readCollection(VAULT_ROOT, 'cyclePlans');
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const moments = readCollection(VAULT_ROOT, 'moments');
    const momentsArr = Object.values(moments);
    const now = new Date();
    const isoToday = now.toISOString().slice(0, 10);

    const results: Array<{
      habitId: string;
      habitName: string;
      areaId: string;
      attitude: (typeof ATTITUDES)[number] | null;
      rhythm: Rhythm | null;
      daysSinceLast: number | null;
    }> = [];

    for (const habit of Object.values(habits)) {
      if (habit.isArchived) continue;
      if (areaId && habit.areaId !== areaId) continue;
      if (attitude && habit.attitude !== attitude) continue;

      const activePlan =
        Object.values(cyclePlans).find((p) => {
          if (p.habitId !== habit.id) return false;
          const c = cycles[p.cycleId];
          if (!c) return false;
          return (
            c.startDate <= isoToday && (!c.endDate || c.endDate >= isoToday)
          );
        }) ?? null;

      const health = computeHealth(habit, activePlan, momentsArr, now);
      if (health !== 'wilting') continue;

      results.push({
        habitId: habit.id,
        habitName: habit.name,
        areaId: habit.areaId,
        attitude: habit.attitude,
        rhythm: resolveRhythm(habit, activePlan),
        daysSinceLast: daysSinceLast(habit.id, momentsArr, now),
      });
    }

    return ok(results);
  },
);
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): add list_wilting_habits read tool"
```

---

### Task 18: MCP `get_cycle_planning_proposals`

**Files:**
- Modify: `mcp-server/index.ts`

- [ ] **Step 1: Add the tool**

```typescript
import { rhythmToCycleBudget } from './vault.js';

server.tool(
  'get_cycle_planning_proposals',
  'Read-only: compute habit proposals for a cycle based on attitude + rhythm + health. Caller decides what to accept.',
  { cycleId: z.string() },
  async ({ cycleId }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const cycle = cycles[cycleId];
    if (!cycle) return err(`Cycle not found: ${cycleId}`);

    const start = new Date(cycle.startDate);
    const end = cycle.endDate ? new Date(cycle.endDate) : new Date();
    const cycleDays = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );

    const habits = readCollection(VAULT_ROOT, 'habits');
    const cyclePlans = readCollection(VAULT_ROOT, 'cyclePlans');
    const moments = readCollection(VAULT_ROOT, 'moments');
    const momentsArr = Object.values(moments);
    const now = new Date();

    const proposals = [];
    for (const habit of Object.values(habits)) {
      if (habit.isArchived) continue;
      if (habit.attitude === null) continue;
      if (habit.attitude === 'BEING') continue;

      const plan =
        Object.values(cyclePlans).find(
          (p) => p.cycleId === cycleId && p.habitId === habit.id
        ) ?? null;
      const effectiveRhythm = resolveRhythm(habit, plan);
      const health = computeHealth(habit, plan, momentsArr, now);
      const dsl = daysSinceLast(habit.id, momentsArr, now);

      if (habit.attitude === 'BEGINNING') {
        const count = momentsArr.filter((m) => m.habitId === habit.id).length;
        if (count >= 5) continue;
        proposals.push({
          habitId: habit.id,
          habitName: habit.name,
          areaId: habit.areaId,
          attitude: habit.attitude,
          suggestedRhythm: effectiveRhythm,
          suggestedCount: 0,
          reason: 'beginning',
          currentHealth: health,
          daysSinceLast: dsl,
        });
        continue;
      }

      if (!effectiveRhythm) continue;

      const suggestedCount = rhythmToCycleBudget(effectiveRhythm, cycleDays);
      proposals.push({
        habitId: habit.id,
        habitName: habit.name,
        areaId: habit.areaId,
        attitude: habit.attitude,
        suggestedRhythm: effectiveRhythm,
        suggestedCount,
        reason: health === 'wilting' ? 'wilting' : 'on-rhythm',
        currentHealth: health,
        daysSinceLast: dsl,
      });
    }

    return ok(proposals);
  },
);
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): add get_cycle_planning_proposals read tool"
```

---

### Task 19: MCP `get_cycle_review`

**Files:**
- Modify: `mcp-server/index.ts`

- [ ] **Step 1: Add the tool**

```typescript
server.tool(
  'get_cycle_review',
  'Read-only: descriptive review of a cycle. No aggregate scores. Observational mirror only.',
  { cycleId: z.string() },
  async ({ cycleId }): Promise<ToolResult> => {
    const cycles = readCollection(VAULT_ROOT, 'cycles');
    const cycle = cycles[cycleId];
    if (!cycle) return err(`Cycle not found: ${cycleId}`);

    const habitsColl = readCollection(VAULT_ROOT, 'habits');
    const cyclePlans = readCollection(VAULT_ROOT, 'cyclePlans');
    const momentsColl = readCollection(VAULT_ROOT, 'moments');
    const momentsArr = Object.values(momentsColl);

    const cycleMoments = momentsArr.filter((m) => m.cycleId === cycleId);
    const unplannedMoments = cycleMoments.filter(
      (m) => m.cyclePlanId === null
    );
    const start = new Date(cycle.startDate);
    const end = cycle.endDate ? new Date(cycle.endDate) : new Date();

    const reviewHabits = [];
    const plansForCycle = Object.values(cyclePlans).filter(
      (p) => p.cycleId === cycleId
    );
    for (const plan of plansForCycle) {
      const habit = habitsColl[plan.habitId];
      if (!habit) continue;

      const allocated = cycleMoments.filter(
        (m) => m.habitId === habit.id && m.day !== null
      );
      const dates = allocated
        .map((m) => (m.day ? new Date(m.day) : null))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());

      const first = dates[0] ?? null;
      const last = dates[dates.length - 1] ?? null;
      let longestGap: number | null = null;
      for (let i = 1; i < dates.length; i++) {
        const gap = Math.floor(
          (dates[i].getTime() - dates[i - 1].getTime()) / (24 * 60 * 60 * 1000)
        );
        if (longestGap === null || gap > longestGap) longestGap = gap;
      }

      const priorMoments = momentsArr.filter(
        (m) => m.day !== null && new Date(m.day) < start
      );
      const startHealth = computeHealth(habit, plan, priorMoments, start);
      const endHealth = computeHealth(habit, plan, momentsArr, end);

      reviewHabits.push({
        habitId: habit.id,
        habitName: habit.name,
        areaId: habit.areaId,
        attitude: habit.attitude,
        rhythmSnapshot: resolveRhythm(habit, plan),
        budgetedCount: plan.budgetedCount,
        actualCount: allocated.length,
        startHealth,
        endHealth,
        firstAllocation: first ? first.toISOString().slice(0, 10) : null,
        lastAllocation: last ? last.toISOString().slice(0, 10) : null,
        longestGapDays: longestGap,
      });
    }

    return ok({
      cycleId: cycle.id,
      cycleName: cycle.name,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      habits: reviewHabits,
      unplannedMoments,
      totalMoments: cycleMoments.length,
    });
  },
);
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): add get_cycle_review read tool"
```

---

### Task 20: Document the agent read/write boundary in `TOOLS.md`

**Files:**
- Modify: `mcp-server/TOOLS.md`

- [ ] **Step 1: Add a new section at an appropriate top-level position**

Append or insert a section:

```markdown
## Agent Read/Write Boundary

Zenborg MCP tools split into **read-side** (safe for an agent to call freely
while exploring) and **write-side** (require explicit user authorization
before the agent commits).

### Read-side (propose freely)
- `list_areas`, `list_habits`, `list_cycles`, `list_moments`, `list_cycle_plans`, `list_phase_configs`
- `get_area`, `get_habit`, `get_cycle`, `get_moment`, `get_cycle_plan`
- `get_habit_health`
- `list_wilting_habits`
- `get_cycle_planning_proposals`
- `get_cycle_review`

### Write-side (commit only with explicit user consent)
- `create_habit`, `update_habit`, `archive_habit`, `unarchive_habit`
- `create_area`, `update_area`, `archive_area`, `unarchive_area`, `delete_area`
- `create_moment`, `update_moment`, `delete_moment`
- `allocate_moment`, `unallocate_moment`, `allocate_moment_from_deck`
- `plan_cycle`, `quick_create_cycle`, `update_cycle`, `end_cycle`, `delete_cycle`
- `budget_habit_to_cycle`, `increment_habit_budget`, `decrement_habit_budget`, `remove_habit_from_deck`

### Attitude-driven planning

At cycle planning time, call `get_cycle_planning_proposals` to surface what
rhythm + health signals suggest. Never call `budget_habit_to_cycle` or
`plan_cycle` without the user confirming which proposals to accept. The
agent's role is to show the garden's state; the user decides what to tend.

Plan and review are distinct acts. `get_cycle_planning_proposals` does NOT
take review context as input — review is backward-looking reflection, plan
is forward-looking intention. Chain them only at the user's direction.
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/TOOLS.md
git commit -m "docs(mcp): document agent read/write boundary and attitude-driven planning"
```

---

## Closing

### Final verification

- [ ] Run the full test suite: `pnpm test`
  Expected: all tests pass.

- [ ] Run the MCP smoke test: `cd mcp-server && node smoke-test.mjs`
  Expected: exits 0.

- [ ] Confirm no data corruption on dev vault: read `~/.zenborg-dev/habits.json` and `~/.zenborg-dev/cyclePlans.json`; new optional fields should be absent on existing records.

- [ ] Confirm JSON vault still loads in the desktop app (user-driven; do not launch the app automatically).

### Out of scope for this plan

- `/harvest` UI for cycle review
- UI panel for cycle planning proposals (agent drives planning in v1)
- Dormant state + pause UI
- BEING "Rooted" section
- Timeline redesign
- Cycle tags

See the spec for the open-questions list.
