# Modes, Habits, and Cycles Design

**Date:** January 26, 2025
**Status:** Approved
**Phase:** Design

## Overview

Zenborg evolves from a single-mode timeline into a three-mode system: Mapping (design habits and budget cycles), Compass (navigate time horizons and allocate moments), and Review (retrospect on cycles). This design introduces habits as templates for moments, cycle planning as budget allocation, and horizon views as temporal perspectives.

## Goals

- Separate system design (habits, cycles) from daily execution (moment allocation)
- Provide multiple temporal perspectives through horizon views
- Track allocation patterns without completion metrics
- Maintain local-first architecture while preparing for cloud sync

## Core Concepts

### The Three Modes

**Mapping** - Design your system. Create habits organized by areas. Budget habit cards across cycles. Desktop/tablet only.

**Compass** - Execute daily. Navigate four time horizons (far/medium/near/current). Allocate moments to timeline slots. Available on all devices.

**Review** - Reflect on cycles. View allocation balance through visual density. Examine patterns by area and habit. Desktop/tablet only.

### Habits as Templates

Habits replace the direct creation of moments. Users design habits in Mapping mode, then spawn moments from those templates in Compass mode. This separation keeps the system focused: design work happens deliberately at the desktop, execution happens anywhere.

A habit belongs to an area, inherits its color, and carries optional custom emoji. When you create a moment from a habit, the moment links back to its source but lives independently. Changing a habit name does not affect existing moments spawned from it.

### Cycle Planning as Budgeting

Before each cycle, users budget how many moments they commit to for each habit. "6 Running cards" means six opportunities to allocate Running moments across the cycle.

Budget => create all N moments at the beginning of the cycle. They can then be allocated or not. They get archived at the end of the cycle. The system tracks budgeted cards separately from spontaneous moments.

Budgeted moments provide structure. Spontaneous moments provide flexibility. Both coexist in the drawing board, visually distinguished.


### Horizon as Temporal Perspective

The compass shows different views depending on which horizon you select. Press `H` to cycle through four perspectives:

**Far horizon** - Future cycles. Shows current cycle and upcoming cycles. Accessed from Compass mode.

**Medium horizon** - Vertical timeline. Shows tomorrow (collapsed), today (expanded), yesterday, and grouped history (This Week, Last Week, Last Month). Default view in Compass mode.

**Near horizon** - Today only. Three phases visible, focus narrows to what happens today.

**Current position** - Active moment full screen. Shows what you committed to right now based on time detection.

## Data Model

### New Entities

**Habit**
```typescript
interface Habit {
  id: string              // UUID
  name: string            // "Running", "Writing", "Meditation"
  areaId: string          // FK to Area
  color: string           // inherited from Area, can override
  emoji: string           // optional custom emoji
  order: number           // position within area
  isArchived: boolean     // soft delete
  createdAt: string
  updatedAt: string
}
```

**CyclePlan**
```typescript
interface CyclePlan {
  id: string
  cycleId: string         // FK to Cycle
  habitId: string         // FK to Habit
  budgetedCount: number   // e.g., 6 for "6 Running cards"
  createdAt: string
  updatedAt: string
}
```

**ModeState**
```typescript
type Mode = 'mapping' | 'compass' | 'review'
type HorizonLevel = 'far' | 'medium' | 'near' | 'current'

interface ModeState {
  activeMode: Mode
  compassHorizon: HorizonLevel
}
```

### Updated Entities

**Moment** - Add habit relationship
```typescript
interface Moment {
  // ... existing fields (id, name, areaId, phase, day, order, etc.)
  habitId: string | null  // null = spontaneous moment
  isBudgeted: boolean     // true if from cycle plan
}
```

## Architecture

### Repository Pattern (DDD)

The system uses repository interfaces (ports) in the domain layer, with Legend State implementations (adapters) in infrastructure.

**Domain Layer Repositories:**
```typescript
// src/domain/repositories/habit-repository.ts
interface HabitRepository {
  findAll(): Habit[]
  findById(id: string): Habit | undefined
  findByAreaId(areaId: string): Habit[]
  save(habit: Habit): void
  delete(id: string): void
  reorder(areaId: string, habitIds: string[]): void
}

// src/domain/repositories/cycle-plan-repository.ts
interface CyclePlanRepository {
  findByCycleId(cycleId: string): CyclePlan[]
  findByActiveCycle(): CyclePlan[]
  getBudgetStatus(habitId: string): {
    budgeted: number
    allocated: number
    remaining: number
  }
  save(plan: CyclePlan): void
  updateBudget(habitId: string, count: number): void
}

// src/domain/repositories/mode-repository.ts
interface ModeRepository {
  getActiveMode(): Mode
  getCompassHorizon(): HorizonLevel
  setMode(mode: Mode): void
  setHorizon(level: HorizonLevel): void
}
```

**Infrastructure Layer Implementations:**
```typescript
// src/infrastructure/persistence/legend-habit-repository.ts
class LegendHabitRepository implements HabitRepository {
  private store = observable({
    habits: [] as Habit[]
  })

  // Implements all HabitRepository methods
  // Store remains private, only repository methods exposed
}
```

Each repository manages its own IndexedDB persistence. Stores can observe each other for derived computations without circular dependencies (habits → moments, not reverse).

**Application Layer:**
```typescript
// src/application/use-cases/create-moment-from-habit.ts
class CreateMomentFromHabit {
  constructor(
    private habitRepo: HabitRepository,
    private momentRepo: MomentRepository,
    private cyclePlanRepo: CyclePlanRepository
  ) {}

  execute(habitId: string, isBudgeted: boolean): Moment {
    const habit = this.habitRepo.findById(habitId)
    if (!habit) throw new Error('Habit not found')

    const moment: Moment = {
      id: generateUUID(),
      name: habit.name,
      areaId: habit.areaId,
      habitId: habit.id,
      isBudgeted,
      phase: null,
      day: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.momentRepo.save(moment)
    return moment
  }
}
```

## User Interface

### Mode Navigation

**URL Structure:**
- `/mapping` - Mapping mode
- `/compass` - Compass mode (default)
- `/review` - Review mode

**Keyboard Shortcuts:**
- `Cmd+Shift+1` - Mapping mode
- `Cmd+Shift+2` - Compass mode
- `Cmd+Shift+3` - Review mode
- `H` - Cycle horizon (compass only)
- `Cmd+N` - Create new (habit/moment depending on mode)
- `Cmd+E` - Edit focused item
- `Cmd+D` - Delete focused item
- Arrow keys - Navigate
- `Enter` - Confirm/expand
- `Esc` - Cancel
- `Tab` / `Shift+Tab` - Cycle areas (when creating)

**Mode Indicators:**
```
Top-right corner displays:
[MAPPING]
[COMPASS:MEDIUM]
[COMPASS:NEAR]
[REVIEW]
```

**Implementation:**
- Next.js App Router handles URLs
- Mode store syncs with URL bidirectionally
- Hotkey handler calls `router.push('/mapping')` + `modeStore.setMode('mapping')`
- Uses `react-hotkeys-hook` library

### Mapping Mode Interface

Mapping mode shows habits organized in a grid of area containers. Users design their habit library here and budget cycles.

**Desktop Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Mapping                                     [MAPPING]   │
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
│                                                           │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ 🟡 Joyful    │  │ ⚫ Intro...  │                     │
│  ├──────────────┤  ├──────────────┤                     │
│  │ Gaming       │  │ Journaling   │                     │
│  │ Music        │  │ Reflection   │                     │
│  │ + New habit  │  │ + New habit  │                     │
│  └──────────────┘  └──────────────┘                     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Interactions:**
- Arrow keys navigate between habit cards
- Click habit name to edit inline
- `Cmd+N` creates new habit in focused area
- `Tab` cycles area assignment (moves habit to different area)
- `Cmd+D` archives habit (soft delete)
- Drag & drop reorders habits within area or moves between areas
- `Cmd+A` opens area management

**Mobile:** Not available. Shows message: "Use desktop for habit design"

### Cycle Planning Interface

Users access cycle planning from Mapping mode via `Cmd+P` or from far horizon view in Compass mode. Here they budget how many cards for each habit in the upcoming cycle.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Cycle Planning: Autumn Focus      [MAPPING:PLANNING]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Cycle: Nov 1 - Nov 30                                   │
│  Bandwidth: Medium                                       │
│                                                           │
│  Budget Your Deck:                                       │
│                                                           │
│  🟢 Wellness                                             │
│    Running        [••••••] 6 cards                       │
│    Meditation     [•••] 3 cards                          │
│    Yoga           [••] 2 cards                           │
│                                                           │
│  🔵 Craft                                                │
│    Writing        [••••] 4 cards                         │
│    Coding         [••••••••] 8 cards                     │
│    Reading        [••] 2 cards                           │
│                                                           │
│  🟠 Social                                               │
│    Coffee chat    [••] 2 cards                           │
│    Family call    [••••] 4 cards                         │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Interactions:**
- Arrow keys navigate habits
- Click number or `Cmd+E` to edit card count inline
- `Cmd+D` removes habit from cycle deck (sets to 0)
- Dots show visual density only, no counts
- Return to Compass mode shows budgeted cards in drawing board

**Mobile:** Not available.

### Compass Mode Interface

Compass mode provides four horizon views. Users navigate temporal perspectives and allocate moments to timeline slots.

**Far Horizon:**
```
┌─────────────────────────────────────────────────────────┐
│  Compass: Far Horizon             [COMPASS:FAR]         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Current Cycle: Barcelona Summer                         │
│                                                           │
│  Next Cycle: Autumn Focus (starts Nov 1)                │
│                                                           │
│  Future Cycles:                                          │
│  • Winter Deep Work (Dec 1 - Feb 28)                    │
│  • Spring Renewal (Mar 1 - May 31)                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Medium Horizon (default):**
```
┌─────────────────────────────────────────────────────────┐
│  Compass: Medium Horizon          [COMPASS:MEDIUM]      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ▼ Tomorrow                                              │
│    ☕ Morning    [slot] [slot] [slot]                    │
│    ☀️ Afternoon  [slot] [slot] [slot]                    │
│    🌙 Evening    [slot] [slot] [slot]                    │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ★ TODAY - October 26                                    │
│    ☕ Morning    [Running] [Meditation] [slot]           │
│    ☀️ Afternoon  [Writing] [slot] [slot]                 │
│    🌙 Evening    [slot] [slot] [slot]                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                           │
│  ▶ Yesterday (Oct 25)                                    │
│                                                           │
│  ▶ This Week (Oct 20-24)                    5 days      │
│                                                           │
│  ▶ Last Week (Oct 13-19)                    7 days      │
│                                                           │
│  ▶ Last Month (Sep 26-Oct 12)              17 days      │
│                                                           │
├─────────────────────────────────────────────────────────┤
│  Drawing Board                                           │
│                                                           │
│  Budgeted (from cycle deck):                             │
│  [Running 3/6] [Writing 2/4] [Meditation 1/3]           │
│                                                           │
│  Spontaneous:                                            │
│  [Coffee break] [Quick call]                             │
│                                                           │
│  + Create moment (Cmd+N)                                 │
└─────────────────────────────────────────────────────────┘
```

Expanded history group example:
```
│  ▼ This Week (Oct 20-24)                    5 days      │
│    Oct 24 (Thu)                                          │
│      ☕ [Running] [Meditation] [slot]                    │
│      ☀️ [Writing] [slot] [slot]                          │
│      🌙 [Gaming] [slot] [slot]                           │
│    Oct 23 (Wed)                                          │
│      ☕ [Running] [slot] [slot]                          │
│      ☀️ [Writing] [Coding] [slot]                        │
│      🌙 [slot] [slot] [slot]                             │
```

**Near Horizon:**
```
┌─────────────────────────────────────────────────────────┐
│  Compass: Near Horizon            [COMPASS:NEAR]        │
├─────────────────────────────────────────────────────────┤
│  Today - October 26                                      │
│                                                           │
│  ☕ Morning    [Running] [Meditation] [slot]            │
│  ☀️ Afternoon  [Writing] [slot] [slot]                   │
│  🌙 Evening    [slot] [slot] [slot]                      │
└─────────────────────────────────────────────────────────┘
```

**Current Position:**
```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│                                                           │
│                      🔵 Writing                          │
│                                                           │
│                   Afternoon · Today                      │
│                                                           │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Interactions:**
- All editing happens inline, no mode switching
- Click moment name to edit
- Drag moment to move between slots
- `H` cycles horizons (far → medium → near → current → far)
- `Cmd+N` creates new moment (opens inline form)
- `Enter` expands/collapses day groups
- Arrow keys scroll through timeline
- Creating from habit: select from list, creates budgeted moment
- Creating custom: type name, creates spontaneous moment

**Mobile (landscape):**
- Same interface as desktop
- Touch interactions: tap to edit, drag to move, swipe to scroll
- Virtual keyboard for editing

### Review Mode Interface

Review mode shows allocation balance for completed cycles. Users examine patterns through visual density bars.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Review: Barcelona Summer                  [REVIEW]     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Cycle: Sep 1 - Sep 30                                   │
│                                                           │
│  Allocation Balance                                      │
│                                                           │
│  ████████████████████░░░░░░░░                           │
│  Slots used vs. available                                │
│                                                           │
│  By Area:                                                │
│  🟢 Wellness     ████████████░░░░                        │
│  🔵 Craft        ██████████████████                      │
│  🟠 Social       ████░░░░░░░░░░░░                        │
│  🟡 Joyful       ██████░░░░░░░░░░                        │
│  ⚫ Introspect   ██████████░░░░░░                        │
│                                                           │
│  Budgeted Habits:                                        │
│  Running          ████░░ (allocated vs budgeted)         │
│  Writing          ██████                                 │
│  Meditation       ██░░░                                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**What bars show:**
- Visual density only (filled vs empty portions)
- No percentages, no numbers, no metrics
- Qualitative sense: "Did I use this cycle intentionally?"
- Per-area balance: Which areas received attention?
- Per-habit: Which budgeted habits got allocated vs remained in deck?

**Interactions:**
- Arrow keys navigate between past cycles
- `Enter` views detailed day-by-day timeline (read-only medium horizon)
- Click cycle to select

**Mobile:** Available in landscape. Same interface and interactions.

## Migration Strategy

### Phase 1: Data Model (Week 1)

Create new entities and repositories:
1. Define Habit entity and HabitRepository interface
2. Define CyclePlan entity and CyclePlanRepository interface
3. Define ModeState and ModeRepository interface
4. Implement Legend State adapters for all repositories
5. Update Moment entity with habitId and isBudgeted fields
6. Write unit tests for domain logic

### Phase 2: Mode Infrastructure (Week 1-2)

Build mode navigation system:
1. Create mode-store with Legend State
2. Set up Next.js routes (/mapping, /compass, /review)
3. Implement URL-store bidirectional sync
4. Add keyboard shortcut handler with react-hotkeys-hook
5. Create mode indicator component
6. Test mode switching and URL persistence

### Phase 3: Mapping Mode (Week 2-3)

Build habit design interface:
1. Create habit grid layout component
2. Implement inline habit creation/editing
3. Add drag & drop for habit reordering
4. Build area management interface
5. Test desktop/tablet experience
6. Add mobile redirect/block

### Phase 4: Cycle Planning (Week 3)

Build cycle budgeting interface:
1. Create cycle planning layout
2. Implement budget allocation UI (dots + inline editing)
3. Connect to CyclePlanRepository
4. Calculate budget remaining per habit
5. Test budget updates and persistence

### Phase 5: Compass Mode (Week 4-5)

Build horizon navigation and timeline:
1. Implement horizon state management
2. Create far horizon view (cycles overview)
3. Build medium horizon (vertical timeline with groups)
4. Build near horizon (today only)
5. Build current position view (full-screen moment)
6. Add horizon cycling with `H` key
7. Update drawing board to show budgeted/spontaneous split
8. Test all horizon transitions

### Phase 6: Moment Creation from Habits (Week 5)

Update moment creation flow:
1. Add habit selection to creation form
2. Implement CreateMomentFromHabit use case
3. Update drawing board to track budget usage
4. Test budgeted vs spontaneous moment flows

### Phase 7: Review Mode (Week 6)

Build retrospective interface:
1. Create review layout with allocation bars
2. Calculate allocation density per cycle
3. Group by area and habit
4. Implement cycle navigation
5. Add detailed view (read-only timeline)
6. Test visual density representation

### Phase 8: Polish & Testing (Week 6-7)

Final integration and testing:
1. End-to-end tests for all three modes
2. Test mode transitions and data persistence
3. Test keyboard shortcuts across all modes
4. Mobile landscape testing (compass, review only)
5. Accessibility audit
6. Performance optimization

## Open Questions

1. **Bandwidth configuration:** How should users configure cycle bandwidth? Fixed number (e.g., "90 total moments per cycle") or percentage-based?
  - ANSWER: I would think in terms of 1 to 3 moments per day, so calculated for a 3 / 7 / 14 / 30 day cycles.

2. **Auto-detection for current position:** Should current position view appear automatically when entering compass mode during a moment's time window, or only when user cycles too it?
  - ANSWER: This should be configurable by an URL parameter (use `nuqs` library). Default to 3 day timeline view.

3. **History grouping logic:** Should "This Week" always mean the current calendar week, or should it adapt (e.g., "Last 7 days" if today is Wednesday)? 
  - ANSWER: I think we go with calendar week for simplicity.

4. **Habit archival:** When a habit is archived, should its existing moments remain visible in timeline, or should they be visually marked as "orphaned"?

5. **Budget overflow:** If a user creates more moments from a habit than budgeted (e.g., 7 Running when budgeted for 6), should the 7th show as "over budget" or simply count as spontaneous?

## Success Criteria

- Users can design habits in Mapping mode and spawn moments in Compass mode
- Cycle planning creates clear budget constraints visible in drawing board
- Horizon navigation feels natural and helps users shift temporal perspective
- Review mode provides qualitative reflection without metrics-driven pressure
- Keyboard shortcuts work consistently across all modes
- Mobile users can execute (compass) but are appropriately blocked from design work (mapping)
- All data persists to IndexedDB and survives page refresh
- Mode transitions happen instantly (<100ms)

## References

- Original CLAUDE.md specification (Zenborg project overview)
- 2025-01-26 Areas, Attitudes, and Habits implementation notes
- Current codebase: `/Users/rafa/Developer/zenborg/src`
- Attentive Tech concept document (`/docs/concepts/attentive-tech.md`)