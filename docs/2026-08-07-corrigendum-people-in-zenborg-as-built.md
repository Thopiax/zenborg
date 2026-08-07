---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:f697e0539a1928969b50b73908832864443baa4e69a0bc624621716923f3e15d
  signedAt: 2026-08-07T16:15:21.473159Z
  signature: ed25519:svzib3RcdO0cGVBbSKUhfOtzmsLCOWrENOVwU2Qb7p700lujpudZ1wUH91MvaWU3Zzoi4Fm8Is6O/d40lpqLDQ==
type: note
---
# Corrigendum: people in zenborg, as built

**Date:** 2026-08-07
**Corrects:** `docs/decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md`, which is signed and attested and therefore not edited in place.

The core decision stands: a person is a `Habit` carrying `kind: "person"`, there is no `people.json`, and `Moment.personIds` carries the many-to-many. Three statements in that document are wrong or incomplete.

## 1. There are 43 people, not 48

The original count filtered on `archived`. The field is **`isArchived`**, so the query matched nothing and silently included archived records. Measured live: the Family, Friends and Sensitive areas hold 50 records, of which 7 are archived (`Ira`, `Kim`, `Lia`, `Mio`, `colloc auber`, `a-relative`, `family breakfast`), leaving 43 live. Two are rituals, so 41 get marked and the two fused pairs split into four — **43 people**.

Only 12 carry a rhythm. Since no rhythm yields `unstated` rather than `wilting`, the outreach queue starts short by construction. That is honest: a roster is not a commitment.

The count moved three times during implementation (48 → 44 → 43) because the vault is live and was edited in the running app while the work was under way. Any figure in any document is stale on arrival; the migration derives its roster at run time and no number is hardcoded anywhere in it.

## 2. The `HabitHealthService` change was larger than "one line"

The decision doc scoped it as a single filter edit. Two things were missed.

First, health is implemented **twice** — `src/domain/services/HabitHealthService.ts` and `mcp-server/health.ts` — so any shared change is paid twice.

Second, and more importantly: `computeHealth` gates on `attitude` *before* rhythm (`attitude === null` short-circuits to `"unstated"`). Of the person records, 14 carried no attitude and 19 carried KEEPING with no rhythm, so routing people through it would have returned `"unstated"` for most of them — and would have made attitude load-bearing for people, the exact coupling this design set out to remove. Person health therefore lives in a separate, attitude-free `PersonService` (domain) and `mcp-server/people.ts`, deliberately not sharing code with `HabitHealthService`.

The filter widening was still necessary, for a reason the doc did not anticipate. A group dinner logged as ONE moment carrying three `personIds` was invisible to every read path except the outreach queue: `get_habit_health`, `list_wilting_habits`, `get_cycle_planning_proposals` and the desktop deck all still selected a habit's moments by `habitId` alone, so two of the three guests looked silent. The predicate is now `m.habitId === habit.id || (m.personIds?.includes(habit.id) ?? false)`, applied at five sites and factored behind one exported `momentInvolvesHabit` helper in `src/domain/entities/Moment.ts`.

Two narrow filters remain in `CycleService` (`:742`, the BEGINNING moment count; `:812`, the `getCycleReview` allocation statistics). Both are parked deliberately: they serve cycle-budgeting surfaces, and people are excluded from cycle budgeting, so the inconsistency is not reachable in normal use. Revisit if people are ever budgeted.

## 3. Ritual exclusions

`poetry` and `tantric` are excluded alongside `family breakfast` and `colloc auber`. The original document named only the latter two. All four stay in the exclusion list even though two are currently archived — harmless now, correct if either is ever unarchived.

## Also worth recording

**Ranking.** The queue orders by **ratio to each person's own rhythm**, not raw days of silence. Ranking by raw days would have placed an annual-rhythm relative at 400 days (1.10× overdue) permanently above a twice-weekly friend at 20 days (5.71× overdue), and any `limit` would have starved exactly the people the feature exists to protect.

**Split siblings.** `Ada` and `Ben` keep their original UUIDs, so their history stays attached. `Cal` and `Dee` are new records with fresh UUIDs, `emoji: null` (falling back to the area emoji rather than inheriting a wrong one), and no history — so they arrive never-contacted and sit at the head of the queue until seen.

**The migration is written but not applied.** Applying it requires the zenborg desktop app to be closed, because zenborg is the sole writer of `habits.json` and a running app would overwrite the migration from its in-memory store. The script refuses to write while it detects the app running; `--force` overrides that check and should not be used.

## Repo-wide gaps surfaced, not fixed

Each is pre-existing and outside this work's scope:

- `.husky/pre-commit` runs `pnpm test` but never `tsc --noEmit`, so type regressions are not caught by the commit loop.
- `tsconfig.json` `include` lists `**/*.ts`, which does not match `.mts` — so `scripts/*.mts` are invisible to the typecheck gate. A real `TS7060` in the migration script was caught only by a standalone check.
- `vitest.config.mts` pins no `TZ`; the suite fails at UTC±13/14. One line (`test.env: { TZ: "UTC" }`) would close the class.
- `pnpm lint` is red at baseline: 205 errors and 116 warnings across 242 files, none from this work.
- `mcp-server/latestAllocationDate` lacks the future-date guard its domain counterpart has, so a future-dated moment can yield `blooming` with a negative `daysSinceLast` on the MCP side.
