# Attitude-Driven Rhythm & Health — Design Spec

**Date:** 2026-04-21
**Status:** Spec (pre-implementation)
**Author:** Rafa + Claude (brainstorm)
**Principles reference:** [`docs/principles.md`](../principles.md)

---

## 1. Problem

Zenborg's `Attitude` enum (BEGINNING / KEEPING / BUILDING / PUSHING / BEING) is well-modeled — value object, inheritance chain (`moment → habit → area`), per-attitude feedback functions, UI components. It is also effectively **dormant**: only 5 of 91 habits have an attitude set, and 0 of 14 areas. The infrastructure exists; the surface is invisible.

The user has flagged:
- Attitudes should be more **central** to the experience — not decorative labels.
- The real missing piece is **semantic pull**: attitudes should drive recommendations and recurring proposals ("you haven't talked to your grandparents in a while", "therapy every Monday").
- Individual numeric counts are friction; **rhythm** (e.g. "weekly × 3") is the mental model.
- The natural **moment for proposal is cycle planning**, not daily notifications.

## 2. Scope Summary

**In v1:**
- Add `Rhythm` value object and `Habit.rhythm?` field.
- Add `CyclePlan.rhythmOverride?` for seasonal variance.
- Compute `Health` (derived enum) from attitude + rhythm + allocation history.
- Render Health by treating the existing habit emoji (opacity shifts) — no new icons.
- Extend MCP tools for rhythm reads/writes; add cycle planning proposals and cycle review as MCP reads.
- Cycle planning proposals are **MCP-first**; UI follows later.

**Parked (explicitly out):**
- Daily whispers lane (removed — no drawing board surface exists anymore).
- Dormant state with manual pause.
- `/harvest` review UI (MCP drives review in v1).
- "Rooted" section UI for BEING habits.
- Timeline redesign.
- Cycle tags for location.
- Skill tree rename / duration dimension.
- Custom icons per health state.

## 3. Principles Grounding

This feature must honor the equanimitech pyramid. Critical alignments:

- **Bounded Experiences** — proposals surface only at cycle planning, not continuously.
- **Downstream Allocation** — the system proposes; the user commits.
- **Peripheral Presence** — health is expressed via ambient emoji treatment, never badges or alerts.
- **Information, never score** — rhythm drives whispers internally but is never displayed as completion % or grade.
- **Strategic Friction** — the act of cycle planning is deliberate; accepting or rejecting a proposal is equally cheap.
- **Fade-by-Design** — as the user internalizes rhythm, the tool's proposals become a mirror rather than a prompt.

See [`docs/principles.md`](../principles.md) for the full framework.

## 4. Data Model

### 4.1 `Rhythm` value object (new)

```typescript
// src/domain/value-objects/Rhythm.ts
export type RhythmPeriod =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annually";

export interface Rhythm {
  period: RhythmPeriod;
  count: number; // 1..N, how many times per period
}

export const PERIOD_DAYS: Record<RhythmPeriod, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  annually: 365,
};

export function rhythmPerWeek(r: Rhythm): number {
  return (r.count * 7) / PERIOD_DAYS[r.period];
}

export function rhythmToCycleBudget(r: Rhythm, cycleDays: number): number {
  return Math.round((r.count * cycleDays) / PERIOD_DAYS[r.period]);
}

export function rhythmSilenceThresholdDays(r: Rhythm): number {
  return PERIOD_DAYS[r.period] / r.count;
}
```

Period day counts are approximate (30-day months, 90-day quarters). Good enough for mindful cadence; avoids calendar edge cases.

### 4.2 `Attitude` (unchanged)

The existing `Attitude` enum and `AttitudeService` (with its inheritance chain `moment → habit → area`) stay as-is. No renames, no shifted semantics, no migration.

### 4.3 `Habit` extension

```typescript
interface Habit {
  // ... existing fields
  rhythm?: Rhythm; // undefined = no rhythm, pure presence
}
```

### 4.4 `CyclePlan` extension

```typescript
interface CyclePlan {
  // ... existing fields (habitId, cycleId, budgetedCount, etc.)
  rhythmOverride?: Rhythm; // optional seasonal deviation from habit.rhythm
}
```

**Resolution order for effective rhythm:** `cyclePlan.rhythmOverride ?? habit.rhythm ?? null`. A null effective rhythm disables all rhythm-derived behavior (no health wilt, no whispers, no derived budget).

**Effective rhythm drives two concerns:**
1. **Health and whispers** during the cycle — always driven by effective rhythm. `rhythmOverride` means "this cycle, treat the habit as having this rhythm for wilt computation and proposal surfacing".
2. **Derived cycle budget** — computed as `rhythmToCycleBudget(effectiveRhythm, cycleDays)` when the user does not explicitly set `budgetedCount`.

**Precedence when multiple fields are set:**
- `budgetedCount` wins for budget. If the user explicitly sets `budgetedCount` on a `CyclePlan`, that value is the budget, regardless of rhythm.
- `rhythmOverride` still drives health and whispers in that case. Setting `budgetedCount` does not disable the rhythm signal — it only overrides the budget number.
- If `budgetedCount` is absent and effective rhythm is present, budget derives from rhythm.
- If both are absent, the CyclePlan has no budget (legacy behavior preserved).

### 4.5 No new storage for Health

`Health` is a computed enum, not a stored field. Re-computed on read from attitude + rhythm + allocation history. Stored derivations create staleness bugs; derivation is cheap.

## 5. Attitude Semantics

Each attitude interprets rhythm and allocation history differently. The `HabitHealthService` (new) encapsulates the logic.

### 5.1 Overview table

| Attitude | Rhythm role | Tracks | Reachable Health states | Whispers? |
|---|---|---|---|---|
| BEGINNING | optional, loose guide | allocation count | Seedling → Budding | rare (opt-in) |
| KEEPING | silence threshold | days since last allocation | Blooming ↔ Wilting | when Wilting |
| BUILDING | target pace | frequency over current period | Budding → Blooming ↔ Wilting | when Wilting |
| PUSHING | pace + metric | frequency + custom metric values | Blooming ↔ Wilting (+ metric signal) | when Wilting |
| BEING | — | nothing (off-timeline) | Evergreen | never |
| (none) | — | — | Unstated | — |

### 5.2 BEGINNING — Exploration

- Rhythm usually absent. If present, treated as loose guide; no wilt.
- Count allocations of this habit's moments.
- Health: Seedling when count < 5, Budding when ≥ 5.
- Feedback text (unchanged from `getBeginningFeedback`): "1st time", "2nd time", "Nth time".
- Whispers: quiet. Optional surface when habit exists > 2 weeks with zero allocations ("haven't tried yet"). Off by default.
- Transition to KEEPING / BUILDING: user-driven, not automatic.

### 5.3 KEEPING — Relational Tending

- Rhythm is required for any wilt signal. `quarterly × 1` → 90-day silence threshold; `monthly × 2` → 15-day threshold.
- `silenceDays = rhythmSilenceThresholdDays(resolvedRhythm)`.
- Health: Blooming if `daysSinceLast ≤ silenceDays`, Wilting if `>`.
- No rhythm → no wilt → stays Unstated.
- Feedback (unchanged): "Today", "2 days ago", "5 months ago".
- Whispers: Wilting habits surface in cycle planning proposals. Copy leans affectionate ("tend"), not disciplinary.

### 5.4 BUILDING — Practice

- Rhythm as target pace within its period.
- `expectedByNow = resolvedRhythm.count × (daysElapsedInPeriod / PERIOD_DAYS[period])`
- Health:
  - **Budding** for the first 3 complete periods after rhythm is set (prevents early-wilt discouragement while rhythm is being learned).
  - After Budding window:
    - **Blooming** if `actualCountThisPeriod ≥ expectedByNow - tolerance`
    - **Wilting** if `actualCountThisPeriod < expectedByNow - tolerance`
- **Tolerance formula (provisional):** `Math.max(1, Math.floor(resolvedRhythm.count * 0.2))` — 20% slack, minimum 1. Calibrate during implementation (see Open Q 1).
- Feedback (unchanged): "2× this week, 8× this month".
- Whispers: Wilting habits appear in cycle planning proposals. Historical dominant-weekday over last ~8 weeks is surfaced as a placement hint ("usually a Monday practice") — descriptive only, not enforced.

### 5.5 PUSHING — Progression

- Rhythm drives pace identically to BUILDING.
- Adds `customMetric` (existing on `Moment`) and `MetricLog` entries (existing entity).
- Health uses the same Blooming / Wilting formula as BUILDING, computed from pace alone. **Metric progress is a separate signal**, shown on hover / habit settings, not baked into health. Rationale: metric progress is directional (improving / regressing), not dichotomous — it does not fit a "state" cleanly.
- Feedback (unchanged): "Last: 5.2km (target: 8km)".
- Whispers: same as BUILDING.

### 5.6 BEING — Crystallized

- No rhythm, no tracking, no whispers.
- Health is always Evergreen.
- Does not appear in cycle planning proposals.
- User may still manually allocate moments (to mark presence); system does not request them.
- UI treatment in v1: no special "Rooted" section. Habit simply absent from proposals and whisper flows. Full UI honors ("Rooted" panel, ring indicator) deferred.

### 5.7 (No attitude) — Pure Presence

- No health computation. Emoji renders at normal treatment.
- No whispers. No rhythm. Allocations are just allocations.
- Default for new habits. User opts into attitude when the habit earns a relationship.

## 6. Health Rendering

Health is rendered **only** via treatment of the habit's existing emoji. No new icons, no badges, no plant glyphs. Monochrome register preserved.

### 6.1 Emoji treatment map

| Health | Treatment |
|---|---|
| Blooming | full opacity (baseline) |
| Budding | full opacity (fresh is not penalized) |
| Seedling | full opacity (optional subtle dot/underline — defer decision to implementation) |
| Wilting | 50% opacity |
| Dormant | ~30% opacity, grayscale (parked for v1; reserved in enum) |
| Evergreen | full opacity, thin outline ring (optional, can defer for v1) |
| Unstated | full opacity (no signal) |

### 6.2 Area card indicator

Each area card (on `/plant`) shifts its tone subtly when habits within it are Wilting:

- Zero Wilting habits → neutral
- Any Wilting → slight desaturation / tone shift (monochrome, no hue change)
- All Wilting → more notable shift, still readable and usable

**No counts, no percentages, no ratios displayed.** The shift is ambient signal only.

Aggregate threshold formula is deferred to implementation — calibrate by feel, not specification (see Open Q 5).

### 6.3 Where treatment appears

- **CycleDeck cards** (`/cultivate`) — existing card component renders habit emoji; extend to apply health treatment.
- **Timeline moments** (`/cultivate`) — existing moment card renders habit emoji; extend to apply health treatment.
- **Area cards** (`/plant`) — individual habit chips within the card use emoji treatment; area card itself carries the aggregate tone.
- **Hover / long-press** — shows the attitude chip, resolved rhythm, and the textual feedback (existing `getXFeedback` functions). Not persistent on the card.

## 7. Surfaces

### 7.1 Cycle Planning (primary proposal moment)

When the user plans a cycle, the system proposes habits based on attitude + rhythm + current health.

**Proposal data:**

```typescript
type CyclePlanningProposal = {
  habitId: string;
  habitName: string;
  areaId: string;
  attitude: Attitude | null;
  suggestedRhythm: Rhythm | null;
  suggestedCount: number; // rhythmToCycleBudget(rhythm, cycleDays)
  reason: "wilting" | "on-rhythm" | "beginning" | "new-habit";
  currentHealth: Health;
  daysSinceLast: number | null;
};
```

**Inclusion rules:**
- KEEPING with resolved rhythm, current Wilting: `reason: "wilting"`
- KEEPING with resolved rhythm, not Wilting: `reason: "on-rhythm"`
- BUILDING / PUSHING with resolved rhythm: always included, `reason: "wilting"` if currently Wilting, else `"on-rhythm"`
- BEGINNING with no rhythm and allocation count < 5: `reason: "beginning"` (optional, opt-in per area)
- BEING: never included
- No attitude: never included

**User actions:**
- Accept → create `CyclePlan` with suggested count (becomes override)
- Edit → modify count before accepting
- Reject → skip this cycle
- Dismiss all → cycle is planned without proposals (sovereignty)

**v1 delivery:** MCP-first. The `plan_cycle` flow can be driven entirely through MCP tools (read proposals, user confirms each, agent commits). UI panel deferred.

### 7.2 Cycle Deck and Timeline (during cycle)

No new surfaces. CycleDeck cards and Timeline moment cards inherit the health-treated emoji. No ghost strip, no whispers region, no separate suggestion lane.

### 7.3 Mid-cycle wilting

If a habit wilts mid-cycle, it is **not** surfaced in a new region. The user notices via emoji treatment and addresses in the next cycle plan. This honors the sealed nature of a planned cycle and avoids reintroducing nagging surfaces.

### 7.4 Review (`/harvest`, future UI)

`/harvest/page.tsx` is a 16-line placeholder, natural home for cycle review. **Not built in v1.** Review is delivered via MCP tool (`get_cycle_review`) in v1; UI lands later based on real use.

### 7.5 Configuration entry points

- **Attitude + Rhythm**: Habit form (existing `AttitudeSelector`; add rhythm fields — period select + count input).
- **Cycle rhythm override**: CyclePlan row inline edit ("Use habit rhythm" toggle; when off, period + count inputs).
- **BEING transitions**: Habit form attitude dropdown.

## 8. MCP Integration

### 8.1 Existing tools — extensions

| Tool | New parameters | Behavior |
|---|---|---|
| `create_habit` | `rhythm?: { period, count }` | stored on habit |
| `update_habit` | `rhythm?: { period, count } \| null` | set or clear |
| `budget_habit_to_cycle` | `rhythmOverride?: { period, count }` | per-cycle override. If neither `budgetedCount` nor `rhythmOverride` given and habit has rhythm, derive count from `rhythmToCycleBudget(habit.rhythm, cycleDays)`. |

### 8.2 New read tools

| Tool | Returns | Purpose |
|---|---|---|
| `get_habit_health(habitId)` | `{ health, rhythm, lastAllocation, feedback }` | ambient query |
| `list_wilting_habits({ areaId?, attitude? })` | `Habit[]` with health context | "what needs tending?" |
| `get_cycle_planning_proposals(cycleId)` | `CyclePlanningProposal[]` | planning surface |
| `get_cycle_review(cycleId)` | `CycleReview` | end-of-cycle reflection |

### 8.3 Review shape

```typescript
type CycleReview = {
  cycleId: string;
  cycleName: string;
  startDate: string;
  endDate: string | null; // null = reviewing mid-cycle
  habits: CycleReviewHabit[];
  unplannedMoments: Moment[]; // allocated outside any CyclePlan
  totalMoments: number;
};

type CycleReviewHabit = {
  habitId: string;
  habitName: string;
  areaId: string;
  attitude: Attitude | null;
  rhythmSnapshot: Rhythm | null;
  budgetedCount: number | null;
  actualCount: number;
  startHealth: Health;
  endHealth: Health;
  firstAllocation: string | null;
  lastAllocation: string | null;
  longestGapDays: number | null;
};
```

Review is **strictly descriptive**: no aggregate scores, no completion percentages, no directional labels ("improving" / "declining"). The agent and user interpret the facts.

### 8.4 Plan and review are distinct

Plan is forward-looking, fresh-state. Review is backward-looking, reflective. `get_cycle_planning_proposals` does **not** accept a `previousReviewCycleId` parameter. The user (or agent prompted by the user) chains them manually: review → reflection → plan.

### 8.5 Agent boundary

Strict split, documented in `mcp-server/TOOLS.md`:

**Read tools (agent-safe, no commitment):**
- `get_habit_health`
- `list_wilting_habits`
- `get_cycle_planning_proposals`
- `get_cycle_review`
- `list_habits` / `list_moments` / etc. (existing)

**Write tools (require explicit user authorization):**
- `create_habit` / `update_habit` with rhythm
- `budget_habit_to_cycle`
- `plan_cycle`
- `allocate_moment_from_deck`

Heuristic to add to `TOOLS.md`:

> **Attitude-driven planning:** at cycle planning time, call `get_cycle_planning_proposals` to surface what rhythm + health signals suggest. Never call `budget_habit_to_cycle` or `plan_cycle` without the user confirming which proposals to accept. The agent's role is to show the garden's state; the user decides what to tend.

This encodes the equanimitech answer to "Who does Downstream Allocation belong to when an AI is making decisions?" — the agent does the read-side of allocation (gather + propose), the human does the write-side (decide + commit).

## 9. Implementation Layering

```
┌─────────────────────────────────────────────────┐
│ Presentation                                     │
│  - CycleDeck card: apply emoji treatment         │
│  - Timeline moment: apply emoji treatment        │
│  - Area card: apply aggregate tone               │
│  - Habit form: rhythm fields                     │
├─────────────────────────────────────────────────┤
│ Application                                      │
│  - HabitService: create/update with rhythm       │
│  - CycleService: propose, compute review         │
├─────────────────────────────────────────────────┤
│ Domain Services                                  │
│  - AttitudeService (unchanged)                   │
│  - HabitHealthService (new) — computeHealth()    │
│  - RhythmDerivations (new) — budget, threshold   │
├─────────────────────────────────────────────────┤
│ Domain                                           │
│  - Rhythm value object (new)                     │
│  - Habit.rhythm? (new field)                     │
│  - CyclePlan.rhythmOverride? (new field)         │
│  - Attitude (unchanged)                          │
└─────────────────────────────────────────────────┘
```

`HabitHealthService` is a pure function of domain state + current time — easy to unit test. The existing `attitude-feedback.ts` functions (`getBeginningFeedback`, `getKeepingFeedback`, etc.) are preserved and feed the hover / detail text; health is the new card-level summary.

## 10. Migration

- Existing habits: `rhythm` starts `undefined`. No backfill. User sets rhythm as they touch each habit.
- Existing `CyclePlan` entries: `rhythmOverride` starts `undefined`. Existing `budgetedCount` preserved and used as manual override.
- Rhythm-derived budget kicks in only when the habit has a rhythm set and the CyclePlan has no explicit `budgetedCount`.
- Existing attitudes on the 5 currently-set habits: unchanged. Health computation activates for them once a rhythm is set.
- JSON vault format: both new fields optional. No version bump, no breaking change. Older app versions ignore unknown fields.
- No data loss, no destructive operations, no forced state transitions.

## 11. Open Questions (not blocking v1)

1. **BUILDING wilt tolerance formula.** `max(1, floor(count × 0.2))` is a reasonable starting heuristic. Validate in practice; may need per-attitude or per-period calibration.
2. **Budding window duration.** "First 3 periods" is a guess — could be 2, could be 4. Adjust by feel during use.
3. **Mid-cycle wilting resurface.** Current decision: don't. If usage reveals this feels wrong (a KEEPING habit becoming Wilting mid-cycle should probably nudge somewhere), revisit in a follow-up.
4. **BEING UI treatment.** Emoji renders normally in v1. Does it need a subtle ring / "Rooted" section? Defer to visual design pass.
5. **Area aggregate tone thresholds.** At what fraction of wilting habits does the area shift? Calibrate in implementation, not spec.
6. **Seedling visual marker.** Does Seedling need any visual differentiation from Blooming in v1? Possibly a subtle dot or underline. Can defer.
7. **Cycle planning UI.** v1 is MCP-only. When the UI lands, does it live inside CycleDeck, inside an expanded `plan_cycle` form, or as its own surface?
8. **Historical dominant-weekday hint.** The spec mentions surfacing "usually a Monday practice" for BUILDING placement. Do we compute and expose this in v1, or defer? Likely v1 exposes it via `get_cycle_planning_proposals` only, with UI usage deferred.

---

*Spec ends. Implementation plan to follow via `writing-plans` skill.*
