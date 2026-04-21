# Active vs Future Cycle Visual Distinction — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the active cycle feel "live" and prominent while future cycles recede visually.

**Architecture:** Pure UI change in `CycleDeck.tsx`. The boolean `isEffectiveCycleActive` (line 148) already distinguishes active from future. We add conditional Tailwind classes for header text weight/color, top border thickness, content opacity, a "Planned" label, and disable droppable for future cycles.

**Tech Stack:** React, Tailwind CSS, Vitest + Testing Library

---

### Task 1: Add tests for active vs future cycle visual distinction

**Files:**
- Modify: `src/components/__tests__/CycleDeck.test.tsx`

**Step 1: Write failing tests for future cycle styling**

Add a new `describe("active vs future cycle distinction")` block at the end of the test file (before the final closing `});`):

```tsx
describe("active vs future cycle distinction", () => {
  const futureCycle = {
    id: "cycle-2",
    name: "Next Sprint",
    startDate: "2027-01-01",
    endDate: "2027-02-01",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("should show 'Planned' label when viewing a future cycle", () => {
    mockGetCurrentAndFutureCycles.mockReturnValue([testCycle, futureCycle]);

    const deckMoments = {
      "area-1": {
        "habit-1": [createTestMoment({ id: "1" })],
      },
    };

    // selectedCycleId = futureCycle.id (navigated away from active)
    mockCycleDeckValues(
      deckMoments,
      testCycle,    // activeCycle is still testCycle
      false,
      false,
      {},
      futureCycle.id, // but we're viewing futureCycle
    );

    render(<CycleDeck />);

    expect(screen.getByText("Planned")).toBeInTheDocument();
  });

  it("should NOT show 'Planned' label when viewing the active cycle", () => {
    mockGetCurrentAndFutureCycles.mockReturnValue([testCycle]);

    const deckMoments = {
      "area-1": {
        "habit-1": [createTestMoment({ id: "1" })],
      },
    };

    mockCycleDeckValues(deckMoments, testCycle);

    render(<CycleDeck />);

    expect(screen.queryByText("Planned")).toBeNull();
  });

  it("should apply muted styling to future cycle header name", () => {
    mockGetCurrentAndFutureCycles.mockReturnValue([testCycle, futureCycle]);

    const deckMoments = {
      "area-1": {
        "habit-1": [createTestMoment({ id: "1" })],
      },
    };

    mockCycleDeckValues(
      deckMoments,
      testCycle,
      false,
      false,
      {},
      futureCycle.id,
    );

    render(<CycleDeck />);

    const heading = screen.getByText("Next Sprint");
    expect(heading.className).toContain("font-medium");
    expect(heading.className).toContain("text-stone-400");
  });

  it("should apply bold styling to active cycle header name", () => {
    mockGetCurrentAndFutureCycles.mockReturnValue([testCycle]);

    const deckMoments = {
      "area-1": {
        "habit-1": [createTestMoment({ id: "1" })],
      },
    };

    mockCycleDeckValues(deckMoments, testCycle);

    render(<CycleDeck />);

    const heading = screen.getByText("Barcelona Summer");
    expect(heading.className).toContain("font-semibold");
    expect(heading.className).toContain("text-stone-900");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`
Expected: FAIL — "Planned" text not found, class assertions fail

**Step 3: Commit failing tests**

```bash
git add src/components/__tests__/CycleDeck.test.tsx
git commit -m "test: add failing tests for active vs future cycle distinction"
```

---

### Task 2: Apply header styling distinction

**Files:**
- Modify: `src/components/CycleDeck.tsx` (lines 158-263, the `header` const)

**Step 1: Update header container top border**

In `CycleDeck.tsx`, find the outer `<div>` wrapper (line 408 for the main return, line 298 for empty-edit, line 338 for empty-readonly). Each has `border-t-2 border-stone-200 dark:border-stone-700`. Make the border conditional on `isEffectiveCycleActive`:

Replace every occurrence of `border-t-2 border-stone-200 dark:border-stone-700` (3 places) with:

```tsx
{cn(
  "w-full bg-stone-50 dark:bg-stone-900 flex-shrink-0",
  isEffectiveCycleActive
    ? "border-t-2 border-stone-300 dark:border-stone-600"
    : "border-t border-stone-200 dark:border-stone-700"
)}
```

**Step 2: Update cycle name text styling**

In the view-mode header (line 211), replace the static `h2` classes:

```tsx
// Before:
<h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold truncate leading-tight">

// After:
<h2 className={cn(
  "text-sm font-mono truncate leading-tight",
  isEffectiveCycleActive
    ? "text-stone-900 dark:text-stone-100 font-semibold"
    : "text-stone-400 dark:text-stone-500 font-medium"
)}>
```

**Step 3: Update subtitle text styling**

In the subtitle `<p>` (line 215), make it conditional:

```tsx
// Before:
<p className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate leading-tight">

// After:
<p className={cn(
  "text-xs font-mono truncate leading-tight",
  isEffectiveCycleActive
    ? "text-stone-600 dark:text-stone-400"
    : "text-stone-400 dark:text-stone-500"
)}>
```

**Step 4: Run tests**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`
Expected: Header styling tests pass, "Planned" label test still fails

**Step 5: Commit**

```bash
git add src/components/CycleDeck.tsx
git commit -m "feat: differentiate header styling for active vs future cycles"
```

---

### Task 3: Apply content area distinction (opacity, "Planned" label, disable drop)

**Files:**
- Modify: `src/components/CycleDeck.tsx`

**Step 1: Add "Planned" label above content when viewing future cycle**

In the content area (around line 418, inside the `!isCollapsed` block), add a "Planned" label before the columns:

```tsx
{!isCollapsed && (
  <div
    ref={isEffectiveCycleActive ? setNodeRef : undefined}
    className={cn(
      "relative transition-colors",
      isEffectiveCycleActive && isOver && "bg-stone-100/50 dark:bg-stone-800/50",
      !isEffectiveCycleActive && "opacity-60",
    )}
  >
    {/* "Planned" label for future cycles */}
    {!isEffectiveCycleActive && (
      <div className="px-6 pt-3">
        <span className="text-stone-400 text-xs font-mono">Planned</span>
      </div>
    )}

    {/* Drop indicator — only for active cycle */}
    {isEffectiveCycleActive && isOver && (
      <div className="absolute inset-0 pointer-events-none ...">
        {/* existing drop overlay */}
      </div>
    )}

    {renderColumns(isEditMode ? allAreasForEdit : areasWithMoments)}
  </div>
)}
```

Key changes:
- `ref={isEffectiveCycleActive ? setNodeRef : undefined}` — disable droppable for future
- `!isEffectiveCycleActive && "opacity-60"` — mute future content
- Guard `isOver` overlay with `isEffectiveCycleActive` — no drop UI for future
- Add "Planned" label `<div>` for future cycles

Apply the same `opacity-60` and disabled droppable to the empty states (lines 298 and 338).

**Step 2: Run all tests**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`
Expected: All tests pass including "Planned" label tests

**Step 3: Commit**

```bash
git add src/components/CycleDeck.tsx
git commit -m "feat: add opacity, Planned label, and disable drop for future cycles"
```

---

### Task 4: Final verification

**Step 1: Run full test suite**

Run: `pnpm vitest run`
Expected: All tests pass

**Step 2: Commit any remaining changes and verify clean state**

```bash
git status
```
