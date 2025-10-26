# Plan, Cultivate, Harvest: Three Tools for Attention Cultivation

**Date:** January 26, 2025
**Status:** Approved
**Phase:** Design

## Overview

Zenborg evolves from a single-page timeline into a three-tool system for attention cultivation. The metaphor shifts from journey (map/compass/mirror) to gardening (plan/cultivate/harvest), reflecting organic growth rather than destination-seeking.

## Goals

- Separate habit design (Plan) from daily execution (Cultivate)
- Provide temporal perspectives through horizon views (Week, Today, Current moment)
- Enable reflection on completed cycles (Harvest)
- Maintain clean routing with shareable URLs
- Build on existing DDD architecture and Legend State patterns

## The Three Tools

### Plan (`/plan`)
Design your habit system. Create, edit, and archive habits organized by areas. Desktop/tablet only.

### Cultivate (`/cultivate`)
Tend your daily practice. Allocate moments across time horizons. Existing Timeline + DrawingBoard interface. Available on all devices (landscape).

### Harvest (`/harvest`)
Reflect on completed cycles. Review allocation patterns. Placeholder for future implementation.

## Routing Structure

**Routes:**
- `/` - Redirects to `/cultivate`
- `/cultivate` - Default route (existing Timeline + DrawingBoard)
- `/plan` - New habit management interface
- `/harvest` - Placeholder ("Coming soon")

**Navigation:**
- `Cmd+Shift+1` → `/plan`
- `Cmd+Shift+2` → `/cultivate`
- `Cmd+Shift+3` → `/harvest`

**Tool Indicator:**
Top-right corner shows `[PLAN]`, `[CULTIVATE]`, or `[HARVEST]` based on current route.

**Implementation:**
1. Move `/app/page.tsx` content to `/app/cultivate/page.tsx`
2. `/app/page.tsx` becomes redirect:
   ```tsx
   export default function Home() {
     redirect('/cultivate')
   }
   ```
3. Create `/app/plan/page.tsx` with habit grid
4. Create `/app/harvest/page.tsx` with placeholder

## Plan Interface

**Layout:**

Grid of area cards, each containing habits from that area. Matches design doc vision from 2025-01-26-modes-habits-cycles-design.md.

```
┌─────────────────────────────────────────────────────────┐
│  Plan                                          [PLAN]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 🟢 Wellness  │  │ 🔵 Craft     │  │ 🟠 Social    │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  │
│  │ Running      │  │ Writing      │  │ Coffee chat  │  │
│  │ Meditation   │  │ Coding       │  │ Family call  │  │
│  │ Yoga         │  │ Reading      │  │              │  │
│  │ + New habit  │  │ + New habit  │  │ + New habit  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
```

**Components:**
- `ToolIndicator` - Top-right corner badge
- `PlanPage` - Route wrapper at `/app/plan/page.tsx`
- `AreaCard` - Area container with habit list
- `HabitListItem` - Individual habit (inline editable)
- `CreateHabitButton` - "+ New habit" per area

**Data Flow:**
```
Legend State store.habits$
  ↓
store.activeHabits$ (computed, filters isArchived=false)
  ↓
Plan page component
  ↓
AreaCard (one per area)
  ↓
HabitListItem (habits within area)
```

**Service Layer:**
Reuse existing `HabitService` (`/src/application/services/HabitService.ts`):
- `createHabit()` - Create with history tracking
- `updateHabit()` - Update with history tracking
- `archiveHabit()` - Soft delete (sets isArchived=true)

**CRUD Operations:**

*Create:*
- Click "+ New habit" opens inline form in that area
- `Cmd+N` creates in first area (or last-used area)
- Enter saves, Esc cancels

*Read:*
- Grid displays all active habits grouped by area
- Uses `store.activeHabits$` computed observable

*Update:*
- Click habit name enters inline edit mode
- Text input appears, Enter saves, Esc cancels

*Delete (Archive):*
- Hover habit shows archive icon
- Click icon sets `habit.isArchived = true`
- `Delete` key archives focused habit
- Archived habits excluded from grid (soft delete)

**Mobile:**
- Portrait: Shows `<LandscapePrompt />`
- Landscape: Same grid, scrollable

## Keyboard Shortcuts

**Global (all tools):**
- `Cmd+Shift+1` - Navigate to Plan
- `Cmd+Shift+2` - Navigate to Cultivate
- `Cmd+Shift+3` - Navigate to Harvest
- `Cmd+Z` - Undo (existing history system)
- `Cmd+Shift+Z` - Redo (existing history system)

**Plan-specific:**
- `Cmd+N` - Create new habit
- `Enter` - Edit focused habit
- `Delete` - Archive focused habit
- `Esc` - Cancel inline edit
- Arrow keys - Navigate between habits (deferred)

**Cultivate-specific:**
- Existing Timeline + DrawingBoard shortcuts remain unchanged

**Implementation:**
- Add global keyboard listener in `/app/layout.tsx` for `Cmd+1/2/3`
- Use Next.js `useRouter()` and `router.push()` to navigate
- Reuse existing `useGlobalKeyboard` hook pattern for Plan shortcuts

## Tool Indicator Component

**Location:** Top-right corner of all routes

**Display:**
```tsx
// On /plan
[PLAN]

// On /cultivate
[CULTIVATE]

// On /harvest
[HARVEST]
```

**Implementation:**
```tsx
// src/components/ToolIndicator.tsx
'use client'

import { usePathname } from 'next/navigation'

export function ToolIndicator() {
  const pathname = usePathname()

  const tool = pathname.startsWith('/plan') ? 'PLAN'
    : pathname.startsWith('/harvest') ? 'HARVEST'
    : 'CULTIVATE'

  return (
    <div className="text-xs font-mono text-stone-400">
      [{tool}]
    </div>
  )
}
```

**Styling:**
- Monospace font (matches Zenborg aesthetic)
- Stone-400 color (subtle, monochromatic)
- No border, no background (minimal)

## Data Model

No new entities required. Existing entities support all Plan functionality:

**Habit** (already exists):
```typescript
interface Habit {
  id: string
  name: string
  areaId: string
  attitude: Attitude | null
  tags: string[]
  emoji: string
  isArchived: boolean  // soft delete flag
  order: number
  createdAt: string
  updatedAt: string
}
```

**Area** (already exists):
```typescript
interface Area {
  id: string
  name: string
  attitude: Attitude | null
  tags: string[]
  color: string
  emoji: string
  isDefault: boolean
  isArchived: boolean
  order: number
  createdAt: string
  updatedAt: string
}
```

## Persistence

**Automatic IndexedDB sync:**
- Existing Legend State persistence handles all data
- 500ms debounce auto-save (already configured)
- No changes to persistence layer required

**History/Undo:**
- Habit CRUD operations tracked by existing history system
- `Cmd+Z` / `Cmd+Shift+Z` work across all tools
- Max 100 history entries (existing configuration)

## Migration Strategy

**Phase 1: Routing Infrastructure**
1. Create `/app/cultivate/page.tsx` - Copy content from `/app/page.tsx`
2. Update `/app/page.tsx` - Simple redirect to `/cultivate`
3. Create `/app/harvest/page.tsx` - Placeholder component
4. Test route navigation manually

**Phase 2: Tool Indicator**
1. Create `ToolIndicator` component
2. Add to root layout (`/app/layout.tsx`)
3. Test indicator updates on route changes

**Phase 3: Global Keyboard Shortcuts**
1. Add keyboard listener in `/app/layout.tsx`
2. Listen for `Cmd+1/2/3`
3. Call `router.push('/plan')` etc.
4. Test shortcuts navigate correctly

**Phase 4: Plan Interface**
1. Create `AreaCard` component (grid container)
2. Create `HabitListItem` component (inline editable)
3. Create `CreateHabitButton` component
4. Create `/app/plan/page.tsx` (compose above components)
5. Wire up existing `HabitService` methods
6. Test CRUD operations

**Phase 5: Plan Keyboard Shortcuts**
1. Add Plan-specific keyboard handler
2. Implement `Cmd+N`, `Enter`, `Delete`, `Esc`
3. Test shortcuts in Plan tool only

**Phase 6: Polish**
1. Test mobile landscape/portrait behavior
2. Test route persistence on refresh
3. Test undo/redo across tool switches
4. Verify monochromatic design consistency

## Success Criteria

- Users navigate between Plan, Cultivate, Harvest via keyboard shortcuts
- Tool indicator updates immediately on route change
- Plan interface displays habits grouped by area
- Users create, edit, archive habits inline (no modals)
- Archived habits disappear from grid (soft delete works)
- Mobile portrait shows landscape prompt (Plan only)
- All data persists to IndexedDB automatically
- Undo/redo works for habit operations
- URLs shareable (`/plan`, `/cultivate`, `/harvest`)

## Non-Goals (Deferred)

- Habit reordering within areas (drag & drop)
- Moving habits between areas (area reassignment)
- Horizon views within Cultivate (Week/Today/Current)
- Cycle planning and budgeting
- Harvest implementation (placeholder only)

## References

- Original design doc: `/docs/plans/2025-01-26-modes-habits-cycles-design.md`
- CLAUDE.md project specification
- Existing codebase: `/Users/rafa/Developer/zenborg/src`
