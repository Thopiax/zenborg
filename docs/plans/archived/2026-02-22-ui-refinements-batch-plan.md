# UI Refinements Batch - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix four UI issues: timeline day navigation, cycle builder stack jitter, missing area options menu, and area gallery centering.

**Architecture:** Four independent changes across presentation layer. Timeline gets state-driven expand/collapse. MomentStack gets stable layout. PlanAreaCard removes a guard. AreaGallery adds centering.

**Tech Stack:** React, Tailwind CSS, Vitest + @testing-library/react, lucide-react icons.

---

### Task 1: MomentStack - Stable Height When Controls Present

**Files:**
- Modify: `src/components/MomentStack.tsx:78-83`
- Modify: `src/components/__tests__/MomentStack.test.tsx`

**Step 1: Write the failing test**

Add a test to `src/components/__tests__/MomentStack.test.tsx` inside the existing `describe("MomentStack")` block, as a new describe section:

```tsx
describe("stable height with controls", () => {
  it("should reserve fixed padding-top when controls are provided, regardless of count", () => {
    const singleMoment = [createTestMoment({ id: "1", name: "Running" })];

    const { container } = render(
      <MomentStack
        moments={singleMoment}
        area={testArea}
        onIncrement={() => {}}
        onDecrement={() => {}}
        onRemove={() => {}}
      />
    );

    // Even with 1 moment (no visual layers), padding-top should be reserved
    const draggable = container.querySelector("[data-draggable]");
    expect(draggable).toHaveStyle({ paddingTop: "8px" });
  });

  it("should keep same padding-top for multiple moments with controls", () => {
    const moments = [
      createTestMoment({ id: "1" }),
      createTestMoment({ id: "2" }),
      createTestMoment({ id: "3" }),
    ];

    const { container } = render(
      <MomentStack
        moments={moments}
        area={testArea}
        onIncrement={() => {}}
        onDecrement={() => {}}
        onRemove={() => {}}
      />
    );

    const draggable = container.querySelector("[data-draggable]");
    expect(draggable).toHaveStyle({ paddingTop: "8px" });
  });

  it("should NOT reserve padding when no controls provided", () => {
    const singleMoment = [createTestMoment({ id: "1" })];

    const { container } = render(
      <MomentStack moments={singleMoment} area={testArea} />
    );

    const draggable = container.querySelector("[data-draggable]");
    expect(draggable).toHaveStyle({ paddingTop: "0px" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/__tests__/MomentStack.test.tsx`
Expected: FAIL - the single-moment-with-controls case will have `paddingTop: 0` instead of `8px`.

**Step 3: Write minimal implementation**

In `src/components/MomentStack.tsx`, replace the dynamic `paddingTop` calculation (line ~78-83):

Change:
```tsx
style={{
  opacity: isDragging ? 0.5 : 1,
  cursor: isDragging ? "grabbing" : "grab",
  // Add padding to top to accommodate the stack layers above
  paddingTop: showLayers ? `${behindLayerCount * 4}px` : 0,
}}
```

To:
```tsx
style={{
  opacity: isDragging ? 0.5 : 1,
  cursor: isDragging ? "grabbing" : "grab",
  // Reserve fixed padding when controls present (prevents jitter on count change)
  // Without controls, use dynamic padding based on actual layers
  paddingTop: hasControls
    ? "8px"
    : showLayers
      ? `${behindLayerCount * 4}px`
      : 0,
}}
```

And add the `hasControls` derived value near line 59:
```tsx
const hasControls = !!(onIncrement || onDecrement || onRemove);
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/__tests__/MomentStack.test.tsx`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/MomentStack.tsx src/components/__tests__/MomentStack.test.tsx
git commit -m "fix: stabilize MomentStack height when controls present"
```

---

### Task 2: Remove Default Area Guard from PlanAreaCard

**Files:**
- Modify: `src/components/PlanAreaCard.tsx:214`

**Step 1: Make the change**

In `src/components/PlanAreaCard.tsx`, remove the `{!area.isDefault && (` conditional wrapper around the `DropdownMenu` block (lines 214 and 235).

Replace:
```tsx
{!area.isDefault && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      ...
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        onSelect={() => onArchiveArea(area.id)}
        className="text-red-600 dark:text-red-400"
      >
        <Archive className="w-4 h-4 mr-2" />
        Archive Area
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

With (remove the conditional, keep the dropdown):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button
      type="button"
      className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
      aria-label="Area settings"
    >
      <MoreVertical className="w-4 h-4 text-stone-500 dark:text-stone-400" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem
      onSelect={() => onArchiveArea(area.id)}
      className="text-red-600 dark:text-red-400"
    >
      <Archive className="w-4 h-4 mr-2" />
      Archive Area
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Step 2: Verify existing tests still pass**

Run: `pnpm vitest run`
Expected: ALL PASS (no existing tests for this guard)

**Step 3: Commit**

```bash
git add src/components/PlanAreaCard.tsx
git commit -m "fix: show options menu on all area cards, not just non-default"
```

---

### Task 3: Center Area Gallery

**Files:**
- Modify: `src/components/AreaGallery.tsx:182`

**Step 1: Make the change**

In `src/components/AreaGallery.tsx`, change line 182:

From:
```tsx
<div className="flex flex-wrap gap-4">
```

To:
```tsx
<div className="flex flex-wrap gap-4 justify-center">
```

**Step 2: Verify existing tests still pass**

Run: `pnpm vitest run`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/components/AreaGallery.tsx
git commit -m "style: center area gallery cards"
```

---

### Task 4: Timeline Navigation Buttons

**Files:**
- Modify: `src/components/Timeline.tsx`

**Step 1: Add state and button rendering to Timeline.tsx**

In `src/components/Timeline.tsx`, make these changes:

**a) Add import for ChevronLeft, ChevronRight from lucide-react:**

```tsx
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";
```

**b) Add state inside the `Timeline` component (after line 134):**

```tsx
const [daysBefore, setDaysBefore] = useState(1);
const [daysAfter, setDaysAfter] = useState(1);
```

**c) Replace the static `getExtendedTimelineDays(1, 1)` call (line 131) with dynamic state:**

```tsx
const timelineDays = getExtendedTimelineDays(daysBefore, daysAfter);
```

**d) Add handler functions after the state declarations:**

```tsx
const handleLoadEarlier = () => {
  setDaysBefore((prev) => prev + 3);
};

const handleLoadLater = () => {
  setDaysAfter((prev) => prev + 3);
};

const isExpanded = daysBefore > 1 || daysAfter > 1;
```

**e) Add "Load Earlier" button before the day map (inside the scroll container, before `{timelineDays.map(...)}`:**

```tsx
{/* Load Earlier Button */}
<button
  type="button"
  onClick={handleLoadEarlier}
  className={cn(
    "flex-shrink-0 flex flex-col items-center justify-center gap-1",
    "px-3 py-4 rounded-md",
    "text-stone-400 dark:text-stone-500",
    "hover:text-stone-600 dark:hover:text-stone-400",
    "hover:bg-stone-100 dark:hover:bg-stone-800",
    "transition-colors font-mono text-xs",
    "min-w-[60px]"
  )}
  aria-label="Load 3 earlier days"
>
  <ChevronLeft className="w-4 h-4" />
  <span>Earlier</span>
</button>
```

**f) Add "Load Later" button after the day map (replace the existing spacer `<div className="w-16 flex-shrink-0" />`):**

```tsx
{/* Load Later Button */}
<button
  type="button"
  onClick={handleLoadLater}
  className={cn(
    "flex-shrink-0 flex flex-col items-center justify-center gap-1",
    "px-3 py-4 rounded-md",
    "text-stone-400 dark:text-stone-500",
    "hover:text-stone-600 dark:hover:text-stone-400",
    "hover:bg-stone-100 dark:hover:bg-stone-800",
    "transition-colors font-mono text-xs",
    "min-w-[60px]"
  )}
  aria-label="Load 3 later days"
>
  <ChevronRight className="w-4 h-4" />
  <span>Later</span>
</button>
```

**g) Add "Back to Today" floating pill (inside the return, before the scroll container div):**

```tsx
{/* Back to Today indicator - shown when expanded beyond default range */}
{isExpanded && (
  <button
    type="button"
    onClick={() => {
      setDaysBefore(1);
      setDaysAfter(1);
      // Scroll back to today after state updates
      setTimeout(scrollToActiveDay, 100);
    }}
    className={cn(
      "absolute top-2 left-1/2 -translate-x-1/2 z-10",
      "px-3 py-1 rounded-full",
      "bg-stone-800 dark:bg-stone-200",
      "text-white dark:text-stone-900",
      "text-xs font-mono font-medium",
      "shadow-md hover:shadow-lg",
      "transition-all duration-150",
      "hover:scale-105"
    )}
  >
    Today
  </button>
)}
```

Note: The outer container div needs `relative` added to its className for the absolute positioning of the pill. Change the container's className to include `relative`:

```tsx
className={cn(
  "relative w-full h-full flex overflow-x-scroll snap-x snap-mandatory scroll-smooth scrollbar-hide",
  ...
)}
```

**Step 2: Verify existing tests still pass**

Run: `pnpm vitest run`
Expected: ALL PASS

**Step 3: Manual verification**

Open the app in browser. Verify:
- "Earlier" and "Later" buttons appear at the scroll edges
- Clicking "Earlier" adds 3 past days
- Clicking "Later" adds 3 future days
- "Today" pill appears when expanded
- Clicking "Today" resets to default 3-day view and scrolls to today

**Step 4: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: add timeline day navigation buttons with expand/collapse"
```

---

### Task 5: Final Verification

**Step 1: Run full test suite**

Run: `pnpm vitest run`
Expected: ALL PASS

**Step 2: Verify no lint errors**

Run: `pnpm biome check src/components/Timeline.tsx src/components/MomentStack.tsx src/components/PlanAreaCard.tsx src/components/AreaGallery.tsx`
Expected: No errors
