# Inline Cycle Deck Editor - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable inline cycle deck editing on the cultivate page with stable ordering and ghost cards for unbudgeted habits.

**Architecture:** Fix `CycleService.materializeCyclePlanMoments` to add/remove incrementally instead of delete-all/recreate. Add edit mode toggle to `CycleDeck` with count controls and "show all habits" ghost cards. Sort habit stacks by `habit.order` for stable visual ordering.

**Tech Stack:** Legend State observables, React, Vitest, @dnd-kit

---

### Task 1: Incremental Materialize in CycleService

**Files:**
- Create: `src/application/__tests__/CycleService.test.ts`
- Modify: `src/application/services/CycleService.ts:421-463`

**Step 1: Write the failing tests**

```typescript
// src/application/__tests__/CycleService.test.ts
// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { observable } from "@legendapp/state";
import { CycleService } from "../services/CycleService";
import { cycles$, cyclePlans$, habits$, moments$ } from "@/infrastructure/state/store";

// Helper factories
const makeHabit = (id: string, areaId = "area-1") => ({
  id,
  name: `Habit ${id}`,
  areaId,
  attitude: null,
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const makeCycle = (id: string) => ({
  id,
  name: `Cycle ${id}`,
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("CycleService.budgetHabitToCycle (incremental materialize)", () => {
  let service: CycleService;

  beforeEach(() => {
    // Reset store state
    moments$.set({});
    cyclePlans$.set({});
    cycles$.set({});
    habits$.set({});

    // Seed test data
    cycles$["cycle-1"].set(makeCycle("cycle-1"));
    habits$["habit-1"].set(makeHabit("habit-1"));

    service = new CycleService();
  });

  it("should create N moments when budgeting a new habit", () => {
    service.budgetHabitToCycle("cycle-1", "habit-1", 3);

    const allMoments = Object.values(moments$.get());
    const planMoments = allMoments.filter((m) => m.cyclePlanId !== null);
    expect(planMoments).toHaveLength(3);
  });

  it("should add only delta moments when incrementing", () => {
    service.budgetHabitToCycle("cycle-1", "habit-1", 2);
    const momentsBefore = Object.values(moments$.get());
    const idsBefore = new Set(momentsBefore.map((m) => m.id));

    service.budgetHabitToCycle("cycle-1", "habit-1", 3);
    const momentsAfter = Object.values(moments$.get());

    // All original moments should still exist
    for (const id of idsBefore) {
      expect(moments$[id].get()).toBeTruthy();
    }
    // Exactly 1 new moment added
    expect(momentsAfter).toHaveLength(3);
  });

  it("should remove unallocated moments first when decrementing", () => {
    service.budgetHabitToCycle("cycle-1", "habit-1", 3);

    // Simulate: allocate one moment to the timeline
    const allMoments = Object.values(moments$.get());
    const firstMoment = allMoments[0];
    moments$[firstMoment.id].day.set("2026-02-01");
    moments$[firstMoment.id].phase.set("morning");

    // Decrement to 1
    service.budgetHabitToCycle("cycle-1", "habit-1", 1);

    // The allocated moment should survive
    expect(moments$[firstMoment.id].get()).toBeTruthy();
    expect(moments$[firstMoment.id].day.get()).toBe("2026-02-01");

    // Total moments for this plan should be 1 (the allocated one)
    const remaining = Object.values(moments$.get()).filter(
      (m) => m.habitId === "habit-1"
    );
    expect(remaining).toHaveLength(1);
  });

  it("should remove only unallocated moments when setting to 0", () => {
    service.budgetHabitToCycle("cycle-1", "habit-1", 3);

    // Allocate one moment
    const allMoments = Object.values(moments$.get());
    const allocatedMoment = allMoments[0];
    moments$[allocatedMoment.id].day.set("2026-02-01");
    moments$[allocatedMoment.id].phase.set("morning");

    // Set to 0
    service.budgetHabitToCycle("cycle-1", "habit-1", 0);

    // Allocated moment survives (orphaned from budget but on timeline)
    expect(moments$[allocatedMoment.id].get()).toBeTruthy();

    // Unallocated moments are gone
    const unallocated = Object.values(moments$.get()).filter(
      (m) => m.day === null && m.habitId === "habit-1"
    );
    expect(unallocated).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/application/__tests__/CycleService.test.ts`
Expected: Tests fail because current materialize deletes all moments

**Step 3: Rewrite `materializeCyclePlanMoments` to be incremental**

Replace `CycleService.ts:421-463` with:

```typescript
  private materializeCyclePlanMoments(cyclePlanId: string): void {
    const plan = cyclePlans$[cyclePlanId].get();
    if (!plan) {
      console.error(`Cycle plan ${cyclePlanId} not found`);
      return;
    }

    const habit = habits$[plan.habitId].get();
    if (!habit) {
      console.error(`Habit ${plan.habitId} not found`);
      return;
    }

    // Get existing moments for this plan
    const allMoments = Object.values(moments$.get());
    const planMoments = allMoments.filter((m) => m.cyclePlanId === cyclePlanId);

    // Separate into allocated (on timeline) and unallocated (in deck)
    const allocated = planMoments.filter((m) => m.day !== null && m.phase !== null);
    const unallocated = planMoments.filter((m) => m.day === null || m.phase === null);

    const currentCount = planMoments.length;
    const targetCount = plan.budgetedCount;

    if (targetCount > currentCount) {
      // INCREMENT: Create only the delta
      const toCreate = targetCount - currentCount;
      for (let i = 0; i < toCreate; i++) {
        const result = createMoment({
          name: habit.name,
          areaId: habit.areaId,
          emoji: habit.emoji,
          habitId: plan.habitId,
          cycleId: plan.cycleId,
          cyclePlanId: plan.id,
          phase: null,
          tags: habit.tags || [],
        });

        if ("error" in result) {
          console.error(`Failed to create budgeted moment: ${result.error}`);
          continue;
        }

        moments$[result.id].set(result);
      }
    } else if (targetCount < currentCount) {
      // DECREMENT: Remove unallocated first, then allocated as last resort
      const toRemove = currentCount - targetCount;
      const removalCandidates = [...unallocated, ...allocated];

      for (let i = 0; i < toRemove && i < removalCandidates.length; i++) {
        moments$[removalCandidates[i].id].delete();
      }
    }
    // targetCount === currentCount: no-op
  }
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/application/__tests__/CycleService.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add src/application/__tests__/CycleService.test.ts src/application/services/CycleService.ts
git commit -m "fix: incremental materialize preserves allocated moments on count change"
```

---

### Task 2: Stable Habit Ordering in Computed Selector

**Files:**
- Modify: `src/infrastructure/state/store.ts:519-542`

**Step 1: Write a failing test**

Add to `src/infrastructure/__tests__/store.test.ts` (or create if section doesn't exist):

```typescript
describe("deckMomentsByAreaAndHabit$ ordering", () => {
  it("should order habits within area by habit.order", () => {
    // Setup: two habits with different orders
    habits$["habit-a"].set(makeHabit("habit-a", { order: 2 }));
    habits$["habit-b"].set(makeHabit("habit-b", { order: 0 }));

    // Create moments for both
    moments$["m1"].set(makeMoment({ habitId: "habit-a", areaId: "area-1" }));
    moments$["m2"].set(makeMoment({ habitId: "habit-b", areaId: "area-1" }));

    const result = deckMomentsByAreaAndHabit$.get();
    const habitIds = Object.keys(result["area-1"] || {});

    // habit-b (order 0) should come before habit-a (order 2)
    expect(habitIds[0]).toBe("habit-b");
    expect(habitIds[1]).toBe("habit-a");
  });
});
```

Note: adapt the helper factories to match the existing test patterns in `store.test.ts`. The key assertion is that habit keys are ordered by `habit.order`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/infrastructure/__tests__/store.test.ts`
Expected: FAIL — current code uses insertion order, not habit.order

**Step 3: Update `deckMomentsByAreaAndHabit$` to sort by habit.order**

Replace `store.ts:519-542`:

```typescript
export const deckMomentsByAreaAndHabit$ = observable(() => {
  const deckMoments = deckMoments$.get();
  const allHabits = habits$.get();
  const byArea: Record<string, Record<string, Moment[]>> = {};

  for (const moment of deckMoments) {
    if (!byArea[moment.areaId]) {
      byArea[moment.areaId] = {};
    }

    const habitId = moment.habitId || "standalone";
    if (!byArea[moment.areaId][habitId]) {
      byArea[moment.areaId][habitId] = [];
    }

    byArea[moment.areaId][habitId].push(moment);
  }

  // Sort habit keys within each area by habit.order
  const sorted: Record<string, Record<string, Moment[]>> = {};
  for (const areaId of Object.keys(byArea)) {
    const habitIds = Object.keys(byArea[areaId]);
    habitIds.sort((a, b) => {
      const habitA = allHabits[a];
      const habitB = allHabits[b];
      return (habitA?.order ?? 999) - (habitB?.order ?? 999);
    });

    sorted[areaId] = {};
    for (const habitId of habitIds) {
      sorted[areaId][habitId] = byArea[areaId][habitId];
    }
  }

  return sorted;
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/infrastructure/__tests__/store.test.ts`
Expected: PASS

**Step 5: Apply same ordering to CycleDeckBuilder**

In `src/components/CycleDeckBuilder.tsx:55-58`, update the sort:

```typescript
  // Current: sorts by createdAt
  // Change to: no sort needed here — the grouping functions handle it
  // But the CycleDeckColumn's momentsByHabit also needs sorting
```

In `CycleDeckColumn` (line 162-251), after building `momentsByHabit`, sort the entries:

```typescript
  const allHabitsMap = use$(habits$);

  // Sort habit entries by habit.order
  const sortedHabitEntries = Object.entries(momentsByHabit)
    .filter(([habitId]) => habitId !== "standalone")
    .sort(([a], [b]) => {
      const habitA = allHabitsMap[a];
      const habitB = allHabitsMap[b];
      return (habitA?.order ?? 999) - (habitB?.order ?? 999);
    });
```

Then use `sortedHabitEntries` in the render instead of `Object.entries(momentsByHabit).filter(...)`.

Add `import { habits$ } from "@/infrastructure/state/store";` to the imports.

**Step 6: Commit**

```bash
git add src/infrastructure/state/store.ts src/components/CycleDeckBuilder.tsx src/infrastructure/__tests__/store.test.ts
git commit -m "feat: sort habit stacks by habit.order for stable visual ordering"
```

---

### Task 3: UI Store — Edit Mode and Show All Habits State

**Files:**
- Modify: `src/infrastructure/state/ui-store.ts:60-65`

**Step 1: Add new observables**

After `cycleDeckCollapsed$` (line 65), add:

```typescript
/**
 * Cycle deck edit mode
 * Controls whether count controls and editing features are shown
 * Ephemeral - not persisted
 */
export const cycleDeckEditMode$ = observable<boolean>(false);

/**
 * Cycle deck "show all habits" toggle
 * When true, shows ghost cards for unbudgeted habits (only in edit mode)
 * Ephemeral - not persisted
 */
export const cycleDeckShowAllHabits$ = observable<boolean>(false);
```

**Step 2: Commit**

```bash
git add src/infrastructure/state/ui-store.ts
git commit -m "feat: add cycleDeckEditMode$ and cycleDeckShowAllHabits$ observables"
```

---

### Task 4: CycleDeck Edit Mode Toggle

**Files:**
- Modify: `src/components/CycleDeck.tsx`
- Modify: `src/components/__tests__/CycleDeck.test.tsx`

**Step 1: Write the failing test**

Add to `CycleDeck.test.tsx`:

```typescript
describe("edit mode", () => {
  it("should show count controls when edit mode is active", () => {
    const deckMoments = {
      "area-1": {
        "habit-1": [createTestMoment({ id: "1" }), createTestMoment({ id: "2" })],
      },
    };

    // 4th useValue call: cycleDeckEditMode$ = true
    // 5th useValue call: cycleDeckShowAllHabits$ = false
    mockUseValue
      .mockReturnValueOnce(deckMoments)    // deckMomentsByAreaAndHabit$
      .mockReturnValueOnce({ id: "cycle-1", name: "Test", endDate: "2026-04-01" }) // currentCycle$
      .mockReturnValueOnce(false)           // cycleDeckCollapsed$
      .mockReturnValueOnce(true)            // cycleDeckEditMode$
      .mockReturnValueOnce(false);          // cycleDeckShowAllHabits$

    render(<CycleDeck />);

    // MomentStack mock should receive onIncrement/onDecrement props
    // Check that the edit mode pencil became a checkmark
    expect(screen.getByLabelText("Done editing")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 3: Implement edit mode toggle in CycleDeck**

Key changes to `CycleDeck.tsx`:

1. Import new store values:
```typescript
import { cycleDeckCollapsed$, cycleDeckEditMode$, cycleDeckShowAllHabits$ } from "@/infrastructure/state/ui-store";
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Pencil } from "lucide-react";
import { habits$ } from "@/infrastructure/state/store";
```

2. In `CycleDeck()`, add reactive reads:
```typescript
const isEditMode = useValue(cycleDeckEditMode$);
const showAllHabits = useValue(cycleDeckShowAllHabits$);
const toggleEditMode = () => {
  const next = !cycleDeckEditMode$.peek();
  cycleDeckEditMode$.set(next);
  // Reset show-all when leaving edit mode
  if (!next) {
    cycleDeckShowAllHabits$.set(false);
  }
};
```

3. Replace the pencil button in the header:
```typescript
<button
  type="button"
  onClick={toggleEditMode}
  className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
  title={isEditMode ? "Done editing" : "Edit cycle deck"}
  aria-label={isEditMode ? "Done editing" : "Edit cycle deck"}
>
  {isEditMode ? (
    <Check className="h-3.5 w-3.5" />
  ) : (
    <Pencil className="h-3.5 w-3.5" />
  )}
</button>
```

4. Add "Show all habits" toggle (only in edit mode), next to the collapse button:
```typescript
{isEditMode && (
  <button
    type="button"
    onClick={() => cycleDeckShowAllHabits$.set(!cycleDeckShowAllHabits$.peek())}
    className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
    title={showAllHabits ? "Hide unbudgeted habits" : "Show all habits"}
    aria-label={showAllHabits ? "Hide unbudgeted habits" : "Show all habits"}
  >
    {showAllHabits ? (
      <EyeOff className="h-3.5 w-3.5" />
    ) : (
      <Eye className="h-3.5 w-3.5" />
    )}
  </button>
)}
```

5. Pass `isEditMode`, `showAllHabits`, and `cycleId` to `CycleDeckColumn`:
```typescript
<CycleDeckColumn
  key={area.id}
  area={area}
  habitMoments={habits}
  isEditMode={isEditMode}
  showAllHabits={showAllHabits}
  cycleId={cycleId!}
/>
```

**Step 4: Update CycleDeckColumn to support edit mode**

Add to `CycleDeckColumnProps`:
```typescript
interface CycleDeckColumnProps {
  area: Area;
  habitMoments: Record<string, any[]>;
  isEditMode: boolean;
  showAllHabits: boolean;
  cycleId: string;
}
```

When `isEditMode` is true, render `CycleDeckStack` (with count controls) instead of plain `MomentStack`. Extract `CycleDeckStack` from `CycleDeckBuilder.tsx` into a shared location or duplicate inline in `CycleDeck.tsx`:

```typescript
function CycleDeckColumn({ area, habitMoments, isEditMode, showAllHabits, cycleId }: CycleDeckColumnProps) {
  const allHabits = useValue(habits$);
  const cycleService = new CycleService();

  // Get habit IDs already budgeted, sorted by habit.order
  const budgetedHabitIds = Object.keys(habitMoments).sort((a, b) => {
    const habitA = allHabits[a];
    const habitB = allHabits[b];
    return (habitA?.order ?? 999) - (habitB?.order ?? 999);
  });

  // If showAllHabits, also include unbudgeted habits for this area
  const allAreaHabitIds = showAllHabits
    ? Object.values(allHabits)
        .filter((h) => h.areaId === area.id && !h.isArchived)
        .sort((a, b) => a.order - b.order)
        .map((h) => h.id)
    : budgetedHabitIds;

  // Merge: all area habits (ordered), with budgeted data where available
  const habitEntries = allAreaHabitIds.map((habitId) => ({
    habitId,
    moments: habitMoments[habitId] || [],
    isBudgeted: !!habitMoments[habitId],
  }));

  // ... render logic below
}
```

For each habit entry, render either:
- **Budgeted + edit mode**: `MomentStack` with `onIncrement`/`onDecrement`/`onRemove`
- **Budgeted + read-only**: `MomentStack` (no controls) — current behavior
- **Unbudgeted (ghost)**: Ghost card (see Task 5)

**Step 5: Run tests**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 6: Commit**

```bash
git add src/components/CycleDeck.tsx src/components/__tests__/CycleDeck.test.tsx
git commit -m "feat: add inline edit mode toggle to CycleDeck with count controls"
```

---

### Task 5: Ghost Cards for Unbudgeted Habits

**Files:**
- Modify: `src/components/CycleDeck.tsx` (CycleDeckColumn)
- Modify: `src/components/MomentStack.tsx`

**Step 1: Write the failing test**

Add to `CycleDeck.test.tsx`:

```typescript
describe("ghost cards", () => {
  it("should show ghost card for unbudgeted habit when showAllHabits is on", () => {
    // Mock habits$ to include an unbudgeted habit
    // Mock deckMoments with only one habit budgeted
    // Assert ghost card renders with x0

    const deckMoments = {
      "area-1": {
        "habit-1": [createTestMoment({ id: "1" })],
      },
    };

    mockUseValue
      .mockReturnValueOnce(deckMoments)
      .mockReturnValueOnce({ id: "cycle-1", name: "Test", endDate: "2026-04-01" })
      .mockReturnValueOnce(false)  // collapsed
      .mockReturnValueOnce(true)   // editMode
      .mockReturnValueOnce(true);  // showAllHabits

    render(<CycleDeck />);

    // Should show ghost card for habit-2 (unbudgeted but in area-1)
    expect(screen.getByTestId("ghost-card-habit-2")).toBeInTheDocument();
  });
});
```

Note: The mock for `habits$` needs to include `habit-2` in `area-1` that's NOT budgeted. Adapt the existing store mock to return both habits.

**Step 2: Implement ghost card rendering in CycleDeckColumn**

In the render loop for `habitEntries`, when `!isBudgeted`:

```typescript
{!entry.isBudgeted && (
  <GhostHabitCard
    habitId={entry.habitId}
    area={area}
    cycleId={cycleId}
  />
)}
```

**Step 3: Create GhostHabitCard component** (inline in CycleDeck.tsx)

```typescript
interface GhostHabitCardProps {
  habitId: string;
  area: Area;
  cycleId: string;
}

function GhostHabitCard({ habitId, area, cycleId }: GhostHabitCardProps) {
  const allHabits = useValue(habits$);
  const habit = allHabits[habitId];
  const cycleService = new CycleService();

  if (!habit) return null;

  const handleAdd = () => {
    cycleService.budgetHabitToCycle(cycleId, habitId, 1);
  };

  const handleRemove = () => {
    // No-op for x0 — the × is there for layout consistency
  };

  return (
    <div
      data-testid={`ghost-card-${habitId}`}
      className="relative opacity-40 w-full"
      style={{ paddingTop: "8px" }}
    >
      <div className="relative" style={{ zIndex: 1 }}>
        {/* Ghost card body — dashed border, area color */}
        <div
          className="rounded-lg border-2 border-dashed p-3 min-h-[64px] flex items-center gap-2"
          style={{ borderColor: area.color }}
        >
          {habit.emoji && (
            <span className="text-sm">{habit.emoji}</span>
          )}
          <span className="text-sm font-mono font-medium text-stone-500 dark:text-stone-400 truncate">
            {habit.name}
          </span>
        </div>

        {/* Badge: [×] x0 [+] */}
        <div
          className="absolute -top-2 -right-2 rounded-md bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-xs font-mono font-medium shadow-sm flex items-center gap-0.5 px-1 py-0.5"
          style={{ zIndex: 2 }}
        >
          <button
            type="button"
            onClick={handleRemove}
            className="p-0.5 rounded opacity-30 cursor-default"
            disabled
          >
            <X className="h-3 w-3" />
          </button>
          <span className="px-1">x0</span>
          <button
            type="button"
            onClick={handleAdd}
            className="p-0.5 rounded hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
            title="Add to cycle"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run tests**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 5: Commit**

```bash
git add src/components/CycleDeck.tsx src/components/__tests__/CycleDeck.test.tsx
git commit -m "feat: ghost cards for unbudgeted habits in cycle deck edit mode"
```

---

### Task 6: Remove `/plant` Navigation from CycleDeck

**Files:**
- Modify: `src/components/CycleDeck.tsx`

**Step 1: Remove the router import and navigation**

- Remove `import { useRouter } from "next/navigation";`
- Remove `const router = useRouter();`
- The pencil button already toggles edit mode (from Task 4), so no navigation code remains

**Step 2: Clean up test mocks**

In `CycleDeck.test.tsx`, remove the `next/navigation` mock if no longer needed.

**Step 3: Commit**

```bash
git add src/components/CycleDeck.tsx src/components/__tests__/CycleDeck.test.tsx
git commit -m "refactor: remove /plant navigation from CycleDeck, edit mode is now inline"
```

---

### Task 7: Final Integration Test

**Step 1: Run all tests**

Run: `pnpm vitest run`
Expected: All tests pass

**Step 2: Manual verification checklist**

- [ ] Open cultivate page with an active cycle
- [ ] CycleDeck shows in read-only mode (no controls)
- [ ] Click pencil → edit mode activates (pencil becomes checkmark)
- [ ] Count controls appear on stacks (+/-)
- [ ] Increment a habit → new moment appears, existing ones stay
- [ ] Decrement a habit → unallocated moment removed, allocated one stays
- [ ] Click eye icon → ghost cards appear for unbudgeted habits
- [ ] Click + on a ghost card → habit gets budgeted (x1)
- [ ] Click checkmark → back to read-only mode
- [ ] Habit stacks maintain stable order when counts change

**Step 3: Commit any fixes**

```bash
git commit -m "fix: integration fixes for inline cycle deck editor"
```
