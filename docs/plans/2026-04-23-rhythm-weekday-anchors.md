# Rhythm Weekday Anchors + Preallocation — Plan

**Date:** 2026-04-23
**Status:** Spec
**Context:** `Rhythm` currently expresses cadence only (`{period, count}`). Some habits have real calendar anchors — "samba first Tuesday", "footy Sundays", "therapy Mondays". We extend rhythm with optional weekday + ordinal, then use those anchors to **preallocate moments on cycle activation** so the user doesn't place the same recurring events by hand every cycle.

## Problem

Rhythm answers *how often*, not *when*. When a user says "samba first Tuesday monthly", cadence is `monthly×1` but placement is lost. Each cycle the user manually drops samba onto May 5, June 2, July 7 — repetitive work the system has enough information to do.

## Design

Extend `Rhythm` with two optional fields. `count` remains the single source of truth for budgeting, proposals, and health. Weekday/ordinal are **placement hints** only.

**Most habits won't have anchors.** Vipassana, build, Lena, Mama, fiction — all float by count. Anchors are opt-in for habits tied to external commitments: classes, appointments, recurring events.

```ts
export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export type Ordinal = "first" | "second" | "third" | "fourth" | "last";

export interface Rhythm {
  period: RhythmPeriod;
  count: number;
  weekdays?: Weekday[]; // optional anchors
  ordinal?: Ordinal;    // nth occurrence of each weekday within period
}
```

### Semantics

- `weekdays` — day-of-week anchors. Order does not matter.
- `ordinal` — meaningful only alongside `weekdays`, and only on `monthly` / `quarterly` / `annually`. Absent = every matching weekday in the period.
- `count` — authoritative for budgeting/health/proposals. Weekdays do not change how many moments a cycle gets.

### Examples

| habit            | rhythm                                                       |
| ---------------- | ------------------------------------------------------------ |
| samba            | `{ period: "monthly", count: 1, weekdays: ["TUE"], ordinal: "first" }` |
| footy            | `{ period: "weekly",  count: 1, weekdays: ["SUN"] }`         |
| therapy          | `{ period: "weekly",  count: 1, weekdays: ["MON"] }`         |
| singing          | `{ period: "weekly",  count: 1, weekdays: ["MON"] }`         |
| gym (M+Th)       | `{ period: "weekly",  count: 2, weekdays: ["MON", "THU"] }`  |
| Vipassana 2×/day | `{ period: "weekly",  count: 14 }` — no anchors              |

## Preallocation

Single concrete use of anchors. Runs automatically on cycle activation; re-runnable manually if anchors change mid-cycle.

### Behavior

For each habit that has:
- `rhythm.weekdays` set, **and**
- a `CyclePlan` in the activating cycle (i.e. the user actually budgeted this habit for this cycle)

compute anchor dates in `[cycle.startDate, cycle.endDate]` via `rhythmTargetDaysInRange`. Allocate moments on the first `min(anchorDates.length, budgetedCount)` of those dates, in the habit's declared `phase` (or leave phase unfilled if none). Skip any (day, phase) already at the 3-moment cap. Remaining budget stays in the deck for manual placement.

Habits without anchors, or anchored habits without a budget in this cycle, are untouched.

### Trigger

- **Auto on cycle activation** — one-shot, idempotent. Active cycle is derived from dates (per TOOLS.md), so "activation" here means "the first time today's date enters the cycle range and preallocation has not yet run for this cycle".
- **Manual re-run** — button in the cycle view: *"preallocate anchored habits"*. Re-running is idempotent: existing moments on anchor dates are kept, missing ones are added.

### Setting

Global toggle in settings: *"Auto-place anchored habits on cycle activation"*, default **on**. No per-habit or per-cycle knob — one switch.

### Scope

Active cycle only. Past cycles are history. Future cycles wait for their own activation.

## Principles check

- **Attentional Granularity** — one field (`rhythm`) for one domain concept (recurrence + placement). No split.
- **Peripheral Presence** — preallocation happens silently once on cycle activation; never nudges during manual allocation.
- **Strategic Friction** — user can turn preallocation off, or re-run it if anchors changed. No lock-in.
- **Fade-by-Design** — absence of `weekdays` leaves current behavior untouched; no regression for existing habits.

## Implementation

### Domain (`src/domain/value-objects/Rhythm.ts`)

1. Add `Weekday`, `Ordinal` types.
2. Extend `Rhythm` with optional `weekdays`, `ordinal`.
3. New helper: `rhythmTargetDaysInRange(r, startISO, endISO): string[]` — ISO dates in the inclusive range matching the rhythm's weekday+ordinal anchors. Empty if no anchors.
4. Existing `rhythmPerWeek`, `rhythmToCycleBudget`, `rhythmSilenceThresholdDays` — unchanged (they read `count` only).

### Entity (`src/domain/entities/Habit.ts`)

- Rhythm is already stored via the interface; extending the shape is enough.
- `createHabit` / `updateHabit` validations:
  - `ordinal` requires non-empty `weekdays`
  - `ordinal` only permitted when `period ∈ {monthly, quarterly, annually}`
  - `weekdays` entries unique

### MCP schema (`src/infrastructure/mcp/`)

Extend rhythm object in `create_habit`, `update_habit`, `budget_habit_to_cycle.rhythmOverride`:

```jsonc
{
  "period":   { "enum": [...] },
  "count":    { "type": "integer", "exclusiveMinimum": 0 },
  "weekdays": { "type": "array", "items": { "enum": ["MON","TUE","WED","THU","FRI","SAT","SUN"] } },
  "ordinal":  { "enum": ["first","second","third","fourth","last"] }
}
```

### Preallocation service

New application service (likely `src/application/services/PreallocationService.ts`):

```ts
preallocateCycle(cycleId: string): { created: Moment[]; skipped: SkipReason[] }
```

- Load cycle + cyclePlans + habits.
- For each cyclePlan whose habit has `weekdays`, compute anchor dates in cycle range.
- Create moments (up to `budgetedCount`), skipping day/phase caps.
- Idempotent: before creating, check no moment for this habit already exists on that day.

Called by:
- A session-start / app-start hook that checks if the active cycle has been preallocated yet.
- A manual MCP tool: `preallocate_cycle { cycleId }`.
- A UI button in the cycle view.

Preallocation-run state: track on the cycle itself (new nullable field `preallocatedAt: string | null`) to make the auto-trigger idempotent. Manual re-run updates this timestamp.

### UI

- Habit form: collapsed "Calendar anchor (optional)" section. Expand → weekday multi-select + ordinal dropdown. Ordinal only shown for monthly+ periods.
- Habit card: small anchor chip next to the rhythm chip when set (e.g. `monthly × 1 · first Tue`).
- Cycle view: "Preallocate anchored habits" button. Confirmation dialog if it would add N moments.
- Settings: toggle for auto-preallocation.

## Data & migration

- JSON vault, nullable fields → no migration.
- Normalizer: strip `weekdays: []` to `undefined` on write.
- `preallocatedAt` on Cycle — nullable, default `null` for existing cycles. Existing active cycle (Paris - bday) can be treated as "already preallocated" (set the timestamp on first load) to avoid retroactively placing moments the user already arranged.

## Testing

- Unit tests in `src/domain/value-objects/__tests__/Rhythm.test.ts`:
  - `rhythmTargetDaysInRange` for each period, with and without ordinal.
  - Edge: last weekday of a month that has 5 of that weekday (ordinal `"last"`).
  - Edge: `ordinal: "fourth"` on a month with only 4 matching weekdays.
  - Validation: ordinal without weekdays rejected; ordinal on weekly rejected.
- PreallocationService tests:
  - Anchored habit with budget → moments placed on anchor dates, capped at `budgetedCount`.
  - Anchored habit without budget → untouched.
  - Unanchored habit with budget → untouched.
  - Idempotent: running twice does not duplicate moments.
  - Day-phase cap respected.

## Rollout

1. Domain + tests (Rhythm extension, `rhythmTargetDaysInRange`, validation).
2. MCP schema + handlers (create/update habit, rhythmOverride).
3. PreallocationService + `preallocate_cycle` MCP tool + `preallocatedAt` on Cycle.
4. UI: habit-form anchor section, habit-card chip, cycle-view preallocate button, settings toggle.
5. Auto-trigger on cycle activation (session-start hook reading the active cycle's `preallocatedAt`).

## Not in scope

- RRULE-style full iCal expressions.
- Time-of-day anchoring — the `phase` field on Habit already handles morning/afternoon/evening.
- Nudges or warnings during manual allocation. Placement is silent and unchanged; anchors inform, they do not gate.
- Per-habit or per-cycle preallocation toggles. One global switch.
- Preallocation for non-active cycles.

## Related

- `docs/plans/2026-04-21-attitude-rhythm-health-design.md` — rhythm/health model this extends.
- `src/domain/value-objects/Rhythm.ts` — file this plan mutates.
