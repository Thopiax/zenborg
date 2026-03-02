# CycleDeck Pane Redesign — Arrow Navigation, Inline Editing, Empty State

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the CycleDeck on the cultivate page as a proper pane with arrow-based cycle navigation, inline name/date editing in edit mode, labeled buttons, double-click collapse, and an empty state that shows all areas with ghost cards.

**Architecture:** Replace the current CycleDeck header with arrow navigation (← name →) through `getCurrentAndFutureCycles()`. Remove collapse chevron in favor of double-click on header. Add labeled text buttons ("Edit"/"Done"/"Show All"). In edit mode, header fields become editable inputs. Empty state renders area columns with ghost cards.

**Tech Stack:** Legend State observables, React, Vitest

---

## Design

### View Mode (read-only)
```
┌───────────────────────────────────────────────────┐
│ ← Barcelona Summer · 12 days left →     [Edit]   │
├───────────────────────────────────────────────────┤
│ 🟢 Wellness  │  🔵 Craft    │  🟠 Social         │
│ [stacks]     │  [stacks]    │  [stacks]           │
└───────────────────────────────────────────────────┘
  (double-click header to collapse)
```

- `←` disabled if first cycle in list
- `→` becomes `[+]` if no next cycle (creates new cycle)
- "Edit" button enters edit mode (only when pane is expanded)

### Edit Mode
```
┌───────────────────────────────────────────────────┐
│ [name input___] [01-01] → [04-01]                │
│                              [Show All] [✓ Done]  │
├───────────────────────────────────────────────────┤
│ 🟢 Wellness  │  🔵 Craft    │  🟠 Social         │
│ [stacks+/-]  │  [stacks+/-] │  [ghosts]           │
└───────────────────────────────────────────────────┘
```

- Arrow navigation hidden during edit mode
- Name becomes text input, dates become date inputs
- Persist on blur via `CycleService.updateCycle`
- "Show All" toggles ghost cards for unbudgeted habits
- "Done" exits edit mode

### Empty State (Edit Mode)
```
┌───────────────────────────────────────────────────┐
│ [name input___] [01-01] → [04-01]                │
│                              [Show All] [✓ Done]  │
├───────────────────────────────────────────────────┤
│ 🟢 Wellness       │  🔵 Craft          │         │
│ ┄ Morning Run ┄   │  ┄ Deep Work ┄     │         │
│   [x] x0 [+]      │    [x] x0 [+]      │         │
└───────────────────────────────────────────────────┘
```

- Instead of "No budgeted moments" dashed box
- Shows area columns for all areas that have habits
- Ghost cards for every non-archived habit in those areas

### Collapsed State
```
┌───────────────────────────────────────────────────┐
│ ← Barcelona Summer · 12 days left →     [Edit]   │
└───────────────────────────────────────────────────┘
  (double-click to expand)
```

- Edit button disabled/hidden when collapsed
- Double-click header bar to toggle collapse/expand

### Rules
- Cannot enter edit mode when collapsed
- Exiting edit mode resets `showAllHabits` to false
- Arrow navigation uses `CycleService.getCurrentAndFutureCycles()` (sorted chronologically)
- `→` at the last cycle triggers create-cycle flow (using `CycleFormDialog`)
- `←` at the first cycle is disabled (grayed out)

---

### Task 1: Arrow Navigation Header (Replace Tabs + Collapse Chevron)

**Files:**
- Modify: `src/components/CycleDeck.tsx`
- Modify: `src/components/__tests__/CycleDeck.test.tsx`
- Modify: `src/infrastructure/state/ui-store.ts` (add `cycleDeckSelectedCycleId$`)

**Step 1: Add UI store state for selected cycle**

In `ui-store.ts`, after `cycleDeckShowAllHabits$`, add:

```typescript
/**
 * Currently selected cycle ID for the CycleDeck pane
 * When null, defaults to the current cycle (containing today)
 * Ephemeral - not persisted
 */
export const cycleDeckSelectedCycleId$ = observable<string | null>(null);
```

**Step 2: Write failing tests**

Add to `CycleDeck.test.tsx`:

```typescript
describe("arrow navigation", () => {
  it("should show left and right arrow buttons", () => {
    mockCycleDeckValues(
      { "area-1": { "habit-1": [createTestMoment({ id: "1" })] } },
      { id: "cycle-1", name: "Barcelona Summer", endDate: "2026-04-01" },
      false, false, false,
    );

    render(<CycleDeck />);

    expect(screen.getByLabelText("Previous cycle")).toBeInTheDocument();
    // Right arrow or + button
    expect(screen.getByLabelText(/Next cycle|Create new cycle/)).toBeInTheDocument();
  });

  it("should collapse on double-click header", () => {
    mockCycleDeckValues(
      { "area-1": { "habit-1": [createTestMoment({ id: "1" })] } },
      { id: "cycle-1", name: "Test", endDate: "2026-04-01" },
      false, false, false,
    );

    render(<CycleDeck />);

    // The collapse chevron button should NOT exist
    expect(screen.queryByLabelText("Collapse cycle deck")).toBeNull();
  });
});
```

Note: Adapt mocks as needed. The key assertions are that arrow buttons exist and the collapse chevron is gone. The mock for `CycleService.getCurrentAndFutureCycles` needs to be set up to return the list of cycles for navigation.

**Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 4: Implement arrow navigation**

Rewrite the CycleDeck header:

1. Remove the collapse chevron button entirely
2. Add `onDoubleClick={toggleCollapsed}` to the header `<div>`
3. Replace `currentCycle$` usage with `cycleDeckSelectedCycleId$` + `getCurrentAndFutureCycles()`:

```typescript
const cyclesList = cycleService.getCurrentAndFutureCycles();
const selectedCycleId = useValue(cycleDeckSelectedCycleId$);

// Default to current cycle if no selection
const currentCycle = useValue(() => currentCycle$.get());
const effectiveCycleId = selectedCycleId || currentCycle?.id || null;
const effectiveCycle = cyclesList.find(c => c.id === effectiveCycleId) || null;
const currentIndex = effectiveCycle ? cyclesList.findIndex(c => c.id === effectiveCycle.id) : -1;

const hasPrev = currentIndex > 0;
const hasNext = currentIndex < cyclesList.length - 1;

const goToPrev = () => {
  if (hasPrev) cycleDeckSelectedCycleId$.set(cyclesList[currentIndex - 1].id);
};
const goToNext = () => {
  if (hasNext) {
    cycleDeckSelectedCycleId$.set(cyclesList[currentIndex + 1].id);
  } else {
    // Open create cycle dialog
    setCreateDialogOpen(true);
  }
};
```

Header JSX:

```typescript
<div
  className="px-6 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between cursor-default"
  onDoubleClick={toggleCollapsed}
>
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={goToPrev}
      disabled={!hasPrev}
      className="p-1 rounded text-stone-400 hover:text-stone-700 disabled:opacity-30 disabled:cursor-default transition-colors"
      aria-label="Previous cycle"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
    <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold">
      {deckTitle}
    </h2>
    <button
      type="button"
      onClick={goToNext}
      className="p-1 rounded text-stone-400 hover:text-stone-700 transition-colors"
      aria-label={hasNext ? "Next cycle" : "Create new cycle"}
    >
      {hasNext ? (
        <ChevronRight className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
    </button>
  </div>
  <div className="flex items-center gap-2">
    {/* Edit/Done and Show All buttons go here — only when not collapsed */}
    {!isCollapsed && (
      <>
        {isEditMode && (
          <button type="button" onClick={...} className="...">
            Show All
          </button>
        )}
        <button type="button" onClick={toggleEditMode} className="...">
          {isEditMode ? "Done" : "Edit"}
        </button>
      </>
    )}
  </div>
</div>
```

Import `ChevronLeft`, `ChevronRight`, `Plus` from lucide-react.

**Step 5: Add CycleFormDialog for creating new cycles**

Import and render `CycleFormDialog` at the bottom of CycleDeck (same pattern as CyclePane):

```typescript
const [createDialogOpen, setCreateDialogOpen] = useState(false);

// ... in JSX return:
<CycleFormDialog
  open={createDialogOpen}
  mode="create"
  initialStartDate={cycleService.getDefaultStartDate()}
  onClose={() => setCreateDialogOpen(false)}
  onSave={(name, templateDuration, startDate, endDate) => {
    const result = cycleService.planCycle(name, templateDuration, startDate, endDate ?? undefined);
    if (!("error" in result)) {
      cycleDeckSelectedCycleId$.set(result.id);
    }
    setCreateDialogOpen(false);
  }}
/>
```

**Step 6: Run tests**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 7: Commit**

```bash
git add src/components/CycleDeck.tsx src/components/__tests__/CycleDeck.test.tsx src/infrastructure/state/ui-store.ts
git commit -m "feat: arrow navigation header with double-click collapse and labeled buttons"
```

---

### Task 2: Inline Cycle Name Editing in Edit Mode

**Files:**
- Modify: `src/components/CycleDeck.tsx`
- Modify: `src/components/__tests__/CycleDeck.test.tsx`

**Step 1: Write failing tests**

```typescript
describe("inline cycle header editing", () => {
  it("should render name as input when edit mode is active", () => {
    mockCycleDeckValues(
      { "area-1": { "habit-1": [createTestMoment({ id: "1" })] } },
      { id: "cycle-1", name: "Barcelona Summer", endDate: "2026-04-01" },
      false, true, false,
    );

    render(<CycleDeck />);

    const nameInput = screen.getByDisplayValue("Barcelona Summer");
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.tagName).toBe("INPUT");
  });

  it("should render name as plain text when edit mode is off", () => {
    mockCycleDeckValues(
      { "area-1": { "habit-1": [createTestMoment({ id: "1" })] } },
      { id: "cycle-1", name: "Barcelona Summer", endDate: "2026-04-01" },
      false, false, false,
    );

    render(<CycleDeck />);

    expect(screen.getByText(/Barcelona Summer/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Barcelona Summer")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 3: Implement**

In edit mode, replace the `<h2>` with an `<input>`:

```typescript
const [editName, setEditName] = useState(effectiveCycle?.name || "");

useEffect(() => {
  if (effectiveCycle) setEditName(effectiveCycle.name);
}, [effectiveCycle?.name]);

const handleNameBlur = () => {
  if (!effectiveCycleId || editName.trim() === effectiveCycle?.name) return;
  cycleService.updateCycle(effectiveCycleId, { name: editName.trim() });
};
```

In edit mode, the header replaces `<h2>` and arrows with:

```typescript
{isEditMode ? (
  <input
    type="text"
    value={editName}
    onChange={(e) => setEditName(e.target.value)}
    onBlur={handleNameBlur}
    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
    className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold bg-transparent border-b border-stone-300 dark:border-stone-600 focus:border-stone-500 outline-none px-0 py-0"
    aria-label="Cycle name"
  />
) : (
  /* arrows + h2 from Task 1 */
)}
```

Arrow navigation is hidden during edit mode (already handled by the conditional).

**Step 4: Run tests**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 5: Commit**

```bash
git add src/components/CycleDeck.tsx src/components/__tests__/CycleDeck.test.tsx
git commit -m "feat: inline editable cycle name in edit mode"
```

---

### Task 3: Inline Cycle Date Editing in Edit Mode

**Files:**
- Modify: `src/components/CycleDeck.tsx`
- Modify: `src/components/__tests__/CycleDeck.test.tsx`

**Step 1: Write failing test**

```typescript
it("should render date inputs when edit mode is active", () => {
  mockCycleDeckValues(
    { "area-1": { "habit-1": [createTestMoment({ id: "1" })] } },
    { id: "cycle-1", name: "Test", startDate: "2026-01-01", endDate: "2026-04-01" },
    false, true, false,
  );

  render(<CycleDeck />);

  expect(screen.getByLabelText("Start date")).toBeInTheDocument();
  expect(screen.getByLabelText("End date")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 3: Implement date inputs**

```typescript
const [editStartDate, setEditStartDate] = useState(effectiveCycle?.startDate || "");
const [editEndDate, setEditEndDate] = useState(effectiveCycle?.endDate || "");

useEffect(() => {
  if (effectiveCycle) {
    setEditStartDate(effectiveCycle.startDate);
    setEditEndDate(effectiveCycle.endDate || "");
  }
}, [effectiveCycle?.startDate, effectiveCycle?.endDate]);

const handleDateBlur = () => {
  if (!effectiveCycleId) return;
  cycleService.updateCycle(effectiveCycleId, {
    startDate: editStartDate,
    endDate: editEndDate || null,
  });
};
```

In edit mode header, next to the name input:

```typescript
<div className="flex items-center gap-1.5 text-xs font-mono text-stone-500">
  <input
    type="date"
    value={editStartDate}
    onChange={(e) => setEditStartDate(e.target.value)}
    onBlur={handleDateBlur}
    className="bg-transparent border-b border-stone-300 dark:border-stone-600 focus:border-stone-500 outline-none px-0 py-0 text-xs font-mono text-stone-600 dark:text-stone-400"
    aria-label="Start date"
  />
  <span className="text-stone-400">→</span>
  <input
    type="date"
    value={editEndDate}
    onChange={(e) => setEditEndDate(e.target.value)}
    onBlur={handleDateBlur}
    className="bg-transparent border-b border-stone-300 dark:border-stone-600 focus:border-stone-500 outline-none px-0 py-0 text-xs font-mono text-stone-600 dark:text-stone-400"
    aria-label="End date"
  />
</div>
```

**Step 4: Run tests**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 5: Commit**

```bash
git add src/components/CycleDeck.tsx src/components/__tests__/CycleDeck.test.tsx
git commit -m "feat: inline editable cycle dates in edit mode"
```

---

### Task 4: Empty State Shows All Areas in Edit Mode

**Files:**
- Modify: `src/components/CycleDeck.tsx`
- Modify: `src/components/__tests__/CycleDeck.test.tsx`

**Step 1: Write failing test**

```typescript
describe("empty state in edit mode", () => {
  it("should show area columns with ghost cards instead of empty message", () => {
    mockCycleDeckValues(
      {},  // no budgeted moments
      { id: "cycle-1", name: "Test", startDate: "2026-01-01", endDate: "2026-04-01" },
      false, true, false,
      {
        "habit-1": { id: "habit-1", name: "Morning Run", areaId: "area-1", isArchived: false, order: 0 },
        "habit-2": { id: "habit-2", name: "Deep Work", areaId: "area-2", isArchived: false, order: 0 },
      },
    );

    render(<CycleDeck />);

    expect(screen.queryByText(/No budgeted moments/)).toBeNull();
    expect(screen.getByTestId("ghost-card-habit-1")).toBeInTheDocument();
    expect(screen.getByTestId("ghost-card-habit-2")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 3: Implement**

Change the empty state condition in `CycleDeck()`:

```typescript
// Current:
if (allDeckMoments.length === 0) { return (/* empty state */); }

// New:
if (allDeckMoments.length === 0 && !isEditMode) {
  return (/* existing empty state — unchanged */);
}

if (allDeckMoments.length === 0 && isEditMode) {
  const allHabitsMap = habits$.get();
  const allAreasMap = areas$.get();

  const areaIdsWithHabits = new Set(
    Object.values(allHabitsMap)
      .filter((h) => !h.isArchived)
      .map((h) => h.areaId)
  );

  const areasToShow = Object.values(allAreasMap)
    .filter((a) => areaIdsWithHabits.has(a.id))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="w-full border-t-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex-shrink-0">
      {header}
      {!isCollapsed && (
        <div className="flex gap-4 overflow-x-auto px-6 py-4 snap-x snap-mandatory scroll-smooth">
          {areasToShow.map((area) => (
            <CycleDeckColumn
              key={area.id}
              area={area}
              habitMoments={{}}
              isEditMode={true}
              showAllHabits={true}
              cycleId={effectiveCycleId!}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Add `areas$` to the store import.

**Step 4: Run tests**

Run: `pnpm vitest run src/components/__tests__/CycleDeck.test.tsx`

**Step 5: Commit**

```bash
git add src/components/CycleDeck.tsx src/components/__tests__/CycleDeck.test.tsx
git commit -m "feat: empty state shows all areas with ghost cards in edit mode"
```

---

### Task 5: Final Integration Test

**Step 1: Run all tests**

Run: `pnpm vitest run`
Expected: All tests pass

**Step 2: Manual verification checklist**

- [ ] Arrow nav: ← goes to previous cycle, → goes to next
- [ ] → on last cycle opens create-cycle dialog
- [ ] ← disabled on first cycle
- [ ] Double-click header collapses/expands the pane
- [ ] Edit button hidden when collapsed
- [ ] Edit mode: name becomes editable input
- [ ] Edit mode: date inputs appear (start → end)
- [ ] Blur on name/date → persists via CycleService
- [ ] "Show All" button shows ghost cards for unbudgeted habits
- [ ] "Done" exits edit mode
- [ ] Empty deck + edit mode → area columns with ghost cards
- [ ] Click + on ghost card → habit budgeted, deck populates

**Step 3: Commit any fixes**

```bash
git commit -m "fix: integration fixes for cycle deck pane redesign"
```
