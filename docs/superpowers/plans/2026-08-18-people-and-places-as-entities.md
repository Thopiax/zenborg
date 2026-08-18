# People and Places as Entities — Implementation Plan (zenborg)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `Habit.kind`, replace 43 person-habits with 9 ritual habits, and carry person and place identity as registry entity keys in `Moment.personIds` and `Moment.placeIds`.

**Architecture:** Zenborg stops holding entity records and holds *references*. Person metadata (including declared contact cadence) belongs to wake's knowledge graph. **No collection is added to zenborg.** The hotline is a read composed at query time from registry cadence plus zenborg moments, storing nothing.

**Tech Stack:** TypeScript, Next.js + Tauri (Rust vault), Legend State observables, vitest, a separate `mcp-server` pnpm workspace that deliberately cannot import from `src/domain`.

**Spec:** `docs/superpowers/specs/2026-08-18-people-and-places-as-entities-design.md`
**Contract:** `kairos/kernel/entities.md` (revised 2026-08-18, stamp before Task 1)

**Scope:** this plan covers zenborg only, which is spec slices S3 and S4. Wake's registry (S2) and minting (S5) need their own plan in `penceive`. Per spec C4, the queue returns nothing until S2 lands; that is expected, not a bug in this work.

## Global Constraints

- **NO NEW COLLECTION.** Two earlier drafts of this design added one (`people.json`/`places.json`, then `hotline.json`). Both were wrong. If a task seems to need somewhere to put person data, the answer is the registry, not the vault. Re-read spec D1 and D9.
- **Everything `mcp-server` needs must be written twice.** It is a separate workspace and cannot import `src/domain`. Health, person logic and validation are already duplicated on purpose. Never introduce a cross-import.
- **Absent, never empty.** An optional list field is deleted when it would be `[]`. Copy the `personIds` block at `mcp-server/index.ts:1519-1528`.
- **Slug rule is fixed** (contract, "Deriving a key from a label"): lowercase → strip diacritics → non-alphanumeric to dash → collapse dash runs → trim dashes. `"São Paulo"` → `sao-paulo`.
- **Cadence is four buckets**, not a `Rhythm`: `weekly | monthly | quarterly | yearly`. Overdue ratio is days-since divided by the bucket's day count.
- **All test fixtures are synthetic.** Use `ada`, `bea`, `cai`. Never a real name from the vault or the Notion CSV, in a test or a commit message.
- **Frozen clocks.** `const NOW = new Date("2026-08-18T12:00:00.000Z")`. Never `new Date()` in a test.
- **`pnpm test` runs both packages** (`vitest.config.mts` includes `src/**` and `mcp-server/**`).
- **Nothing automated typechecks `.mts`.** `tsconfig.json` `include` uses `**/*.ts`, which does not match `.mts`, and `.husky/pre-commit` runs `pnpm test` only. Run `npx tsc --noEmit --strict` by hand on any `.mts` file.
- **`pnpm lint` is red at baseline** (205 errors, 116 warnings). Diff against baseline.
- **Migrations are written and NOT run.** Running them against the live vault needs Rafa's explicit go-ahead with the desktop app closed.

---

## Task 0: Repair the worktree baseline

**Files:** none committed.

`pnpm vitest run` currently fails 4 of 49 files (`mcp-server/health.test.ts`, `people.test.ts`, `validation.test.ts`, `vault.test.ts`) with `Cannot find package 'zod'`. `mcp-server` is a separate workspace and its dependencies are not installed in this worktree. A red baseline makes every later task ambiguous.

- [ ] **Step 1:** `pnpm install` at the root, then install the `mcp-server` workspace's own dependencies.
- [ ] **Step 2:** `pnpm vitest run`. Expect 49 files passing, 747+ tests. Record the number; it is the baseline every later task is judged against.
- [ ] **Step 3:** No commit. This is environment repair, not a change.

---

## Part A — People (spec S3)

### Task 1: Cadence in the domain

**Files:**
- Create: `src/domain/value-objects/Cadence.ts`
- Test: `src/domain/__tests__/Cadence.test.ts`

**Interfaces:**
- Produces: `type Cadence = "weekly" | "monthly" | "quarterly" | "yearly"`, `cadenceDays(c: Cadence): number`, `overdueRatio(daysSince: number, c: Cadence): number`

Day counts: weekly 7, monthly 30, quarterly 91, yearly 365. `overdueRatio` returns `daysSince / cadenceDays`, rounded to 2 decimals, matching the existing `mcp-server/people.ts:153-163` rounding exactly so the two implementations agree.

- [ ] **Step 1: Write the failing tests.** `overdueRatio(20, "weekly")` is 2.86; `overdueRatio(400, "yearly")` is 1.10; the weekly value sorts above the yearly one. This is the corrigendum's warning encoded as a test.
- [ ] **Step 2: Run, expect failure.** `pnpm vitest run src/domain/__tests__/Cadence.test.ts`
- [ ] **Step 3: Implement.** Pure functions, no I/O.
- [ ] **Step 4: Run, expect pass. Mirror the file into `mcp-server/cadence.ts` with its own test.**
- [ ] **Step 5: Commit.** `feat(people): cadence as four buckets, not a rhythm`

### Task 2: `PersonService` takes cadence as a parameter

**Files:**
- Modify: `src/domain/services/PersonService.ts:116-132` (`personHealth`)
- Test: `src/domain/services/__tests__/PersonService.test.ts`

**Interfaces:**
- Consumes: `Cadence`, `overdueRatio` (Task 1)
- Produces: `personHealth(personKey: string, cadence: Cadence | null, status: "active" | "paused", moments: Moment[], now: Date): Health`

`personMoments`, `latestContactDate`, `hasArrangedContact` and `daysSinceLastContact` change only in that their first parameter is a slug rather than a habit UUID. `personHealth` stops taking a `Habit` and stops reading `person.rhythm`.

- [ ] **Step 1: Write the failing tests.** `cadence: null` → `unstated` (spec verification 8). `status: "paused"` → `unstated` regardless of silence (spec verification 7). Cadence set, never contacted → `wilting`. Cadence set, contacted within the bucket → `blooming`.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Change the signature and implementation.**
- [ ] **Step 4: Delete `kind` from the test's `person()` factory** (`:59`) and make fixtures slug-keyed and synthetic.
- [ ] **Step 5: Run, expect pass. Commit.** `refactor(people): person health takes a declared cadence`

### Task 3: Mirror in `mcp-server`, repoint the queue

**Files:**
- Modify: `mcp-server/people.ts` (five pure functions `:30-134`; `overdueRatio` `:153-163` now imports from `mcp-server/cadence.ts`; `selectPeopleToReach` `:192-243`; delete the `habit.kind !== 'person'` filter at `:202`)
- Modify: `mcp-server/index.ts:698-713` (`list_people_to_reach`)
- Test: `mcp-server/people.test.ts`

**Interfaces:**
- Produces: `selectPeopleToReach(people: RegistryPerson[], moments: Moment[], now: Date, opts: { category?: string; limit?: number }): PersonToReach[]` where `RegistryPerson = { key, cadence, status, category, favorite, basePlace }`

`PersonToReach` loses `areaId`, gains `key` and `category`. It carries **no display name**: the registry owns that, and fail-soft says render the key. The `areaId` and `tag` filters go, since both read habit fields that no longer exist. `far` arrives in Task 7.

The tool reads registry people through wake. Until that resolve tool exists (spec C2), it receives an empty list and returns an empty queue. **Write it so an empty registry is a normal empty result, never an error.**

**Preserve exactly, both load-bearing:** overdue-ratio ranking, never raw days; and the `hasArrangedContact` future-moment exclusion at `:218`.

- [ ] **Step 1: Write the failing tests.** Port existing tests to the registry shape. Add: weekly-at-20-days outranks yearly-at-400. Add: a future-dated moment removes someone from the queue. Add: `status: "paused"` removes them. Add: an empty registry returns `[]` and does not throw.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement**, mirroring Task 2 byte for byte.
- [ ] **Step 4: Update `mcp-server/TOOLS.md:180`.**
- [ ] **Step 5: Run, expect pass. Commit.** `refactor(hotline): the queue reads registry cadence`

### Task 4: Delete `Habit.kind`

**Files:**
- Modify: `src/domain/entities/Habit.ts:16-25` (`HabitKind`), `:49` (field), `:391-396` (`isPerson`)
- Modify: `mcp-server/vault.ts:144`; `mcp-server/index.ts:378`, `:424`, `:452`, `:509-515`
- Modify: `mcp-server/TOOLS.md:107-108,180`
- Modify: `scripts/globe.mjs:9,88,145,441`
- Delete tests: `src/domain/__tests__/Habit.test.ts:369-373`
- Modify fixtures: `src/application/__tests__/CycleService.test.ts:1177`, `src/infrastructure/__tests__/harvestViewModel.test.ts:77`

`isPerson()` has **zero callers** outside its own definition and tests. Record that in the commit body: the 43 person-habits were never actually filtered from the plant deck or cycle planning, so removing them in Task 8 is the first time those views become correct.

`scripts/globe.mjs` is a fifth producer of `kind` that no prior document mentions; it creates person-habits via `POST /api/person`. Retire that path rather than port it.

- [ ] **Step 1: Delete the type, the field and `isPerson`.**
- [ ] **Step 2: `npx tsc --noEmit`** and let it enumerate every consumer.
- [ ] **Step 3: Work to green**, removing `kind` from zod schemas and the update-clear block at `:509-515`.
- [ ] **Step 4: `pnpm test`. Commit.** `feat!: delete Habit.kind — a person is not a perennial`

### Task 5: Harvest renders keys, fail-soft

**Files:**
- Modify: `src/infrastructure/state/harvestViewModel.ts:134`
- Test: `src/infrastructure/__tests__/harvestViewModel.test.ts:232`

`:134` resolves `personIds` through `habitsById.get(id)?.name`, which silently yields nothing once they are slugs. Per the kernel's fail-soft rule, render the key.

- [ ] **Step 1: Write the failing test.** `personIds: ["ada","bea"]` with no matching habit renders `["ada","bea"]`, not `[]`.
- [ ] **Step 2: Run, expect failure.** The existing test at `:232` expects unresolved entries dropped, which is the behaviour being reversed.
- [ ] **Step 3: Implement.** Drop the `habitsById` lookup.
- [ ] **Step 4: Run, expect pass. Commit.** `fix(harvest): render unresolved entity keys instead of dropping them`

---

## Part B — Places (spec S4)

### Task 6: `Moment.placeIds` and `Moment.placeUrl`

**Files:**
- Modify: `src/domain/entities/Moment.ts:32-65` (interface), validation near `:88-113`
- Modify: `mcp-server/vault.ts:180-203`, `mcp-server/validation.ts:81-136`
- Test: `src/domain/__tests__/Moment.test.ts` and a mirror in `mcp-server`

**Interfaces:**
- Produces: `placeIds?: string[]`, `placeUrl?: string`, `slugify(label: string): string`, `validatePlaceUrl(url: string | undefined): string | null`

`slugify` implements the contract rule and lives in both packages. `placeUrl` validates with the existing `isParseableRef` (`Moment.ts:74-81`).

- [ ] **Step 1: Write the failing tests.** `slugify("São Paulo") === "sao-paulo"`; `slugify("Café Lab, Vila Madalena") === "cafe-lab-vila-madalena"`; dash runs collapse; leading and trailing dashes trim. `placeIds` types as `string[] | undefined`, a bare string fails (`@ts-expect-error`). `validatePlaceUrl` rejects a non-URL, accepts a Maps link.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement in `src/domain`, then mirror into `mcp-server`.**
- [ ] **Step 4: Run, expect pass. Commit.** `feat(places): placeIds and placeUrl on Moment`

### Task 7: MCP write path and the `far` filter

**Files:**
- Modify: `mcp-server/index.ts:1369-1413` (`buildMoment`), `:1455-1533` (`update_moment`), `:1750-1811` (`create_standalone_moment`)
- Modify: `mcp-server/people.ts` (`selectPeopleToReach`), `mcp-server/index.ts:698-713`

`placeIds` copies the `personIds` block at `:1519-1528` exactly. `placeUrl` copies the singular-nullable `startTime` pattern at `:1508-1513`.

Do **not** inherit `placeIds` or `placeUrl` in `spawn_spontaneous_from_habit` (`:1689-1748`) or `allocate_from_plan` (`:1611-1689`), for the reason already recorded at `:1724-1726` about refs: a habit template has no place.

`far` compares a person's registry `basePlace` against the `placeIds` of the current cycle.

- [ ] **Step 1: Write the failing tests.** `create_standalone_moment` with `placeIds` round-trips. `update_moment({ placeIds: [] })` deletes the key. `update_moment({ placeUrl: null })` deletes the key. A non-URL `placeUrl` is rejected. With a cycle in `sao-paulo`, a person based in `london` is `far: true`; based in `sao-paulo`, `far: false`; unknown base, `far: null`.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement.** One change in `buildMoment` serves both create tools.
- [ ] **Step 4: Update `mcp-server/TOOLS.md`. Run, expect pass. Commit.** `feat(places): write placeIds and placeUrl, and filter the queue by distance`

### Task 8: Retire the person/place tag framing

**Files:**
- Modify: `mcp-server/index.ts:1975-1986` (`list_tags`), `:1988-2005` (`get_tag_profile`), `:2007-2020` (`get_related_habits`)
- Modify: `mcp-server/TOOLS.md:165`

`tags.ts` and `graph.ts` logic needs **no change**: they never parsed the prefixes, they only aggregate strings. Only the docstrings claim `person-`/`place-` are the People and Places indexes, and that claim is now false.

- [ ] **Step 1: Rewrite the three docstrings** to describe generic tag aggregation, pointing people and place questions at `personIds` and `placeIds`.
- [ ] **Step 2: `pnpm test`.** Fixtures in `tags.test.ts` and `graph.test.ts` use person/place tags as examples of generic tags and stay valid. Commit. `docs(mcp): tags are tags again`

---

## Part C — Migration (written, reviewed, NOT run)

### Task 9: Registry export

**Files:**
- Create: `scripts/people-to-registry.mts`

Spec Migration steps 2 and 4. Join the 43 person-habits to the 46 Notion CSV rows by slugged name, and emit one registry export file for wake to ingest. Carry `category`, `cadence`, `status`, `favorite`, `notes`, aliases, emoji and base place.

Where a habit's `rhythm` and the CSV's `Frequency` disagree, **the CSV wins**: it is the record Rafa curated, and only twelve habits carry a rhythm. Report every name present in one source and not the other rather than guessing at a match.

Drop `Time to Chat`, `Share Moment`, `Reasons to chat` (empty in all 46 rows), `Tags` (one meaningless value), and `Last Chat At` / `Next Chat At` (derived from moments).

**This script reads real contact data.** It writes an export file for local ingestion. It must not print names to stdout beyond a count and a list of unmatched keys, and no name from it may reach a test fixture or a commit message.

- [ ] **Step 1: Write the pure `buildRegistryExport(habits, csvRows)` function**, separated from all I/O, as `scripts/people-migration.mts:267-380` does.
- [ ] **Step 2: Unit-test it against synthetic habits and synthetic CSV rows.**
- [ ] **Step 3: `npx tsc --noEmit --strict scripts/people-to-registry.mts`.**
- [ ] **Step 4: Run dry, inspect counts only. Commit the script.** `feat(migration): export people to the registry`

### Task 10: Moment rewrite

**Files:**
- Create: `scripts/moments-to-entity-keys.mts`

Spec Migration steps 3, 5, 6, 7. Rewrite person-moments to `habitId: null` with slug `personIds`; archive the person-habits; convert `place-<key>` to `placeIds`; drop the short-form duplicates (`sp`, `bcn`, `nyc`, `london`, `paris`, `madrid`).

**Do not convert a `place-` tag that arrived by inheritance from a person-habit.** That is the London-breakfast lie. A moment with no `placeIds` is honest; one with the wrong place is not.

Copy `scripts/people-migration.mts` wholesale for structure: dry-run default, `--write`, `--force`, running-app detection via `/bin/ps` (`:169-211`, excluding the `zenborg-mcp` sidecar), the validate-then-refuse gate (`:474-487`), the timestamped `.bak` (`:538-543`) and the atomic write (`:224-246`).

- [ ] **Step 1: Write the pure transform and its tests**, including the inheritance case explicitly.
- [ ] **Step 2: `npx tsc --noEmit --strict`.**
- [ ] **Step 3: Run dry. Inspect. Do not write. Commit.** `feat(migration): moments carry entity keys`

### Task 11: Verification

- [ ] **Step 1: `pnpm test`** green across both packages, at or above the Task 0 baseline.
- [ ] **Step 2: `npx tsc --noEmit`** clean.
- [ ] **Step 3: `pnpm lint`** diffed against the 205/116 baseline, no new errors.
- [ ] **Step 4: Report to Rafa** with both dry-run outputs and an explicit request to run the migrations with the app closed.

---

## Out of scope for this plan

- **Wake's registry (spec S2) and minting (S5)**, in `penceive/crates/wake`. Needs its own plan: person entities with the D10 shape, the key-resolve tool, and place minting from `placeUrl`.
- **Desktop UI pickers** for people and places. MCP-first, as the last people bet shipped.
- **The `.ics` feed.** Unbuilt, and blocked on S5.
