# Calendar Sync Design (Phase 1: Moments Gain Time)

**Date:** 2026-08-21
**Status:** Draft, awaiting principal review
**Problem owner:** Rafa

> This is **Phase 1 of the zoom-ladder roadmap**, not a sync feature bolted onto the
> side. [`docs/ideas/2026-06-03-calendar-zoom-ladder.md`](../../ideas/2026-06-03-calendar-zoom-ladder.md)
> (stamped 2026-06-03) names the rung directly. Phase 1 is EventKit, the roadmap entry
> where *"moments gain time"*, described there as *"the instrument"*, with the week grid
> as *"Phase 1's destination"*. This spec is that rung, made buildable.

---

## Problem

Zenborg has no calendar sync. `docs/principles.md:170` still lists it under things not
yet built. There is no EventKit, ICS, CalDAV or Google Calendar code anywhere in
`src/`, `src-tauri/` or `mcp-server/`, and `Moment` carries no external identity.

What exists instead is a **skill-layer read**: `week-planning` beat 2 pulls the week's
events from the Google Calendar MCP once on a Monday and marks the affected (day,
phase) blocks as taken. That is a one-shot human-in-the-loop glance, and it explains
both complaints exactly:

- **Imprecise**, because an event is flattened to a phase band. A 10:30 standup and a
  16:45 call both become "AFTERNOON is busy". The real start and duration are discarded
  even though `Moment.startTime` and `Moment.durationMin` already exist to hold them.
- **Changes never come back**, because nothing holds a link between an event and a
  moment. After Monday, the plan and the calendar drift apart silently for six days.

There is a third problem underneath both, and it is the one that actually blocks the
fix: **zenborg has nowhere calendar-shaped to put a scheduled moment.** The day view is
banded by phase and caps at `DAY_VIEW_PHASE_CAPACITY`. Ingesting a real week of events
into that surface would not be usable. Precision needs somewhere precise to live.

---

## Decisions

Each decision records what was rejected and why, so a later reader can tell which
constraints are load-bearing and which were preference.

### D1: The calendar is a two-way surface, via EventKit

Moments and events sync in both directions. A moment with a clock time becomes a real
event you can drag in Calendar.app; dragging it moves the moment.

This **reverses D1 of [`2026-08-03-kairos-reach-design.md`](2026-08-03-kairos-reach-design.md)**,
which rejected two-way sync. That rejection is not wrong so much as **scoped to the
wrong mechanism**. Its costs were Google Calendar *API* costs: OAuth verification, the
non-resettable 100-user lifetime cap on the GCP project, watch-channel renewal cron,
and `410 GONE` resync recovery. Every one of those is a cost of talking to Google over
the network. None of them exist in EventKit, which is a local framework against the
store Calendar.app already owns.

What survives the change of mechanism is **echo suppression**, which is real and is
handled in D4, and the equanimitech "constraint erosion" objection, which is a values
call the principal has made.

Rejected: **Google Calendar API directly.** Pays the full D1 cost list, and sees only
Google. iCloud and Exchange calendars stay invisible.

Rejected for now: **a locally running CalDAV server** (Radicale, Baikal). Puts three
stores in the loop rather than two (vault, CalDAV store, Calendar.app cache), so every
drag survives two reconciliations and we own the vault-to-server bridge, which is the
same reconciliation problem moved one hop out. The 2026-08-03 finding still holds and is
18 days old: no mature CalDAV *server* library exists for Node or TS (`ts-caldav`,
`tsdav`, `dav` are all clients), so this means adding a Python or PHP daemon to a Rust
and TS repo. Latency is poll-based rather than event-driven, and the Google calendar
stays invisible because it would be a separate account.

**CalDAV is deferred, not dead.** The zoom-ladder plan already parks it correctly, as
`~ plumbing`: *"CalDAV when web parity / bidir matters (not a vision phase; the Next.js
deployed version needs it, EventKit can't)"*. That is where it belongs.

Rejected: **`.ics` publication.** The zoom-ladder plan rejects it in one line that is
still the whole argument: *"read-only kills 'then sync from'"*.

### D2: EventKit reaches every calendar, including Google, for free

Calendar.app already aggregates Google, iCloud and Exchange accounts. EventKit reads
that aggregate. So two-way sync with a Google calendar costs **no OAuth at all**, and
iCloud propagates Mac to iPhone without zenborg doing anything, which is precisely the
zoom-ladder plan's stated reason for choosing it: *"Mac is the hub; iCloud propagates
Mac↔iPhone for free, best sync, most local-first."*

The price is that this is **macOS only**, and requires the user to grant calendar access
(a TCC prompt). Off-Mac reach is already solved separately by
[`docs/decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md`](../../decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md)
and must not drive this choice.

### D3: Zenborg writes only into a dedicated "Zenborg" calendar

Outbound events land in one calendar zenborg creates and owns. Zenborg never writes into
the principal's existing calendars.

This buys three things at once. The principal's real calendars stay clean. The layer can
be toggled off in Calendar.app without uninstalling anything, which satisfies the
sovereignty principle (`docs/principles.md:55`, the design test: can a non-technical user
freeze the current version). And echo
suppression collapses to a one-line rule (D4).

Inbound reading still spans whichever calendars the principal selects. Read and write
scopes are deliberately asymmetric.

### D4: Echo suppression is a content hash, not a timer

The vault already solves this exact problem for files. `src-tauri/src/vault/write_tracker.rs`
stamps every self-write and suppresses the watcher event that follows, with a 3 second
window sized for FSEvents batching. The calendar needs the same shape against a different
store, but a **timer is the wrong instrument here**, because a drag can legitimately land
inside any window we pick.

Instead, `Moment.externalRef` carries `lastWrittenHash`: a hash of exactly the fields
zenborg last pushed (start, duration, title). On any `EKEventStoreChanged`:

- Event is in the Zenborg calendar and its hash **matches** `lastWrittenHash`: this is our
  own write echoing back. Ignore.
- Event is in the Zenborg calendar and its hash **differs**: the principal dragged or
  edited our event. This is the feature working. Apply to the moment.
- Event is in another selected calendar: inbound ingestion (D5).

This is exact rather than probabilistic, and it needs no window.

### D5: Ingested events arrive as `tentative` moments

Events on selected calendars become moments with `status: "tentative"`. Hand-planted
moments are `accepted`. Accepting is one gesture in the grid.

This carries over the reasoning from the 2026-08-03 supersede note, which is the single
most load-bearing observation in that document:

> *The real cause of abandonment is authoring cost, not reach. The tool demands input it
> should derive. Life already emits traces. The garden should fill itself and ask to be
> curated.*

The garden filling itself is the point. `tentative` is what makes that safe: nothing
uninvited is ever counted as an intention the principal made.

**Tentative moments do not count toward habit health, cycle plans, or any allocation
read.** They are proposals. Only accepting makes a moment real. This is a hard invariant,
because violating it would let the calendar silently inflate the garden's picture of
how attention was spent, and `docs/principles.md` is explicit that zenborg allocates
intention and never grades.

Enforced at every read that aggregates moments, filtering `status === "tentative"` out:
`mcp-server/health.ts`, `src/hooks/useHabitHealth.ts`, cycle plan allocation counts, and
the heatmap density read. Slice A therefore ships a single shared predicate
(`countsAsAllocation(moment)`) rather than four filters that can drift apart, and each
call site gets a test asserting a tentative moment does not move the number.

### D6: Granularity is 15 minutes, and phase is derived from time

`PhaseConfig` already bounds phases in **whole hours** (`startHour`, `endHour`, wrapping
for night). That is the existing coarse grain, and the principal's constraint is
"relatively low granularity but more inline with the calendar".

So: **clock times snap to a 15 minute grid.** Coarse enough that the garden does not
become a scheduling tool, fine enough to sit correctly beside a real 10:30 meeting.

For a **timed** moment, `phase` becomes **derived** from `startTime` against
`PhaseConfig` rather than stored independently. When an event moves from 11:00 to 14:00,
the moment's phase follows from MORNING to AFTERNOON with no separate reconciliation
step. `startTime` wins any disagreement, because it is the more precise statement.

**Ambient** moments (no `startTime`) keep an explicit phase and no clock time. They are
not published to the calendar. Inventing a start time for a moment deliberately without
one would be fabricating data, and the zoom-ladder plan already handles ambient moments
in the day view as *"a center cluster (they ride inside the day, not pinned to the rim)"*.

### D7: The sidecar writes the vault directly

Follows the established pattern rather than inventing a second one. `zenborg-mcp` already
writes vault collections directly with atomic temp-then-rename (`mcp-server/vault.ts:353`,
mirroring `src-tauri/src/vault/fs.rs:128`), and the app's watcher
(`src-tauri/src/vault/watcher.rs`) emits `vault:collection-changed` so the UI reloads.

The calendar sidecar is therefore a **peer of the MCP sidecar**, not a new architecture:
it owns EventKit, reconciles, writes the vault atomically, and the running app picks the
change up through the path that already exists.

Rejected: **routing all writes through the Tauri app** to preserve a single writer. It is
tidier in theory, but it makes the sidecar useless whenever the app is not running, which
defeats ingestion (the principal's calendar changes all day; the app does not run all
day). The vault is already a multi-writer store by design.

---

## Architecture

Three slices, in dependency order. **Slice B is shippable without Slice C**, which is the
main de-risking move: the principal gets a working week calendar inside zenborg before a
single line of Swift exists.

```
  A. DOMAIN                B. SURFACE                 C. BRIDGE
  moments gain time        the week grid              EventKit sidecar

  Moment.status            hour rows bounded by       zenborg-calendar (Swift)
  Moment.externalRef       PhaseConfig.startHour/          │
  15-min snapping          endHour                         │ EventKit
  phase derived from       no per-phase cap                ▼
    startTime              area color, stone base    macOS Calendar store
                           inline edit, no modals      ├─ Google
  pure, testable,          tentative = unfilled        ├─ iCloud
  no UI, no Swift                                      └─ Exchange
        │                        │                            │
        └────────────────────────┴────── vault (atomic) ──────┘
                                              │
                                   watcher → vault:collection-changed
                                              │
                                        running app reloads
```

### Slice A: Domain

Two additions to `Moment` (`src/domain/entities/Moment.ts`):

```ts
/**
 * Whether this moment is a proposal or a committed intention.
 * Optional, and absent means `accepted`. Every moment in the vault today was
 * hand-planted, so absence carries exactly the right meaning and **no vault
 * migration is required**. Only ingestion ever writes `"tentative"`.
 */
status?: "tentative" | "accepted";

/**
 * Provenance for a moment that mirrors an external calendar event.
 * Absent on moments with no calendar counterpart.
 */
externalRef?: {
  source: "eventkit";
  eventId: string;        // EKEvent.eventIdentifier
  calendarId: string;     // EKCalendar.calendarIdentifier
  lastWrittenHash: string; // hash of {startTime, durationMin, name} we last pushed
  lastSyncedAt: string;    // ISO timestamp
};
```

Plus pure functions, unit-tested with no I/O:

- `snapToGrid(startTime, durationMin)`: 15 minute rounding.
- `phaseForStartTime(startTime, configs)`: derives `Phase`, handling the night wrap.
- `momentHash(moment)`: the stable hash D4 compares against.
- `reconcile(moment, event)`: returns the action to take. This is the heart of the
  design and is a **pure function over two snapshots**, so every rule in the table below
  is a unit test with no EventKit and no filesystem.

**Existing invariant to respect:** `src/domain/value-objects/Schedule.ts` already rejects
a habit `schedule` that contradicts its `rhythm` or `phase`. Deriving moment phase from
`startTime` (D6) must not break habits that inherit a schedule at allocation time. The
derivation applies to the moment instance, and disagreement corrects the moment rather
than the parent habit.

### Slice B: The week grid

The surface named in the zoom-ladder plan as Phase 1's destination: moments as timed
blocks on hour rows bounded by `PhaseConfig.startHour` and `endHour`.

This is where "many more moments during a phase" stops being a problem. The data layer
cap was already relaxed on 2026-08-07 (see `mcp-server/TOOLS.md:278`); the remaining cap
is a **day-view display concern** in `src/components/TimelineCell.tsx:47` and
`src/hooks/useEntityActions.ts:137`. **The week grid has no cap**, because blocks are
positioned by time rather than stacked in a cell. The day view keeps its cap unchanged.

Constraints, from §6 of the zoom-ladder plan and `DESIGN.md`:

- Monochrome **stone** base; **area color only** carries meaning. No phase palette.
- **Inline editing, no modals.**
- **Landscape only** on mobile.
- Tentative moments render **unfilled** (hairline outline), so the eye separates
  proposal from intention without a legend. Accepting is a single gesture.

### Slice C: The EventKit sidecar

A second Tauri sidecar, `zenborg-calendar`, in Swift, staged next to `zenborg-mcp` in
`src-tauri/binaries/` and declared in `tauri.conf.json` `externalBin`. It is the first
Swift in the repo, so `src-tauri/scripts/build-sidecars.sh` grows a `swiftc` branch
beside the existing `bun build --compile` one, keeping the same
`<name>-<target-triple>` staging convention Tauri requires.

Responsibilities, and nothing else:

1. Hold calendar authorization and surface its state.
2. Publish accepted timed moments into the Zenborg calendar.
3. Ingest events from selected calendars as tentative moments.
4. Watch `EKEventStoreChanged` and reconcile.
5. Write the vault atomically.

---

## Reconciliation rules

The full truth table. Every row is a unit test against `reconcile()`.

| Trigger | Moment state | Action |
|---|---|---|
| New event, selected calendar | none | Create `tentative` moment, snapped |
| New accepted timed moment | no `externalRef` | Create event in Zenborg calendar, store ref |
| Zenborg event edited, hash matches | any | Ignore. Our own echo (D4) |
| Zenborg event dragged, hash differs | `accepted` | Update moment time; re-derive phase |
| Ingested event moved | `tentative` | Update moment time; re-derive phase |
| Ingested event moved | `accepted` | Update moment time; re-derive phase |
| Ingested event deleted | `tentative` | Delete the moment |
| Ingested event deleted | `accepted` | **Unallocate to the drawing board**, drop `externalRef` |
| Moment unallocated in zenborg | any | Delete its event |
| Moment deleted in zenborg | any | Delete its event |
| Moment accepted | `tentative` | Publish to Zenborg calendar if not already an event |
| Both sides changed since last sync | any | Last write wins by timestamp; log the loss |

**The one asymmetry worth naming**, and the reason the two delete rows differ: deleting an
*ingested* event removes a proposal nobody committed to, so the moment goes with it. But
an event behind a moment the principal **accepted** carries an intention that the calendar
does not own. A cancelled meeting must not be able to destroy an intention, so that moment
returns to the drawing board instead of dying. This follows directly from the principle
that zenborg allocates intention: the calendar can inform allocation, never revoke it.

---

## Error handling

| Failure | Behaviour |
|---|---|
| Calendar access denied or revoked | Sidecar reports unauthorized; grid works, sync is dormant, never silently half-syncing |
| Zenborg calendar deleted by the user | Recreate on next publish; drop stale `externalRef`s |
| Event id no longer resolves | Treat as deleted; apply the delete rules above |
| Vault write fails | Atomic rename means no partial state; retry next reconcile |
| Sidecar crashes | App keeps working. Full reconcile on next launch |
| Clock skew or DST transition | Store wall-clock `HH:MM` plus the ISO date, as `Moment` already does. Never store offsets |

**Recovery is always a full reconcile.** There is no incremental sync token to corrupt, so
the worst case is a slow pass rather than a wrong state.

---

## Testing

- **Slice A** is pure and carries the real risk, so it gets the real coverage: every row
  of the reconciliation table, grid snapping at boundaries, phase derivation across the
  night wrap, and hash stability. No EventKit, no filesystem.
- **Property test** worth having, per `property-based-testing`: publish then ingest is
  identity. A moment pushed to the calendar and read back must produce an equal moment.
  This is the invariant that catches echo bugs and rounding drift.
- **Slice B** follows existing component test patterns (`src/components/__tests__/`).
- **Slice C** is thin by construction, because all judgement lives in A. It gets a manual
  checklist against a scratch calendar rather than a mocked EventKit.

---

## Out of scope

Named so a later reader does not think they were forgotten.

- **Cycles as all-day spans** (`docs/ideas/2026-06-23-cycles-should-appear-in-the-calendar.md`).
  Wants D1 settled first.
- **The circular day view.** The zoom-ladder plan itself calls it *"a delightful side-view,
  not a mandatory zoom rung"*.
- **Pinch-zoom re-rasterization** across the ladder. That is Phase 3+.
- **CalDAV**, per D1: web-parity plumbing for the deployed Next.js version.
- **iOS.** iCloud already propagates the Zenborg calendar to the phone read-only, which is
  most of the value at none of the cost.
- **Behavioral graph from co-occurrence.** Phase 2, and it explicitly depends on this rung
  landing first.

---

## Open questions for the principal

1. **Which calendars are read by default?** Proposal: none, and the principal selects them
   on first run. Opt-in matches the sovereignty principle and prevents a work calendar
   flooding the garden on day one.
2. **Do tentative moments expire?** An unaccepted proposal for a past day is clutter.
   Proposal: sweep tentative moments older than 7 days, since the event itself remains the
   record.
3. **Should the 15 minute grid be configurable?** Proposal: no, not in Phase 1. A constant
   is one fewer thing to reason about, and it can be lifted later without migration.
