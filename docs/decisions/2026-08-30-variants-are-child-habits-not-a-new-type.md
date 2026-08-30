# Variants are child habits, not a new type

**Date:** 2026-08-30
**Context:** zenborg — modelling session variants (breakfast/lunch/dinner on meal, push/pull/legs on strength, vipassana/metta on meditation).

## Problem

A habit like "meal" has variants that differ in phase, duration, and sometimes tags — but they share area, attitude, and lineage. The original design introduced a `Cultivar` value object (`{ tag, params? }`) as an array on Habit, with a parallel `cultivarRotation` on CyclePlan and a `cultivar` snapshot on Moment. This created a second type system with its own schema, normalization, rotation logic, and MCP surface — all narrower than Habit.

When it came to the UI, each missing field (rhythm, phase, aliases, emoji) had to be re-added to the cultivar form, converging on the full Habit interface. A variant IS a habit.

## Decision

A variant is a `Habit` carrying `parentHabitId`. There is no `Cultivar` type.

- `Habit.parentHabitId?: string` — optional FK to the parent habit. Absent = root habit.
- Child habits are filtered from `activeHabits$` — they appear only through the parent's edit form and are plantable as moments via their own `habitId`.
- The HabitFormDialog is reused for variant creation: "add variant" opens a fresh create form with `parentHabitId` and the parent's area/attitude/phase pre-filled.
- Health, tags, search, and cycle planning all work for free — a child habit IS a habit.

## Why not a parallel type

A `Cultivar` needs name, duration, phase, rhythm, aliases, emoji, tags. `Habit` already carries every one of them. The cultivar-specific fields (`params`, `cultivarRotation`, moment snapshot) were workarounds for the fields the type lacked.

A parallel type would cost a Zod schema, normalization functions, rotation helpers, MCP tool additions on 6 tools, CycleService resolution logic, a snapshot on Moment, tag mirroring, a separate form component, and a popover+dialog UI — all converging toward what Habit already is.

One field (`parentHabitId`) replaces all of it.

## What this supersedes

- `Habit.cultivars?: Cultivar[]` — to be removed
- `CyclePlan.cultivarRotation?: string[]` — to be removed
- `Moment.cultivar?: Cultivar` — to be removed
- `src/domain/shared/cultivar-schema.ts` — to be removed
- MCP cultivar support on `add_moment`, `create_habit`, `update_habit` — to be simplified
- `CycleService` cultivar resolution in `allocateFromPlan` / `spawnSpontaneousFromHabit` — to be removed

## UX implications

- A variant shows its own name on the moment card (e.g. "breakfast", not "meal")
- Planting from a variant works the same as planting from any habit
- The plant view shows only root habits; variants are managed inside the parent's form
- The MCP agent plants a variant by passing the variant's `habitId` to `add_moment` — no cultivar parameter needed
