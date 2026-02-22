# Horizontal Layout for /plant Page

**Date:** 2026-02-22
**Status:** Approved

## Problem

The /plant page uses a vertical split (AreaGallery top 60%, CyclePane bottom 40%). Budgeting habits to cycles is a comparison activity — you want "supply" (areas/habits) and "demand" (cycle deck) visible side by side. The vertical layout forces scrolling between two full-width panels, wasting horizontal space.

## Solution

Flip the panel direction from vertical to horizontal: AreaGallery on the left, CyclePane on the right. This creates a natural L→R budgeting flow.

## Layout

```
┌─────────────────────────┐┌───────────────────────────┐
│  Area Gallery (45%)     ││  Cycle Pane (55%)         │
│  Responsive grid of     ││  Cycle tabs + deck builder│
│  area cards — wraps     ││  Horizontal-scrolling     │
│  to fewer columns in    ││  grouped columns inside   │
│  narrower panel         ││                           │
│  (scrolls vertically)   ││  (scrolls vertically)     │
└─────────────────────────┘└───────────────────────────┘
         ↕ vertical resize handle
```

## Changes

### `PlantPage` (page.tsx)
- `PanelGroup direction="vertical"` → `direction="horizontal"`
- `autoSaveId` → `"plant-layout-h"` (reset persisted sizes)
- Left panel: `defaultSize={45}`, `minSize={25}`
- Right panel: `defaultSize={55}`, `minSize={20}`
- Update JSDoc comment to reflect horizontal layout

### Resize Handle
- Flip from horizontal bar to vertical bar
- `h-1` → `w-1`, `inset-x-0` → `inset-y-0`
- Pill indicator: `w-12 h-1` → `w-1 h-12`

### `CyclePane`
- `CollapsedCyclePane`: adapt from horizontal strip to vertical strip
  - `border-t` → `border-l`
  - Layout becomes vertical (icon on top, text rotated or stacked)
  - `ChevronUp` → `ChevronLeft` (expand toward left)
- Expanded: `ChevronDown` → `ChevronRight` (collapse toward right)
- No structural changes to cycle deck builder internals

### AreaGallery
- No changes needed — responsive grid already wraps

### Drag & Drop
- No changes — DndContext is position-based, not direction-dependent

## Non-Changes
- CycleDeckBuilder internals (horizontal scroll columns) — unchanged
- CycleTabs — unchanged
- MomentStack/MomentCard — unchanged
- All drag & drop logic — unchanged
- Mobile/landscape behavior — unchanged
