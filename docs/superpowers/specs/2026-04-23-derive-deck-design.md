# Derive Deck from Plans — Design Spec

**Date:** 2026-04-23
**Status:** Approved (pending user review)
**Authors:** Rafa + Claude

## Problem

The cycle deck is currently populated by "materializing" moments up-front when a habit is budgeted to a cycle: each unit of `plan.budgetedCount` spawns a corresponding unallocated `Moment` row in `moments.json`. The frontend `CycleService.budgetHabitToCycle` enforces this via a call to `materializeCyclePlanMoments` (`src/application/services/CycleService.ts:759-819`).

The MCP server (`mcp-server/index.ts:998-1063`) writes plans to `cyclePlans.json` directly without materializing, producing a structural inconsistency: plans persist, deck stays empty. Observed today on the "Paris - bday" cycle — 27 plans written via MCP, 1 moment in vault.

Beyond the acute bug, the materialize paradigm creates a second source of truth (`plan.budgetedCount` vs `count(moments where cyclePlanId)`) that forces sync on every mutation path and bloats storage with template moments that are rarely customized.

## Goals

- Eliminate the structural drift between plans and deck moments.
- Make `plan.budgetedCount` the single source of truth for deck size.
- Keep MCP tools thin: they record intent, the app doesn't need a materialize step.
- Preserve the current UX — dragging virtual cards feels identical to the old deck.
- Migrate existing legacy unallocated moments without user intervention.

## Non-Goals

- Replacing `budgetedCount: number` with an appetite enum — tracked as a separate future spec.
- Changing the visual design of the deck or timeline.
- Modifying cycle planning proposals / whisper engine.
- Cloud sync or multi-device conflict resolution.

## Design Decisions

| # | Decision |
|---|---|
| 1 | Materialization happens only on allocation (drag to slot, MCP `allocate_from_plan`). |
| 2 | One-shot migration on first launch sweeps legacy unallocated `cyclePlanId`-linked moments. |
| 3 | Only one card type exists in steady state (virtual deck card, allocated moment). No visual distinction needed. |
| 4 | `archive_habit` deletes plans only; allocated moments survive (orphan via `habitId`). `delete_cycle` deletes plans + all moments in that cycle. |
| 5 | `decrementHabitBudget` floors at `allocatedCount` (no-op if budget - 1 < allocated). |
| 6 | MCP: rename `allocate_moment_from_deck` → `allocate_from_plan(cycleId, habitId, day, phase)`. Server resolves plan and creates Moment. |
| 7 | Virtual card ordering: grouped by area, sorted by `habit.order` within area (matches current behavior). |
| 8 | Unallocate = delete moment row (no unallocated-but-real moments in steady state). |

## Architecture

**Single source of truth:** `cyclePlans.json` — `plan.budgetedCount` is the cycle's intended deck size for each habit.

**`moments.json`** stores only allocated moments and future customizations (allocated-moment rename, emoji override). Spontaneous and standalone moments remain unchanged (`cyclePlanId === null`).

**Invariant change:**
- Old: `plan.budgetedCount === count(moments where cyclePlanId === plan.id)`
- New: `plan.budgetedCount >= count(moments where cyclePlanId === plan.id)` (allocated only)

**Layer ownership unchanged:**
- Domain — `Moment`, `CyclePlan` entity rules.
- Application — `CycleService` orchestrates plan + moment ops.
- Infrastructure — Legend State store reflects vault files, adds `virtualDeckCards$` reactive view.
- Presentation — `CycleDeck` renders from derived view.
- MCP — writes plan-level state; allocation delegated to new tool.

**Deleted concepts:** "deck moment" / "budgeted moment" / `materializeCyclePlanMoments`.

## Components

### Domain (`src/domain/`)
- `CyclePlan.ts` — unchanged.
- `Moment.ts` — unchanged. `cyclePlanId` still the back-reference from allocated moment to plan.

### Application (`src/application/services/CycleService.ts`)

**Removed:**
- `materializeCyclePlanMoments` (lines 759-819)
- Call site in `budgetHabitToCycle` (line 504)

**Added:**
- `allocateFromPlan(cycleId, habitId, day, phase): MomentResult` — finds plan, validates `allocatedCount < budgetedCount` and slot capacity, creates Moment with `cyclePlanId` set.
- `unallocateMoment(momentId): { ok: true } | { error }` — deletes the row. Rejects if `cyclePlanId === null` (spontaneous/standalone use `delete_moment`).
- `countAllocatedForPlan(planId): number` — used by decrement floor + deck derivation.
- `reconcileLegacyDeckMoments(): { deleted: number }` — one-shot migration helper. Idempotent.

**Changed:**
- `decrementHabitBudget` — floor at `countAllocatedForPlan` (no-op if budget-1 < allocated).
- `archiveHabit` — delete plans; allocated moments untouched.

### Infrastructure (`src/infrastructure/state/store.ts`)
- `virtualDeckCards$(cycleId)` — reactive computed. For each plan in cycle, emits `{plan, habit, ghosts: budgetedCount - allocatedCount}`. Grouped by area, sorted by `habit.order` within area.
- Boot hook calls `reconcileLegacyDeckMoments` once, gated by a persisted migration flag. Vault currently has no `meta.json`; introduce one (`~/.zenborg/meta.json`) with shape `{ migrations: { derivedDeck: boolean } }` managed by a thin `MetaRepository`.

### Presentation (`src/components/CycleDeck.tsx`, `CycleDeckColumn.tsx`)
- Render from `virtualDeckCards$` instead of querying unallocated moments.
- Drag-to-slot handler calls `allocateFromPlan` instead of updating existing moment.
- Drag-to-deck handler calls `unallocateMoment` (deletes row).

### MCP (`mcp-server/index.ts`)

**Removed:**
- `allocate_moment_from_deck`

**Added:**
- `allocate_from_plan(cycleId, habitId, day, phase)` — resolves plan server-side, clones habit fields, writes moment to `moments.json`.

**Changed semantics (signatures unchanged):**
- `unallocate_moment(momentId)` — deletes row.
- `archive_habit(habitId)` — stops deleting unallocated moments; deletes plans only.

**Unchanged:**
- `budget_habit_to_cycle` — already only writes plan. The bug resolves by virtue of removing the spawn expectation.

## Data Flow

### Flow A — Budget a habit to a cycle
```
caller → budget_habit_to_cycle(cycleId, habitId, count)
       → upsert plan in cyclePlans.json
       → done. No moment writes.
UI:    cycleDeck reads plan; renders (budgetedCount - allocatedCount) virtual cards.
```

### Flow B — Allocate from deck (drag virtual card to slot)
```
UI drag-end → allocateFromPlan(cycleId, habitId, day, phase)
            → look up plan(cycleId, habitId); reject if missing
            → if allocatedCount >= budgetedCount → error "over-budget"
            → if slot (day, phase) has 3 moments → error "slot full"
            → if day outside cycle range → error
            → createMoment({ name, areaId, emoji, habitId, cycleId,
                             cyclePlanId, day, phase, tags }) — name validated by Moment entity
            → moments$[id].set(moment)
UI:         virtual card count drops by 1; allocated card appears in slot.
```

### Flow C — Unallocate (drag allocated card back to deck)
```
UI drag-end → unallocateMoment(momentId)
            → reject if cyclePlanId === null
            → moments$[momentId].delete()
UI:         allocated card vanishes; virtual card auto-reappears (allocatedCount dropped).
```

### Flow D — Increment / decrement budget
```
increment: plan.budgetedCount++ → write
decrement: if budgetedCount - 1 < allocatedCount → no-op (return current plan)
           else plan.budgetedCount-- → write
UI:        deck virtual card count adjusts reactively.
```

### Flow E — Archive habit
```
archive_habit(habitId) → habit.isArchived = true
                       → for each plan with habitId: cyclePlans$[id].delete()
                       → allocated moments untouched (still reference habitId)
UI:                    deck virtual cards vanish (no plan); allocated moments stay in timeline.
```

### Flow F — Delete cycle
```
delete_cycle(cycleId) → for each plan with cycleId: cyclePlans$[id].delete()
                      → for each moment with cycleId: moments$[id].delete()
                      → cycles$[cycleId].delete()
```

### Flow G — Migration (one-shot, on boot)
```
on app startup:
  meta = readMeta() ?? { migrations: {} }
  if !meta.migrations.derivedDeck:
    for each moment m where m.cyclePlanId !== null
                          && m.day === null
                          && m.phase === null:
      moments$[m.id].delete()   // console.log for audit
    meta.migrations.derivedDeck = true
    writeMeta(meta)
```

## Error Handling

### `allocateFromPlan`
| Condition | Error |
|---|---|
| Cycle not found | `"Cycle {id} not found"` |
| Habit not found or archived | `"Habit {id} not found or archived"` |
| No plan for (cycleId, habitId) | `"No budget: habit not planned for cycle"` |
| `allocatedCount >= budgetedCount` | `"Over budget: {count}/{budget} already allocated"` |
| Slot full (3 moments at day/phase) | `"Slot {day} {phase} full (3/3)"` |
| Day outside cycle range (when `cycle.endDate !== null`; ongoing cycles have no upper bound) | `"Day {date} outside cycle range"` |
| Name invalid (defensive) | bubbled from `createMoment` |

### `unallocateMoment`
| Condition | Behavior |
|---|---|
| Moment not found | `"Moment {id} not found"` |
| `cyclePlanId === null` | `"Cannot unallocate spontaneous moment; use delete_moment"` |
| happy path | row deleted, return `{ ok: true }` |

### `decrementHabitBudget`
| Condition | Behavior |
|---|---|
| No plan exists | `"No plan for (cycle, habit)"` |
| `budgetedCount - 1 < allocatedCount` | No-op, return current plan |
| `budgetedCount === 0` | No-op |

### Migration reconciler
- Idempotent (flag persisted in `meta.json`).
- Per-moment delete logged to console for audit.
- Safety net: never deletes moments with `day !== null || phase !== null`.

### UI surface
- Keep current pattern (`alert()` + `console.error`). Toast system not in scope.

## Testing

### Domain (unit)
- `CyclePlan` + `Moment` entities unchanged; existing tests carry over.

### Application (`CycleService`)
- `allocateFromPlan` — happy path, missing plan, over-budget, slot-full, out-of-range day, archived habit.
- `unallocateMoment` — happy path, reject on spontaneous, not-found.
- `decrementHabitBudget` — floor at allocatedCount (no-op), normal decrement, zero budget.
- `budgetHabitToCycle` — no longer creates moments; assert `moments.json` untouched, only plan written.
- `archiveHabit` — plans deleted, allocated moments survive.
- `reconcileLegacyDeckMoments` — idempotent, only deletes `day=null AND phase=null AND cyclePlanId!=null`, respects flag.

### Infrastructure
- `virtualDeckCards$(cycleId)` — 0 allocated → full ghost count; partial → delta; full → 0 ghosts; ordering by area + `habit.order`.

### MCP
- `budget_habit_to_cycle` — writes plan only; `moments.json` untouched.
- `allocate_from_plan` — new tool; error surface mirrors service tests.
- `unallocate_moment` — deletes row (not just clears day/phase).
- `archive_habit` — plans gone, allocated moments kept.
- `delete_cycle` — plans + all cycle moments gone.

### E2E (Playwright)
- Drag virtual deck card → slot → card materializes, deck ghost count drops.
- Drag allocated card → deck → row deleted, ghost reappears.
- Budget habit via dev tool (or MCP shim) → ghosts appear immediately in deck.
- Decrement budget to below allocated → no-op, no visual change.

### Migration test
- Seed vault with legacy unallocated `cyclePlanId`-linked moments → launch → assert deleted + flag set. Re-launch → no-op.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Migration deletes user-customized unallocated moments | Safety clause: only deletes where `day === null && phase === null && cyclePlanId !== null`. Customizations that left day/phase set survive. |
| MCP written plans while app closed — user sees ghosts appear on next launch (slight lag) | Acceptable: deck is virtual on render, no spawn step needed. App reads plans on boot. |
| Over-budget edge cases if legacy data has `allocatedCount > budgetedCount` | `virtualDeckCards$` uses `Math.max(0, ghosts)`. UI shows 0 ghosts until allocated drops. |
| Tests relying on materialize side-effect | Replace with direct `CycleService.allocateFromPlan` calls in updated tests. |

## Open Questions

None. All seven brainstorm questions resolved; unallocate semantics locked to "delete row".

## References

- Principles: `docs/principles.md`
- Current materialize logic: `src/application/services/CycleService.ts:759-819`
- MCP budget tool: `mcp-server/index.ts:998-1063`
- Future appetite refactor: separate spec (TBD)
