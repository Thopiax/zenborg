# Zenborg MCP — Tool Surface Redesign

**Status:** implementation plan, ready for sign-off.
**Scope:** `mcp-server/` only. No vault shape changes — everything here is tool-surface, so the
"two implementations, pay twice" rule is never triggered.
**Anchor:** Anthropic's *Writing tools for agents* guidance, operationalized in the
`designing-mcp-tools` skill. Every decision below cites one of its principles.

---

## 1. Where we are

69 tools registered in `mcp-server/index.ts` (3,041 lines, one flat file). The surface grew
accretively — moments alone accumulated five creation tools — and predates the response-shape
discipline the rest of the tool ecosystem now follows.

The smells, in priority order:

| # | Smell | Principle violated | Severity |
|---|---|---|---|
| 1 | 5 tools to put a moment on the board (`create_moment`, `allocate_moment`, `create_standalone_moment`, `spawn_spontaneous_from_habit`, `allocate_from_plan`) | "Two tools where one is a strict subset — agent guesses; one path silently rots" | HIGH |
| 2 | No `response_format` anywhere; every tool returns the full record(s) | "Default to concise. Verbose-by-default burns context on every call" | HIGH |
| 3 | No pagination on `list_moments` / `list_habits` (126 habits, unbounded moments) | "Pagination on any list-returning read" | MEDIUM |
| 4 | Zero tools carry `readOnlyHint` (or any annotation) | Read-surface checklist; permission-model clients can't auto-allow | LOW effort, HIGH signal |
| 5 | `quick_create_cycle` is a strict subset of `plan_cycle` | Same as #1 | SMALL |
| 6 | `JSON.stringify(payload, null, 2)` — pretty-print tax on every response | Token budget; indentation earns nothing for an LLM reader | SMALL |

Two facts discovered during the audit that shape the plan:

- **CyclePlan CRUD is already gone.** The 2026-08-24 pitch replaced it with `get_running_cycle`.
  Consequence: **no read tool exposes a `cyclePlanId`**, so the `add_moment` sketch's
  "`cyclePlanId` given → link to plan" clause is not implementable as written — an agent has no
  way to obtain that UUID. §4 resolves the plan server-side from `(covering cycle, habitId)`
  instead, exactly as `allocate_from_plan` does today. (Principle: return semantic identifiers;
  never force a UUID round-trip the surface can't even supply.)
- **The deployed server has drifted from the repo.** Live sessions still expose
  `budget_habit_to_cycle`, `increment_habit_budget`, `list_cycle_plans`, `remove_habit_from_deck`
  — tools deleted from `index.ts`. The compiled `dist/` (and the plugin cache copy at
  `~/.claude/plugins/cache/kairos/zenborg/…`) was not rebuilt after the cycle-plan removal.
  Every phase below therefore ends with an explicit **rebuild + reinstall** step; shipping code
  without shipping the binary is how the current drift happened.

---

## 2. Target state

**64 tools** (69 − 6 collapsed + 1 new), every one carrying:

- `response_format: "concise" | "full"` — default `"concise"` (§5)
- correct annotations: `readOnlyHint: true` on all 28 read tools, `destructiveHint: true` on
  hard deletes and cascades, `openWorldHint: false` everywhere (local vault, no network)
- compact JSON serialization
- pagination on the two unbounded lists (§6)

One creation path for moments (`add_moment`), one for cycles (`plan_cycle` with `template`).

---

## 3. Full 69-tool audit

Verdicts: **KEEP** (unchanged semantics; gains `response_format` + annotations like everything
else), **MODIFY** (schema or behavior change), **COLLAPSE** (absorbed elsewhere; deprecated then
removed), **NEW**.

### Areas (7) — all KEEP

| Tool | Verdict | Rationale |
|---|---|---|
| `list_areas` | KEEP | One task (orient in the garden). ~20 rows; unbounded is fine. `readOnlyHint`. |
| `get_area` | KEEP | Targeted fetch by id-or-name; not a subset of `list_areas` because name resolution is the task. `readOnlyHint`. |
| `create_area` / `update_area` | KEEP | One task each; concise write echo. |
| `archive_area` / `unarchive_area` | KEEP | Not a guess-between-paths pair — the agent always knows which direction it wants. Collapsing into a `set_archived(bool)` saves one tool and costs schema clarity; not worth it. |
| `delete_area` | KEEP | Distinct destructive act with its own precondition (archived + momentless). `destructiveHint`. |

### Habits (7) — all KEEP, `list_habits` MODIFY (pagination)

| Tool | Verdict | Rationale |
|---|---|---|
| `list_habits` | MODIFY | Gains `limit`/`cursor` (§6) — 126 habits and growing is exactly the unbounded-array trap. `readOnlyHint`. |
| `get_habit` | KEEP | `readOnlyHint`. Concise mode drops `description`/`guidance` (the two long-prose fields) — `full` for those. |
| `create_habit` / `update_habit` | KEEP | Schedule reconciliation logic stays; concise write echo. |
| `archive_habit` / `unarchive_habit` | KEEP | `archive_habit` gets `destructiveHint` (cascades plan deletion). |
| `get_habit_health` | KEEP | Derived read, already curated. `readOnlyHint`. |

### Derived reads (2) — KEEP

| Tool | Verdict | Rationale |
|---|---|---|
| `list_wilting_habits` | KEEP | Overlaps `get_running_cycle.wilting`, but is not a strict subset: it works with **no active cycle** and filters by `areaId`/`attitude`. Different task ("audit decay anywhere") vs orientation snapshot. Note the overlap in both descriptions so the agent picks deliberately. `readOnlyHint`. |
| `list_people_to_reach` | KEEP | The one tool whose description is a 300-word essay. Trim to the decision-relevant contract (what `overdueRatio` means, what `far: null` means); move the design rationale to this doc. Descriptions are session-level context paid once, but 300 words × every session is still budget. `readOnlyHint`. |

### People (5), Places (5), Relationships (4), Mentions (1) — all KEEP

Registry CRUD is one-task-per-tool and small-cardinality; `mention` is a genuinely
agent-shaped tool (batch resolve + additive attach in one call — removing it would force
`search_people` + `search_places` + `update_moment` composition, which is the test for keeping
a tool). `list_relationships`, `get_related` get `readOnlyHint`; `delete_person` /
`delete_place` / `delete_relationship` get `destructiveHint`.

### Cycle planning/review (2) — KEEP

`get_cycle_planning_proposals`, `get_cycle_review`: read-only orchestration reads, already
concise-by-construction. `readOnlyHint`. The plan/review separation is doctrine (TOOLS.md) —
do not merge.

### Cycles (7) — `plan_cycle` MODIFY, `quick_create_cycle` COLLAPSE, rest KEEP

| Tool | Verdict | Rationale |
|---|---|---|
| `list_cycles` / `get_cycle` | KEEP | Small collection; `readOnlyHint`. |
| `plan_cycle` | MODIFY | Gains `template?: "week" \| "month" \| "quarter"` — computes `endDate` (7/28/90 days) exactly as `quick_create_cycle` does. Passing both `template` and `endDate` is an actionable error ("pass one or the other"), not a silent precedence rule. |
| `quick_create_cycle` | COLLAPSE → `plan_cycle` | Strict subset (same write, fewer fields — can't even set `placeIds`). Textbook "one path silently rots": it already lags `plan_cycle` on the `placeIds` feature. |
| `update_cycle` / `end_cycle` | KEEP | `end_cycle` is not a subset of `update_cycle` in agent terms — "close the season" is its own task with a today-default. Keep both; cheap and unambiguous. |
| `delete_cycle` | KEEP | `destructiveHint` (cascades moments + plans). |

### Orientation (1) — KEEP

`get_running_cycle`: the model citizen — one call replacing three, curated payload.
`readOnlyHint`.

### Moments (10) → 6 + 1 NEW

| Tool | Verdict | Rationale |
|---|---|---|
| `add_moment` | **NEW** | §4. The one creation path. |
| `create_moment` | COLLAPSE → `add_moment` (omit `day`) | Drawing-board create is `add_moment` with no placement. |
| `create_standalone_moment` | COLLAPSE → `add_moment` (`name`+`areaId`+`day`) | Was create+allocate glued together — that glue *is* `add_moment`. |
| `spawn_spontaneous_from_habit` | COLLAPSE → `add_moment` (`habitId`+`day`) | Habit inheritance becomes a resolution rule, not a tool. |
| `allocate_from_plan` | COLLAPSE → `add_moment` (`habitId`+`day`+`fromPlan: true`) | Plan resolution + budget check become a resolution rule. |
| `allocate_moment` | COLLAPSE → `update_moment` | **Deviation from the sketch, deliberate:** this tool operates on an *existing* moment, so folding it into a creation tool would give `add_moment` a `momentId` mode with a disjoint param set — the "6-mode do-everything tool" anti-pattern. Moving a moment onto (or across) the board is an update. `update_moment` gains `day` (nullable) + `order`; it already has `phase`/`startTime`/`durationMin`. |
| `update_moment` | MODIFY | Gains `day: string \| null` and `order`. Setting `day`(+`phase` or `startTime`) allocates; `day: null` returns a **spontaneous** moment to the drawing board. For a **plan-linked** moment `day: null` is refused with "use `unallocate_moment` — plan-linked moments are deleted, and the deck ghost reappears" (the two acts have different vault semantics; the error teaches the split). |
| `list_moments` | MODIFY | Pagination (§6). `readOnlyHint`. |
| `get_moment` / `delete_moment` | KEEP | `readOnlyHint` / `destructiveHint`. |
| `unallocate_moment` | KEEP | Not redundant with `delete_moment`: enforces the plan-linked/spontaneous distinction and its refusal message routes the agent correctly. |

### Active moment (3), Phases (2), Tags (3), Fuzzy search (3) — all KEEP

- `set_active_moment` / `get_active_moment` / `clear_active_moment`: singleton pointer with keel
  lockstep semantics; already agent-shaped (name-or-id resolution, staleness reporting).
- `list_phase_configs` / `update_phase_config`: 4 rows; fine.
- `list_tags` / `get_tag_profile` / `get_related_habits`: derived, curated, `readOnlyHint`.
- `search_habits` / `search_people` / `search_places`: **considered collapsing** into one
  `search(kind, query)` per the "type-suffix triples your count" rule — **rejected**. The result
  shapes differ per kind, `search_habits` carries kind-specific filters (`areaId`,
  `includeArchived`), and each maps to a distinct agent task ("resolve this habit reference").
  Three well-scoped tools beat one mode-switched tool here. `readOnlyHint` on all three.

### Fences (7) — all KEEP

`set_fence` / `set_host_block` / `set_browser_gate` / `set_browser_transform` are four rule
*types* with genuinely disjoint schemas and invariants (a transform has no exit to name; a block
must name one) — merging them is the flat-optional-bag anti-pattern in the other direction.
`seed_host_blocks` is the batch primitive the checklist asks for. `get_fence` gets
`readOnlyHint`; `clear_fence` gets `destructiveHint`.

**Net:** 69 − (`create_moment`, `create_standalone_moment`, `spawn_spontaneous_from_habit`,
`allocate_from_plan`, `allocate_moment`, `quick_create_cycle`) + `add_moment` = **64**.

---

## 4. `add_moment` — full specification

One tool = one agent task: *"put an intention on the board (or the drawing board)."* Every
input beyond identity and placement is optional with the right default.

### 4.1 Input schema (zod)

```ts
{
  // ── Identity — habit path OR standalone path ─────────────────────────
  habitId: z.string().optional()
    .describe("Create from this habit (resolve fuzzy references with search_habits first). " +
      "Inherits name, areaId, emoji, tags, and schedule timing; any of those passed " +
      "explicitly override the inherited value."),
  name: z.string().optional()
    .describe("Moment name, 1–3 words. Required when habitId is absent; optional override " +
      "when it is present (renaming keeps habitId, so habit health still counts it)."),
  areaId: z.string().optional()
    .describe("Required when habitId is absent; override when it is present."),

  // ── Placement — omit day for a drawing-board moment ──────────────────
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Allocate to this day. Omit to create an unallocated drawing-board moment."),
  phase: PhaseSchema.optional()
    .describe("Required with day unless startTime (given or inherited) derives it."),
  startTime: StartTimeSchema.optional(),
  durationMin: z.number().int().positive().optional(),
  order: z.number().int().nonnegative().optional()
    .describe("Position in the (day, phase) slot. Default: appended after existing moments."),

  // ── Plan linkage ─────────────────────────────────────────────────────
  fromPlan: z.boolean().optional()
    .describe("Link to the covering cycle's plan for this habit and consume one budgeted " +
      "allocation. Requires habitId and day. Errors if no plan exists or budget is " +
      "exhausted. Default false = spontaneous."),

  // ── Payload (all optional, same semantics as today) ──────────────────
  emoji: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  personIds: z.array(z.string()).optional(),
  placeIds: z.array(z.string()).optional(),
  placeUrl: z.string().optional(),
  customMetric: CustomMetricSchema.optional(),
  refs: z.array(z.string()).optional(),
  status: z.enum(["tentative", "accepted"]).optional(),

  response_format: z.enum(["concise", "full"]).optional()   // default "concise"
}
```

**Deviation from the decision sketch:** the sketch said "`cyclePlanId` given → link to plan."
No read tool has exposed a `cyclePlanId` since cycle-plan CRUD was retired (2026-08-24 pitch),
so that parameter would be a UUID the agent cannot obtain — a guaranteed dead path.
`fromPlan: true` + server-side `(covering cycle, habitId) → plan` resolution is the same
mechanism `allocate_from_plan` uses today, and it is discoverable: the agent needs nothing it
doesn't already have. If cycle-plan reads ever return, `cyclePlanId` can be added as an
escape hatch then — not before.

### 4.2 Resolution rules (in order; each failure is an actionable error)

1. **Identity gate.** Neither `habitId` nor (`name` and `areaId`) →
   `Error: pass habitId (create from a habit) or both name and areaId (standalone). Example: { "name": "call sasa", "areaId": "<area uuid>", "day": "2026-08-29", "phase": "EVENING" }`.
2. **Habit inheritance.** `habitId` → `requireActiveHabit` (not found / archived errors as
   today). Effective `name` = override ?? habit.name; same for `areaId`, `emoji`, `tags`.
   Schedule timing (`startTime`, `durationMin`) inherited from `habit.schedule` when present
   and not overridden. `refs` are never inherited (a habit has none — refs are per-occurrence).
3. **Name/area validation.** Effective name must be 1–3 words; effective area must exist and
   be active (`requireActiveArea`).
4. **Phase derivation.** If effective `startTime` is set → phase derived from `phaseConfigs`;
   an explicit `phase` contradicting it is ignored (matches every current allocation tool).
   Else explicit `phase`. If `day` is given and no phase can be determined →
   `Error: phase is required when no startTime is provided (given or inherited from the habit's schedule)`.
   If `day` is absent, `phase` may still be set (a drawing-board moment can carry a phase
   preference, as `create_moment` allows today).
5. **Cycle inheritance.** `day` given → `cycleId` = the covering cycle (latest-starting cycle
   containing `day`), else `null`. Same scan as `spawn_spontaneous_from_habit`.
6. **Plan linkage.** `fromPlan: true` →
   - requires `habitId` and `day` (`Error: fromPlan requires habitId and day`);
   - requires a covering cycle (`Error: no cycle covers ${day} — fromPlan needs a running or scheduled season`);
   - day must be inside the cycle range (same check as today);
   - plan lookup by `(cycleId, habitId)` → `Error: no budget: habit not planned for cycle "<name>"` when absent;
   - budget check: allocated-for-plan < `budgetedCount`, else
     `Error: over budget: N/N already allocated for "<habit>" this cycle. Add it anyway without fromPlan to plant it as spontaneous.`
     (The error names the recovery path — spontaneous is always legal.)
   - success → `cyclePlanId` set.
7. **Allocation.** `day` given → `order` defaults to current slot count; response carries
   `dayViewOverflow: N` when the slot now holds > 3 (`DAY_VIEW_PHASE_CAPACITY`) — informative,
   never a refusal. `day` absent → `day: null`, `cyclePlanId: null`, no overflow field.
8. **Payload validation.** `validateMomentTiming`, `validateRefs`, `validatePlaceUrl` as today;
   `placeIds` slugged; empty arrays write nothing (absence is the single empty representation).

The rules 1–8 live in a **pure function** `resolveAddMoment(input, ctx)` in a new
`mcp-server/moments.ts` (ctx = the five collections + now), following the repo's established
pattern (`validation.ts`, `health.ts`, `people.ts` are all pure + tested). The tool handler is
a thin adapter: read collections → resolve → write → serialize.

### 4.3 Response shape

**Concise (default):**

```json
{
  "id": "9f2c…",
  "name": "themia data",
  "area": { "id": "1a…", "name": "equanimi.tech" },
  "habitId": "77b…",
  "day": "2026-08-29",
  "phase": "MORNING",
  "startTime": "09:00",
  "fromPlan": true,
  "budget": { "allocated": 3, "budgeted": 8 },
  "dayViewOverflow": 4
}
```

Rules: `habitId`/`startTime`/`durationMin` only when set; `fromPlan` + `budget` only when plan-
linked; `dayViewOverflow` only past 3; `day`/`phase` are `null` for drawing-board moments (the
agent must see that placement did *not* happen). Area is resolved to `{id, name}` — semantic
identifier over bare UUID, and it confirms which plot the moment landed in without a round-trip.

**Full:** `{ "created": <complete Moment record> }` — byte-compatible with what the five old
tools return today, easing the deprecation-alias story (§7).

---

## 5. `response_format` contract

Single enum param on **every** tool: `response_format: "concise" | "full"`, default
`"concise"`. Never boolean flags (they multiply combinatorially). Implemented once in a
`defineTool()` wrapper (§8), not 69 times by hand.

### Per-category contract

| Category | Concise (default) | Full |
|---|---|---|
| **Writes** (create/update/archive/delete/allocate/set/clear) | Echo summary: `{ id, name }` + the fields this write changed or derived (placement, cascade counts, budget, `dayViewOverflow`). Never the whole record — the agent just decided the contents; re-reading them teaches nothing. | Today's payload: the complete written record (`{ created: … }` / `{ updated: … }`). |
| **Entity reads** (`get_*`) | Identity + decision fields. Drop: `createdAt`/`updatedAt`, `isDefault`, `order`, long prose (`description`, `guidance`), and every `null`/empty-array key. | Complete stored record. |
| **Lists** (`list_*`) | Array of concise rows (same field set as concise get). Paginated lists wrap in the §6 envelope. | Array of complete records (still paginated where pagination applies). |
| **Derived reads** (`get_running_cycle`, `get_habit_health`, proposals, review, tags, `get_fence`, `list_people_to_reach`, search) | Already curated payloads — concise ≡ today's shape minus null-valued keys. | Identical to concise (documented as such; the param is accepted for uniformity, never an error). |
| **Errors** | Unchanged in both modes — already terse and actionable. | — |

### Concise row definitions (the load-bearing ones)

- **Moment:** `id, name, areaId, habitId?, cycleId?, day, phase, startTime?, durationMin?, tags?, personIds?, placeIds?, status?` (`?` = omitted when null/empty; `day`/`phase` always present, `null` meaning drawing board).
- **Habit:** `id, name, areaId, emoji?, attitude, phase?, rhythm?, schedule?, tags?, aliases?, placeIds?, isArchived?` (only when true).
- **Area:** `id, name, emoji, color, attitude?, tags?, isArchived?`.
- **Cycle:** `id, name, startDate, endDate, intention?, placeIds?`.
- **Person / Place:** as today minus timestamps and null keys (already small).

Null-stripping is safe by construction: the vault contract already treats *absent* as the
single empty representation (`buildMoment` writes no `personIds: []`), so concise output
mirrors storage semantics rather than inventing new ones.

### Caller-compat check (required before flipping the default)

All known callers are LLM skills (§7) — the constituency the concise default optimizes for.
The one risk is a skill string-matching a field that concise drops; the audit in Phase 4
greps each caller for field references (`createdAt`, `updatedAt`, `order`) against the concise
row definitions. Skills verified to read only `id`, `name`, `day`, `phase`, `refs`, `tags`,
health fields — all present in concise. If Phase 4 finds an exception, that skill passes
`response_format: "full"` until fixed; the default still flips.

---

## 6. Pagination contract

Applies to `list_moments` and `list_habits` only. Areas (~20), cycles, people, places, phases,
tags, relationships stay unbounded — envelope-wrapping a 4-row list is pure overhead.

### Parameters

```ts
limit:  z.number().int().min(1).max(200).optional()   // default 50
cursor: z.string().optional()                          // opaque; from a previous response
```

### Envelope (both modes)

```json
{
  "items": [ … ],
  "total": 312,
  "truncated": true,
  "nextCursor": "eyJ2IjoxLCJvIjo1MCwiZiI6ImE3YzQifQ"
}
```

- `truncated: false` ⇒ `nextCursor: null`. Explicit truncation, per checklist — silent
  truncation is a debugging trap.
- Tool description states the loop: *"when `truncated` is true, pass `nextCursor` back with the
  same filters to continue."*

### Cursor shape

Opaque base64url of `{ v: 1, o: <offset>, f: <8-char hash of the normalized filter object> }`.

- **Offset-based, deliberately.** The store is a single-process read of a local JSON file —
  there is no concurrent-writer consistency problem that keyset cursors exist to solve, and
  offset keeps the implementation ~15 lines. If the vault ever fronts a real DB, `v` bumps.
- **Filter hash** makes a cursor self-validating: reused with different filters →
  `Error: cursor was issued for a different filter — drop the cursor or restore the original filters.`
- Deterministic sort orders (ties broken by `id` asc):
  - `list_habits`: `order` asc — unchanged from today.
  - `list_moments`: `day` desc with `null` days last, then `phase` in band order, then `order`
    asc. Recent-and-upcoming first, drawing board at the end — matches what agents ask for.

---

## 7. Migration path — no breaking change without a glide

**Versioning:** `0.3.0` (today) → `0.4.0` (Phases 0–4, additive + deprecations) → `0.5.0`
(Phase 5, removals).

### Deprecation mechanics (Phase 2 → Phase 5)

The six collapsing tools stay registered through `0.4.x` as **thin wrappers over the new code
path**: each one maps its params onto `resolveAddMoment` (or `plan_cycle`) and returns the old
response shape (`full`). This kills the glide path's classic failure — two diverging
implementations — because there is only one resolver from day one. Each wrapper:

- Description prefixed `DEPRECATED — use add_moment: …` (agents reliably weight the first
  words of a description).
- Response gains `"deprecated": "use add_moment"` so even a caller ignoring descriptions sees
  it in transcripts.

### Caller inventory (grounded, verified by grep)

| Caller | Uses | Change |
|---|---|---|
| `~/.claude/skills/cycle-planning/` (SKILL.md, `references/appetite-and-shape.md`, `evals/evals.json`) | `spawn_spontaneous_from_habit`, `create_standalone_moment`, `quick_create_cycle`, `update_moment` | `spawn_…` → `add_moment {habitId, day, phase}`; `create_standalone_…` → `add_moment {name, areaId, day, phase}`; `quick_create_cycle` → `plan_cycle {template}`. The "spawn then rename via update_moment" two-step becomes one call (`add_moment {habitId, name}` — override keeps `habitId`, so health still counts it). |
| `~/.claude/skills/week-planning/SKILL.md` | `spawn_spontaneous_from_habit` + `update_moment` (rename + refs), `create_standalone_moment` | Same mapping; the rename+refs two-step becomes `add_moment {habitId, name, refs}`. |
| Garden skills plugin (`tend`, `sunrise`, `sunset`, `weather`, `season`) | moment creation + allocation family | Re-grep at migration time (the plugin ships from the kairos marketplace): `grep -rlE "create_moment|allocate_moment|create_standalone_moment|spawn_spontaneous_from_habit|allocate_from_plan|quick_create_cycle" <plugin root>`. |
| `mcp-server/TOOLS.md` | documents the old surface + read/write boundary | Rewritten in Phase 4 (it is also still marked "proposal" — overdue). |
| `mcp-server/smoke-test.mjs` | boots + exercises tools | Extended each phase. |

Keel and the Tauri app read the **vault**, not the MCP — out of scope by construction.

### Deployed-binary refresh (every phase's last step)

```
cd mcp-server && pnpm build && pnpm smoke        # dist/ refresh + boot check
# then refresh the installed copy (plugin cache / marketplace re-materialize)
```

This is not ceremony: the live server currently serves tools deleted from the repo months ago.
The redesign is not shipped until a fresh session's tool list shows the new surface.

### Removal gate (entering Phase 5)

Remove the six deprecated tools only when: (a) all callers in the inventory are migrated and
exercised (one real `cycle-planning` run, one `week-planning` run, one `tend` batch), and
(b) a week of transcripts shows no deprecated-tool calls. Then delete wrappers, bump `0.5.0`,
rebuild, reinstall.

---

## 8. Implementation architecture

Minimal structural change with maximal uniformity: a `defineTool()` wrapper in `index.ts` (or a
small `tooling.ts`), used by all 64 registrations:

```ts
defineTool(server, {
  name, description,
  schema,                        // response_format appended automatically
  annotations: { readOnlyHint, destructiveHint, openWorldHint: false },
  concise: (payload) => …,       // optional; default = null-stripping projection
  handler,
});
```

- Appends `response_format` to every schema; routes the result through the concise projector
  or passes it raw for `full`.
- Serializes with `JSON.stringify(payload)` — no indentation.
- Uses `server.registerTool()` under the hood (the current `server.tool(name, desc, schema,
  handler)` legacy signature cannot carry annotations).
- Exports the registration table, making the §9 parity test a 10-line loop.

New pure modules, following the existing helper pattern: `moments.ts` (`resolveAddMoment`),
`serialize.ts` (concise projectors), `paging.ts` (cursor encode/decode/validate, sort orders).
`index.ts` keeps only adapters. (A full split of `index.ts` into per-family modules is
worthwhile but **out of appetite** — it multiplies the diff without changing the surface;
capture as a follow-up.)

---

## 9. Testing strategy

**Exists today:** vitest via root config (`mcp-server/**/*.test.ts` included; husky pre-commit
runs the suite) covering the pure helpers — `validation`, `health`, `people`, `search`, `tags`,
`graph`, `fences`, `cadence`, `vault`. Plus `smoke-test.mjs` (build + boot + basic calls).
**Gap:** the 69 tool handlers themselves are untested — all logic that lives inline in
`index.ts` is invisible to the suite.

**To add, per phase:**

| Phase | Tests |
|---|---|
| 0 | Smoke asserts a response parses as JSON and contains no `\n  ` indentation. |
| 1 | `serialize.test.ts`: per-category projector tests (null-stripping, timestamp dropping, write echoes). Registry parity test: iterate the exported table — every tool has `response_format` in its schema; every `list_*`/`get_*`/`search_*` carries `readOnlyHint: true`; every hard delete carries `destructiveHint`. This test is the tripwire that makes the next contributor declare their annotations. |
| 2 | `moments.test.ts`: table-driven matrix over `resolveAddMoment` — the identity cases × placement (day/no-day) × phase source (explicit/derived/inherited/missing) × `fromPlan` (no-plan / over-budget / day-outside-cycle / success) × override inheritance. Wrapper-equivalence tests: each deprecated tool's params through the wrapper produce the same vault write as the legacy handler did (golden fixtures from the old behavior). `plan_cycle` template arithmetic (7/28/90, `template`+`endDate` error). |
| 3 | `paging.test.ts`: cursor round-trip, filter-hash mismatch error, sort determinism, `truncated`/`nextCursor` envelope invariants, limit bounds. |
| 4 | Extended smoke: full agent-shaped flow against a temp vault — `add_moment` (all identity/placement shapes), paginate 60 moments, `response_format: "full"` fallback. Plus the **transcript eval** the skill checklist demands: run one real `cycle-planning` planting session and read it — did the agent pick `add_moment` first try, with the right args, in fewer calls than the old flow? |
| 5 | Delete wrapper-equivalence tests with the wrappers; parity test count drops to 64. |

---

## 10. Phases and appetite

Shape Up scale: tiny / small / medium / big. Each phase is independently shippable and ends
with build + smoke + reinstall.

| Phase | Contents | Appetite | Risk |
|---|---|---|---|
| **0 — Compact JSON** | Drop `null, 2` from `ok()`. Ship immediately; no caller parses whitespace. | **tiny** | none |
| **1 — Uniform envelope** | `defineTool()` wrapper; migrate 69 registrations to `registerTool` + annotations (`readOnlyHint` × 28, `destructiveHint`, `openWorldHint: false`); `response_format` on everything, default concise; concise projectors; parity test. Mechanical but wide — the whole file is touched once, deliberately, so no later phase does another sweep. | **medium** | Concise dropping a field a skill reads — mitigated by the §5 caller-compat check and the `full` escape hatch. |
| **2 — One way to plant** | `resolveAddMoment` + `add_moment`; `update_moment` gains `day`/`order`; `plan_cycle` gains `template`; six tools become deprecated wrappers over the new path; description trims (`list_people_to_reach`); server `instructions` updated to name `add_moment` in the typical-workflows section. | **medium** | Resolution-rule regressions — mitigated by the matrix tests + wrapper equivalence. |
| **3 — Pagination** | `paging.ts`; envelope on `list_moments` + `list_habits`. | **small** | Callers expecting a bare array — both tools' concise output changed in Phase 1 already; envelope lands in the same release train, callers adapt once (Phase 4). |
| **4 — Callers + docs + deploy** | Migrate `cycle-planning`, `week-planning`, garden-skills plugin; rewrite `TOOLS.md` against the real surface; extended smoke + one transcript eval; rebuild + reinstall so the live surface finally matches the repo. | **small** | Skill regressions — each migrated skill exercised once live before Phase 5. |
| **5 — Removal** | Delete the six wrappers after the §7 removal gate; `0.5.0`. | **tiny** | none if the gate held |

Sequencing: Phases 1–3 can land in one release (`0.4.0`); Phase 4 follows within days;
Phase 5 waits for the gate. Phase 2 depends on 1 (wrapper infra); 3 is independent of 2.

---

## 11. Decisions needing sign-off

1. **`fromPlan: boolean` instead of `cyclePlanId`** (§4.1 deviation). Recommended: yes —
   `cyclePlanId` is unobtainable through the current surface.
2. **`allocate_moment` folds into `update_moment`, not `add_moment`** (§3 deviation).
   Recommended: yes — creation and relocation are different tasks on different objects.
3. **Concise default flips in one release** rather than a two-release `full`-default grace
   period. Recommended: yes — every caller is an LLM skill under this roof; the two-step
   glide exists for surfaces with unknown callers, which this is not.
4. **Search tools stay three** (§3). Rejecting a collapse is also a decision.
5. `index.ts` per-family module split: deferred, tracked as follow-up (out of appetite).
