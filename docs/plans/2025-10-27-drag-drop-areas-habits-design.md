# Drag-and-Drop for Plan Areas & Habits

**Date:** 2025-10-27
**Status:** Approved for implementation

## Problem

Users cannot reorder PlanAreaCards or habits within each area. The interface requires drag-and-drop sorting to let users organize their habit system.

## Solution

Add sortable drag-and-drop using nested DndContext pattern. Each sorting scope (areas grid, habits within area) operates independently with its own collision detection and state.

## Architecture

### Component Structure

```
Plan Page (plan/page.tsx)
├─ DndContext (area sorting)
│  └─ SortableContext (areas)
│     └─ SortableAreaCard (new wrapper)
│        └─ PlanAreaCard (pure presentation)
│           └─ PlanHabitsList (new component)
│              └─ DndContext (habit sorting)
│                 └─ SortableContext (habits)
│                    └─ SortableHabitItem (new wrapper)
│                       └─ Habit UI (existing)
```

### New Components

**SortableHabitItem.tsx**
- Wraps habit UI with useSortable hook
- Renders grip dots icon (left side, GripVertical from lucide-react)
- Passes drag handle props to icon only
- Applies CSS transform and transition for smooth animation

**PlanHabitsList.tsx**
- Accepts habits array, areaId, and event callbacks
- Sorts habits by order property ascending
- Wraps list in DndContext with PointerSensor, KeyboardSensor (touch 150ms delay)
- Uses SortableContext with verticalListSortingStrategy
- Handles onDragEnd: reorders with arrayMove, updates habits$ observable

**SortableAreaCard.tsx**
- Wraps PlanAreaCard with useSortable hook
- Reuses pattern from AreaManagementModal (lines 54-90)
- Passes all existing props to PlanAreaCard
- Applies transform/transition styling during drag

### Modified Components

**PlanAreaCard.tsx**
- Replaces habits loop (lines 287-346) with PlanHabitsList component
- Adds grip dots icon to header (top-right, absolute positioned)
- Receives drag handle props for area drag
- Keeps existing inline editing, emoji picker, color picker

**plan/page.tsx**
- Sorts areas by order before mapping (ascending)
- Wraps area grid in DndContext (PointerSensor, KeyboardSensor, TouchSensor)
- Wraps area grid in SortableContext (grid strategy)
- Maps areas to SortableAreaCard instead of PlanAreaCard
- Adds onDragEnd handler: arrayMove → update areas$[id].order

## Data Flow

### Area Reordering

1. User drags area card by grip handle
2. onDragEnd fires in plan/page.tsx with active and over IDs
3. Calculate oldIndex and newIndex from sorted areas array
4. Apply arrayMove(areas, oldIndex, newIndex)
5. Update order property for all affected areas in areas$ observable
6. Legend State triggers re-render with new grid order

### Habit Reordering

1. User drags habit row by grip handle
2. onDragEnd fires in PlanHabitsList with active and over IDs
3. Calculate oldIndex and newIndex from sorted habits array (this area only)
4. Apply arrayMove(habits, oldIndex, newIndex)
5. Update order property for all affected habits in habits$ observable
6. Legend State triggers re-render within that area card only

### Order Values

Order values are sequential integers: 0, 1, 2, 3...

When an item moves, all items in that scope receive new order values. Example: moving item from index 1 to 3 reindexes [0,1,2,3,4] to [0,2,3,1,4].

No history tracking (UI layout changes do not require undo/redo).

## UI/UX Design

### Drag Handles

**Area Cards:**
- Icon: GripVertical (grid dots) from lucide-react
- Position: Top-right corner of header, absolute positioned
- Size: 20px width, 20px height
- Color: stone-400, hover: stone-600
- Cursor: grab → grabbing when active

**Habit Rows:**
- Icon: GripVertical (same as areas, smaller)
- Position: Left side before emoji
- Size: 16px width, 16px height
- Visibility: Hover only on desktop, always visible on mobile
- Color: matches area text color with 40% opacity
- Cursor: grab → grabbing when active

### Visual Feedback

**During Drag:**
- Active item opacity: 50%
- Transform: Applied via CSS.Transform.toString(transform)
- Transition: Smooth animation for non-dragging items
- No DragOverlay (simpler than moment card implementation)

**Touch Support:**
- 150ms activation delay (prevents scroll interference)
- 5px tolerance for movement detection
- Works on iPad/tablets in landscape mode

### Constraints

- Areas: All active areas sortable, no limit
- Habits: All habits within area sortable, no limit
- Habits stay within parent area (cannot drag between areas)
- Archived areas and habits not sortable

## Implementation Order

1. Create SortableHabitItem component
2. Create PlanHabitsList component
3. Update PlanAreaCard to use PlanHabitsList
4. Create SortableAreaCard wrapper
5. Update plan/page.tsx with area drag-and-drop
6. Test all scenarios (see below)

## Testing Checklist

- [ ] Drag areas in grid, verify order persists on refresh
- [ ] Drag habits within area, verify reordering works
- [ ] Verify habits cannot drag between areas
- [ ] Test touch drag on iPad landscape mode
- [ ] Verify grip icons show/hide correctly (hover on desktop)
- [ ] Test empty habit list (no errors)
- [ ] Test single habit (draggable but no reorder effect)
- [ ] Test newly created habit/area gets correct order

## Files Changed

**New:**
- `src/components/SortableHabitItem.tsx`
- `src/components/PlanHabitsList.tsx`
- `src/components/SortableAreaCard.tsx`

**Modified:**
- `src/components/PlanAreaCard.tsx`
- `src/app/plan/page.tsx`

## Performance Characteristics

Nested DndContext provides best performance:
- Each context tracks only its scope (areas OR habits, not both)
- Collision detection scoped, reducing computation
- State updates isolated (habit reorder affects one card only)
- @dnd-kit optimized for nested contexts

No performance degradation expected with typical usage (10-20 areas, 5-10 habits per area).
