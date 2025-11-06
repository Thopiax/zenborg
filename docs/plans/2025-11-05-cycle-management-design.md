# Cycle Management Design

**Status:** Approved
**Date:** 2025-11-05
**Phase:** Design

## Overview

This design introduces cycle planning and management to Zenborg, enabling users to budget habits across time periods (cycles) and execute their plans through a cycle deck interface. The cycle deck replaces the drawing board during active cycles, providing structure through budgeted moments while preserving flexibility through spontaneous moment creation.

## Goals

- Enable tactical cycle planning on top of strategic habit library (areas/habits)
- Provide visual deck-building interface for budgeting habits across cycles
- Replace drawing board with cycle deck during active cycles
- Support both budgeted (from plan) and spontaneous (ad-hoc) moment creation
- Maintain separation between planning (Plant mode) and execution (Cultivate mode)
- Track allocation patterns in Review mode without completion metrics

## Core Concepts

### Cycles as Time Containers

**Cycle**: A named time period (e.g., "November Focus", "Q1 2025") with contiguous, non-overlapping date ranges. Only one cycle can be active at a time.

**Cycle Plan**: A budget allocation linking a habit to a cycle with a count (e.g., "6 Running cards for November"). Multiple plans per cycle, one plan per habit-cycle pair.

**Budgeted vs Spontaneous**:
- **Budgeted moments**: Pre-created from cycle plans at cycle start, live in cycle deck
- **Spontaneous moments**: Created ad-hoc during cycle (from habits or standalone)

### Cycle Planning as Deck Building

**Garden → Deck metaphor**: Users drag habits from the library (garden) to build a cycle deck of budgeted moment cards. Like building a deck in a card game.

**Bandwidth**: Calculated as `days × 3 phases × (1-3 moments per day)`. Visual feedback shows budget density without hard limits.

**Materialized moments**: When a cycle plan is created/updated, all N moment cards are immediately created with `day: null, phase: null` (unallocated but in deck).

### Cycle Deck Replaces Drawing Board

**During active cycle**: The bottom panel shows the cycle deck (budgeted moment stacks grouped by area) instead of the drawing board (unallocated moments).

**Allocation flows**:
1. **Budgeted**: Drag moment stack from cycle deck → timeline slot
2. **Spontaneous from habit**: Press N → type habit name → autocomplete → spawn directly to timeline
3. **Spontaneous standalone**: Press N → type custom name → no match → spawn directly to timeline

**Stack visualization**: Multiple cards of the same habit appear as a visual stack (3 layers max) with a counter badge (x6).

## Data Model

### New Entity: CyclePlan

```typescript
interface CyclePlan {
  id: string              // UUID
  cycleId: string         // FK to Cycle
  habitId: string         // FK to Habit
  budgetedCount: number   // e.g., 6 for "6 Running cards"
  createdAt: string
  updatedAt: string
}
```

**Constraints**:
- One CyclePlan per (cycleId, habitId) pair
- budgetedCount must be >= 0
- Deleting creates 0-count plan (soft delete pattern)

### Updated Entity: Moment

```typescript
interface Moment {
  // ... existing fields (id, name, areaId, phase, day, order)
  habitId: string | null      // Link to habit (null = standalone)
  cycleId: string | null      // Which cycle TIME PERIOD this belongs to
  cyclePlanId: string | null  // Which budget plan (null = spontaneous)
}
```

**Key semantics**:
- `cyclePlanId !== null` → budgeted moment (from plan)
- `cyclePlanId === null` → spontaneous moment (ad-hoc)
- `cycleId` links ALL moments to time period (for Review mode)
- Unallocated budgeted: `cyclePlanId !== null && day === null && phase === null`
- Allocated budgeted: `cyclePlanId !== null && day !== null && phase !== null`
- Spontaneous always created allocated (skip deck)

### Helper Functions

```typescript
// src/domain/entities/Moment.ts

export function isAllocated(moment: Moment): boolean {
  return moment.day !== null && moment.phase !== null
}

export function isInDeck(moment: Moment): boolean {
  return !isAllocated(moment) && moment.cyclePlanId !== null
}

export function isBudgeted(moment: Moment): boolean {
  return moment.cyclePlanId !== null
}

export function isSpontaneous(moment: Moment): boolean {
  return moment.cyclePlanId === null
}
```

```typescript
// src/domain/entities/Cycle.ts

export function getActiveCycle(cycles: Record<string, Cycle>): Cycle | null {
  return Object.values(cycles).find(c => c.isActive) ?? null
}

export function calculateCycleBandwidth(
  cycle: Cycle,
  momentsPerDay: 1 | 2 | 3
): number {
  const startDate = new Date(cycle.startDate)
  const endDate = cycle.endDate ? new Date(cycle.endDate) : new Date()
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return days * 3 * momentsPerDay  // 3 phases per day
}
```

## Domain Logic & Use Cases

### 1. Plan New Cycle

**Input**:
- name: string
- templateDuration?: 'week' | '2-week' | 'month' | 'quarter'
- startDate?: string (manual override)
- endDate?: string (manual override)

**Logic**:
1. If template selected, calculate dates from calendar (contiguous from last cycle)
2. Validate non-overlapping with existing cycles
3. Create cycle entity (not active yet, just planned)
4. Return cycle

**Use case**: `PlanCycleUseCase`

### 2. Budget Habit to Cycle

**Input**:
- cycleId: string
- habitId: string
- count: number (increment by 1 on each drag, or manual edit)

**Logic**:
1. Find existing CyclePlan(cycleId, habitId) or create new
2. Update budgetedCount
3. Materialize moments (delete existing, create N new)
4. Each moment gets: `cycleId`, `cyclePlanId`, `habitId`, `day: null`, `phase: null`

**Use case**: `BudgetHabitToCycleUseCase` → `MaterializeCyclePlanMomentsUseCase`

### 3. Activate Cycle (Start It)

**Input**:
- cycleId: string

**Logic**:
1. Deactivate current active cycle
2. Activate new cycle (isActive = true)
3. Materialize all cycle plans (ensure all budgeted moments exist)

**Use case**: `ActivateCycleUseCase`

### 4. Allocate Moment from Deck

**Input**:
- momentId: string
- day: string
- phase: Phase
- order: number

**Logic**:
1. Validate moment is in deck (isInDeck(moment) === true)
2. Update moment: set day, phase, order
3. Moment leaves deck, appears in timeline

**Use case**: `AllocateMomentFromDeckUseCase`
**DnD flow**: Drag MomentStack → timeline slot → call use case

### 5. Spawn Spontaneous from Habit

**Input**:
- habitId: string
- day: string
- phase: Phase
- order: number

**Logic**:
1. Load habit details
2. Create moment: `habitId` set, `cycleId` = active cycle, `cyclePlanId = null`
3. Moment spawns directly allocated (skip deck)

**Use case**: `SpawnSpontaneousFromHabitUseCase`
**UI flow**: Press N → type "run" → autocomplete Running → Enter → spawn

### 6. Create Standalone Moment

**Input**:
- name: string (user-typed)
- areaId: string
- day: string | null
- phase: Phase | null
- order: number

**Logic**:
1. Create moment: `habitId = null`, `cycleId` = active cycle, `cyclePlanId = null`
2. Spontaneous standalone moment

**Use case**: `CreateStandaloneMomentUseCase`
**UI flow**: Press N → type custom name → Enter → spawn

## Repository Layer

### New: CyclePlanRepository Interface

```typescript
// src/domain/repositories/cycle-plan-repository.ts

export interface CyclePlanRepository {
  findAll(): CyclePlan[]
  findById(id: string): CyclePlan | undefined
  findByCycleId(cycleId: string): CyclePlan[]
  findByCycleAndHabit(cycleId: string, habitId: string): CyclePlan | undefined
  save(plan: CyclePlan): void
  delete(id: string): void

  // Computed query
  getBudgetStatus(cycleId: string, habitId: string): {
    budgeted: number      // Total budgeted count
    allocated: number     // How many in timeline
    remaining: number     // How many still in deck
  }
}
```

### Implementation

```typescript
// src/infrastructure/repositories/legend-cycle-plan-repository.ts

export class LegendCyclePlanRepository implements CyclePlanRepository {
  private store = cyclePlans$  // From global store

  findByCycleId(cycleId: string): CyclePlan[] {
    return Object.values(this.store.get())
      .filter(plan => plan.cycleId === cycleId)
  }

  getBudgetStatus(cycleId: string, habitId: string) {
    const plan = this.findByCycleAndHabit(cycleId, habitId)
    if (!plan) return { budgeted: 0, allocated: 0, remaining: 0 }

    const moments = Object.values(moments$.get())
      .filter(m => m.cyclePlanId === plan.id)

    const allocated = moments.filter(m => isAllocated(m)).length

    return {
      budgeted: plan.budgetedCount,
      allocated,
      remaining: plan.budgetedCount - allocated
    }
  }
}
```

### Extended: MomentRepository

```typescript
// src/domain/repositories/moment-repository.ts (additions)

export interface MomentRepository {
  // ... existing methods

  // Cycle-specific queries
  findByCycleId(cycleId: string): Moment[]
  findByCyclePlanId(cyclePlanId: string): Moment[]
  findDeckMoments(cycleId: string): Moment[]  // In deck, not allocated
  findAllocatedInCycle(cycleId: string): Moment[]
  findSpontaneousInCycle(cycleId: string): Moment[]
}
```

### Store Setup

```typescript
// src/infrastructure/state/store.ts (additions)

export const cyclePlans$ = observable<Record<string, CyclePlan>>({});
```

```typescript
// src/infrastructure/state/persistence.ts (additions)

configureSynced(cyclePlans$, {
  persist: {
    name: 'cyclePlans',
    indexedDB: {
      databaseName: 'zenborg',
      itemID: 'id'
    }
  }
});
```

## UI Component Structure

### What Already Exists ✓

- **PlanAreaCard** - Habit library grid (areas with habits)
- **PlanHabitItem** - Individual habit cards
- **DrawingBoard** - Unallocated moments with DnD, grouping, collapsible
- **MomentCard** - Draggable moment cards
- **Timeline** - Droppable slots for moments
- **All DnD infrastructure** - @dnd-kit setup, drag handlers

### What's New

#### 1. Plant Mode Navigation

**Bottom tab navigation**:
- `/plant/areas` - Habit library management (existing)
- `/plant/cycles` - Cycle planning (NEW)

**Component**: `PlantTabs.tsx` - switches between areas/cycles views

#### 2. Cycle Planning Page

**Route**: `/plant/cycles`

```
┌─────────────────────────────────────────────────────────┐
│  [Current] [Next: Nov] [+]                              │
├──────────────────────────┬──────────────────────────────┤
│ Habits Library           │ November Cycle Deck          │
│                          │                              │
│ ┌──────────────┐         │ 🟢 Wellness                  │
│ │ 🟢 Wellness  │         │   [Running]                  │
│ ├──────────────┤         │   [Running]                  │
│ │ Running   🔘 │ ─drag─> │   [Running]    (x3)          │
│ │ Meditation🔘 │         │                              │
│ └──────────────┘         │   [Meditation] (x2)          │
│                          │                              │
│ ┌──────────────┐         │ 🔵 Craft                     │
│ │ 🔵 Craft     │         │   [Writing] [Writing]        │
│ └──────────────┘         │   [Writing] [Writing] (x4)  │
└──────────────────────────┴──────────────────────────────┘
```

**Components**:
- `CycleTabs.tsx` - Horizontal tabs for cycles (Current, Next, +)
- `CreateCycleDialog.tsx` - Template duration picker + manual dates
- `HabitsLibraryForPlanning.tsx` - Reuses PlanAreaCard, makes habits draggable
- `CycleDeckBuilder.tsx` - Right panel showing budgeted moment stacks by area

**New DnD flow**: Drag habit → drop in deck area column → increment budget count

#### 3. Cycle Deck (Replaces Drawing Board)

**Component**: `CycleDeck.tsx`

Similar structure to DrawingBoard but:
- Data source: `deckMoments = moments where isInDeck(m) && m.cycleId === activeCycleId`
- Group by area (hide empty areas)
- Show stacked moments (NEW pattern)
- No toolbar (read-only during cultivation)

```
┌─────────────────────────────────────────────────────────┐
│  Cycle Deck                                             │
├─────────────────────────────────────────────────────────┤
│  🟢 Wellness       🔵 Craft         🟠 Social           │
│  [Running]         [Writing]        [Coffee]            │
│  [Running] (x2)    [Writing] (x3)   [Coffee] (x1)      │
│                                                          │
│  [Meditation] (x2) [Coding] (x5)                        │
└─────────────────────────────────────────────────────────┘
```

#### 4. Moment Stack Component

**Component**: `MomentStack.tsx`

Visual representation of multiple moment cards stacked together.

**Features**:
- Show 3 visual layers max (cards offset)
- Counter badge (x6) on top-right
- Drag from stack → only top card moves, others remain
- Reuses existing MomentCard for top card

**Implementation**:
```typescript
interface MomentStackProps {
  moments: Moment[]  // Same habitId, same cyclePlanId
}

export function MomentStack({ moments }: MomentStackProps) {
  const topMoment = moments[0]
  const count = moments.length

  // Draggable top card
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: topMoment.id,
    data: { momentId: topMoment.id, sourceType: 'cycle-deck' }
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      {/* Visual stack layers */}
      {count > 2 && <div className="absolute top-2 left-2 ..." />}
      {count > 1 && <div className="absolute top-1 left-1 ..." />}

      {/* Top card */}
      <MomentCard moment={topMoment} area={...} />

      {/* Counter badge */}
      {count > 1 && (
        <div className="absolute -top-2 -right-2 bg-stone-800 text-white">
          x{count}
        </div>
      )}
    </div>
  )
}
```

#### 5. Stack Counter (in Cycle Planning)

**Component**: `StackCounter.tsx`

Calm counter with inline number input for quick adjustments.

**Features**:
- Displays as `(x3)` in muted style (unfocused)
- Click → number input appears
- Enter or blur → save new count → rematerialize moments

**Used in**: `CycleDeckBuilder.tsx` (planning view)

#### 6. Habit Autocomplete (for Spontaneous Creation)

**Enhancement to existing**: `MomentFormInline.tsx`

Add habit autocomplete similar to `TagAutocompleteInline`:

**Flow**:
1. User presses N in timeline slot
2. Inline input appears
3. User types "run"
4. Dropdown shows: "Running (Wellness)" → select → spawns spontaneous moment
5. Or user keeps typing "coffee break" → no match → Enter → creates standalone

**Component**: `HabitAutocompleteInline.tsx` (similar to TagAutocompleteInline)

## Drag & Drop Flows

### Flow 1: Habit → Deck (Planning)

**Source**: Habit card in HabitsLibraryForPlanning
**Target**: Area column in CycleDeckBuilder
**Action**: Increment budget count by 1

```typescript
// Already implemented in existing DnD infrastructure
function handleDragEnd(event: DragEndEvent) {
  const habitData = active.data.current as { habit: Habit }
  const deckData = over.data.current as { areaId: string, cycleId: string }

  // Validate habit matches area
  if (habitData.habit.areaId !== deckData.areaId) {
    toast.error("Habit must match area")
    return
  }

  // Get current count
  const plan = cyclePlanRepo.findByCycleAndHabit(
    deckData.cycleId,
    habitData.habit.id
  )
  const newCount = plan ? plan.budgetedCount + 1 : 1

  // Update budget (triggers materialization)
  budgetHabitUseCase.execute({
    cycleId: deckData.cycleId,
    habitId: habitData.habit.id,
    count: newCount
  })
}
```

### Flow 2: Deck Stack → Timeline (Cultivation)

**Source**: MomentStack in CycleDeck
**Target**: Timeline slot
**Action**: Allocate budgeted moment to timeline

```typescript
// Reuses existing timeline DnD handler
function handleDragEnd(event: DragEndEvent) {
  const momentData = active.data.current as { momentId: string }
  const slotData = over.data.current as { day: string, phase: Phase, order: number }

  // Validate max 3 per phase
  const existingCount = momentsInSlot(slotData.day, slotData.phase).length
  if (existingCount >= 3) {
    toast.error("Max 3 moments per phase")
    return
  }

  // Allocate from deck
  allocateFromDeckUseCase.execute({
    momentId: momentData.momentId,
    day: slotData.day,
    phase: slotData.phase,
    order: slotData.order
  })
}
```

### Flow 3: Timeline → Deck (Return to Deck)

**Already supported**: Existing unallocate logic works (set day/phase to null)

## Cycle Lifecycle

### Cycle Creation

**Triggers**: User clicks [+] tab in cycle planning

**UI**: CreateCycleDialog opens

**Options**:
1. **Template duration**: Week / 2-Week / Month / Quarter
   - Auto-calculates start/end from last cycle end date
   - Calendar-aligned (starts on Monday for week, 1st for month)
2. **Manual dates**: Date pickers for start/end

**Validation**: No overlaps with existing cycles

**Result**: New cycle created (not active yet, just planned)

### Cycle Activation

**When**: User manually activates cycle OR system auto-activates when date arrives

**Action**:
1. Deactivate current active cycle
2. Activate new cycle
3. Materialize all cycle plans (create budgeted moments in deck)

**Use case**: `ActivateCycleUseCase`

### Cycle End

**When**: End date is reached

**Behavior**:
- Unused budgeted moments remain with `cycleId` (for Review mode)
- Not automatically archived (visible in Review)
- Next cycle's deck only shows its own budgeted moments
- Query filters: `isInDeck(m) && m.cycleId === activeCycleId`

**No rollover**: Unused budget doesn't carry forward (clean slate philosophy)

## Bandwidth & Budget Feedback

### Bandwidth Calculation

```typescript
const bandwidth = calculateCycleBandwidth(cycle, momentsPerDay)
// e.g., 30 days × 3 phases × 2 moments = 180 slots
```

**momentsPerDay**: User preference (1-3), configurable in settings

### Visual Feedback in Planning

**Calm progress indicator** (no numbers):

```typescript
const totalBudgeted = cyclePlans.reduce((sum, plan) => sum + plan.budgetedCount, 0)
const bandwidth = calculateCycleBandwidth(cycle, 2)
const percentage = (totalBudgeted / bandwidth) * 100

// Visual only
<div className="w-full h-2 bg-stone-200">
  <div className="h-full bg-stone-800" style={{ width: `${percentage}%` }} />
</div>
```

**Philosophy**: Soft limit, not enforcement. Users can over-budget (system warns but allows).

## Review Mode Integration

### Query All Moments in Cycle

```typescript
// All moments in cycle (budgeted + spontaneous)
const allMomentsInCycle = Object.values(moments$.get())
  .filter(m => m.cycleId === cycleId && isAllocated(m))

// Split by type
const budgeted = allMomentsInCycle.filter(m => m.cyclePlanId !== null)
const spontaneous = allMomentsInCycle.filter(m => m.cyclePlanId === null)
```

### Allocation Density Visualization

**By habit**:
```typescript
const habitAllocation = cyclePlans.map(plan => {
  const status = cyclePlanRepo.getBudgetStatus(cycleId, plan.habitId)
  return {
    habitName: habits[plan.habitId].name,
    budgeted: status.budgeted,
    allocated: status.allocated,
    density: status.allocated / status.budgeted  // 0.0 to 1.0
  }
})

// Visual: horizontal bar (filled portion = allocated / budgeted)
```

**By area**:
```typescript
const areaAllocation = areas.map(area => {
  const moments = allMomentsInCycle.filter(m => m.areaId === area.id)
  return {
    areaName: area.name,
    count: moments.length,
    color: area.color
  }
})

// Visual: stacked bar or separate bars per area
```

**Philosophy**: Qualitative reflection ("Did I use my budget intentionally?"), not metrics-driven completion.

## Implementation Phases

### Phase 1: Data Model & Repositories (Week 1)
- [ ] Create CyclePlan entity with factory functions
- [ ] Add cycleId, cyclePlanId to Moment entity
- [ ] Create helper functions (isInDeck, isBudgeted, etc.)
- [ ] Define CyclePlanRepository interface
- [ ] Implement LegendCyclePlanRepository
- [ ] Extend MomentRepository with cycle queries
- [ ] Add cyclePlans$ to store and persistence
- [ ] Unit tests for domain logic

### Phase 2: Use Cases (Week 1-2)
- [ ] Implement PlanCycleUseCase (template + manual dates)
- [ ] Implement BudgetHabitToCycleUseCase
- [ ] Implement MaterializeCyclePlanMomentsUseCase
- [ ] Implement ActivateCycleUseCase
- [ ] Implement AllocateMomentFromDeckUseCase
- [ ] Implement SpawnSpontaneousFromHabitUseCase
- [ ] Implement CreateStandaloneMomentUseCase
- [ ] Integration tests for use cases

### Phase 3: Plant Mode - Cycle Planning UI (Week 2-3)
- [ ] Create PlantTabs component (Areas / Cycles)
- [ ] Update /plant layout to include bottom tabs
- [ ] Create /plant/cycles page
- [ ] Build CycleTabs component (horizontal cycle selector)
- [ ] Build CreateCycleDialog (template + manual dates)
- [ ] Build HabitsLibraryForPlanning (reuse PlanAreaCard, add draggable)
- [ ] Build CycleDeckBuilder component
- [ ] Build StackCounter component (inline number input)
- [ ] Implement DnD handler: Habit → Deck (increment budget)
- [ ] Add bandwidth visual feedback

### Phase 4: MomentStack Component (Week 3)
- [ ] Build MomentStack component (visual stacking)
- [ ] Add counter badge styling
- [ ] Implement draggable behavior (drag top card)
- [ ] Add touch/mouse interaction polish
- [ ] Test with various stack sizes (1-10+ cards)

### Phase 5: CycleDeck Component (Week 3-4)
- [ ] Build CycleDeck component (similar to DrawingBoard)
- [ ] Query deckMoments from store
- [ ] Group by area, hide empty areas
- [ ] Render MomentStack components
- [ ] Add collapsible behavior (like DrawingBoard)
- [ ] Replace DrawingBoard conditionally (if active cycle exists)

### Phase 6: Spontaneous Moment Creation (Week 4)
- [ ] Build HabitAutocompleteInline component
- [ ] Integrate with existing MomentFormInline
- [ ] Fuzzy search habits by name
- [ ] Handle habit selection → spawn spontaneous
- [ ] Handle no match → create standalone
- [ ] Add keyboard navigation (up/down, enter, escape)

### Phase 7: Cycle Activation & Lifecycle (Week 4-5)
- [ ] Add cycle activation UI (button or auto-activate)
- [ ] Implement activation flow (deactivate old, activate new)
- [ ] Add cycle end handling (filter queries)
- [ ] Test cycle transitions
- [ ] Add cycle status indicators

### Phase 8: Review Mode Integration (Week 5)
- [ ] Query allocated moments by cycle
- [ ] Split budgeted vs spontaneous
- [ ] Build allocation density visuals (by habit, by area)
- [ ] Add unused budget visualization
- [ ] Test with historical cycles

### Phase 9: Polish & Testing (Week 5-6)
- [ ] E2E tests: Full cycle planning → execution → review flow
- [ ] Visual polish: stacks, counters, animations
- [ ] Accessibility audit
- [ ] Performance optimization (large cycles)
- [ ] Mobile landscape testing
- [ ] Documentation updates

## Open Questions

1. **Auto-activation**: Should cycles auto-activate when their start date arrives, or require manual activation?
   - ANSWER: Start with manual activation, add auto-activation later if needed

2. **Bandwidth enforcement**: Should system prevent over-budgeting (hard limit) or just warn (soft limit)?
   - ANSWER: Soft limit with visual warning (freedom with feedback)

3. **Deck visibility**: Should unallocated moments (old drawing board) still be accessible when cycle is active?
   - ANSWER: No, cycle deck replaces drawing board completely during active cycle

4. **Stack ordering**: When dragging from stack, should order be FIFO, LIFO, or user-selectable?
   - ANSWER: FIFO (first created is top of stack, first to be allocated)

5. **Cycle templates**: Should we add more templates (bi-weekly, quarter, custom recurring)?
   - ANSWER: Start with 4 templates (week, 2-week, month, quarter), add custom later

## Success Criteria

- [ ] Users can create and plan future cycles with template durations
- [ ] Deck building interface feels tactile and game-like (drag habits to build deck)
- [ ] Cycle deck clearly shows remaining budget per habit (stack visual + counter)
- [ ] Spontaneous moment creation is fast (N → type → autocomplete → done)
- [ ] Budgeted vs spontaneous moments are visually distinguishable
- [ ] Review mode shows allocation patterns without metrics pressure
- [ ] All data persists correctly (cycles, plans, moments)
- [ ] Cycle transitions work smoothly (old deck clears, new deck appears)
- [ ] Performance is good with large cycles (100+ budgeted moments)

## References

- Original CLAUDE.md specification (Zenborg project overview)
- 2025-01-26 Modes, Habits, and Cycles design (predecessor to this doc)
- DrawingBoard.tsx (existing component to model CycleDeck after)
- PlanAreaCard.tsx (existing habits library UI)
- Existing DnD infrastructure (@dnd-kit setup)
