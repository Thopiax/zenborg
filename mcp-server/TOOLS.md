# Zenborg MCP — Tool Inventory (proposal)

**Status:** draft for sign-off before implementation.
**Vault layout:** `~/.zenborg/` (release) or `~/.zenborg-dev/` (debug). Collections are JSON keyed by UUID: `areas.json`, `habits.json`, `cycles.json`, `cyclePlans.json`, `moments.json`, `phaseConfigs.json`, `metricLogs.json`.

---

## Scope (Shape-Up)

### Must-have — v0.3
Covers Rafa's explicit ask: "CRUDs for areas, habits, cycles, moments, phases + services".

**Reads** — `list_*` + `get_*` for every collection.
**Writes** — CRUD for Areas / Habits / Cycles / Moments / CyclePlans.
**Archive** — archive / unarchive for Areas + Habits (cascade handled).
**Service orchestration** — `plan_cycle`, `budget_habit_to_cycle`, `allocate_moment_from_deck`, `allocate_moment`, `unallocate_moment`, `spawn_spontaneous_from_habit`, `create_standalone_moment`.

### Should-have — if cheap
- `PhaseConfig` update (the only mutating op — configs are seeded)
- Incremental budget ops (`increment_habit_budget`, `decrement_habit_budget`)
- `remove_habit_from_deck`
- `quick_create_cycle` (template shortcut)

### Nice-to-have / off-sides
- MetricLog CRUD — defer (Rafa didn't ask, PUSHING-only surface)
- Bulk ops — defer
- History/undo — stays UI-local (history observable is not in vault)
- Search / full-text — defer
- "Activate cycle" as an explicit MCP op — off-sides: `activeCycle$` is **purely derived from dates** per `store.ts:180`. Mutating it directly would drift from the app. To make a cycle active, move its dates.

---

## Tool list

### Areas (`areas.json`)
| Tool | Inputs | Notes |
|---|---|---|
| `list_areas` | `includeArchived?` | Already exists — sort by `order`. |
| `get_area` | `idOrName` | Resolve by id, then exact-name match among active. |
| `create_area` | `name, color, emoji, order, attitude?, tags?` | Validate via `createArea` domain fn. |
| `update_area` | `idOrName, updates` | Partial patch; re-normalize tags. |
| `archive_area` | `idOrName` | Soft delete. |
| `unarchive_area` | `idOrName` | |
| `delete_area` | `idOrName` | Only if archived **and** `hasAreaMoments === false`. |

### Habits (`habits.json`)
| Tool | Inputs | Notes |
|---|---|---|
| `list_habits` | `areaId?, includeArchived?` | |
| `get_habit` | `id` | |
| `create_habit` | `name(1–3 words), areaId, order, attitude?, phase?, tags?, emoji?, description?, guidance?` | `HABIT_DESCRIPTION_MAX_CHARS = 2000`. |
| `update_habit` | `id, updates` | |
| `archive_habit` | `id` | **Cascade:** deletes unallocated moments + cycle plans for this habit. |
| `unarchive_habit` | `id` | |

### Cycles + plans (`cycles.json`, `cyclePlans.json`)
| Tool | Inputs | Notes |
|---|---|---|
| `list_cycles` | `filter?: "active"\|"current"\|"upcoming"\|"all"` | `active` = derived from dates. |
| `get_cycle` | `id` | |
| `plan_cycle` | `name, templateDuration?, startDate?, endDate?, intention?` | Mirrors `CycleService.planCycle`. |
| `quick_create_cycle` | `template` | Should-have. |
| `update_cycle` | `id, updates` | |
| `end_cycle` | `id, endDate?` | Sets `endDate`; keeps cycle. |
| `delete_cycle` | `id` | **Cascade:** plans + moments scoped to cycle. |
| `list_cycle_plans` | `cycleId?` | |
| `get_cycle_plan` | `id` | |
| `budget_habit_to_cycle` | `cycleId, habitId, count` | Upserts plan; enforces one-per-(cycle, habit). |
| `increment_habit_budget` | `cycleId, habitId` | Should-have. |
| `decrement_habit_budget` | `cycleId, habitId` | Should-have. |
| `remove_habit_from_deck` | `cycleId, habitId` | Should-have. |

### Moments (`moments.json`)
| Tool | Inputs | Notes |
|---|---|---|
| `list_moments` | `filter: { areaId?, habitId?, cycleId?, day?, phase?, allocation?: "unallocated"\|"deck"\|"allocated"\|"budgeted"\|"spontaneous" }` | One tool, structured filter. |
| `get_moment` | `id` | |
| `create_moment` | `name, areaId, phase?, emoji?, tags?, customMetric?` | Unallocated. |
| `update_moment` | `id, { name?, areaId?, emoji?, phase?, tags?, customMetric? }` | |
| `delete_moment` | `id` | |
| `allocate_moment` | `id, day, phase, order?` | Enforce 3-per-(day, phase) cap. |
| `unallocate_moment` | `id` | |
| `allocate_moment_from_deck` | `momentId, day, phase, order?` | Deck moment must belong to a cycle. |
| `spawn_spontaneous_from_habit` | `habitId, day, phase, order?` | Inherits area/emoji/tags. |
| `create_standalone_moment` | `name, areaId, day, phase, order?` | Create + allocate in one op. |

### Phases (`phaseConfigs.json`) — Should-have
| Tool | Inputs | Notes |
|---|---|---|
| `list_phase_configs` | — | Sorted by `order`. |
| `update_phase_config` | `id, { label?, emoji?, color?, startHour?, endHour?, isVisible?, order? }` | Configs are seeded; only update surface. |

---

## Invariants the MCP must enforce (shared with app)

Beyond entity-level validation, these are cross-entity rules currently enforced in services. MCP ports them:

1. **3-moments-per-(day, phase) cap** (`canAllocateToPhase` in `Moment.ts`).
2. **One `CyclePlan` per (cycleId, habitId)** — upsert semantics in `budget_habit_to_cycle`.
3. **Referential integrity on create** — `areaId` must exist and be non-archived; `habitId` likewise; `cycleId` must exist.
4. **Habit-name 1–3 words** and **moment-name 1–3 words**.
5. **Cascade on archive_habit / delete_cycle** — same fan-out as `HabitService.archiveHabit` / `CycleService.deleteCycle`.

---

## Vault resolution

Current: `--vault /path` CLI arg only. Proposal:

1. `--vault /path` if passed.
2. Else `$ZENBORG_VAULT_DIR` env var.
3. Else `~/.zenborg/` (matches Tauri release default).

**Dev vs prod:** MCP defaults to the release vault. If user is running the debug app (`~/.zenborg-dev`) and the MCP against the default, they diverge silently. Fix: startup log line printing resolved vault path + warn if `~/.zenborg-dev` exists but not targeted.

---

## Off-sides (explicit)

- No MetricLog tools this cycle.
- No multi-file bulk ops.
- No LLM-in-the-loop validation — zod + domain fns only.
- No history integration — undo stack is in-memory on desktop.
- No `activate_cycle` — activation is date-derived.
- No tag normalization exposure — handled inside domain fns (`normalizeTag`).

---

## Open questions (need Rafa's call)

1. **Cascade confirmation.** `archive_habit` deletes unallocated moments + plans. Desktop shows a confirm modal. MCP has no UI. Options:
   - **(a)** Cascade silently, return `{ archived, deletedMoments: N, deletedPlans: N }` in payload. *(my recommendation — conversational LLM can narrate.)*
   - **(b)** Two-step: `archive_habit` fails with `requires_confirm: true, preview: {...}`; caller passes `confirm: true` to proceed.
2. **`list_moments` filter shape.** Nested object (shown above) vs flat optional args. Nested wins on clarity but zod schemas get bigger. *(My call: nested — LLM tool-calling handles nested JSON fine.)*
3. **Dev vault safety.** Do we want the MCP to refuse to run if it detects the desktop app is writing to a different vault? That's paranoid. Alternative: just log loudly and trust the human.
4. **`update_moment` via deck allocation.** Currently allocation is its own tool. Should `update_moment` accept `day`/`phase` too and route internally, or is keeping allocation separate the right DDD split? *(My call: separate — matches the service layer and prevents accidental allocations.)*

---

## What I'll rip out

Current `mcp-server/index.ts` reads penceive's `vault/areas/<key>.md` + YAML frontmatter. That codepath is entirely incompatible with Zenborg's JSON layout. I'll delete all of it, keep only the zod schemas + atomic write helper, and rebuild against the collection model above.

---

**Request for Rafa:** sign off on scope (Must-have + Should-have?) and pick answers to the 4 open questions. Then I code.

---

## Decisions (signed off 2026-04-21)

| # | Question | Call |
|---|---|---|
| — | Scope | Must-have + Should-have both in v0.3. |
| 1 | Cascade confirmation for `archive_habit` | **Silent cascade, return counts.** `{ archived, deletedMoments, deletedPlans }`. |
| 2 | Vault resolution | **`--vault` → `$ZENBORG_VAULT_DIR` → `~/.zenborg`.** |
| 3 | Dev vault safety | **Log loudly, trust the human.** Print resolved path + warn if `~/.zenborg-dev` exists but isn't the target. |
| 4 | Allocation via `update_moment` | **Keep allocation separate.** `allocate_moment` / `unallocate_moment` / `allocate_moment_from_deck` stay their own tool family. |

### Known-evolving invariants

- **3-moments-per-(day, phase) cap.** Rafa flagged this will change. MCP mirrors `canAllocateToPhase` today for parity with the desktop app; when the domain loosens, MCP needs a matching update. Marked with a `TODO(moment-cap)` comment in code.

