# zenborg — the garden

> Orientation and working agreements. Two documents outrank this one and win on conflict:
> philosophy → [`docs/principles.md`](docs/principles.md); shared contracts → [`../kairos/kernel/`](../kairos/kernel/).
> Anything here that contradicts the code is a bug in here — the code is the truth.

## Where this sits

**kairos is the umbrella; zenborg is an instrument under it.** Not a rename — renaming
zenborg → kairos in place was decided 2026-08-03 and reversed 2026-08-06, because one name
cannot be both the whole and a part.

Zenborg keeps the garden metaphor and should. Plots, perennials, seasons, weeds — that
vocabulary does real work. *The substrate is unified; the metaphors are not.*

Sibling instruments: **keel** (attentive tech — activity log, rules, tides) and **wake**
(journals). They share a home on disk, not a codebase.

## What it is

A macOS desktop app (Tauri 2) wrapping a Next.js static export, plus an MCP server that
exposes the same vault to any agent. Local-first, no accounts, no server.

Not a task manager, not a habit tracker, not a calendar. The question it exists to ask is
*"Where will I place my consciousness today?"*

## Domain

Pure TypeScript in `src/domain/`. Entities carry behaviour; there are no classes in the
persistence path.

| | |
|---|---|
| **Area** | a plot of your life. The one shared kernel concept — see below |
| **Habit** | a perennial: a recurring moment template, lives in an area |
| **Moment** | what you plant: a named intention, 1–3 words, allocated to a (day, phase) |
| **Cycle** | a season: a time container with an intention |
| **CyclePlan** | a plot's budget for the season — one per (cycleId, habitId) |
| **Phase** | time-of-day band — MORNING / AFTERNOON / EVENING / NIGHT |
| **Attitude** | relationship mode — BEGINNING → RETURNING → KEEPING → BUILDING → PUSHING → BEING |
| **Rhythm / Health** | declared cadence, and the wilting signal derived from it |
| **DayNote, MetricLog, HistoryEntry, Meta** | supporting records |

`Attitude` lives on **habits**, not areas — 80 of 126 habits carry one, 0 of 20 areas do.
Anything reasoning about friction reads habits or the moment that references one.

## The vault

Garden state is a filesystem vault under the kairos substrate contract. **The contract is
[`../kairos/kernel/substrate.md`](../kairos/kernel/substrate.md) and it wins on conflict** —
what follows is only what you need to work here.

```
$KAIROS_HOME          # default ~/.kairos (release), ~/.kairos-dev (debug builds)
```

One JSON file per collection, each a **JSON object keyed by entity UUID** (not an array):
`areas.json`, `habits.json`, `cycles.json`, `cyclePlans.json`, `moments.json`,
`phaseConfigs.json`, `metricLogs.json`, `dayNotes.json`.

Plus one **singleton** file that is not a collection: `activeMoment.json`, a
`{ momentId, at }` pointer naming the moment that IS the current intention. It is
deliberately outside `DomainModelRegistry`, export/import and the synced stores — it has
its own shape and its own module (`src/infrastructure/vault/active-moment.ts`). Adding
another singleton is a design decision; the parity test in
`src/infrastructure/vault/__tests__/collections-sync.test.ts` makes you declare it.

The debug/release split is not a zenborg detail — running a dev build against a locally
installed release app must not trash the real vault.

### Rules you inherit

- **One writer per collection.** Zenborg is the writer for all eight above, and for
  `activeMoment`. Keel reads `areas`, `dayNotes` and `activeMoment` live. Readers never
  mutate — not even to add a missing record.
- **`id` is a UUID.** Stable, opaque, never regenerated. The filename is the id, never a
  slug of the name.
- **Time is UTC, ISO-8601, milliseconds.** Local time is computed at render, never stored.
- **Order is explicit.** Anything whose display order matters carries an integer `order`.
- **Fail soft.** A missing or malformed collection means *empty*, never an error.
- **Preserve unknown fields on write**, or an older build silently deletes a newer one's data.

### Two implementations, pay twice

`src-tauri/src/vault/fs.rs` (the app) and `mcp-server/vault.ts` (the MCP server) each read
and write the vault independently. **Any change to the vault's structured shape costs two
implementations.** Weigh that before adding a format — it is the reason the sidecar
convention below carries no structured state.

Root resolution: `vault_root()` in `fs.rs`, mirrored in `resolveVault()` in `vault.ts`.
They must stay in lockstep; they have drifted before.

## Area sidecar folders

Unstructured, area-scoped content lives beside the JSON, never inside it:

```
$KAIROS_HOME/areas/<slug>/
├── AGENTS.md      # area-scoped agent context
├── docs/          # whatever belongs to this plot
└── skills/        # area-scoped skills
```

- `<slug>` is the area name kebab-cased — `equanimi.tech` → `equanimi-tech`. Renaming an
  area means renaming the folder; at ~20 areas that is rare enough not to warrant an
  id-keyed indirection.
- Create a folder when there is a file to put in it. Do not scaffold one per area.
- `areas.json` stays the index and the source of truth for structured fields (name, color,
  emoji, order). **The sidecar never carries structured state** — no `AREA.md`, no
  frontmatter, no slug↔id map, no parser. That is the whole point: zero code in either
  vault implementation.
- Habits get `areas/<slug>/habits/<slug>/` the day a habit actually has a doc.

**Considered and rejected:** making `AREA.md` frontmatter the source of truth. It reads
fine and is git-friendly, but it turns one atomic JSON write into an N-file operation and
obliges both vault implementations to grow a YAML parser and a rename-is-a-move path. Read
performance was never the constraint — 20 areas and 126 habits parse in single-digit
milliseconds. The write path is the cost.

## Layout

```
src/
├── domain/          pure TS — entities, value-objects, services. No framework imports
├── application/     use-case services: Area, Habit, Cycle, DayNote, MomentCreation, MomentUpdate
├── infrastructure/  Legend State stores, vault sync, integrations
├── components/      React. Inline editing, no modals
└── app/             routes — plant · cultivate · harvest
src-tauri/src/       vault/{fs,watcher,write_tracker}, mcp_install
mcp-server/          the second vault implementation + MCP tools (TOOLS.md)
```

Dependencies flow inward: domain ← application ← infrastructure ← UI.

`src/domain/registry.ts` is the type-level registry of persisted collections. Add a collection
there and TypeScript forces the export/import path and the stores to follow. It is the one file to
touch when the vault grows a file.

### Two runtimes, one shape

`infrastructure/state/persistence.ts` picks a mode at boot via `isTauri()`. **Tauri** → vault-synced:
the vault is truth, IndexedDB is a hot cache, writes debounce 2s through
`infrastructure/vault/adapter.ts` and a Rust watcher feeds external edits back. **Web** → IndexedDB
only, same layout, no vault. The web path is still live; don't assume Tauri.

UI preferences (`activeCycleId`, `lastUsedAreaId`, TRMNL settings) always go to localStorage — they
are per-device, not per-vault. `ui-store.ts` holds ephemeral form state and is deliberately not
persisted; `store.ts` holds domain collections as `Record<uuid, Entity>`.

### Two command systems, no shared code

`src/commands/` is the palette registry (cmdk) — flat list of `{ id, label, shortcut, category,
action }`. `infrastructure/state/command-parser.ts` is a separate pure parser for the vim `:` mode:
`[day][y][phase]` allocations (`:ty1` = today/morning), `:d` to unallocate. Adding a palette entry
does not add a `:` command.

Mnemonics, from `DAY_MAP` / `PHASE_MAP` in the parser — day `y` yesterday · `t` today ·
`w` tomorrow (*will do*); phase `1` morning · `2` afternoon · `3` evening · `4` night. Navigation
commands are `:area`, `:settings`, `:help`.

There is **no grid-level vim normal mode.** An older doc listed `hjkl`/`dd`/`yy`/`p`/`x`; no global
key handler implements them. Keyboard handling is component-local (palette, dialogs, autocompletes).

### Entity forms read the store, not props

Habit and Moment forms follow one pattern — deviate only with a reason:

- Form state lives in `infrastructure/state/ui-store.ts` (`habitFormState$` / `momentFormState$`),
  never in component state. Fields are set directly (`habitFormState$.name.set(v)`).
- Open via the helpers — `openHabitFormCreate({ areaId })` / `openHabitFormEdit(id, habit)` — not by
  toggling an `open` prop.
- The dialog takes **only** `onSave` and `onDelete`. See `components/HabitFormDialog.tsx`.
- Local state is for popovers and validation only.

**Areas are the exception**: inline editing, not dialogs, per the "no modals, flat UI" constraint —
simple properties contextual to one card, so local state is correct there.

## Commands

```bash
pnpm dev            # Next dev server
pnpm dev:tauri      # the actual app
pnpm build:tauri    # bundle
pnpm build:export   # static export the Tauri bundle wraps
pnpm test           # vitest — node env, src/**/*.test.{ts,tsx}
pnpm test -- src/domain/services/__tests__/HabitHealthService.test.ts   # single file
pnpm lint           # biome check (not eslint/prettier); pnpm format to write
```

pnpm only — never npm or yarn. Running `pnpm dev` and building to verify a change is fine.

The husky pre-commit hook runs `pnpm test`, so a red suite blocks commits. `mcp-server/` is its own
package: `pnpm start` (tsx), `pnpm build` (tsc), `pnpm build:compile` (bun binary), `pnpm smoke`.

`pnpm test:e2e` runs Playwright against the **web** build (IndexedDB, no vault, so it never touches
a real garden). It boots `pnpm dev` itself and seeds a synthetic garden through the app's own
Settings import path, so the fixture goes through real validation. Browsers install once with
`npx playwright install chromium`. It is deliberately outside the pre-commit hook: it covers what
unit tests cannot see, which is what a card does with the space it has.

## Design

Canonical system: [`../DESIGN.md`](../DESIGN.md) (org-wide). It wins on conflict.
`DESIGN_SYSTEM.md` in this repo is partly superseded and retained as history.

- **Stone tones only, unless attributed to an area.** Area `color` is the one sanctioned
  channel for colour in the whole system. Test: if something on screen is coloured, a
  viewer must be able to name which area it belongs to. "Red because destructive" fails.
- **Phases are structural, not coloured** — position, label, glyph, tonal stone step.
- **Flat at rest.** No shadow, gradient, blur, or glassmorphism. One exception, the One
  Lift: `-2px` translate on hover for genuinely draggable elements.
- **Square by default**, 4px radius ceiling.
- **No modals.** Inline editing.
- **Mobile is landscape-only.** Portrait is not considered.

## Red lines

Full treatment in [`docs/principles.md`](docs/principles.md). Never build: completion
checkboxes or "done" states, streaks, progress bars against targets, push notifications or
badges, algorithmic curation, leaderboards or comparative scoring, engagement-based revenue.

Permitted and easily confused with the above: counting allocations ("3rd time" is
information, not a score), neutral history ("2 days ago"), passive surfaces the user visits,
ambient chips on cards.

## Known drift — verify before trusting a doc

- **The 3-moments-per-phase cap.** Recorded as removed (idea 2026-06-14, substrate.md says
  deleted 2026-08-03) but still enforced in `TimelineCell.tsx`, `lib/design-tokens.ts`,
  `mcp-server/validation.ts`, and `CycleService.ts`. Code is the truth until someone lands
  the removal. The intent is that the cap is a day-view affordance, not a domain invariant.
- **`README.md`** still describes the retired Next-on-Vercel era — a web app with a Compass
  and a three-day timeline. Do not build from it.
- **The `docs/protection/` tree** documents shields and a rule engine that moved to keel,
  whose intervention layer was then retired 2026-06-12. Dead here.
- **`docs/ideas/2026-05-31-*`** are capture stubs pointing at Things, not designs.
