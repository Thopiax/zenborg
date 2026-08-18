# People and Places as Entities — Implementation Plan (zenborg)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `Habit.kind`, replace 43 person-habits with 9 ritual habits, move person and place identity to registry entity keys carried in `Moment.personIds` / `Moment.placeIds`, and give the hotline its own collection.

**Architecture:** Zenborg stops holding entity records. It holds *references* (slug keys) and its own *commitments* (`hotline.json`). Person and place metadata belongs to wake's knowledge graph. An unresolved key renders as itself (the kernel's fail-soft rule), so zenborg ships and works before wake mints anything.

**Tech Stack:** TypeScript, Next.js + Tauri (Rust vault), Legend State observables, vitest, a separate `mcp-server` pnpm workspace that deliberately cannot import from `src/domain`.

**Spec:** `docs/superpowers/specs/2026-08-18-people-and-places-as-entities-design.md`
**Contract:** `kairos/kernel/entities.md` (revised 2026-08-18, must be stamped before Task 1)

## Global Constraints

- **Everything in `src/domain` that `mcp-server` needs must be written twice.** `mcp-server` is a separate workspace and cannot import `src/domain`. Health, person logic and validation are already duplicated on purpose. Mirror every change; never introduce a cross-import.
- **Absent, never empty.** An optional list field is deleted when it would be `[]`. One representation for "none". Copy the `personIds` block at `mcp-server/index.ts:1519-1528`.
- **Slug rule is fixed** (contract, "Deriving a key from a label"): lowercase → strip diacritics → non-alphanumeric to dash → collapse dash runs → trim dashes. `"São Paulo"` → `sao-paulo`.
- **All test fixtures are synthetic.** No real person from the vault appears in any test. Use `ada`, `bea`, `cai`.
- **Frozen clocks.** `const NOW = new Date("2026-08-18T12:00:00.000Z")`. Never `new Date()` in a test. Shift calendar dates, not milliseconds.
- **`pnpm test` runs both packages** (`vitest.config.mts` includes `src/**` and `mcp-server/**`).
- **Nothing automated typechecks `.mts`.** `tsconfig.json` `include` uses `**/*.ts`, which does not match `.mts`, and `.husky/pre-commit` runs `pnpm test` only. Run `npx tsc --noEmit --strict` by hand on any `.mts` file before committing it.
- **`pnpm lint` is red at baseline** (205 errors, 116 warnings). Diff against baseline; do not treat existing noise as regression.
- **Migrations are written and NOT run.** Tasks 13 and 14 produce scripts. Running them against the live vault requires Rafa's explicit go-ahead with the desktop app closed.

---

## Part A — People and the hotline (S2)

### Task 1: The `Hotline` entity

**Files:**
- Create: `src/domain/entities/Hotline.ts`
- Test: `src/domain/__tests__/Hotline.test.ts`

**Interfaces:**
- Produces: `interface Hotline { rhythm: Rhythm; startedAt: string; pausedAt?: string }`, `function isPaused(entry: Hotline, now: Date): boolean`

**Design note:** the collection is `Record<entityKey, Hotline>`, keyed by slug. It carries **no `id` field** (the map key is the identity) and **no name, alias, note or relation** (all of that is registry metadata the spec forbids zenborg from holding). Follow `src/domain/entities/DayNote.ts`, which is the only existing non-UUID-keyed collection.

- [ ] **Step 1: Read the precedent.** `src/domain/entities/DayNote.ts` for the no-`id` map-keyed convention, and `Rhythm` in `src/domain/entities/Habit.ts`.
- [ ] **Step 2: Write the failing tests.** `isPaused` returns false when `pausedAt` is absent; true when `pausedAt` is a past ISO timestamp; false when `pausedAt` is in the future. Assert at the type level that `Hotline` has no `id` property.
- [ ] **Step 3: Run, expect failure.** `pnpm vitest run src/domain/__tests__/Hotline.test.ts`
- [ ] **Step 4: Implement.** Types plus `isPaused`. No I/O.
- [ ] **Step 5: Run, expect pass. Commit.** `feat(hotline): the Hotline entity, keyed by entity slug`

### Task 2: Wire `hotline` through the vault, all nine files

**Files (in this order):**
- Modify: `src-tauri/src/vault/fs.rs:50-60` (`ALLOWED_COLLECTIONS`) **and** the stale module doc at `:9-20`, which already omits `dayNotes`
- Modify: `mcp-server/vault.ts` (add `Hotline` interface near `MetricLog` at `:219-226`; `COLLECTION_NAMES` `:232-240`; `CollectionTypeMap` `:243-251`)
- Modify: `src/domain/registry.ts` (`DomainModelRegistry` `:34-43`, `EXPORTABLE_MODELS` `:49-58`, `COLLECTION_METADATA` `:76-125`)
- Modify: `src/infrastructure/state/store.ts:87,93` (add `hotline$`) and `resetDatabase()` `:675-692`
- Modify: `src/infrastructure/state/persistence.ts` (`configureVaultSync()` `:78-90`; `configureIdbOnly()` table list `:102-111` and its `syncObservable` `:140-147`)
- Modify: `src/infrastructure/vault/synced-vault.ts:29-42` (`IDB_CONFIG.tableNames`, a second independent copy of the same list)
- Modify: `src/infrastructure/state/initialize.ts:45-53` (`seedVaultFromCacheIfNeeded`)
- Modify: `src/application/use-cases/export-import.ts` (follow every `dayNotes` site: `:37-50`, `:71-105`, `:149-194`, `:242-265`, `:283-292`, `:296-313`, `:316-325`, the merge loop `:390-397`, `:399-407`, `:409-433`)
- Modify: `src/infrastructure/state/export-import.ts:15,17,38-39,48-49,121-122,133-134,148-149,164-165`

**Interfaces:**
- Consumes: `Hotline` from Task 1
- Produces: `hotline$` observable; `readCollection(VAULT_ROOT, 'hotline')` available to mcp-server

**Two decisions to make deliberately, not by copying:**
- `dayNotes$` is **not** cleared in `resetDatabase()`. Clear `hotline$` there. A "reset all data" that silently keeps your contact commitments is a bug, not a feature.
- `dayNotes` is **not** in `seedVaultFromCacheIfNeeded`. Add `hotline`, because the migration seeds it before the desktop app ever writes it.

**Close the drift while you are here:** add `dayNotes` to `mcp-server/vault.ts` `COLLECTION_NAMES` and `CollectionTypeMap`. It is currently invisible to every MCP tool, which the spec calls out as pre-existing divergence.

- [ ] **Step 1: Rust first.** Add `"hotline"` to `ALLOWED_COLLECTIONS` and fix the module doc comment to list both `dayNotes.json` and `hotline.json`.
- [ ] **Step 2: Run the type gate and watch it fail loudly.** `npx tsc --noEmit`. `src/domain/registry.ts` enforces completeness by design, so adding `hotline` to `DomainModelRegistry` will break roughly twenty object literals in `src/application/__tests__/export-import.test.ts`. This is intended friction.
- [ ] **Step 3: Work the compiler to green.** Add `hotline: {}` to every failing literal. Do not weaken the registry type to avoid this.
- [ ] **Step 4: Write the round-trip test.** Export a state containing one hotline entry, import it, assert it survives. Add it beside the `dayNotes` round-trip test in `src/application/__tests__/export-import.test.ts`.
- [ ] **Step 5: Run `pnpm test` and `npx tsc --noEmit`. Both green. Commit.** `feat(hotline): wire the collection through vault, stores and export`

### Task 3: `PersonService` reads the hotline, not the habit

**Files:**
- Modify: `src/domain/services/PersonService.ts:116-132` (`personHealth`)
- Test: `src/domain/services/__tests__/PersonService.test.ts`

**Interfaces:**
- Consumes: `Hotline` (Task 1)
- Produces: `personHealth(personKey: string, entry: Hotline | undefined, moments: Moment[], now: Date): Health`

`personMoments`, `latestContactDate`, `hasArrangedContact` and `daysSinceLastContact` are rhythm-agnostic and change only in that their first parameter is now a slug rather than a habit UUID. `personHealth` is the only real change: it stops taking a `Habit` and stops reading `person.rhythm`.

- [ ] **Step 1: Write the failing tests.** No entry → `unstated`. Entry with rhythm, never contacted → `wilting`. Entry with rhythm, contacted within threshold → `blooming`. Entry with `pausedAt` in the past → `unstated` (a paused commitment is not a broken one).
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Change the signature and implementation.** Keep `rhythmSilenceThresholdDays` exactly as is.
- [ ] **Step 4: Delete `kind` from the test's `person()` factory** (`:59`) and rename it to a slug-keyed fixture.
- [ ] **Step 5: Run, expect pass. Commit.** `refactor(people): person health reads the hotline, not a habit`

### Task 4: Mirror Task 3 in `mcp-server`, and repoint the queue

**Files:**
- Modify: `mcp-server/people.ts` (five pure functions `:30-134`; `selectPeopleToReach` `:192-243`; delete the `habit.kind !== 'person'` filter at `:202`)
- Modify: `mcp-server/index.ts:698-713` (`list_people_to_reach` handler)
- Test: `mcp-server/people.test.ts`

**Interfaces:**
- Produces: `selectPeopleToReach(hotline: Record<string, Hotline>, moments: Moment[], now: Date, opts: { limit?: number }): PersonToReach[]`

`PersonToReach` loses `areaId` and gains `key: string`. It carries **no display name**: the registry owns that, and the kernel's fail-soft rule says a consumer renders the key itself. The `areaId` and `tag` filters go, because both read habit fields that no longer exist. The `far` filter arrives in Task 12.

**Preserve exactly, both are load-bearing:**
- `overdueRatio` ranking (`:153-172`), never raw days. The corrigendum records why: raw days permanently starves a twice-weekly friend behind an annual relative.
- `hasArrangedContact` future-moment exclusion (`:218`). Arranging dinner three weeks out must stop the nagging.

- [ ] **Step 1: Write the failing tests.** Port every existing test in `mcp-server/people.test.ts` to the hotline shape. Add: a twice-weekly entry silent 20 days outranks an annual entry silent 400 days. Add: an entry with a future-dated moment is absent from the queue. Add: a paused entry is absent.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement**, mirroring Task 3's domain logic byte for byte.
- [ ] **Step 4: Update the handler** to read `readCollection(VAULT_ROOT, 'hotline')` and drop `habits`.
- [ ] **Step 5: Update `mcp-server/TOOLS.md:180`** to describe the new filters.
- [ ] **Step 6: Run, expect pass. Commit.** `refactor(hotline): the queue reads commitments, not person-habits`

### Task 5: Delete `Habit.kind`

**Files:**
- Modify: `src/domain/entities/Habit.ts:16-25` (`HabitKind`), `:49` (field), `:391-396` (`isPerson`)
- Modify: `mcp-server/vault.ts:144`
- Modify: `mcp-server/index.ts:378`, `:424`, `:452`, `:509-515`
- Modify: `mcp-server/TOOLS.md:107-108,180`
- Modify: `scripts/globe.mjs:9,88,145,441`
- Delete tests: `src/domain/__tests__/Habit.test.ts:369-373`
- Modify fixtures: `src/application/__tests__/CycleService.test.ts:1177`, `src/infrastructure/__tests__/harvestViewModel.test.ts:77`

`isPerson()` has **zero callers** outside its own definition and tests, so deleting it is safe. Note what that means and record it in the commit: the 43 person-habits were never actually filtered out of the plant deck or cycle planning. Removing them from `habits.json` in Task 13 is the first time that view becomes correct.

`scripts/globe.mjs` is a fifth producer of `kind` that no prior document mentions. It creates person-habits via `POST /api/person`. Retire that path rather than port it.

- [ ] **Step 1: Delete the type, the field and `isPerson`.**
- [ ] **Step 2: Run `npx tsc --noEmit`** and let it enumerate every consumer.
- [ ] **Step 3: Work to green**, removing `kind` from zod schemas and the update-clear block.
- [ ] **Step 4: Run `pnpm test`.** Commit. `feat!: delete Habit.kind — a person is not a perennial`

### Task 6: Harvest renders keys, fail-soft

**Files:**
- Modify: `src/infrastructure/state/harvestViewModel.ts:134`
- Test: `src/infrastructure/__tests__/harvestViewModel.test.ts:232`

`:134` currently resolves `personIds` to display names via `habitsById.get(id)?.name`. Once `personIds` holds slugs this silently yields nothing. Per the kernel's fail-soft rule, render the key itself.

- [ ] **Step 1: Write the failing test.** A moment with `personIds: ["ada", "bea"]` and no matching habit renders `["ada", "bea"]`, not `[]`.
- [ ] **Step 2: Run, expect failure** (the existing test at `:232` uses `["p1","p2","gone"]` and expects the unresolved one dropped, which is the behaviour being reversed).
- [ ] **Step 3: Implement.** Drop the `habitsById` lookup entirely.
- [ ] **Step 4: Run, expect pass. Commit.** `fix(harvest): render unresolved entity keys instead of dropping them`

### Task 7: Create the nine rituals

**Files:**
- Create: `scripts/create-rituals.mts`

Family: `FaceTime`, `sunday dinner`, `breakfast`. Friends: `long call`, `reach out`, `coffee`, `drinks`, `football night`. Sensitive: `date`.

`sunday dinner` gets `guidance: "When I'm in SP."` Rhythm has no notion of place and must not grow one.

- [ ] **Step 1: Write the script**, dry-run by default, `--write` to apply, copying the CLI shape of `scripts/people-migration.mts:387-400`.
- [ ] **Step 2: `npx tsc --noEmit --strict scripts/create-rituals.mts`.** Nothing else typechecks `.mts`.
- [ ] **Step 3: Run dry, inspect output. Commit the script, do not run it.** `feat(rituals): the nine perennials that replace forty-three people`

---

## Part B — Places (S3)

### Task 8: `Moment.placeIds` and `Moment.placeUrl`

**Files:**
- Modify: `src/domain/entities/Moment.ts:32-65` (interface), validation near `:88-113`
- Modify: `mcp-server/vault.ts:180-203`, `mcp-server/validation.ts:81-136`
- Test: `src/domain/__tests__/Moment.test.ts`, and a mirror in `mcp-server`

**Interfaces:**
- Produces: `placeIds?: string[]`, `placeUrl?: string`, `slugify(label: string): string`, `validatePlaceUrl(url: string | undefined): string | null`

`slugify` implements the contract's rule and must live in both packages. `placeUrl` validates with the existing `isParseableRef` (`Moment.ts:74-81`).

- [ ] **Step 1: Write the failing tests.** `slugify("São Paulo") === "sao-paulo"`; `slugify("Café Lab, Vila Madalena") === "cafe-lab-vila-madalena"`; collapsing dash runs; trimming leading and trailing dashes. `placeIds` types as `string[] | undefined`; a bare string fails to assign (`@ts-expect-error`). `validatePlaceUrl` rejects a non-URL and accepts a Maps link.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement in `src/domain`, then mirror into `mcp-server`.**
- [ ] **Step 4: Run, expect pass. Commit.** `feat(places): placeIds and placeUrl on Moment`

### Task 9: The MCP write path

**Files:**
- Modify: `mcp-server/index.ts:1369-1413` (`buildMoment`), `:1455-1533` (`update_moment`), `:1750-1811` (`create_standalone_moment`)

`placeIds` copies the `personIds` block at `:1519-1528` exactly (list, `'field' in updates` gate, empty clears the key). `placeUrl` copies the singular-nullable `startTime` pattern at `:1508-1513`.

Do **not** inherit `placeIds` or `placeUrl` in `spawn_spontaneous_from_habit` (`:1689-1748`) or `allocate_from_plan` (`:1611-1689`), for the reason already recorded at `:1724-1726` about refs: a habit template has no place.

- [ ] **Step 1: Write the failing tests.** `create_standalone_moment` with `placeIds` round-trips. `update_moment({ placeIds: [] })` deletes the key. `update_moment({ placeUrl: null })` deletes the key. A non-URL `placeUrl` is rejected.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement.** One change in `buildMoment` serves both create tools.
- [ ] **Step 4: Update `mcp-server/TOOLS.md`. Run, expect pass. Commit.** `feat(places): write placeIds and placeUrl through MCP`

### Task 10: Retire the person/place tag framing

**Files:**
- Modify: `mcp-server/index.ts:1975-1986` (`list_tags`), `:1988-2005` (`get_tag_profile`), `:2007-2020` (`get_related_habits`)
- Modify: `mcp-server/TOOLS.md:165`

`tags.ts` and `graph.ts` logic is generic and needs **no change**: they never parsed the prefixes, they only aggregate strings. Only the docstrings claim `person-`/`place-` are the People and Places indexes, and that claim is now false.

- [ ] **Step 1: Rewrite the three docstrings** to describe generic tag aggregation. Point people and place questions at `personIds` / `placeIds`.
- [ ] **Step 2: Run `pnpm test`.** The fixtures in `tags.test.ts` and `graph.test.ts` use person/place tags as examples of generic tags and stay valid. Commit. `docs(mcp): tags are tags again`

### Task 11: The `far` filter

**Files:**
- Modify: `mcp-server/people.ts` (`selectPeopleToReach`), `mcp-server/index.ts:698-713`

A person is *far* when their registry base place differs from the `placeIds` of the current cycle. Until wake exposes a key-resolve tool (spec C2), the base place is unavailable, so `far` reads the person's most recent moment `placeIds` as a stand-in and is documented as approximate.

- [ ] **Step 1: Write the failing test.** With a current cycle in `sao-paulo`, an entry last seen in `london` is `far: true`; one last seen in `sao-paulo` is `far: false`; one never seen is `far: null`.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement and expose `far?: boolean` as a filter on the tool.**
- [ ] **Step 4: Run, expect pass. Commit.** `feat(hotline): filter the queue by distance`

---

## Part C — Migration (written, reviewed, NOT run)

### Task 12: People migration script

**Files:**
- Create: `scripts/people-to-entities.mts`

Copy the structure of `scripts/people-migration.mts` wholesale: dry-run default, `--write`, `--force`, running-app detection via `/bin/ps` (`:169-211`, excluding the `zenborg-mcp` sidecar), the validate-then-refuse gate (`:474-487`), the timestamped `.bak` (`:538-543`) and the atomic write (`:224-246`).

Steps 1 to 5 and 8 of the spec's Migration section: emit a registry export file for wake, rewrite person-moments to `habitId: null` with slug `personIds`, seed `hotline.json` from the twelve habits carrying a rhythm, archive the person-habits.

- [ ] **Step 1: Write the pure `migrate()` function** separated from all I/O, as `people-migration.mts:267-380` does.
- [ ] **Step 2: Write unit tests for `migrate()`** against synthetic habits and moments.
- [ ] **Step 3: `npx tsc --noEmit --strict`.**
- [ ] **Step 4: Run dry against the live vault. Inspect. Do not write. Commit.** `feat(migration): people become entity keys`

### Task 13: Place migration script

**Files:**
- Create: `scripts/place-tags-to-ids.mts`

Spec Migration steps 6 and 7. Convert `place-<key>` on a moment to `placeIds`. Drop the short-form duplicates (`sp`, `bcn`, `nyc`, `london`, `paris`, `madrid`). **Do not convert a `place-` tag that arrived by inheritance from a person-habit**, which is the London-breakfast lie: a moment with no `placeIds` is honest, a moment with the wrong one is not.

Use `scripts/backfill-place-tags.mjs` as the structural template.

- [ ] **Step 1: Write the pure transform and its tests**, including the inheritance case explicitly.
- [ ] **Step 2: `npx tsc --noEmit --strict`.**
- [ ] **Step 3: Run dry. Inspect. Do not write. Commit.** `feat(migration): place tags become placeIds`

### Task 14: Verification

- [ ] **Step 1: `pnpm test` green across both packages.**
- [ ] **Step 2: `npx tsc --noEmit` clean.**
- [ ] **Step 3: `pnpm lint` diffed against the 205/116 baseline, no new errors.**
- [ ] **Step 4: Report to Rafa** with both dry-run outputs and an explicit request to run the migrations with the app closed.

---

## Out of scope for this plan

- **S4, wake's minting** (`penceive/crates/wake`). Needs its own plan in that repo: parse `placeUrl`, mint `kairos:place/<key>` with parent chain and coordinates, expose the key-resolve tool spec C2 requires.
- **Desktop UI pickers** for people and places. MCP-first, as the last people bet shipped.
- **The `.ics` feed.** Unbuilt, and blocked on S4.
