# Areas, Attitudes, and Habits Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add attitudes (relationship modes), habits (recurring templates), and tags to Areas for emergent structure in attention allocation.

**Architecture:** Domain-first approach. Extend Area entity with attitude/tags, create new Habit entity, modify Moment to reference habits. Two-phase UI (Planning for structure, Committing for allocation) with keyboard-first interactions.

**Tech Stack:** TypeScript, Legend State, React, Tailwind CSS, Vitest

---

## Task 1: Extend Area Entity with Attitude and Tags

**Files:**
- Modify: `src/domain/entities/Area.ts`
- Modify: `src/domain/value-objects/Attitude.ts`
- Test: `src/domain/__tests__/Area.test.ts`

**Step 1: Write failing test for Area with attitude and tags**

Add to `src/domain/__tests__/Area.test.ts` after existing tests:

```typescript
describe("Area with Attitude and Tags", () => {
  it("should create area with attitude and tags", () => {
    const area = createArea("Fitness", "#10b981", "🏋️", 0);
    if ("error" in area) throw new Error(area.error);

    const updated = updateArea(area, {
      attitude: Attitude.BUILDING,
      tags: ["wellness", "physical"],
    });

    if ("error" in updated) throw new Error(updated.error);

    expect(updated.attitude).toBe(Attitude.BUILDING);
    expect(updated.tags).toEqual(["wellness", "physical"]);
  });

  it("should allow null attitude (pure presence)", () => {
    const area = createArea("Reading", "#6b7280", "📚", 0);
    if ("error" in area) throw new Error(area.error);

    expect(area.attitude).toBeNull();
  });

  it("should normalize tags to lowercase", () => {
    const area = createArea("Mindfulness", "#10b981", "🧘", 0);
    if ("error" in area) throw new Error(area.error);

    const updated = updateArea(area, {
      tags: ["Wellness", "MENTAL", "Self-Care"],
    });

    if ("error" in updated) throw new Error(updated.error);

    expect(updated.tags).toEqual(["wellness", "mental", "self-care"]);
  });
});
```

**Step 2: Run tests to verify failure**

```bash
npm test -- src/domain/__tests__/Area.test.ts
```

Expected: FAIL - `attitude` and `tags` properties don't exist on Area interface

**Step 3: Extend Area interface with attitude and tags**

In `src/domain/entities/Area.ts`, modify the `Area` interface:

```typescript
import { Attitude } from "../value-objects/Attitude";

export interface Area {
  readonly id: string;
  name: string;
  attitude: Attitude | null; // NEW: Default relationship mode
  tags: string[];            // NEW: Meta-grouping tags
  color: string;
  emoji: string;
  isDefault: boolean;
  isArchived: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}
```

**Step 4: Update DEFAULT_AREAS with new fields**

In `src/domain/entities/Area.ts`, modify `DEFAULT_AREAS`:

```typescript
export const DEFAULT_AREAS: Omit<Area, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Wellness",
    attitude: null,
    tags: [],
    color: "#10b981",
    emoji: "🧘",
    isDefault: true,
    isArchived: false,
    order: 0,
  },
  {
    name: "Craft",
    attitude: null,
    tags: [],
    color: "#3b82f6",
    emoji: "🎨",
    isDefault: true,
    isArchived: false,
    order: 1,
  },
  {
    name: "Social",
    attitude: null,
    tags: [],
    color: "#f97316",
    emoji: "🤝",
    isDefault: true,
    isArchived: false,
    order: 2,
  },
  {
    name: "Joyful",
    attitude: null,
    tags: [],
    color: "#eab308",
    emoji: "😄",
    isDefault: true,
    isArchived: false,
    order: 3,
  },
  {
    name: "Introspective",
    attitude: null,
    tags: [],
    color: "#6b7280",
    emoji: "🤔",
    isDefault: true,
    isArchived: false,
    order: 4,
  },
  {
    name: "Chore",
    attitude: null,
    tags: [],
    color: "#8b5cf6",
    emoji: "🧹",
    isDefault: true,
    isArchived: false,
    order: 5,
  },
];
```

**Step 5: Add tag normalization helper**

In `src/domain/entities/Area.ts`, add before `createArea`:

```typescript
/**
 * Normalizes tag to lowercase with hyphens
 */
function normalizeAreaTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}
```

**Step 6: Update createArea to include new fields**

In `src/domain/entities/Area.ts`, modify `createArea`:

```typescript
export function createArea(
  name: string,
  color: string,
  emoji: string,
  order: number,
  attitude: Attitude | null = null,
  tags: string[] = []
): AreaResult {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { error: "Area name cannot be empty" };
  }

  if (!color.match(/^#[0-9a-fA-F]{6}$/)) {
    return { error: "Color must be a valid hex code (e.g., #10b981)" };
  }

  if (!emoji.trim()) {
    return { error: "Emoji cannot be empty" };
  }

  if (order < 0) {
    return { error: "Order must be non-negative" };
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    attitude,
    tags: tags.map(normalizeAreaTag),
    color: color.toLowerCase(),
    emoji: emoji.trim(),
    isDefault: false,
    isArchived: false,
    order,
    createdAt: now,
    updatedAt: now,
  };
}
```

**Step 7: Update updateArea to support attitude and tags**

In `src/domain/entities/Area.ts`, modify `updateArea`:

```typescript
export function updateArea(
  area: Area,
  updates: Partial<Pick<Area, "name" | "color" | "emoji" | "order" | "attitude" | "tags">>
): AreaResult {
  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    if (!trimmedName) {
      return { error: "Area name cannot be empty" };
    }
  }

  if (updates.color !== undefined) {
    if (!updates.color.match(/^#[0-9a-fA-F]{6}$/)) {
      return { error: "Color must be a valid hex code (e.g., #10b981)" };
    }
  }

  if (updates.emoji !== undefined) {
    if (!updates.emoji.trim()) {
      return { error: "Emoji cannot be empty" };
    }
  }

  if (updates.order !== undefined) {
    if (updates.order < 0) {
      return { error: "Order must be non-negative" };
    }
  }

  return {
    ...area,
    ...updates,
    name: updates.name ? updates.name.trim() : area.name,
    color: updates.color ? updates.color.toLowerCase() : area.color,
    emoji: updates.emoji ? updates.emoji.trim() : area.emoji,
    tags: updates.tags ? updates.tags.map(normalizeAreaTag) : area.tags,
    updatedAt: new Date().toISOString(),
  };
}
```

**Step 8: Run tests to verify they pass**

```bash
npm test -- src/domain/__tests__/Area.test.ts
```

Expected: PASS - All area tests including new attitude/tags tests

**Step 9: Commit**

```bash
git add src/domain/entities/Area.ts src/domain/__tests__/Area.test.ts
git commit -m "feat: add attitude and tags to Area entity

- Add attitude field (nullable) for relationship mode
- Add tags array for meta-grouping
- Normalize tags to lowercase with hyphens
- Update DEFAULT_AREAS with new fields
- Update createArea and updateArea functions
- Add tests for attitude and tags

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create Habit Entity

**Files:**
- Create: `src/domain/entities/Habit.ts`
- Create: `src/domain/__tests__/Habit.test.ts`

**Step 1: Write failing tests for Habit entity**

Create `src/domain/__tests__/Habit.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createHabit,
  updateHabit,
  archiveHabit,
  unarchiveHabit,
  type Habit,
} from "../entities/Habit";
import { Attitude } from "../value-objects/Attitude";

describe("Habit", () => {
  describe("createHabit", () => {
    it("should create habit with required fields", () => {
      const habit = createHabit("Running", "area-123", 0);

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.id).toBeDefined();
      expect(habit.name).toBe("Running");
      expect(habit.areaId).toBe("area-123");
      expect(habit.attitude).toBeNull();
      expect(habit.tags).toEqual([]);
      expect(habit.emoji).toBeNull();
      expect(habit.isArchived).toBe(false);
      expect(habit.order).toBe(0);
      expect(habit.createdAt).toBeDefined();
      expect(habit.updatedAt).toBeDefined();
    });

    it("should create habit with attitude and tags", () => {
      const habit = createHabit(
        "Meditation",
        "area-456",
        1,
        Attitude.BUILDING,
        ["mindfulness", "daily"]
      );

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.attitude).toBe(Attitude.BUILDING);
      expect(habit.tags).toEqual(["mindfulness", "daily"]);
    });

    it("should create habit with custom emoji", () => {
      const habit = createHabit("Yoga", "area-789", 2, null, [], "🧘");

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.emoji).toBe("🧘");
    });

    it("should enforce 1-3 word limit on name", () => {
      const valid = createHabit("Morning Run", "area-123", 0);
      expect("error" in valid).toBe(false);

      const tooLong = createHabit("My Very Long Habit Name", "area-123", 0);
      expect("error" in tooLong).toBe(true);
      if ("error" in tooLong) {
        expect(tooLong.error).toContain("3 words");
      }
    });

    it("should normalize tags to lowercase", () => {
      const habit = createHabit("Running", "area-123", 0, null, [
        "Cardio",
        "OUTDOOR",
        "Morning-Run",
      ]);

      if ("error" in habit) throw new Error(habit.error);

      expect(habit.tags).toEqual(["cardio", "outdoor", "morning-run"]);
    });

    it("should require non-empty name", () => {
      const result = createHabit("", "area-123", 0);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("empty");
      }
    });

    it("should require valid areaId", () => {
      const result = createHabit("Running", "", 0);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("areaId");
      }
    });
  });

  describe("updateHabit", () => {
    it("should update habit name", () => {
      const habit = createHabit("Running", "area-123", 0);
      if ("error" in habit) throw new Error(habit.error);

      const updated = updateHabit(habit, { name: "Jogging" });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.name).toBe("Jogging");
      expect(updated.updatedAt).not.toBe(habit.updatedAt);
    });

    it("should update attitude", () => {
      const habit = createHabit("Meditation", "area-456", 0);
      if ("error" in habit) throw new Error(habit.error);

      const updated = updateHabit(habit, { attitude: Attitude.PUSHING });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.attitude).toBe(Attitude.PUSHING);
    });

    it("should update tags", () => {
      const habit = createHabit("Yoga", "area-789", 0);
      if ("error" in habit) throw new Error(habit.error);

      const updated = updateHabit(habit, { tags: ["flexibility", "strength"] });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.tags).toEqual(["flexibility", "strength"]);
    });

    it("should update emoji", () => {
      const habit = createHabit("Guitar", "area-123", 0);
      if ("error" in habit) throw new Error(habit.error);

      const updated = updateHabit(habit, { emoji: "🎸" });

      if ("error" in updated) throw new Error(updated.error);

      expect(updated.emoji).toBe("🎸");
    });

    it("should validate name length on update", () => {
      const habit = createHabit("Running", "area-123", 0);
      if ("error" in habit) throw new Error(habit.error);

      const result = updateHabit(habit, {
        name: "This Name Is Way Too Long For A Habit",
      });

      expect("error" in result).toBe(true);
    });
  });

  describe("archiveHabit", () => {
    it("should archive habit", () => {
      const habit = createHabit("Old Habit", "area-123", 0);
      if ("error" in habit) throw new Error(habit.error);

      const archived = archiveHabit(habit);

      expect(archived.isArchived).toBe(true);
      expect(archived.updatedAt).not.toBe(habit.updatedAt);
    });
  });

  describe("unarchiveHabit", () => {
    it("should unarchive habit", () => {
      const habit = createHabit("Restored Habit", "area-123", 0);
      if ("error" in habit) throw new Error(habit.error);

      const archived = archiveHabit(habit);
      const unarchived = unarchiveHabit(archived);

      expect(unarchived.isArchived).toBe(false);
      expect(unarchived.updatedAt).not.toBe(archived.updatedAt);
    });
  });
});
```

**Step 2: Run tests to verify failure**

```bash
npm test -- src/domain/__tests__/Habit.test.ts
```

Expected: FAIL - Module `../entities/Habit` not found

**Step 3: Create Habit entity**

Create `src/domain/entities/Habit.ts`:

```typescript
import { Attitude } from "../value-objects/Attitude";

/**
 * Habit - Recurring moment template
 *
 * Habits represent patterns that emerge from repeated moments.
 * Users create habits from patterns or proactively in Planning phase.
 * Habits provide structure while preserving organic moment creation.
 */
export interface Habit {
  readonly id: string;
  name: string; // 1-3 words
  areaId: string; // FK to Area (required parent)
  attitude: Attitude | null; // Override Area's attitude if set
  tags: string[]; // Attributes for filtering (e.g., "cardio", "outdoor")
  emoji: string | null; // Optional override of Area emoji
  isArchived: boolean; // Soft delete
  order: number; // Display order within attitude section
  createdAt: string;
  updatedAt: string;
}

/**
 * Result type for operations that may fail
 */
export type HabitResult = Habit | { error: string };

/**
 * Validates habit name (1-3 words)
 */
function validateHabitName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: "Habit name cannot be empty" };
  }

  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);

  if (words.length < 1) {
    return { valid: false, error: "Habit name must contain at least 1 word" };
  }

  if (words.length > 3) {
    return {
      valid: false,
      error: "Habit name cannot exceed 3 words",
    };
  }

  return { valid: true };
}

/**
 * Normalizes tag to lowercase with hyphens
 */
function normalizeHabitTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/\s+/g, "-");
}

/**
 * Creates a new habit
 */
export function createHabit(
  name: string,
  areaId: string,
  order: number,
  attitude: Attitude | null = null,
  tags: string[] = [],
  emoji: string | null = null
): HabitResult {
  const validation = validateHabitName(name);
  if (!validation.valid) {
    return { error: validation.error! };
  }

  if (!areaId || !areaId.trim()) {
    return { error: "Habit must have an areaId" };
  }

  if (order < 0) {
    return { error: "Order must be non-negative" };
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    areaId: areaId.trim(),
    attitude,
    tags: tags.map(normalizeHabitTag),
    emoji: emoji ? emoji.trim() : null,
    isArchived: false,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Updates habit properties
 */
export function updateHabit(
  habit: Habit,
  updates: Partial<
    Pick<Habit, "name" | "attitude" | "tags" | "emoji" | "order">
  >
): HabitResult {
  if (updates.name !== undefined) {
    const validation = validateHabitName(updates.name);
    if (!validation.valid) {
      return { error: validation.error! };
    }
  }

  if (updates.order !== undefined && updates.order < 0) {
    return { error: "Order must be non-negative" };
  }

  return {
    ...habit,
    ...updates,
    name: updates.name ? updates.name.trim() : habit.name,
    tags: updates.tags ? updates.tags.map(normalizeHabitTag) : habit.tags,
    emoji: updates.emoji !== undefined ? (updates.emoji ? updates.emoji.trim() : null) : habit.emoji,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Archives a habit (soft delete)
 */
export function archiveHabit(habit: Habit): Habit {
  return {
    ...habit,
    isArchived: true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Unarchives a habit
 */
export function unarchiveHabit(habit: Habit): Habit {
  return {
    ...habit,
    isArchived: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Type guard to check if result is an error
 */
export function isHabitError(result: HabitResult): result is { error: string } {
  return "error" in result;
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- src/domain/__tests__/Habit.test.ts
```

Expected: PASS - All habit tests pass

**Step 5: Commit**

```bash
git add src/domain/entities/Habit.ts src/domain/__tests__/Habit.test.ts
git commit -m "feat: create Habit entity

- Add Habit interface with areaId, attitude, tags, emoji
- Enforce 1-3 word name constraint (like Moments)
- Support attitude override (inherits from Area if not set)
- Tag normalization to lowercase with hyphens
- Soft delete with isArchived flag
- Comprehensive tests for CRUD operations

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add habitId to Moment Entity

**Files:**
- Modify: `src/domain/entities/Moment.ts`
- Modify: `src/domain/__tests__/Moment.test.ts`

**Step 1: Write failing test for Moment with habitId**

Add to `src/domain/__tests__/Moment.test.ts` in createMoment section:

```typescript
it("should create moment with habitId (linked to habit)", () => {
  const moment = createMoment({
    name: "Morning Run",
    areaId: "area-123",
    habitId: "habit-456",
  });

  if ("error" in moment) throw new Error(moment.error);

  expect(moment.habitId).toBe("habit-456");
  expect(moment.areaId).toBe("area-123");
});

it("should create orphaned moment (no habitId)", () => {
  const moment = createMoment({
    name: "One Time Thing",
    areaId: "area-123",
  });

  if ("error" in moment) throw new Error(moment.error);

  expect(moment.habitId).toBeNull();
});
```

**Step 2: Run tests to verify failure**

```bash
npm test -- src/domain/__tests__/Moment.test.ts
```

Expected: FAIL - `habitId` property doesn't exist on CreateMomentProps

**Step 3: Add habitId to Moment interface**

In `src/domain/entities/Moment.ts`, modify `Moment` interface:

```typescript
export interface Moment {
  readonly id: string;
  name: string;
  areaId: string;
  habitId: string | null; // NEW: Optional link to Habit (emergent structure)
  phase: Phase | null;
  day: string | null;
  order: number;
  horizon: Horizon | null;

  // Attitudes & Tags (Phase 2 features)
  attitude: Attitude | null; // Will be removed in next task
  customMetric?: CustomMetric;
  tags: string[] | null;

  createdAt: string;
  updatedAt: string;
}
```

**Step 4: Add habitId to CreateMomentProps**

In `src/domain/entities/Moment.ts`, modify `CreateMomentProps`:

```typescript
export interface CreateMomentProps {
  name: string;
  areaId: string;
  habitId?: string | null; // NEW: Optional link to habit
  horizon?: Horizon | null;
  phase?: Phase | null;
  attitude?: Attitude | null;
  tags?: string[];
  customMetric?: CustomMetric;
}
```

**Step 5: Update createMoment to handle habitId**

In `src/domain/entities/Moment.ts`, modify `createMoment`:

```typescript
export function createMoment(props: CreateMomentProps): MomentResult {
  const {
    name,
    areaId,
    habitId = null, // NEW: Default to null (orphaned)
    horizon = null,
    phase = null,
    attitude = null,
    tags = [],
    customMetric,
  } = props;

  const validation = validateMomentName(name);

  if (!validation.valid) {
    return { error: validation.error! };
  }

  if (!areaId || !areaId.trim()) {
    return { error: "Moment must have an areaId" };
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    areaId: areaId.trim(),
    habitId: habitId ? habitId.trim() : null, // NEW: Trim or null
    phase,
    day: null,
    order: 0,
    horizon,
    attitude,
    customMetric,
    tags: tags.filter(validateTag),
    createdAt: now,
    updatedAt: now,
  };
}
```

**Step 6: Run tests to verify they pass**

```bash
npm test -- src/domain/__tests__/Moment.test.ts
```

Expected: PASS - All moment tests including new habitId tests

**Step 7: Commit**

```bash
git add src/domain/entities/Moment.ts src/domain/__tests__/Moment.test.ts
git commit -m "feat: add habitId to Moment entity

- Add optional habitId field (nullable)
- Support linking moments to habits (emergent structure)
- Default to null for orphaned moments
- Update CreateMomentProps interface
- Add tests for habit-linked and orphaned moments

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Remove attitude from Moment (Move to Habit/Area)

**Files:**
- Modify: `src/domain/entities/Moment.ts`
- Modify: `src/domain/__tests__/Moment.test.ts`

**Step 1: Remove attitude-related tests from Moment**

In `src/domain/__tests__/Moment.test.ts`, delete or comment out tests related to:
- `setMomentAttitude`
- `setMomentCustomMetric`
- `clearMomentCustomMetric`

Keep `customMetric` in interface for now (will be used via Habit attitude).

**Step 2: Remove attitude field from Moment interface**

In `src/domain/entities/Moment.ts`, modify `Moment` interface:

```typescript
export interface Moment {
  readonly id: string;
  name: string;
  areaId: string;
  habitId: string | null;
  phase: Phase | null;
  day: string | null;
  order: number;
  horizon: Horizon | null;

  // REMOVED: attitude field (now on Habit/Area)
  customMetric?: CustomMetric; // Keep for PUSHING habit support
  tags: string[] | null;

  createdAt: string;
  updatedAt: string;
}
```

**Step 3: Remove attitude from CreateMomentProps**

In `src/domain/entities/Moment.ts`:

```typescript
export interface CreateMomentProps {
  name: string;
  areaId: string;
  habitId?: string | null;
  horizon?: Horizon | null;
  phase?: Phase | null;
  // REMOVED: attitude
  tags?: string[];
  customMetric?: CustomMetric;
}
```

**Step 4: Remove attitude from createMoment**

In `src/domain/entities/Moment.ts`, modify `createMoment`:

```typescript
export function createMoment(props: CreateMomentProps): MomentResult {
  const {
    name,
    areaId,
    habitId = null,
    horizon = null,
    phase = null,
    tags = [],
    customMetric, // Keep for habit-inherited PUSHING support
  } = props;

  // ... validation ...

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    areaId: areaId.trim(),
    habitId: habitId ? habitId.trim() : null,
    phase,
    day: null,
    order: 0,
    horizon,
    // REMOVED: attitude
    customMetric,
    tags: tags.filter(validateTag),
    createdAt: now,
    updatedAt: now,
  };
}
```

**Step 5: Remove attitude management functions**

In `src/domain/entities/Moment.ts`, delete:
- `SetMomentAttitudeProps` interface
- `setMomentAttitude` function
- Related exports

Keep `customMetric` functions for now (used when habit has PUSHING attitude).

**Step 6: Run tests to verify they pass**

```bash
npm test -- src/domain/__tests__/Moment.test.ts
```

Expected: PASS - Tests pass without attitude-related tests

**Step 7: Commit**

```bash
git add src/domain/entities/Moment.ts src/domain/__tests__/Moment.test.ts
git commit -m "refactor: remove attitude from Moment entity

Attitude now lives at Habit/Area level (pattern, not instance).
Moments inherit attitude via: habit?.attitude ?? area?.attitude ?? null

- Remove attitude field from Moment interface
- Remove attitude from CreateMomentProps
- Remove setMomentAttitude functions
- Keep customMetric for PUSHING habit support
- Delete attitude-related tests

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Add Habits to Legend State Store

**Files:**
- Modify: `src/infrastructure/state/store.ts`
- Create: `src/infrastructure/state/__tests__/habits-store.test.ts`

**Step 1: Write failing tests for habits in store**

Create `src/infrastructure/state/__tests__/habits-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { clearStore, initializeStore } from "../initialize";
import { store$ } from "../store";
import { Attitude } from "../../../domain/value-objects/Attitude";

describe("Habits Store", () => {
  beforeEach(async () => {
    await clearStore();
    await initializeStore();
  });

  it("should start with empty habits array", () => {
    const habits = store$.habits.get();
    expect(habits).toEqual([]);
  });

  it("should add habit to store", () => {
    const habit = {
      id: "habit-1",
      name: "Running",
      areaId: "area-1",
      attitude: Attitude.BUILDING,
      tags: ["cardio", "outdoor"],
      emoji: "🏃",
      isArchived: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store$.habits.set([habit]);

    const habits = store$.habits.get();
    expect(habits).toHaveLength(1);
    expect(habits[0].name).toBe("Running");
  });

  it("should update habit in store", () => {
    const habit = {
      id: "habit-1",
      name: "Running",
      areaId: "area-1",
      attitude: Attitude.BUILDING,
      tags: ["cardio"],
      emoji: "🏃",
      isArchived: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store$.habits.set([habit]);

    const updatedHabit = {
      ...habit,
      attitude: Attitude.PUSHING,
      tags: ["cardio", "outdoor"],
      updatedAt: new Date().toISOString(),
    };

    store$.habits.set([updatedHabit]);

    const habits = store$.habits.get();
    expect(habits[0].attitude).toBe(Attitude.PUSHING);
    expect(habits[0].tags).toEqual(["cardio", "outdoor"]);
  });

  it("should archive habit", () => {
    const habit = {
      id: "habit-1",
      name: "Old Habit",
      areaId: "area-1",
      attitude: null,
      tags: [],
      emoji: null,
      isArchived: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store$.habits.set([habit]);

    const archivedHabit = { ...habit, isArchived: true };
    store$.habits.set([archivedHabit]);

    const habits = store$.habits.get();
    expect(habits[0].isArchived).toBe(true);
  });
});
```

**Step 2: Run tests to verify failure**

```bash
npm test -- src/infrastructure/state/__tests__/habits-store.test.ts
```

Expected: FAIL - `habits` property doesn't exist on store

**Step 3: Add Habit type import to store**

In `src/infrastructure/state/store.ts`, add import:

```typescript
import type { Habit } from "../../domain/entities/Habit";
```

**Step 4: Add habits observable to store**

In `src/infrastructure/state/store.ts`, add to `store$` definition:

```typescript
export const store$ = observable({
  // Existing observables
  moments: [] as Moment[],
  areas: [] as Area[],
  cycles: [] as Cycle[],
  crystallizedRoutines: [] as CrystallizedRoutine[],
  metricLogs: [] as MetricLog[],
  historyEntries: [] as HistoryEntry[],
  phaseConfigs: [] as PhaseConfig[],

  // NEW: Habits observable
  habits: [] as Habit[],

  // UI state...
  vimMode: /* ... */,
  // ... rest of store
});
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- src/infrastructure/state/__tests__/habits-store.test.ts
```

Expected: PASS - All habits store tests pass

**Step 6: Commit**

```bash
git add src/infrastructure/state/store.ts src/infrastructure/state/__tests__/habits-store.test.ts
git commit -m "feat: add habits observable to Legend State store

- Add habits array to store observable
- Import Habit type from domain
- Add tests for habit CRUD in store
- Verify habit archiving works

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Create Habit Service Layer

**Files:**
- Create: `src/application/services/HabitService.ts`
- Create: `src/application/__tests__/HabitService.test.ts`

**Step 1: Write failing tests for HabitService**

Create `src/application/__tests__/HabitService.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { clearStore, initializeStore } from "../../infrastructure/state/initialize";
import { store$ } from "../../infrastructure/state/store";
import {
  createHabitInStore,
  updateHabitInStore,
  archiveHabitInStore,
  getHabitById,
  getHabitsByArea,
  getHabitsByAttitude,
} from "../services/HabitService";
import { Attitude } from "../../domain/value-objects/Attitude";

describe("HabitService", () => {
  beforeEach(async () => {
    await clearStore();
    await initializeStore();

    // Create test area
    store$.areas.set([
      {
        id: "area-1",
        name: "Wellness",
        attitude: null,
        tags: [],
        color: "#10b981",
        emoji: "🧘",
        isDefault: true,
        isArchived: false,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  });

  describe("createHabitInStore", () => {
    it("should create habit and add to store", () => {
      const result = createHabitInStore({
        name: "Running",
        areaId: "area-1",
        attitude: Attitude.BUILDING,
        tags: ["cardio"],
        emoji: "🏃",
      });

      if ("error" in result) throw new Error(result.error);

      const habits = store$.habits.get();
      expect(habits).toHaveLength(1);
      expect(habits[0].name).toBe("Running");
      expect(habits[0].attitude).toBe(Attitude.BUILDING);
    });

    it("should return error for invalid name", () => {
      const result = createHabitInStore({
        name: "This Is Way Too Many Words",
        areaId: "area-1",
      });

      expect("error" in result).toBe(true);
    });
  });

  describe("updateHabitInStore", () => {
    it("should update habit in store", () => {
      const created = createHabitInStore({
        name: "Meditation",
        areaId: "area-1",
      });
      if ("error" in created) throw new Error(created.error);

      const result = updateHabitInStore(created.id, {
        attitude: Attitude.PUSHING,
        tags: ["mindfulness", "daily"],
      });

      if ("error" in result) throw new Error(result.error);

      const habits = store$.habits.get();
      expect(habits[0].attitude).toBe(Attitude.PUSHING);
      expect(habits[0].tags).toEqual(["mindfulness", "daily"]);
    });

    it("should return error if habit not found", () => {
      const result = updateHabitInStore("nonexistent", { name: "Test" });

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("not found");
      }
    });
  });

  describe("archiveHabitInStore", () => {
    it("should archive habit", () => {
      const created = createHabitInStore({
        name: "Old Habit",
        areaId: "area-1",
      });
      if ("error" in created) throw new Error(created.error);

      const result = archiveHabitInStore(created.id);

      if ("error" in result) throw new Error(result.error);

      const habits = store$.habits.get();
      expect(habits[0].isArchived).toBe(true);
    });
  });

  describe("getHabitById", () => {
    it("should get habit by id", () => {
      const created = createHabitInStore({
        name: "Yoga",
        areaId: "area-1",
      });
      if ("error" in created) throw new Error(created.error);

      const habit = getHabitById(created.id);
      expect(habit?.name).toBe("Yoga");
    });

    it("should return undefined if not found", () => {
      const habit = getHabitById("nonexistent");
      expect(habit).toBeUndefined();
    });
  });

  describe("getHabitsByArea", () => {
    it("should get habits for area", () => {
      createHabitInStore({ name: "Running", areaId: "area-1" });
      createHabitInStore({ name: "Yoga", areaId: "area-1" });

      const habits = getHabitsByArea("area-1");
      expect(habits).toHaveLength(2);
    });

    it("should exclude archived habits by default", () => {
      const created = createHabitInStore({ name: "Running", areaId: "area-1" });
      if ("error" in created) throw new Error(created.error);
      archiveHabitInStore(created.id);

      const habits = getHabitsByArea("area-1");
      expect(habits).toHaveLength(0);
    });

    it("should include archived habits when requested", () => {
      const created = createHabitInStore({ name: "Running", areaId: "area-1" });
      if ("error" in created) throw new Error(created.error);
      archiveHabitInStore(created.id);

      const habits = getHabitsByArea("area-1", true);
      expect(habits).toHaveLength(1);
    });
  });

  describe("getHabitsByAttitude", () => {
    it("should get habits with specific attitude", () => {
      createHabitInStore({
        name: "Running",
        areaId: "area-1",
        attitude: Attitude.BUILDING,
      });
      createHabitInStore({
        name: "Meditation",
        areaId: "area-1",
        attitude: Attitude.PUSHING,
      });

      const buildingHabits = getHabitsByAttitude(Attitude.BUILDING);
      expect(buildingHabits).toHaveLength(1);
      expect(buildingHabits[0].name).toBe("Running");
    });

    it("should get habits with null attitude", () => {
      createHabitInStore({
        name: "Reading",
        areaId: "area-1",
        attitude: null,
      });

      const purePresenceHabits = getHabitsByAttitude(null);
      expect(purePresenceHabits).toHaveLength(1);
    });
  });
});
```

**Step 2: Run tests to verify failure**

```bash
npm test -- src/application/__tests__/HabitService.test.ts
```

Expected: FAIL - Module `../services/HabitService` not found

**Step 3: Create HabitService**

Create `src/application/services/HabitService.ts`:

```typescript
import { store$ } from "../../infrastructure/state/store";
import {
  createHabit,
  updateHabit,
  archiveHabit as archiveHabitDomain,
  isHabitError,
  type Habit,
  type HabitResult,
} from "../../domain/entities/Habit";
import { Attitude } from "../../domain/value-objects/Attitude";

/**
 * Props for creating habit in store
 */
export interface CreateHabitProps {
  name: string;
  areaId: string;
  attitude?: Attitude | null;
  tags?: string[];
  emoji?: string | null;
}

/**
 * Creates habit and adds to store
 */
export function createHabitInStore(props: CreateHabitProps): HabitResult {
  const { name, areaId, attitude = null, tags = [], emoji = null } = props;

  // Get current habits to determine order
  const currentHabits = store$.habits.get();
  const order = currentHabits.length;

  const result = createHabit(name, areaId, order, attitude, tags, emoji);

  if (isHabitError(result)) {
    return result;
  }

  // Add to store
  store$.habits.set([...currentHabits, result]);

  return result;
}

/**
 * Updates habit in store
 */
export function updateHabitInStore(
  habitId: string,
  updates: Partial<Pick<Habit, "name" | "attitude" | "tags" | "emoji" | "order">>
): HabitResult {
  const habits = store$.habits.get();
  const habit = habits.find((h) => h.id === habitId);

  if (!habit) {
    return { error: "Habit not found" };
  }

  const result = updateHabit(habit, updates);

  if (isHabitError(result)) {
    return result;
  }

  // Update in store
  store$.habits.set(habits.map((h) => (h.id === habitId ? result : h)));

  return result;
}

/**
 * Archives habit in store
 */
export function archiveHabitInStore(habitId: string): HabitResult {
  const habits = store$.habits.get();
  const habit = habits.find((h) => h.id === habitId);

  if (!habit) {
    return { error: "Habit not found" };
  }

  const archived = archiveHabitDomain(habit);

  // Update in store
  store$.habits.set(habits.map((h) => (h.id === habitId ? archived : h)));

  return archived;
}

/**
 * Gets habit by ID
 */
export function getHabitById(habitId: string): Habit | undefined {
  const habits = store$.habits.get();
  return habits.find((h) => h.id === habitId);
}

/**
 * Gets all habits for an area
 */
export function getHabitsByArea(
  areaId: string,
  includeArchived = false
): Habit[] {
  const habits = store$.habits.get();
  return habits.filter(
    (h) => h.areaId === areaId && (includeArchived || !h.isArchived)
  );
}

/**
 * Gets habits by attitude
 */
export function getHabitsByAttitude(
  attitude: Attitude | null,
  includeArchived = false
): Habit[] {
  const habits = store$.habits.get();
  return habits.filter(
    (h) => h.attitude === attitude && (includeArchived || !h.isArchived)
  );
}

/**
 * Gets all active (non-archived) habits
 */
export function getActiveHabits(): Habit[] {
  const habits = store$.habits.get();
  return habits.filter((h) => !h.isArchived);
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- src/application/__tests__/HabitService.test.ts
```

Expected: PASS - All habit service tests pass

**Step 5: Commit**

```bash
git add src/application/services/HabitService.ts src/application/__tests__/HabitService.test.ts
git commit -m "feat: create HabitService for habit management

- Add createHabitInStore with validation
- Add updateHabitInStore with error handling
- Add archiveHabitInStore
- Add query functions: getHabitById, getHabitsByArea, getHabitsByAttitude
- Comprehensive tests for all operations

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Next Steps

**Implementation continues with:**

- Task 7: Create Planning Phase UI components
- Task 8: Create Committing Phase deck UI
- Task 9: Attitude resolution logic (habit → area → null)
- Task 10: Mobile landscape layouts
- Task 11: Keyboard shortcuts (Cmd+K, Cmd+P, etc.)
- Task 12: Crystallization flow (BEING → CrystallizedRoutine)

**Estimated remaining effort:** ~5-7 sprints (Tasks 7-12)

---

## Testing Strategy

**Unit Tests:**
- Domain entities: Area, Habit (✅ Complete in Tasks 1-2)
- Services: HabitService (✅ Complete in Task 6)
- UI components: Planning phase, habit decks (Tasks 7-8)

**Integration Tests:**
- Attitude resolution: habit?.attitude ?? area?.attitude ?? null (Task 9)
- Phase switching: Planning ↔ Committing (Task 7-8)
- Habit deck → moment creation (Task 8)

**E2E Tests (Future):**
- Full Planning phase workflow
- Habit deck interaction
- Crystallization flow

---

## Deployment Notes

**Schema Migration:**
- Area: Add `attitude`, `tags` fields (nullable/default)
- Habit: New table/collection
- Moment: Add `habitId` (nullable), remove `attitude`

**Backward Compatibility:**
- Existing moments remain valid (orphaned)
- Areas get default `attitude: null`, `tags: []`
- No data loss, additive changes only

---

**Plan Status:** ✅ Foundation tasks complete (1-6). UI tasks (7-12) ready for implementation.
