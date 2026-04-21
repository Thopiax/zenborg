# UI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three UI issues: (1) Areas panel auto-scrolls during habit drag on Plant page, (2) no drag preview when dragging from CycleDeck in Cultivate, (3) CycleDeck has no collapse toggle or hotkey.

**Architecture:** All three fixes are self-contained. Issue 1 tunes `DndContext`'s `autoScroll` threshold in `plant/page.tsx`. Issue 2 fixes the `activeId` lookup in `DnDProvider.tsx` by extracting the real moment ID from drag event data. Issue 3 adds a `cycleDeckCollapsed$` observable to `ui-store.ts`, a chevron toggle button to `CycleDeck.tsx`, height animation in `cultivate/page.tsx`, and a `p` key hotkey entry in `view-commands.ts` (mirroring how the drawing board toggle already works).

**Tech Stack:** Next.js 15, `@dnd-kit/core`, `@legendapp/state`, `react-hotkeys-hook`, Tailwind CSS 4, Lucide icons.

---

## Task 1: Fix Plant page — Areas panel no longer auto-scrolls during drag

**Problem:** When dragging a habit downward toward the Cycle panel in Plant page, the Areas panel (which has `overflow-y-auto`) auto-scrolls because dnd-kit detects the pointer near the container edge.

**Fix:** Add `autoScroll` config to the `DndContext` in Plant page. Raise the scroll threshold so it only triggers very close to the edge (5% from edge instead of 20%), and lower the acceleration so it doesn't yank the scroll position.

**Files:**
- Modify: `src/app/plant/page.tsx:259-263`

**Step 1: Add `autoScroll` prop to `DndContext`**

In `src/app/plant/page.tsx`, find the `<DndContext` opening tag (line ~259) and add the `autoScroll` prop:

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={customCollisionDetection}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  autoScroll={{
    threshold: {
      x: 0.05, // 5% from horizontal edge (default is 0.2)
      y: 0.05, // 5% from vertical edge — prevents premature scroll
    },
    acceleration: 5, // Slow acceleration (default is 10)
    interval: 5,     // ms between scroll steps (default is 5, lower = smoother)
  }}
>
```

**Step 2: Verify in browser**

1. Open Plant page
2. Drag a habit card slowly downward toward the Cycle panel
3. Confirm the Areas section does NOT scroll while dragging
4. Confirm the Cycle panel area still scrolls if you hover very near its inner edge

**Step 3: Commit**

```bash
git add src/app/plant/page.tsx
git commit -m "fix: reduce auto-scroll sensitivity during habit drag on Plant page"
```

---

## Task 2: Fix Cultivate — Drag preview shows when dragging from CycleDeck

**Problem:** `MomentStack` registers draggables with id `"stack-${topMoment.id}"`. In `DnDProvider`, `handleDragStart` stores this full string as `activeId`. The overlay then does `allMoments[activeId]` which looks up `allMoments["stack-abc123"]` — not a real moment ID — so `activeMoment` is `null` and nothing renders.

The drag data _already_ contains the real moment ID: `event.active.data.current.momentId`. We just need to use it.

**Files:**
- Modify: `src/components/DnDProvider.tsx:124-132` (handleDragStart)

**Step 1: Update `handleDragStart` to extract the real moment ID**

Find `handleDragStart` in `src/components/DnDProvider.tsx` (line ~124):

```typescript
// BEFORE:
function handleDragStart(event: DragStartEvent) {
  const id = event.active.id as string;
  setActiveId(id);
  // @ts-expect-error - activatorEvent contains the original mouse/pointer event
  const altKeyPressed = event.activatorEvent?.altKey || false;
  isDuplicateMode$.set(altKeyPressed);
}
```

Replace with:

```typescript
// AFTER:
function handleDragStart(event: DragStartEvent) {
  const id = event.active.id as string;
  // MomentStack uses "stack-{momentId}" as draggable id but stores the real
  // momentId in data.current.momentId. Use that for the overlay lookup so
  // allMoments[activeId] resolves correctly.
  const momentId = (event.active.data.current as { momentId?: string })?.momentId ?? id;
  setActiveId(momentId);
  // @ts-expect-error - activatorEvent contains the original mouse/pointer event
  const altKeyPressed = event.activatorEvent?.altKey || false;
  isDuplicateMode$.set(altKeyPressed);
}
```

**Step 2: Verify in browser**

1. Open Cultivate page with an active cycle that has budgeted moments in the CycleDeck
2. Drag a MomentStack card from the CycleDeck upward toward the Timeline
3. Confirm a drag preview (MomentCard) follows the cursor
4. Confirm dropping it into a Timeline cell still works correctly
5. Confirm dragging regular timeline moments still shows a preview (regression check)

**Step 3: Commit**

```bash
git add src/components/DnDProvider.tsx
git commit -m "fix: show drag preview when dragging MomentStack from CycleDeck to Timeline"
```

---

## Task 3: Add CycleDeck collapse toggle with hotkey

**What:** The CycleDeck in Cultivate needs a collapse/expand button in its header (matching how DrawingBoard works) and a `p` hotkey to toggle it — BUT `p` is already used for "Toggle Planning View" (the drawing board). Since only one of CycleDeck or DrawingBoard is visible at a time, we can reuse `p` to toggle whichever panel is currently shown.

**Files:**
- Modify: `src/infrastructure/state/ui-store.ts` — add `cycleDeckCollapsed$`
- Modify: `src/components/CycleDeck.tsx` — add chevron toggle button
- Modify: `src/app/cultivate/page.tsx` — read collapse state, apply height
- Modify: `src/commands/view-commands.ts` — update `p` hotkey to handle both panels

### Step 3a: Add `cycleDeckCollapsed$` to ui-store

In `src/infrastructure/state/ui-store.ts`, after the `drawingBoardExpanded$` declaration (line ~58), add:

```typescript
/**
 * Cycle deck collapsed state
 * Controls whether the CycleDeck panel is visible or collapsed
 * Ephemeral - not persisted (matches drawing board pattern)
 */
export const cycleDeckCollapsed$ = observable<boolean>(false);
```

**Commit:**
```bash
git add src/infrastructure/state/ui-store.ts
git commit -m "feat: add cycleDeckCollapsed$ observable to ui-store"
```

### Step 3b: Add toggle button to CycleDeck header

In `src/components/CycleDeck.tsx`:

1. Add imports at the top:
```typescript
import { ChevronDown, ChevronUp } from "lucide-react";
import { useValue } from "@legendapp/state/react";
import { cycleDeckCollapsed$ } from "@/infrastructure/state/ui-store";
```

2. Inside the `CycleDeck` function, add:
```typescript
const isCollapsed = useValue(cycleDeckCollapsed$);
const toggleCollapsed = () => cycleDeckCollapsed$.set(!cycleDeckCollapsed$.peek());
```

3. In the header `<div>` (the one with `px-6 py-3 border-b`), add a toggle button next to the title. Replace the existing header `<div>` in the non-empty render path (line ~93):

```tsx
{/* Header */}
<div className="px-6 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
  <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold">
    {deckTitle}
  </h2>
  <button
    type="button"
    onClick={toggleCollapsed}
    className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
    title={isCollapsed ? "Expand cycle deck (p)" : "Collapse cycle deck (p)"}
    aria-label={isCollapsed ? "Expand cycle deck" : "Collapse cycle deck"}
  >
    {isCollapsed ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )}
  </button>
</div>
```

4. Also update the **empty state** header to include the same toggle button (the `<div className="px-6 py-3 border-b ...">` at line ~62):

```tsx
<div className="px-6 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
  <h2 className="text-sm font-mono text-stone-900 dark:text-stone-100 font-semibold">
    {deckTitle}
  </h2>
  <button
    type="button"
    onClick={toggleCollapsed}
    className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
    title={isCollapsed ? "Expand cycle deck (p)" : "Collapse cycle deck (p)"}
    aria-label={isCollapsed ? "Expand cycle deck" : "Collapse cycle deck"}
  >
    {isCollapsed ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )}
  </button>
</div>
```

**Important:** Move the `isCollapsed` / `toggleCollapsed` declarations above the early return for the empty state, so both branches can use them.

**Commit:**
```bash
git add src/components/CycleDeck.tsx
git commit -m "feat: add collapse toggle button to CycleDeck header"
```

### Step 3c: Apply collapse in Cultivate page

In `src/app/cultivate/page.tsx`, read the collapsed state and apply it to the CycleDeck wrapper:

1. Add import:
```typescript
import { cycleDeckCollapsed$ } from "@/infrastructure/state/ui-store";
```

2. Add reactive read near other `useValue` calls:
```typescript
const isCycleDeckCollapsed = useValue(cycleDeckCollapsed$);
```

3. Find the CycleDeck wrapper div (line ~110):
```tsx
{/* Cycle Deck (current cycle) or Drawing Board (no cycle) */}
<div className="flex-shrink-0">
  {currentCycle ? <CycleDeck /> : <DrawingBoard />}
</div>
```

Replace with:
```tsx
{/* Cycle Deck (current cycle) or Drawing Board (no cycle) */}
<div
  className={cn(
    "flex-shrink-0 overflow-hidden transition-all duration-200 ease-in-out",
    currentCycle && isCycleDeckCollapsed ? "max-h-[52px]" : "max-h-[600px]"
  )}
>
  {currentCycle ? <CycleDeck /> : <DrawingBoard />}
</div>
```

> `max-h-[52px]` is enough to show just the header (~52px = py-3 * 2 + text + border). `max-h-[600px]` is a generous upper bound that accommodates content without cutting it off. The `transition-all duration-200` gives a smooth collapse animation.

**Commit:**
```bash
git add src/app/cultivate/page.tsx
git commit -m "feat: apply CycleDeck collapse state in Cultivate page with animation"
```

### Step 3d: Update `p` hotkey to handle both CycleDeck and DrawingBoard

The existing `p` shortcut in `view-commands.ts` only toggles `drawingBoardExpanded$`. Update it so:
- When CycleDeck is visible (active cycle exists): toggle `cycleDeckCollapsed$`
- When DrawingBoard is visible (no cycle): toggle `drawingBoardExpanded$`

In `src/commands/view-commands.ts`:

1. Add imports:
```typescript
import { cycleDeckCollapsed$, drawingBoardExpanded$, isCommandPaletteOpen$ } from "@/infrastructure/state/ui-store";
import { currentCycle$ } from "@/infrastructure/state/store";
```

2. Update the `view.planning.toggle` command action:
```typescript
{
  id: "view.planning.toggle",
  label: "Toggle Planning Panel",
  shortcut: "p",
  category: "Views",
  keywords: ["show", "hide", "board", "drawing", "cycle", "deck", "collapse"],
  action: () => {
    const cycle = currentCycle$.peek();
    if (cycle) {
      // CycleDeck is visible — toggle its collapsed state
      cycleDeckCollapsed$.set(!cycleDeckCollapsed$.peek());
    } else {
      // DrawingBoard is visible — toggle its expanded state
      drawingBoardExpanded$.set(!drawingBoardExpanded$.peek());
    }
  }
},
```

**Commit:**
```bash
git add src/commands/view-commands.ts
git commit -m "feat: make p hotkey toggle CycleDeck or DrawingBoard depending on active cycle"
```

### Step 3e: Verify end-to-end

1. Open Cultivate with an active cycle
2. Confirm CycleDeck shows fully by default
3. Press `p` — confirm CycleDeck collapses with animation showing only the header
4. Press `p` again — confirm it expands
5. Click the chevron button in the header — confirm it also toggles
6. Navigate to a day with no active cycle (or temporarily remove cycle)
7. Confirm `p` still toggles the DrawingBoard as before
8. Confirm dragging moments still works when CycleDeck is collapsed (the drag overlay is portal-rendered, so it should be unaffected)

---

## Summary

| Task | File(s) | Type |
|------|---------|------|
| 1. Fix auto-scroll | `plant/page.tsx` | Config tweak |
| 2. Fix drag preview | `DnDProvider.tsx` | Bug fix (1 line) |
| 3a. Add observable | `ui-store.ts` | New state |
| 3b. Add toggle button | `CycleDeck.tsx` | UI |
| 3c. Apply collapse | `cultivate/page.tsx` | Layout |
| 3d. Update hotkey | `view-commands.ts` | Command |
