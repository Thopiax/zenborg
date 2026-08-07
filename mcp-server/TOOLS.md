# Zenborg MCP — Tool Inventory (proposal)

**Status:** draft for sign-off before implementation.
**Vault layout:** collections are JSON keyed by UUID — `areas.json`, `habits.json`, `cycles.json`, `cyclePlans.json`, `moments.json`, `phaseConfigs.json`, `metricLogs.json`, `dayNotes.json`.

**Vault root:** `~/.kairos` (release) or `~/.kairos-dev` (debug). Resolution order is
`--vault` → `$KAIROS_HOME` → `$ZENBORG_VAULT_DIR` (legacy) → `~/.kairos`, and it must stay
in lockstep with `vault_root()` in `src-tauri/src/vault/fs.rs`. The vault moved from
`~/.zenborg` on 2026-08-06 (0.15.0); the MCP server followed on the same release. `.mcp.json`
deliberately does *not* pin `--vault` — the default is the single source of truth, because
two places naming the root is exactly how the app and the MCP server drifted apart.

**Area sidecar folders.** Unstructured, area-scoped content lives at
`<vault root>/areas/<slug>/` — `AGENTS.md`, `docs/`, `skills/` — where `<slug>` is the
area name kebab-cased. The sidecar holds files only; `areas.json` remains the source of
truth for all structured fields. No `AREA.md`, no frontmatter, no parser, and no MCP tool
resolves an area to its folder yet. See `CLAUDE.md` → *Area Sidecar Folders*.

---

## Agent Read/Write Boundary

Zenborg MCP tools split into **read-side** (safe for an agent to call freely
while exploring) and **write-side** (require explicit user authorization
before the agent commits).

### Read-side (propose freely)

- `list_areas`, `list_habits`, `list_cycles`, `list_moments`, `list_cycle_plans`, `list_phase_configs`
- `get_area`, `get_habit`, `get_cycle`, `get_moment`, `get_cycle_plan`
- `get_habit_health`
- `list_wilting_habits`
- `get_cycle_planning_proposals`
- `get_cycle_review`

### Write-side (commit only with explicit user consent)

- `create_habit`, `update_habit`, `archive_habit`, `unarchive_habit`
- `create_area`, `update_area`, `archive_area`, `unarchive_area`, `delete_area`
- `create_moment`, `update_moment`, `delete_moment`
- `allocate_moment`, `unallocate_moment`, `allocate_from_plan`
- `spawn_spontaneous_from_habit`, `create_standalone_moment`
- `plan_cycle`, `quick_create_cycle`, `update_cycle`, `end_cycle`, `delete_cycle`
- `budget_habit_to_cycle`, `increment_habit_budget`, `decrement_habit_budget`, `remove_habit_from_deck`
- `update_phase_config`

### Attitude-driven planning

At cycle planning time, call `get_cycle_planning_proposals` to surface what
rhythm + health signals suggest. Never call `budget_habit_to_cycle` or
`plan_cycle` without the user confirming which proposals to accept. The
agent's role is to show the garden's state; the user decides what to tend.

Plan and review are distinct acts. `get_cycle_planning_proposals` does NOT
take review context as input — review is backward-looking reflection, plan
is forward-looking intention. Chain them only at the user's direction.

---

## Scope (Shape-Up)

### Must-have — v0.3
Covers Rafa's explicit ask: "CRUDs for areas, habits, cycles, moments, phases + services".

**Reads** — `list_*` + `get_*` for every collection.
**Writes** — CRUD for Areas / Habits / Cycles / Moments / CyclePlans.
**Archive** — archive / unarchive for Areas + Habits (cascade handled).
**Service orchestration** — `plan_cycle`, `budget_habit_to_cycle`, `allocate_from_plan`, `allocate_moment`, `unallocate_moment`, `spawn_spontaneous_from_habit`, `create_standalone_moment`.

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
| `create_habit` | `name(1–3 words), areaId, order, attitude?, phase?, tags?, aliases?, kind?, emoji?, description?, guidance?, rhythm?, schedule?` | `HABIT_DESCRIPTION_MAX_CHARS = 2000`. `aliases` are alternate names (nicknames/full names) that participate in habit search — normalized: trimmed, empty dropped, de-duped case-insensitively, any alias matching the name case-insensitively is dropped. `kind: "person"` marks the record as a person; absent means an ordinary habit. |
| `update_habit` | `id, updates` (inc. `aliases?`, pass `null` or `[]` to clear; `schedule?`, pass `null` to clear; `kind?`, pass `null` to clear) | Updates to `name` auto-renormalize existing aliases against the new name. Setting/keeping a `schedule` re-reconciles `rhythm` and `phase`. `kind: null` untags a mistagged person back into an ordinary habit. |
| `archive_habit` | `id` | **Cascade:** deletes all cycle plans for this habit; allocated moments preserved as historical records (orphan via `habitId`). |
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
| `create_moment` | `name, areaId, phase?, emoji?, tags?, personIds?, customMetric?, startTime?, durationMin?` | Unallocated. `personIds` are the people present; an empty array writes nothing (absent means nobody). |
| `update_moment` | `id, { name?, areaId?, emoji?, phase?, tags?, customMetric?, startTime?, durationMin? }` | `startTime`/`durationMin` override what the moment inherited from its habit's schedule; pass `null` to clear. |
| `delete_moment` | `id` | |
| `allocate_moment` | `id, day, phase, order?, startTime?, durationMin?` | No cap. Returns `dayViewOverflow` past 3 in the slot. |
| `unallocate_moment` | `id` | |
| `allocate_from_plan` | `cycleId, habitId, day, phase` | Materialize a virtual deck card onto a slot. Resolves plan server-side; creates `Moment` with `cyclePlanId` set and the habit's schedule timing inherited. Returns `dayViewOverflow` past 3 in the slot. |
| `spawn_spontaneous_from_habit` | `habitId, day, phase, order?` | Inherits area/emoji/tags, plus the habit's schedule timing. Returns `dayViewOverflow` past 3 in the slot. |
| `create_standalone_moment` | `name, areaId, day, phase, order?, emoji?, tags?, personIds?, startTime?, durationMin?` | Create + allocate in one op. Returns `dayViewOverflow` past 3 in the slot. `personIds` are the people present; an empty array writes nothing (absent means nobody). |

### Phases (`phaseConfigs.json`) — Should-have
| Tool | Inputs | Notes |
|---|---|---|
| `list_phase_configs` | — | Sorted by `order`. |
| `update_phase_config` | `id, { label?, emoji?, color?, startHour?, endHour?, isVisible?, order? }` | Configs are seeded; only update surface. |

---

## Invariants the MCP must enforce (shared with app)

Beyond entity-level validation, these are cross-entity rules currently enforced in services. MCP ports them:

1. ~~**3-moments-per-(day, phase) cap**~~ — **lifted at the data layer 2026-08-07.** The rule survives as a *day-view display* capacity (`DAY_VIEW_PHASE_CAPACITY` in `Moment.ts`, mirrored in `validation.ts`). Allocation tools never refuse; they attach a `dayViewOverflow` notice past 3 so the `morning` and `cycle-planning` skills keep their anti-over-planning signal.
2. **One `CyclePlan` per (cycleId, habitId)** — upsert semantics in `budget_habit_to_cycle`.
3. **Referential integrity on create** — `areaId` must exist and be non-archived; `habitId` likewise; `cycleId` must exist.
4. **Habit-name 1–3 words** and **moment-name 1–3 words**.
5. **Cascade on archive_habit / delete_cycle** — same fan-out as `HabitService.archiveHabit` / `CycleService.deleteCycle`.

---

## Vault resolution

Current: `--vault /path` CLI arg only. Proposal:

1. `--vault /path` if passed.
2. Else `$KAIROS_HOME` env var.
3. Else `$ZENBORG_VAULT_DIR` env var (legacy).
4. Else `~/.kairos/` (matches Tauri release default).

**Dev vs prod:** MCP defaults to the release vault. If user is running the debug app (`~/.kairos-dev`) and the MCP against the default, they diverge silently. Fix: startup log line printing resolved vault path + warn if `~/.kairos-dev` exists but not targeted.

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
| 1 | Cascade confirmation for `archive_habit` | **Silent cascade, return counts.** `{ archived, deletedPlans }` — allocated moments survive (derive paradigm; orphan via `habitId`). |
| 2 | Vault resolution | **`--vault` → `$KAIROS_HOME` → `$ZENBORG_VAULT_DIR` → `~/.kairos`.** |
| 3 | Dev vault safety | **Log loudly, trust the human.** Print resolved path + warn if `~/.kairos-dev` exists but isn't the target. |
| 4 | Allocation via `update_moment` | **Keep allocation separate.** `allocate_moment` / `unallocate_moment` / `allocate_from_plan` stay their own tool family. |

### Known-evolving invariants

- ~~**3-moments-per-(day, phase) cap.**~~ **Resolved 2026-08-07.** Relaxed at the data layer, kept as a day-view display concern, per `docs/ideas/2026-06-08-calendar-zoomed-in-mode-and-phase-cap.md` (which warned the cap is load-bearing for `morning` / `cycle-planning`) and `docs/ideas/2026-06-14-remove-the-rule-of-3-moments-per-phase-only-applies-at-day-v.md`. Domain, application and MCP write paths no longer block; the timeline grid, drag validation and entity actions still cap at `DAY_VIEW_PHASE_CAPACITY`.

### Habit schedules (added 2026-08-07)

`Habit.schedule?: { weekdays: Weekday[], startTime: "HH:MM", durationMin: number }` and
`Moment.startTime?` / `Moment.durationMin?` are **fully optional and purely additive** — no
migration, existing vault data stays valid, ambient habits are unaffected.

- `rhythm` stays **stored, not derived.** A schedule *fills* it when absent (`{ weekly, weekdays.length }`) and is **rejected** when a weekly rhythm's `count` disagrees with `weekdays.length`. Longer periods are unconstrained — "every other Monday" is `biweekly ×1` on `[MON]`.
- `phase` stays **stored, not derived.** A schedule fills it from the band `startTime` falls in (read from `phaseConfigs`) and rejects a phase that contradicts it.
- Moments inherit `startTime`/`durationMin` from the habit's schedule at allocation time and may override either per instance.

