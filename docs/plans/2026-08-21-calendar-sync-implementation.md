# Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-21
**Status:** Plan
**Spec:** `docs/superpowers/specs/2026-08-21-calendar-sync-design.md` (approved). The plan argues from the spec; executors read both.

**Goal:** Moments gain real clock time, a week grid to live on, and two-way sync with macOS calendars via an EventKit sidecar.

**Architecture:** Three slices in strict dependency order. Slice A adds `status` and `externalRef` to `Moment` plus pure functions (`snapToGrid`, `momentHash`, `reconcile`, the shared `countsAsAllocation` predicate): no I/O, no UI, no Swift. Slice B builds the week grid surface on hour rows bounded by `PhaseConfig.startHour`/`endHour`, with no per-phase cap. Slice C adds the `zenborg-calendar` Swift sidecar over EventKit, a peer of `zenborg-mcp`, writing the vault directly with atomic temp-then-rename.

**Slice B is shippable without Slice C.** The repo must be releasable at the end of Task 10 with a working week grid and zero Swift in the tree. Every task ends test-green and committable.

## Amendments, 2026-08-21 (post-review)

Six changes from a read-through with the principal. Recorded here because several
reverse an earlier instruction in this same document, and an executor following a stale
paragraph would build the wrong thing.

| # | Change | Why |
|---|---|---|
| A1 | **`title` dropped from `momentHash`**; new field `externalRef.lastWrittenTitle` carries names one way, zenborg to calendar. Pinned digest is now `ff236ccaea7fb964`. | Hashing the title made a rename in Calendar.app revert two passes later. Timing is the only thing a drag changes, so timing is the only thing the hash tracks. Tasks 3, 4, 12, 14. |
| A2 | **`event = null` means confirmed absent, never "not fetched".** The pass skips out-of-window moments entirely and confirms absence with `event(withIdentifier:)`. | Without it the bounded fetch window sent every moment older than 7 days down the delete path, erasing tentative moments and unallocating accepted ones along with their history. Tasks 4, 14. |
| A3 | **Grid-row placement** (`gridRowStart`/`gridRowSpan` on a 15-minute row unit) replaces `topPct`/`heightPct`, adapting the Tailwind Plus week-view block. | Makes `CALENDAR_GRID_MINUTES` the layout unit itself, so a block cannot land off-grid, and the span clamp closes the cross-midnight overflow for free. Tasks 8, 9. |
| A4 | **Single-instance `flock`** on `run` and `reconcile-once`, plus the app killing its child on exit. | Two concurrent watchers both do full passes; atomic rename stops a torn file but not a lost update. Task 14. |
| A5 | **Sidecar spawns in dev behind `ZENBORG_CALENDAR_SIDECAR=1`**, not release-only. | The integrated loop (sidecar write, `vault:collection-changed`, grid updates) was otherwise unreachable without a release build. Task 14. |
| A6 | **Two vacuous tests replaced.** `momentHash` now pins a computed literal; the publish-ingest property generates arbitrary times rather than pre-aligned ones. | Both previously held by construction and could not fail. Tasks 3, 5. |

Vector count rises from 19 to 22 (three new edge cases: the two rename directions and
the window guard). Checklist items 12 to 14 verify A2, A1 and A4 by hand.

**Tech Stack:** TypeScript (Next.js + Tauri app), vitest (+ happy-dom for component tests), Legend-State observables, Biome, pnpm; Swift + EventKit for Slice C only; bash for the sidecar build script.

## Global Constraints

Copied from the spec and repo conventions. Every task's requirements implicitly include this section.

- **pnpm only**, never npm or yarn. Run tests with `pnpm vitest run <path>` (the bare `pnpm test` script starts watch mode in a TTY).
- **Pre-commit runs the full suite** (1071 tests, all green today) plus a PII guard. A commit with a red suite will not land; do not bypass the hook.
- **TDD:** the failing test comes before the implementation, in every task.
- **Value imports carry an explicit `.ts` extension** (commit `4fb1418`); type-only imports may omit it. Match the style in `src/domain/entities/Moment.ts`.
- **Biome** is the formatter/linter: `pnpm lint` must pass before each commit; `pnpm format` to fix.
- **Layering:** `src/domain` is pure (no I/O, no React); `src/application`; `src/infrastructure`; `src/components`. `mcp-server/` is a separate package that deliberately does **not** import from `src/domain`; it mirrors domain logic (see the comment on `momentInvolvesHabit` in `src/domain/entities/Moment.ts`). Keep that mirroring pattern.
- Prefer `for...of` over `forEach`; functional style; immutable value objects.
- **Never use an em dash** (U+2014) in any prose, heading, code comment, or commit message. Use commas, colons, parentheses, semicolons or full stops.
- **The 15-minute grid is a constant**, not configurable (spec open question 3, proposal adopted).
- **Tentative moments never count toward any allocation read.** Hard invariant (spec D5).
- **Zenborg writes only into the Zenborg calendar** (spec D3). Inbound reads span the selected calendars.
- **Wall-clock storage:** moments keep `day` (`YYYY-MM-DD`) plus `startTime` (`HH:MM`). Never store offsets (spec error table, DST row).
- **No vault migration:** absence of `status` means `accepted`; absence of `externalRef` means no calendar counterpart.

## File Map

| File | Role |
|---|---|
| `src/domain/entities/Moment.ts` | Modify: `status`, `externalRef`, `countsAsAllocation`, `acceptMoment` |
| `src/domain/value-objects/TimeGrid.ts` | Create: `CALENDAR_GRID_MINUTES`, `snapToGrid` |
| `src/domain/services/CalendarSyncService.ts` | Create: `momentHash`, `fnv1a64`, `eventFieldsForMoment`, `reconcile`, `applyEventToMoment`, snapshot/action types |
| `src/domain/__tests__/MomentStatus.test.ts` | Create: Task 1 tests |
| `src/domain/value-objects/__tests__/TimeGrid.test.ts` | Create: Task 2 tests |
| `src/domain/services/__tests__/CalendarSyncService.test.ts` | Create: Task 3, 4, 5 tests |
| `calendar-sidecar/fixtures/reconcile-vectors.json` | Create: shared truth-table vectors (TS tests and Swift self-test both consume) |
| `src/domain/services/HabitHealthService.ts` | Modify: filter through `countsAsAllocation` |
| `src/infrastructure/state/bandedHeatmapViewModel.ts` | Modify: density read excludes tentative |
| `mcp-server/vault.ts` | Modify: mirror `status` + `externalRef` on `Moment` |
| `mcp-server/health.ts` | Modify: mirror `countsAsAllocation`, apply in `computeHealth` / `daysSinceLast`, add `allocatedMomentsForHabit` |
| `mcp-server/index.ts` | Modify: cycle-count call sites, `status` on moment write tools |
| `mcp-server/TOOLS.md` | Modify: document `status` and `externalRef` |
| `src/infrastructure/state/weekGridViewModel.ts` | Create: pure week-grid derivation |
| `src/infrastructure/state/weekGridViewModel.test.ts` | Create: Task 8 tests |
| `src/components/week-grid/WeekGrid.tsx`, `WeekGridDayColumn.tsx`, `WeekMomentBlock.tsx` | Create: Slice B surface |
| `src/components/__tests__/WeekGrid.test.tsx` | Create: Task 9 tests |
| `src/app/week/page.tsx`, `src/components/ModeSelector.tsx` | Create/modify: route + nav entry |
| `calendar-sidecar/Sources/{main,Vault,Reconciler,EventStore}.swift` | Create: Slice C sidecar |
| `src-tauri/scripts/build-sidecars.sh` | Modify: `swiftc` branch |
| `src-tauri/tauri.conf.json` | Modify: `externalBin` + `bundle.macOS.entitlements` |
| `src-tauri/Info.plist`, `src-tauri/Entitlements.plist` | Create: calendar usage description + entitlement |
| `src-tauri/src/lib.rs` | Modify: spawn the calendar sidecar on launch |

---

# Slice A: Domain (moments gain time)

Pure and exhaustively tested. This slice carries the real risk, so it carries the real coverage.

### Task 1: Moment.status, Moment.externalRef, countsAsAllocation, acceptMoment

**Files:**
- Modify: `src/domain/entities/Moment.ts`
- Test: `src/domain/__tests__/MomentStatus.test.ts`

**Interfaces:**
- Consumes: existing `Moment` interface, `createMoment`.
- Produces (later tasks rely on these exact names):
  - `type MomentStatus = "tentative" | "accepted"`
  - `interface ExternalRef { source: "eventkit"; eventId: string; calendarId: string; lastWrittenHash: string; lastWrittenTitle: string; lastSyncedAt: string }`
  - `Moment.status?: MomentStatus` and `Moment.externalRef?: ExternalRef`
  - `countsAsAllocation(moment: Moment): boolean`
  - `acceptMoment(moment: Moment): Moment`

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/__tests__/MomentStatus.test.ts
import { describe, expect, it } from "vitest";
import {
  acceptMoment,
  countsAsAllocation,
  createMoment,
  isMomentError,
  type Moment,
} from "../entities/Moment.ts";

function newMoment(overrides: Partial<Moment> = {}): Moment {
  const created = createMoment({ name: "singing", areaId: "area-1" });
  if (isMomentError(created)) throw new Error(created.error);
  return { ...created, ...overrides };
}

describe("Moment status", () => {
  it("createMoment leaves status absent, which means accepted", () => {
    const m = newMoment();
    expect("status" in m).toBe(false);
  });

  describe("countsAsAllocation", () => {
    it("counts a moment with no status (every pre-existing vault moment)", () => {
      expect(countsAsAllocation(newMoment())).toBe(true);
    });

    it("counts an explicitly accepted moment", () => {
      expect(countsAsAllocation(newMoment({ status: "accepted" }))).toBe(true);
    });

    it("does not count a tentative moment", () => {
      expect(countsAsAllocation(newMoment({ status: "tentative" }))).toBe(false);
    });
  });

  describe("acceptMoment", () => {
    it("turns a tentative moment into an accepted one", () => {
      const accepted = acceptMoment(newMoment({ status: "tentative" }));
      expect(accepted.status).toBe("accepted");
      expect(countsAsAllocation(accepted)).toBe(true);
    });

    it("preserves externalRef so the calendar link survives acceptance", () => {
      const ref = {
        source: "eventkit" as const,
        eventId: "ek-1",
        calendarId: "cal-1",
        lastWrittenHash: "0000000000000000",
        lastSyncedAt: "2026-08-21T10:00:00.000Z",
      };
      const accepted = acceptMoment(
        newMoment({ status: "tentative", externalRef: ref }),
      );
      expect(accepted.externalRef).toEqual(ref);
    });

    it("is a no-op on an already accepted moment", () => {
      const m = newMoment();
      expect(acceptMoment(m)).toBe(m);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/domain/__tests__/MomentStatus.test.ts`
Expected: FAIL, `countsAsAllocation` / `acceptMoment` not exported.

- [ ] **Step 3: Implement in `src/domain/entities/Moment.ts`**

Add below the existing `Moment` doc block (fields go inside the `Moment` interface, next to `startTime`/`durationMin`):

```ts
/**
 * Whether this moment is a proposal or a committed intention.
 * Optional; absence means `accepted`. Every moment in the vault today was
 * hand-planted, so absence carries exactly the right meaning and no vault
 * migration is required. Only calendar ingestion ever writes "tentative".
 */
export type MomentStatus = "tentative" | "accepted";

/**
 * Provenance for a moment that mirrors an external calendar event.
 * Absent on moments with no calendar counterpart.
 */
export interface ExternalRef {
  readonly source: "eventkit";
  readonly eventId: string; // EKEvent.eventIdentifier
  readonly calendarId: string; // EKCalendar.calendarIdentifier
  /**
   * Hash of the event TIMING as of the last sync, in either direction: what
   * zenborg last pushed to its own calendar, or what it last ingested from a
   * foreign one. The echo-suppression comparand (spec D4).
   *
   * Covers day, startTime and durationMin only. Title is excluded on purpose:
   * hashing it made a calendar-side rename revert two passes later. Timing is
   * the only thing a drag changes, so timing is the only thing the hash tracks.
   */
  readonly lastWrittenHash: string;
  /**
   * The title zenborg last wrote to the event. Compared against `moment.name`
   * so a rename made IN ZENBORG still reaches the calendar, without the
   * calendar ever renaming a moment. If the principal renames the event in
   * Calendar.app, this still equals `moment.name`, so nothing republishes and
   * their rename stands.
   */
  readonly lastWrittenTitle: string;
  readonly lastSyncedAt: string; // ISO timestamp
}
```

Inside `interface Moment`:

```ts
  status?: MomentStatus;
  externalRef?: ExternalRef;
```

New functions (near `isAllocated`):

```ts
/**
 * Does this moment count as an allocation of intention?
 *
 * Tentative moments are proposals the calendar made; nothing uninvited is
 * ever counted as an intention the principal made (spec D5, hard invariant).
 * Every read that aggregates moments (health, cycle counts, heatmap density)
 * selects with this single predicate so the filters cannot drift apart.
 * Mirrored in mcp-server/health.ts, a separate package that deliberately
 * does not import from src/domain.
 */
export function countsAsAllocation(moment: Moment): boolean {
  return moment.status !== "tentative";
}

/**
 * Accepting is the one gesture that turns a calendar proposal into an
 * intention. Keeps externalRef: the moment stays linked to its event.
 */
export function acceptMoment(moment: Moment): Moment {
  if (moment.status !== "tentative") return moment;
  return {
    ...moment,
    status: "accepted",
    updatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/domain/__tests__/MomentStatus.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint, full suite, commit**

```bash
pnpm lint && pnpm vitest run
git add src/domain/entities/Moment.ts src/domain/__tests__/MomentStatus.test.ts
git commit -m "feat(domain): moment status and externalRef, with countsAsAllocation"
```

### Task 2: snapToGrid (15-minute grid)

**Files:**
- Create: `src/domain/value-objects/TimeGrid.ts`
- Test: `src/domain/value-objects/__tests__/TimeGrid.test.ts`

**Interfaces:**
- Produces:
  - `CALENDAR_GRID_MINUTES = 15`
  - `snapToGrid(startTime: string, durationMin: number): { startTime: string; durationMin: number }`
- Semantics (locked here, consumed by Tasks 4, 13):
  - Start snaps to the **nearest** grid point (minute offset 0-7 rounds down, 8-14 rounds up).
  - A start that would round to 24:00 clamps to `23:45`; the day never wraps.
  - Duration snaps to the nearest multiple of 15 and never below 15.
  - Input `startTime` is assumed already valid `HH:MM` (validated upstream by `isValidStartTime`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/value-objects/__tests__/TimeGrid.test.ts
import { describe, expect, it } from "vitest";
import { CALENDAR_GRID_MINUTES, snapToGrid } from "../TimeGrid.ts";

describe("snapToGrid", () => {
  it("exposes the 15 minute constant", () => {
    expect(CALENDAR_GRID_MINUTES).toBe(15);
  });

  it("leaves an exact grid time unchanged", () => {
    expect(snapToGrid("10:30", 60)).toEqual({ startTime: "10:30", durationMin: 60 });
  });

  it("snaps 10:07 down to 10:00", () => {
    expect(snapToGrid("10:07", 60).startTime).toBe("10:00");
  });

  it("snaps 10:08 up to 10:15", () => {
    expect(snapToGrid("10:08", 60).startTime).toBe("10:15");
  });

  it("snaps across the hour: 10:53 becomes 11:00", () => {
    expect(snapToGrid("10:53", 60).startTime).toBe("11:00");
  });

  it("clamps 23:55 to 23:45 rather than wrapping the day", () => {
    expect(snapToGrid("23:55", 30).startTime).toBe("23:45");
  });

  it("snaps a 20 minute duration to 15 and a 25 minute one to 30", () => {
    expect(snapToGrid("10:00", 20).durationMin).toBe(15);
    expect(snapToGrid("10:00", 25).durationMin).toBe(30);
  });

  it("never snaps a duration below 15", () => {
    expect(snapToGrid("10:00", 5).durationMin).toBe(15);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/domain/value-objects/__tests__/TimeGrid.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/domain/value-objects/TimeGrid.ts`**

```ts
/**
 * The calendar grid: 15 minutes (spec D6). Coarse enough that the garden
 * does not become a scheduling tool, fine enough to sit beside a real
 * 10:30 meeting. A constant, deliberately not configurable in Phase 1.
 */
export const CALENDAR_GRID_MINUTES = 15;

const LAST_GRID_MINUTE = 24 * 60 - CALENDAR_GRID_MINUTES;

function snapMinutes(total: number): number {
  return Math.round(total / CALENDAR_GRID_MINUTES) * CALENDAR_GRID_MINUTES;
}

function formatTime(totalMinutes: number): string {
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Snap a clock time and duration to the 15 minute grid.
 * Start rounds to nearest (clamped so the day never wraps);
 * duration rounds to nearest with a 15 minute floor.
 */
export function snapToGrid(
  startTime: string,
  durationMin: number,
): { startTime: string; durationMin: number } {
  const [h, m] = startTime.split(":").map(Number);
  const snappedStart = Math.min(snapMinutes(h * 60 + m), LAST_GRID_MINUTE);
  const snappedDuration = Math.max(
    CALENDAR_GRID_MINUTES,
    snapMinutes(durationMin),
  );
  return { startTime: formatTime(snappedStart), durationMin: snappedDuration };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/domain/value-objects/__tests__/TimeGrid.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Lint, full suite, commit**

```bash
pnpm lint && pnpm vitest run
git add src/domain/value-objects/TimeGrid.ts src/domain/value-objects/__tests__/TimeGrid.test.ts
git commit -m "feat(domain): snapToGrid on the 15 minute calendar grid"
```

### Task 3: momentHash and eventFieldsForMoment

**Files:**
- Create: `src/domain/services/CalendarSyncService.ts`
- Test: `src/domain/services/__tests__/CalendarSyncService.test.ts`

**Interfaces:**
- Consumes: `Moment` from Task 1.
- Produces (Tasks 4, 5, 13 rely on these exact shapes):
  - `interface EventFields { title: string; day: string; startTime: string; durationMin: number }`
  - `momentHash(fields: EventFields): string` (16-char lowercase hex, FNV-1a 64 over `` `${day}|${startTime}|${durationMin}` ``)
  - **`title` is deliberately NOT hashed** (amended 2026-08-21). Hashing it made a
    calendar-side rename revert two passes later: the rename read as "event changed",
    the sidecar refreshed `lastWrittenHash` from the renamed event, and the next pass
    read the unchanged moment name as "moment changed" and republished the old title
    over it. Excluding `title` means the hash tracks **only timing**, which is the only
    thing a drag can change, so a rename in Calendar.app is ignored and survives. Names
    flow one way, zenborg to calendar, via `externalRef.lastWrittenTitle` (Task 4
    branch 9). The calendar never renames a moment.
  - `eventFieldsForMoment(moment: Moment): EventFields | null` (null when the moment is ambient, no `startTime`, or unallocated, no `day`; `durationMin` defaults to 60 when absent)
- Note: `phaseForStartTime` already exists at `src/domain/value-objects/Schedule.ts:151` (and its mcp mirror at `mcp-server/validation.ts:278`), with night-wrap tests in `Schedule.test.ts`. The spec lists it as a Slice A deliverable; it is reused, not rewritten.

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/services/__tests__/CalendarSyncService.test.ts
import { describe, expect, it } from "vitest";
import {
  createMoment,
  isMomentError,
  type Moment,
} from "../../entities/Moment.ts";
import {
  type EventFields,
  eventFieldsForMoment,
  momentHash,
} from "../CalendarSyncService.ts";

function newMoment(overrides: Partial<Moment> = {}): Moment {
  const created = createMoment({ name: "standup", areaId: "area-1" });
  if (isMomentError(created)) throw new Error(created.error);
  return { ...created, ...overrides };
}

const fields: EventFields = {
  title: "standup",
  day: "2026-08-24",
  startTime: "10:30",
  durationMin: 30,
};

describe("momentHash", () => {
  it("pins a literal digest, so a refactor cannot quietly change the algorithm", () => {
    // Computed, not guessed. The Swift port must produce this exact string
    // (Task 12 Step 2 asserts the same literal from the other language).
    expect(momentHash(fields)).toBe("ff236ccaea7fb964");
  });

  it("ignores title: renaming an event in Calendar.app is not a timing change", () => {
    expect(momentHash({ ...fields, title: "something else entirely" })).toBe(
      momentHash(fields),
    );
  });

  it("is 16 lowercase hex characters", () => {
    expect(momentHash(fields)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes when any timing field changes", () => {
    const base = momentHash(fields);
    expect(momentHash({ ...fields, startTime: "10:45" })).toBe("3aabf0c623137da0");
    expect(momentHash({ ...fields, durationMin: 45 })).toBe("ff2069caea7d7e74");
    expect(momentHash({ ...fields, day: "2026-08-25" })).toBe("98be2a9224c0686d");
    for (const digest of ["3aabf0c623137da0", "ff2069caea7d7e74", "98be2a9224c0686d"]) {
      expect(digest).not.toBe(base);
    }
  });
});

describe("eventFieldsForMoment", () => {
  it("maps an allocated timed moment to event fields", () => {
    const m = newMoment({ day: "2026-08-24", startTime: "10:30", durationMin: 30 });
    expect(eventFieldsForMoment(m)).toEqual(fields);
  });

  it("returns null for an ambient moment: no start time is never invented", () => {
    expect(eventFieldsForMoment(newMoment({ day: "2026-08-24" }))).toBeNull();
  });

  it("returns null for an unallocated moment", () => {
    expect(
      eventFieldsForMoment(newMoment({ startTime: "10:30", durationMin: 30 })),
    ).toBeNull();
  });

  it("defaults a missing duration to 60 minutes", () => {
    const m = newMoment({ day: "2026-08-24", startTime: "10:30" });
    expect(eventFieldsForMoment(m)?.durationMin).toBe(60);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/domain/services/__tests__/CalendarSyncService.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the first part of `src/domain/services/CalendarSyncService.ts`**

```ts
import type { Moment } from "../entities/Moment";

/**
 * Exactly the fields zenborg pushes to (or ingests from) a calendar event.
 * The hash over these is the echo-suppression comparand (spec D4).
 */
export interface EventFields {
  readonly title: string;
  readonly day: string; // YYYY-MM-DD, wall clock
  readonly startTime: string; // HH:MM, wall clock
  readonly durationMin: number;
}

/** Default event length when a timed moment carries no duration. */
export const DEFAULT_EVENT_DURATION_MIN = 60;

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/**
 * FNV-1a 64-bit over UTF-8 bytes, hex encoded. Chosen over a crypto hash
 * because it is synchronous, dependency-free, runs identically in the
 * browser, node and bun, and ports to Swift in ten lines (Slice C mirrors
 * it byte for byte). Collision resistance is irrelevant here: the hash only
 * ever compares an event against zenborg's own last write.
 */
export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

/** The stable hash spec D4 compares against. */
export function momentHash(fields: EventFields): string {
  return fnv1a64(
    `${fields.day}|${fields.startTime}|${fields.durationMin}|${fields.title}`,
  );
}

/**
 * The event a moment would publish as. Null for ambient moments (inventing
 * a start time for a moment deliberately without one would be fabricating
 * data, spec D6) and for unallocated moments (an event needs a date).
 */
export function eventFieldsForMoment(moment: Moment): EventFields | null {
  if (moment.day === null || moment.startTime === undefined) return null;
  return {
    title: moment.name,
    day: moment.day,
    startTime: moment.startTime,
    durationMin: moment.durationMin ?? DEFAULT_EVENT_DURATION_MIN,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/domain/services/__tests__/CalendarSyncService.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint, full suite, commit**

```bash
pnpm lint && pnpm vitest run
git add src/domain/services/CalendarSyncService.ts src/domain/services/__tests__/CalendarSyncService.test.ts
git commit -m "feat(domain): momentHash and eventFieldsForMoment for calendar sync"
```

### Task 4: reconcile(), the truth table, and applyEventToMoment

The heart of the design: a pure function over two snapshots. Every row of the spec's reconciliation table becomes at least one named test; the same cases are also written once as JSON vectors that the Swift sidecar replays in Task 13, so the two implementations can never quietly disagree.

**Files:**
- Modify: `src/domain/services/CalendarSyncService.ts`
- Create: `calendar-sidecar/fixtures/reconcile-vectors.json`
- Test: `src/domain/services/__tests__/CalendarSyncService.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1 (`Moment`, `countsAsAllocation`), Task 2 (`snapToGrid`), Task 3 (`momentHash`, `eventFieldsForMoment`), and `phaseForStartTime` from `src/domain/value-objects/Schedule.ts`.
- Produces (Tasks 9, 13, 14 rely on these exact shapes):

```ts
export interface CalendarEventSnapshot {
  readonly eventId: string;
  readonly calendarId: string;
  readonly title: string;
  readonly day: string; // YYYY-MM-DD wall clock
  readonly startTime: string; // HH:MM wall clock
  readonly durationMin: number;
  readonly lastModified: string; // ISO timestamp
}

export interface ReconcileContext {
  readonly zenborgCalendarId: string;
  readonly selectedCalendarIds: readonly string[];
}

export type ReconcileAction =
  | { kind: "none"; reason: "echo" | "inSync" | "unselectedCalendar" | "ambient" | "localEdit" }
  | { kind: "createTentativeMoment"; name: string; day: string; startTime: string; durationMin: number; eventId: string; calendarId: string }
  | { kind: "publishEvent"; momentId: string; overwroteEventEdit: boolean }
  | { kind: "applyEventToMoment"; momentId: string; day: string; startTime: string; durationMin: number; overwroteMomentEdit: boolean }
  | { kind: "deleteMoment"; momentId: string }
  | { kind: "returnToDrawingBoard"; momentId: string }
  | { kind: "deleteEvent"; eventId: string };

export function reconcile(
  moment: Moment | null,
  event: CalendarEventSnapshot | null,
  context: ReconcileContext,
): ReconcileAction;

export function applyEventToMoment(
  moment: Moment,
  action: Extract<ReconcileAction, { kind: "applyEventToMoment" }>,
  phaseConfigs: readonly PhaseConfig[],
): Moment;
```

**Pairing convention** (the caller, Slice C, pairs snapshots before calling; encode this in the doc comment):
- Moments and events are paired by `externalRef.eventId`.
- An event with no matching moment: `moment = null`.
- A moment whose `externalRef.eventId` no longer resolves: `event = null` (this is also how "event id no longer resolves" from the error table flows into the delete rules).
- **`event = null` means CONFIRMED ABSENT, never merely "not fetched"** (amended
  2026-08-21). This is load-bearing, and getting it wrong destroys data. The sidecar
  fetches events in a bounded window (Task 14: 7 days back, 60 forward). A moment from
  three weeks ago has no fetched event because it is outside that window, not because
  anything was deleted, and passing `null` for it would send branch 7 down the delete
  path: tentative moments erased, accepted moments unallocated back to the drawing
  board, taking their history and their habit-health contribution with them. The caller
  MUST therefore, before ever passing `null` for a moment that carries an
  `externalRef`, both (a) skip moments whose `day` falls outside the sync window
  entirely, leaving them untouched, and (b) confirm the absence for the rest with a
  direct `EKEventStore.event(withIdentifier:)` lookup, which is window-independent.
  Only a lookup that genuinely returns nothing may be passed as `null`. Task 14 Step 1
  implements both halves; Task 14 Step 3 checklist item 12 verifies it.
- An accepted timed allocated moment without `externalRef`: `event = null`.
- After the sidecar applies any non-`none` action it recomputes `externalRef.lastWrittenHash` from the event's current fields and sets `lastSyncedAt` (Task 14); `reconcile` itself never mutates.

**Decision logic** (implement exactly this; each branch cites its truth-table row):

1. `moment === null && event === null`: `none/inSync` (degenerate guard).
2. `moment === null`, event in the Zenborg calendar: `deleteEvent` (rows R9/R10: the moment behind our own event is gone or unallocated).
3. `moment === null`, event on a selected calendar: `createTentativeMoment` with `snapToGrid` applied and `name = event.title` (row R1).
4. `moment === null`, event elsewhere: `none/unselectedCalendar`.
5. Moment ambient (`startTime === undefined`): `none/ambient` (spec D6: never published).
6. `event === null`, no `externalRef`: if allocated, timed and `countsAsAllocation(moment)`, `publishEvent` with `overwroteEventEdit: false` (rows R2 and R11 "publish if not already an event"); else `none/inSync`.
7. `event === null`, has `externalRef`: tentative gets `deleteMoment` (row R7); accepted gets `returnToDrawingBoard` (row R8, the one asymmetry: a cancelled meeting must not destroy an intention).
8. Both present, `moment.day === null`: `deleteEvent` (row R9: unallocated in zenborg).
9. Both present, **Zenborg calendar**: compute `eventHash = momentHash(fields of event)` and `currentMomentHash = momentHash(eventFieldsForMoment(moment))`; compare each to `externalRef.lastWrittenHash`:
   - neither timing changed, but `moment.name !== externalRef.lastWrittenTitle`:
     `publishEvent` (a rename made in zenborg; push the name out). A rename made in
     Calendar.app does NOT reach this branch, because `lastWrittenTitle` still equals
     `moment.name`, so the principal's rename stands.
   - neither changed: `none/echo` (row R3, spec D4).
   - only event changed: `applyEventToMoment` snapped, `overwroteMomentEdit: false` (row R4).
   - only moment changed: `publishEvent`, `overwroteEventEdit: false` (moment edited in zenborg; push).
   - both changed: last write wins by timestamp, `event.lastModified` vs `moment.updatedAt`; the winning action carries `overwroteMomentEdit: true` or `overwroteEventEdit: true` so the sidecar can log the loss (row R12).
10. Both present, **foreign (ingested) calendar**: zenborg never writes there (spec D3). If `snapToGrid(event.startTime, event.durationMin)` plus `event.day` already equal the moment's fields: `none/inSync` (idempotence guard). Else if `eventHash !== externalRef.lastWrittenHash`: `applyEventToMoment` snapped, `overwroteMomentEdit` true only when the moment also drifted (rows R5/R6). Else: `none/localEdit` (the principal retimed an ingested moment inside zenborg; the moment wins, the foreign event is not touched).

`applyEventToMoment` updates `day`, `startTime`, `durationMin` (already snapped by `reconcile`), re-derives `phase = phaseForStartTime(startTime, phaseConfigs) ?? moment.phase` (spec D6: startTime wins any disagreement; the derivation corrects the moment instance, never the parent habit), refreshes `updatedAt`, and changes nothing else. It never renames: the moment name invariant (1-3 words) does not accept arbitrary event titles, so title edits flow only through the hash refresh (see Questions).

- [ ] **Step 1: Write the vectors file**

Create `calendar-sidecar/fixtures/reconcile-vectors.json`: an array of cases, one per truth-table row plus the edges, each `{ "name": ..., "moment": Moment | null, "event": CalendarEventSnapshot | null, "context": ReconcileContext, "expected": ReconcileAction }`. Build the fixture moments explicitly (fixed `id`s like `"m-1"`, fixed timestamps) so the file is deterministic. Include exactly these cases, named:

1. `R1 new event on selected calendar creates snapped tentative moment` (event at `10:20` for 50 min; expected `createTentativeMoment` at `10:15` for 45 min)
2. `R2 new accepted timed moment publishes an event`
3. `R3 zenborg event matching lastWrittenHash is our echo`
4. `R4 dragged zenborg event updates the accepted moment`
5. `R5 moved ingested event updates its tentative moment`
6. `R6 moved ingested event updates its accepted moment`
7. `R7 deleted ingested event deletes its tentative moment`
8. `R8 deleted ingested event returns its accepted moment to the drawing board`
9. `R9 unallocated moment deletes its event`
10. `R10 orphan zenborg event with no moment is deleted`
11. `R11a accepted ingested moment with an existing event publishes nothing`
12. `R11b accepted tentative moment with no event publishes`
13. `R12a both changed, newer event wins, moment edit loss flagged`
14. `R12b both changed, newer moment wins, event edit loss flagged`
15. `edge: event on an unselected foreign calendar is ignored`
16. `edge: ambient moment is never published`
17. `edge: ingested event already matching its moment yields no action`
18. `edge: moment-side edit to a zenborg event republishes`
19. `edge: local retime of an ingested moment is kept, foreign event untouched`
20. `edge: renamed zenborg event with unchanged timing is an echo, the rename stands` (event title differs from `lastWrittenTitle`, timing hash matches, `moment.name` equals `lastWrittenTitle`; expected `none/echo`, so the calendar-side rename is never reverted)
21. `edge: moment renamed in zenborg republishes its title` (timing hash matches, `moment.name` differs from `lastWrittenTitle`; expected `publishEvent`)
22. `edge: linked moment outside the sync window is never passed as deleted` (documents that the caller, not reconcile, owns the window guard: an out-of-window moment must not reach `reconcile` at all)

- [ ] **Step 2: Write the failing tests**

Extend `CalendarSyncService.test.ts` with a vector-driven block plus phase-derivation tests:

```ts
import vectors from "../../../../calendar-sidecar/fixtures/reconcile-vectors.json";
import { applyEventToMoment, reconcile } from "../CalendarSyncService.ts";
import { getDefaultPhaseConfigs, Phase } from "../../value-objects/Phase.ts";

describe("reconcile: the truth table", () => {
  for (const vector of vectors) {
    it(vector.name, () => {
      expect(
        reconcile(vector.moment, vector.event, vector.context),
      ).toEqual(vector.expected);
    });
  }
});

describe("applyEventToMoment", () => {
  const configs = getDefaultPhaseConfigs();

  it("re-derives phase when an event moves from 11:00 to 14:00", () => {
    const m = newMoment({
      day: "2026-08-24", phase: Phase.MORNING,
      startTime: "11:00", durationMin: 60,
    });
    const next = applyEventToMoment(
      m,
      { kind: "applyEventToMoment", momentId: m.id, day: "2026-08-24", startTime: "14:00", durationMin: 60, overwroteMomentEdit: false },
      configs,
    );
    expect(next.phase).toBe(Phase.AFTERNOON);
    expect(next.startTime).toBe("14:00");
  });

  it("derives NIGHT across the wrap for a 23:30 start", () => {
    const m = newMoment({
      day: "2026-08-24", phase: Phase.EVENING,
      startTime: "20:00", durationMin: 60,
    });
    const next = applyEventToMoment(
      m,
      { kind: "applyEventToMoment", momentId: m.id, day: "2026-08-24", startTime: "23:30", durationMin: 60, overwroteMomentEdit: false },
      configs,
    );
    expect(next.phase).toBe(Phase.NIGHT);
  });

  it("keeps the existing phase when no config covers the hour", () => {
    const partial = configs.filter((c) => c.phase === Phase.MORNING);
    const m = newMoment({
      day: "2026-08-24", phase: Phase.EVENING,
      startTime: "20:00", durationMin: 60,
    });
    const next = applyEventToMoment(
      m,
      { kind: "applyEventToMoment", momentId: m.id, day: "2026-08-24", startTime: "21:00", durationMin: 60, overwroteMomentEdit: false },
      partial,
    );
    expect(next.phase).toBe(Phase.EVENING);
  });

  it("never renames the moment", () => {
    const m = newMoment({ day: "2026-08-24", startTime: "10:00", durationMin: 30 });
    const next = applyEventToMoment(
      m,
      { kind: "applyEventToMoment", momentId: m.id, day: "2026-08-24", startTime: "10:30", durationMin: 30, overwroteMomentEdit: false },
      configs,
    );
    expect(next.name).toBe(m.name);
  });
});
```

Vitest resolves JSON imports natively; if the TS compiler complains, add `"resolveJsonModule": true` to `tsconfig.json` `compilerOptions` (check first; Next.js projects usually already set it).

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/domain/services/__tests__/CalendarSyncService.test.ts`
Expected: FAIL, `reconcile` / `applyEventToMoment` not exported.

- [ ] **Step 4: Implement `reconcile` and `applyEventToMoment`**

In `CalendarSyncService.ts`, add the types from the Interfaces block verbatim, then implement the ten-branch decision logic above. Imports to add at the top (note the `.ts` extension on value imports):

```ts
import { countsAsAllocation, type Moment } from "../entities/Moment.ts";
import type { PhaseConfig } from "../value-objects/Phase";
import { phaseForStartTime } from "../value-objects/Schedule.ts";
import { snapToGrid } from "../value-objects/TimeGrid.ts";
```

`applyEventToMoment`:

```ts
export function applyEventToMoment(
  moment: Moment,
  action: Extract<ReconcileAction, { kind: "applyEventToMoment" }>,
  phaseConfigs: readonly PhaseConfig[],
): Moment {
  return {
    ...moment,
    day: action.day,
    startTime: action.startTime,
    durationMin: action.durationMin,
    phase: phaseForStartTime(action.startTime, phaseConfigs) ?? moment.phase,
    updatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/domain/services/__tests__/CalendarSyncService.test.ts`
Expected: PASS (22 vector cases + 4 apply tests + Task 3's 8).

- [ ] **Step 6: Lint, full suite, commit**

```bash
pnpm lint && pnpm vitest run
git add src/domain/services/CalendarSyncService.ts calendar-sidecar/fixtures/reconcile-vectors.json src/domain/services/__tests__/CalendarSyncService.test.ts
git commit -m "feat(domain): reconcile truth table with shared vectors"
```

### Task 5: Property test, publish then ingest is identity

**Files:**
- Modify: `package.json` (devDependency), `src/domain/services/__tests__/CalendarSyncService.test.ts`

**Interfaces:** consumes Task 2-4 exports only.

- [ ] **Step 1: Add fast-check**

```bash
pnpm add -D fast-check
```

- [ ] **Step 2: Write the properties (they should pass immediately; a failure is a real bug in Tasks 2-4)**

```ts
import fc from "fast-check";
import { CALENDAR_GRID_MINUTES, snapToGrid } from "../../value-objects/TimeGrid.ts";

const gridTime = fc
  .record({ hour: fc.integer({ min: 0, max: 23 }), quarter: fc.integer({ min: 0, max: 3 }) })
  .map(({ hour, quarter }) =>
    `${String(hour).padStart(2, "0")}:${String(quarter * 15).padStart(2, "0")}`,
  );
const gridDuration = fc.integer({ min: 1, max: 16 }).map((n) => n * 15);
const isoDay = fc
  .date({ min: new Date("2026-01-01"), max: new Date("2027-12-31") })
  .map((d) => d.toISOString().slice(0, 10));

describe("properties", () => {
  it("publish then ingest is identity, from ARBITRARY times not pre-aligned ones", () => {
    // Generating only grid-aligned inputs would make this hold by construction.
    // Start from any wall-clock time, snap once as ingestion does, and require
    // that publishing and re-ingesting never moves it again.
    const anyTime = fc
      .record({ h: fc.integer({ min: 0, max: 23 }), m: fc.integer({ min: 0, max: 59 }) })
      .map(({ h, m }) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

    fc.assert(
      fc.property(anyTime, fc.integer({ min: 1, max: 300 }), isoDay, (raw, rawDur, day) => {
        const settled = snapToGrid(raw, rawDur);
        const m = newMoment({ ...settled, day, phase: null });
        const fields = eventFieldsForMoment(m);
        expect(fields).not.toBeNull();
        const reingested = snapToGrid(fields!.startTime, fields!.durationMin);
        expect(reingested).toEqual(settled);
        expect(fields!.day).toBe(day);
      }),
    );
  });

  it("the hash ignores title across arbitrary titles", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const base = { day: "2026-08-24", startTime: "10:30", durationMin: 30 };
        expect(momentHash({ ...base, title: a })).toBe(momentHash({ ...base, title: b }));
      }),
    );
  });

  it("snapToGrid is idempotent and always lands on the grid", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 1, max: 300 }),
        (h, m, dur) => {
          const raw = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const once = snapToGrid(raw, dur);
          expect(snapToGrid(once.startTime, once.durationMin)).toEqual(once);
          const [, mm] = once.startTime.split(":").map(Number);
          expect(mm % CALENDAR_GRID_MINUTES).toBe(0);
          expect(once.durationMin % CALENDAR_GRID_MINUTES).toBe(0);
        },
      ),
    );
  });
});
```

- [ ] **Step 3: Run and verify PASS**

Run: `pnpm vitest run src/domain/services/__tests__/CalendarSyncService.test.ts`
Expected: PASS. If a property fails, debug the implementation (systematic-debugging), not the property.

- [ ] **Step 4: Lint, full suite, commit**

```bash
pnpm lint && pnpm vitest run
git add package.json pnpm-lock.yaml src/domain/services/__tests__/CalendarSyncService.test.ts
git commit -m "test(domain): publish-ingest identity and snap idempotence properties"
```

### Task 6: countsAsAllocation at the domain read sites

Wire the predicate into every app-side read that aggregates moments, with a test per call site asserting a tentative moment does not move the number (spec D5).

**Files:**
- Modify: `src/domain/services/HabitHealthService.ts` (the `momentInvolvesHabit` filter at ~line 51 additionally requires `countsAsAllocation`; same inside `daysSinceLast`'s selection if separate)
- Modify: `src/hooks/useHabitHealth.ts` (the `habitMoments` filter at ~line 52 gains `countsAsAllocation(m) &&`)
- Modify: `src/infrastructure/state/bandedHeatmapViewModel.ts` (the `matches` filter in `buildCell` at ~line 153 gains `countsAsAllocation(m) &&`)
- Test: `src/domain/services/__tests__/HabitHealthService.tentative.test.ts` (create), plus a heatmap case in the existing view-model test file if one exists, else create `src/infrastructure/state/bandedHeatmapViewModel.tentative.test.ts`

**Interfaces:** consumes `countsAsAllocation` from Task 1. No new exports.

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/services/__tests__/HabitHealthService.tentative.test.ts
import { describe, expect, it } from "vitest";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import { Attitude } from "@/domain/value-objects/Attitude";
import { Phase } from "@/domain/value-objects/Phase";
import { HabitHealthService } from "../HabitHealthService";

// Fixture style copied from HabitHealthService.test.ts in this directory.
const service = new HabitHealthService();
const ISO = (d: Date) => d.toISOString();
const DAY = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number, now: Date) =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

const keepingHabit: Habit = {
  id: "habit-1",
  name: "test habit",
  areaId: "area-1",
  attitude: Attitude.KEEPING,
  rhythm: { period: "weekly", count: 1 },
  phase: null,
  tags: [],
  emoji: null,
  isArchived: false,
  order: 0,
  createdAt: ISO(new Date("2026-01-01")),
  updatedAt: ISO(new Date("2026-01-01")),
};

const allocatedMoment = (day: Date, overrides: Partial<Moment> = {}): Moment => ({
  id: `moment-${day.toISOString()}`,
  name: "m",
  areaId: "area-1",
  habitId: "habit-1",
  cycleId: null,
  cyclePlanId: null,
  phase: Phase.MORNING,
  day: DAY(day),
  order: 0,
  tags: null,
  createdAt: ISO(day),
  updatedAt: ISO(day),
  ...overrides,
});

describe("tentative moments and health (spec D5)", () => {
  const now = new Date("2026-08-21T12:00:00");

  it("a tentative moment does not rescue a wilting KEEPING habit", () => {
    const moments = [
      allocatedMoment(daysAgo(30, now)),
      allocatedMoment(daysAgo(0, now), { status: "tentative" }),
    ];
    expect(service.computeHealth(keepingHabit, null, moments, now)).toBe("wilting");
  });

  it("latestAllocationDate ignores tentative moments", () => {
    const moments = [
      allocatedMoment(daysAgo(10, now)),
      allocatedMoment(daysAgo(1, now), { status: "tentative" }),
    ];
    expect(service.latestAllocationDate(moments, now)).toEqual(
      service.latestAllocationDate([allocatedMoment(daysAgo(10, now))], now),
    );
  });

  it("an accepted moment with identical timing does move the number (control)", () => {
    const moments = [
      allocatedMoment(daysAgo(30, now)),
      allocatedMoment(daysAgo(0, now), { status: "accepted" }),
    ];
    expect(service.computeHealth(keepingHabit, null, moments, now)).toBe("blooming");
  });
});
```

(If `latestAllocationDate` has a different arity on the service, match the call in `src/hooks/useHabitHealth.ts:56`, which is the caller this protects.) For the heatmap:

```ts
// bandedHeatmapViewModel test addition (same fixture style as the file's
// other cases; two moments on one (day, phase), one tentative)
it("a tentative moment adds no density to its day cell", () => {
  const vm = deriveBandedHeatmapViewModel({
    cycles: [],
    areas: [areaFixture("a1"), areaFixture("a2")],
    phaseConfigs: getDefaultPhaseConfigs(),
    today: "2026-08-21",
    moments: [
      momentFixture({ day: "2026-08-21", phase: Phase.MORNING, areaId: "a1" }),
      momentFixture({
        day: "2026-08-21",
        phase: Phase.MORNING,
        areaId: "a2",
        status: "tentative",
      }),
    ],
  });
  const day = vm.days.find((d) => d.date === "2026-08-21");
  expect(day?.cells[Phase.MORNING]?.count).toBe(1);
  expect(day?.cells[Phase.MORNING]?.dominantAreaId).toBe("a1");
});
```

(`areaFixture` / `momentFixture` / the cell shape: mirror whatever the existing tests or `__fixtures__/specimen.ts` for the banded heatmap already use; the assertion contract is count 1 and dominant area a1.)

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm vitest run src/domain/services/__tests__/HabitHealthService.tentative.test.ts`
Expected: FAIL (tentative currently counts).

- [ ] **Step 3: Apply the one-line filters**

In each listed file, extend the existing moment selection with `countsAsAllocation(m)`, importing from `@/domain/entities/Moment` (the import line in `HabitHealthService.ts` already pulls `momentInvolvesHabit` from there; add `countsAsAllocation` to it). Inside `HabitHealthService`, apply it in the `habitMoments` selection **and** inside `latestAllocationDate`'s loop (the hook calls `latestAllocationDate` with its own selection, and the direct test above feeds it a tentative moment on purpose). Do not restructure the filters; this is additive.

- [ ] **Step 4: Run the full suite**

Run: `pnpm vitest run`
Expected: PASS, including all 1071 pre-existing tests (no existing vault moment carries `status`, so no baseline number moves).

- [ ] **Step 5: Lint, commit**

```bash
pnpm lint
git add -A src/domain src/hooks src/infrastructure/state
git commit -m "feat(domain): tentative moments count toward no allocation read"
```

### Task 7: mcp-server mirror and write tools

`mcp-server` deliberately does not import from `src/domain`, so the predicate is mirrored, exactly like `momentInvolvesHabit` already is.

**Files:**
- Modify: `mcp-server/vault.ts` (`Moment` interface ~line 180: add `status?: "tentative" | "accepted";` and `externalRef?: { source: "eventkit"; eventId: string; calendarId: string; lastWrittenHash: string; lastSyncedAt: string };`)
- Modify: `mcp-server/health.ts` (add `countsAsAllocation`; apply inside `computeHealth`, `daysSinceLast` and `latestAllocationDate` selections)
- Modify: `mcp-server/index.ts` (three allocation-count call sites gain `&& countsAsAllocation(m)` in their existing inline filters: `get_cycle_review` ~line 854 (filters by `habitId`), `decrement_habit_budget` ~line 1274 and `remove_habit_from_deck` ~line 1305 (both filter by `cyclePlanId`); `create_moment` and `update_moment` gain an optional `status` param)
- Modify: `mcp-server/TOOLS.md` (document `status`, `externalRef`, and the invariant)
- Test: `mcp-server/health.test.ts` (extend)

**Interfaces:**
- Produces in `mcp-server/health.ts`:

```ts
/**
 * Mirrors src/domain/entities/Moment.ts countsAsAllocation (spec D5).
 * The single predicate every aggregating filter composes with, so the
 * call sites cannot drift apart on what counts.
 */
export function countsAsAllocation(moment: Moment): boolean {
  return moment.status !== "tentative";
}
```

- `create_moment` / `update_moment` zod additions: `status: z.enum(["tentative", "accepted"]).optional()` (update also accepts it to flip a proposal to accepted from MCP; `externalRef` is deliberately not writable through MCP, the sidecar owns it, and `update_moment`'s spread already preserves it).

- [ ] **Step 1: Write the failing tests**

Extend `mcp-server/health.test.ts` following its existing fixture style:

The file already exposes `habit(over)` and `dayBefore(NOW, n)` factories and a `WEEKLY` rhythm at the top; reuse them, plus its moment factory (or an inline literal matching `Moment` from `./vault.js` if none exists):

```ts
import { countsAsAllocation } from "./health.js"; // extend the existing import line

describe("tentative moments (spec D5)", () => {
  const keeping = habit({ attitude: "KEEPING", rhythm: WEEKLY });

  const allocated = (day: string, over: Partial<Moment> = {}): Moment => ({
    id: `m-${day}`,
    name: "m",
    areaId: "a-1",
    habitId: "h-1",
    cycleId: null,
    cyclePlanId: null,
    phase: "MORNING",
    day,
    order: 0,
    tags: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });

  it("countsAsAllocation rejects tentative, accepts absent and accepted", () => {
    expect(countsAsAllocation(allocated(dayBefore(NOW, 0)))).toBe(true);
    expect(countsAsAllocation(allocated(dayBefore(NOW, 0), { status: "accepted" }))).toBe(true);
    expect(countsAsAllocation(allocated(dayBefore(NOW, 0), { status: "tentative" }))).toBe(false);
  });

  it("computeHealth ignores a tentative moment for a KEEPING habit", () => {
    const moments = [
      allocated(dayBefore(NOW, 30)),
      allocated(dayBefore(NOW, 0), { status: "tentative" }),
    ];
    expect(computeHealth(keeping, null, moments, NOW)).toBe("wilting");
  });

  it("daysSinceLast ignores tentative moments", () => {
    const moments = [
      allocated(dayBefore(NOW, 10)),
      allocated(dayBefore(NOW, 1), { status: "tentative" }),
    ];
    expect(daysSinceLast("h-1", moments, NOW)).toBe(10);
  });

  it("the cycle-count filter keeps only accepted allocated moments", () => {
    const moments = [
      allocated(dayBefore(NOW, 1)),
      allocated(dayBefore(NOW, 1), { id: "m-t", status: "tentative" }),
      allocated(dayBefore(NOW, 1), { id: "m-u", day: null }),
    ];
    // The exact composition get_cycle_review and the budget floors use.
    const counted = moments.filter((m) => m.day !== null && countsAsAllocation(m));
    expect(counted.map((m) => m.id)).toEqual([`m-${dayBefore(NOW, 1)}`]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run mcp-server/health.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add the two helpers to `health.ts`, thread `countsAsAllocation(m)` into the `habitMoments` filters in `computeHealth` (~line 55) and `daysSinceLast` (~line 123), replace the three inline count filters in `index.ts` with `allocatedMomentsForHabit`, add the `status` zod fields and pass-through in the `create_moment` / `update_moment` handlers (create: spread `...(params.status !== undefined ? { status: params.status } : {})`; update: same pattern, and `status: null` is not offered, acceptance is one-way from MCP). Update `TOOLS.md`: one paragraph under the moment tools describing `status` (absence means accepted; tentative moments are calendar proposals excluded from health, cycle counts and density) and `externalRef` (read-only provenance, owned by the calendar sidecar).

- [ ] **Step 4: Run the mcp suite and typecheck**

Run: `pnpm vitest run mcp-server && (cd mcp-server && pnpm typecheck)`
Expected: PASS.

- [ ] **Step 5: Lint, full suite, commit**

```bash
pnpm lint && pnpm vitest run
git add mcp-server
git commit -m "feat(mcp): mirror moment status, exclude tentative from every count"
```

**Slice A checkpoint:** the domain is complete and pure. `git log` shows seven green commits; no UI or Swift exists yet.

---

# Slice B: The week grid

Shippable without Slice C: everything below renders from vault data that already exists (`startTime`/`durationMin` are live fields today; `status` simply never appears until the sidecar writes it, so tentative styling is exercised by tests and ready for ingestion).

Design constraints from the spec (section "Slice B") and `DESIGN.md`: monochrome stone base, area color as the only carrier of meaning, no phase palette; inline editing, no modals; landscape only on mobile; tentative renders unfilled (hairline outline); no per-phase cap; the day view keeps its cap unchanged (`src/components/TimelineCell.tsx:47`, `src/hooks/useEntityActions.ts:137` are not touched).

### Task 8: weekGridViewModel (pure derivation)

**Files:**
- Create: `src/infrastructure/state/weekGridViewModel.ts`
- Test: `src/infrastructure/state/weekGridViewModel.test.ts`

**Interfaces:**
- Consumes: `Moment`, `countsAsAllocation` is NOT used here (the grid shows tentative moments; that is the point), `PhaseConfig`, `getVisiblePhases` from `src/domain/value-objects/Phase.ts`.
- Produces (Task 9 relies on these exact shapes):

```ts
export interface WeekGridBlock {
  readonly momentId: string;
  readonly name: string;
  readonly areaId: string;
  readonly startTime: string;
  readonly durationMin: number;
  // CSS grid placement on a 15-minute row unit, 1-indexed, row 1 being the
  // ambient lane. Amended 2026-08-21: replaces topPct/heightPct. A row unit of
  // CALENDAR_GRID_MINUTES makes the 15-minute grid structural, so a block cannot
  // land off-grid or overflow its track, rather than merely being snapped to it
  // by snapToGrid and then clamped in percentages.
  readonly gridRowStart: number;
  readonly gridRowSpan: number;
  readonly tentative: boolean;
}

export interface WeekGridDay {
  readonly date: string; // YYYY-MM-DD
  readonly isToday: boolean;
  readonly blocks: readonly WeekGridBlock[]; // sorted by startTime
  readonly ambient: readonly Moment[]; // allocated, no startTime; phase order then order
}

export interface WeekGridViewModel {
  readonly days: readonly WeekGridDay[]; // 7, Monday first
  readonly startHour: number;
  readonly endHour: number; // exclusive; 24 when a visible phase wraps midnight
  readonly hours: readonly number[]; // [startHour .. endHour-1] for the rules
  readonly rowsPerHour: number; // 60 / CALENDAR_GRID_MINUTES, so 4
  readonly totalRows: number; // (endHour - startHour) * rowsPerHour
}

export function deriveWeekGridViewModel(input: {
  moments: readonly Moment[];
  phaseConfigs: readonly PhaseConfig[];
  weekStart: string; // ISO Monday
  today: string;
}): WeekGridViewModel;
```

- Bounds rule (locked here): `startHour` is the minimum `startHour` across **visible** phase configs; `endHour` is the maximum `endHour`, treating a wrapping visible phase (`endHour <= startHour`) as extending to 24. Hidden phases (NIGHT by default) do not extend the grid. Blocks whose start falls outside the bounds clamp visually to the edge row.

- [ ] **Step 1: Write the failing tests**

```ts
// src/infrastructure/state/weekGridViewModel.test.ts
import { describe, expect, it } from "vitest";
import { createMoment, isMomentError, type Moment } from "@/domain/entities/Moment";
import { getDefaultPhaseConfigs, Phase } from "@/domain/value-objects/Phase";
import { deriveWeekGridViewModel } from "./weekGridViewModel.ts";

function moment(overrides: Partial<Moment>): Moment {
  const created = createMoment({ name: "standup", areaId: "area-1" });
  if (isMomentError(created)) throw new Error(created.error);
  return { ...created, ...overrides };
}

const configs = getDefaultPhaseConfigs(); // MORNING 6-12, AFTERNOON 12-18, EVENING 18-22, NIGHT 22-6 hidden

describe("deriveWeekGridViewModel", () => {
  const base = { phaseConfigs: configs, weekStart: "2026-08-24", today: "2026-08-26" };

  it("produces seven days, Monday first, with today flagged", () => {
    const vm = deriveWeekGridViewModel({ ...base, moments: [] });
    expect(vm.days.map((d) => d.date)).toEqual([
      "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27",
      "2026-08-28", "2026-08-29", "2026-08-30",
    ]);
    expect(vm.days[2].isToday).toBe(true);
  });

  it("bounds the grid by visible phase configs: 6 to 22 by default", () => {
    const vm = deriveWeekGridViewModel({ ...base, moments: [] });
    expect(vm.startHour).toBe(6);
    expect(vm.endHour).toBe(22);
  });

  it("a hidden NIGHT phase does not extend the grid", () => {
    const vm = deriveWeekGridViewModel({ ...base, moments: [] });
    expect(vm.hours).not.toContain(23);
  });

  it("a visible wrapping phase extends the grid to midnight", () => {
    const withNight = configs.map((c) =>
      c.phase === Phase.NIGHT ? { ...c, isVisible: true } : c,
    );
    const vm = deriveWeekGridViewModel({ ...base, phaseConfigs: withNight, moments: [] });
    expect(vm.endHour).toBe(24);
  });

  it("positions a timed moment by start and duration", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [moment({ day: "2026-08-24", phase: Phase.MORNING, startTime: "08:00", durationMin: 60 })],
    });
    const block = vm.days[0].blocks[0];
    // 6..22 at 4 rows/hour = 64 rows. Row 1 is the ambient lane, so 06:00
    // starts at row 2; 08:00 is 8 quarter-hours later, row 10; 60min spans 4.
    expect(vm.rowsPerHour).toBe(4);
    expect(vm.totalRows).toBe(64);
    expect(block.gridRowStart).toBe(10);
    expect(block.gridRowSpan).toBe(4);
  });

  it("a block can never span past the last row", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [moment({ day: "2026-08-24", phase: Phase.EVENING, startTime: "21:30", durationMin: 180 })],
    });
    const block = vm.days[0].blocks[0];
    expect(block.gridRowStart + block.gridRowSpan).toBeLessThanOrEqual(vm.totalRows + 2);
  });

  it("routes an ambient allocated moment to the ambient lane, not the hour rows", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [moment({ day: "2026-08-24", phase: Phase.MORNING })],
    });
    expect(vm.days[0].blocks).toHaveLength(0);
    expect(vm.days[0].ambient).toHaveLength(1);
  });

  it("flags tentative blocks", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [moment({ day: "2026-08-24", status: "tentative", startTime: "10:00", durationMin: 30, phase: Phase.MORNING })],
    });
    expect(vm.days[0].blocks[0].tentative).toBe(true);
  });

  it("has no per-phase cap: five afternoon blocks all render", () => {
    const five = ["12:00", "13:00", "14:00", "15:00", "16:00"].map((t) =>
      moment({ day: "2026-08-24", phase: Phase.AFTERNOON, startTime: t, durationMin: 45 }),
    );
    const vm = deriveWeekGridViewModel({ ...base, moments: five });
    expect(vm.days[0].blocks).toHaveLength(5);
  });

  it("ignores unallocated moments and other weeks", () => {
    const vm = deriveWeekGridViewModel({
      ...base,
      moments: [
        moment({ startTime: "10:00", durationMin: 30 }),
        moment({ day: "2026-09-07", startTime: "10:00", durationMin: 30, phase: Phase.MORNING }),
      ],
    });
    expect(vm.days.every((d) => d.blocks.length === 0 && d.ambient.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/infrastructure/state/weekGridViewModel.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `deriveWeekGridViewModel`**

Pure function, no observables. Derive the seven dates from `weekStart` with the date helpers in `src/lib/dates.ts` (see `fromISODate` usage in `BandedHeatmap.tsx`; avoid `new Date(iso)` UTC parsing). Bucket moments by `day`. Timed ones (with `startTime`) become blocks placed on the 15-minute row unit:

```ts
const rowsPerHour = 60 / CALENDAR_GRID_MINUTES;            // 4
const totalRows = (endHour - startHour) * rowsPerHour;     // 64 by default
const AMBIENT_LANE_ROWS = 1;                               // row 1 is the ambient lane

const offsetMin = startMinutes - startHour * 60;
const gridRowStart =
  clamp(Math.floor(offsetMin / CALENDAR_GRID_MINUTES), 0, totalRows - 1) +
  1 + AMBIENT_LANE_ROWS;
const gridRowSpan = clamp(
  Math.ceil((durationMin ?? DEFAULT_EVENT_DURATION_MIN) / CALENDAR_GRID_MINUTES),
  1,
  totalRows + 1 + AMBIENT_LANE_ROWS - gridRowStart,        // never spans past the last row
);
```

The span clamp is what closes the cross-midnight overflow: a 23:45 block with a 60 minute duration simply ends at the last row instead of running off the grid. Ambient allocated ones sort by phase `order` (via config lookup) then `order` and land in `ambient`, rendered in row 1. Follow the structure of `deriveBandedHeatmapViewModel` in the same directory.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/infrastructure/state/weekGridViewModel.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Lint, full suite, commit**

```bash
pnpm lint && pnpm vitest run
git add src/infrastructure/state/weekGridViewModel.ts src/infrastructure/state/weekGridViewModel.test.ts
git commit -m "feat(week): pure week grid view model on visible phase bounds"
```

### Task 9: WeekGrid components

**Files:**
- Create: `src/components/week-grid/WeekGrid.tsx`, `src/components/week-grid/WeekGridDayColumn.tsx`, `src/components/week-grid/WeekMomentBlock.tsx`
- Test: `src/components/__tests__/WeekGrid.test.tsx`

**Interfaces:**
- Consumes: `WeekGridViewModel`, `WeekGridBlock`, `WeekGridDay` from Task 8; `Area` from `src/domain/entities/Area.ts`.
- Produces:

```tsx
export interface WeekGridProps {
  vm: WeekGridViewModel;
  areas: Record<string, Area>;
  onAccept: (momentId: string) => void;
  onRename: (momentId: string, name: string) => void;
  onSelect?: (momentId: string) => void;
}
export function WeekGrid(props: WeekGridProps): JSX.Element;
```

- Visual rules (from the spec, not negotiable): stone base (`bg-stone-*` tonal steps like `ModeSelector` and `TimelineCell`); the block's fill is the **area color** for accepted moments; tentative moments render **unfilled**: transparent fill, hairline outline in the area color (`border` 1px, `bg-transparent`), so the eye separates proposal from intention without a legend. No phase palette anywhere. Accepting is a single gesture: a small check affordance on hover/focus of a tentative block, plus Enter on a focused tentative block; both call `onAccept(momentId)`. Renaming is inline: double-click (or Enter on an accepted block) swaps the label for a text input, commit on blur/Enter, escape cancels; no modal, no dialog.

- [ ] **Step 1: Write the failing component tests**

```tsx
// src/components/__tests__/WeekGrid.test.tsx
// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { WeekGrid } from "../week-grid/WeekGrid";
globalThis.React = React;

import type { WeekGridViewModel } from "@/infrastructure/state/weekGridViewModel";

const block = (over: Record<string, unknown>) => ({
  momentId: "m-1",
  name: "standup",
  areaId: "a1",
  startTime: "10:00",
  durationMin: 60,
  gridRowStart: 18,
  gridRowSpan: 4,
  tentative: false,
  ...over,
});

const day = (date: string, blocks: ReturnType<typeof block>[]) => ({
  date,
  isToday: date === "2026-08-26",
  blocks,
  ambient: [],
});

const vm: WeekGridViewModel = {
  days: [
    day("2026-08-24", [
      block({}),
      // row 34 is 14:00 on a 6am-based grid: (34 - 2) * 15min after 06:00.
      block({ momentId: "m-2", name: "dentist", areaId: "a2", tentative: true, startTime: "14:00", gridRowStart: 34 }),
    ]),
    day("2026-08-25", []), day("2026-08-26", []), day("2026-08-27", []),
    day("2026-08-28", []), day("2026-08-29", []), day("2026-08-30", []),
  ],
  startHour: 6,
  endHour: 22,
  hours: Array.from({ length: 16 }, (_, i) => i + 6),
};

// Area fixture style from MomentStack.test.tsx; only id/name/color matter here.
const areas = {
  a1: { id: "a1", name: "work", color: "#7c9a72" },
  a2: { id: "a2", name: "health", color: "#b06060" },
} as never;

const noop = () => {};

describe("WeekGrid", () => {
  it("renders seven day columns", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    expect(screen.getAllByTestId("week-day-column")).toHaveLength(7);
  });

  it("renders one hour rule per entry in vm.hours, not a hardcoded 24", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    expect(screen.getAllByTestId("hour-rule")).toHaveLength(16);
  });

  it("places a block by grid row rather than absolute position", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    const el = screen.getByText("standup").closest("[data-testid=week-block]");
    // gridRowStart 18, span 4 (see the fixture): the CSS contract Task 8 produces.
    expect(el).toHaveStyle({ gridRow: "18 / span 4" });
  });

  it("fills an accepted block with its area color", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    const el = screen.getByText("standup").closest("[data-testid=week-block]");
    expect(el).toHaveStyle({ backgroundColor: "#7c9a72" });
  });

  it("renders a tentative block unfilled with a hairline outline", () => {
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={noop} />);
    const el = screen.getByText("dentist").closest("[data-testid=week-block]");
    expect(el).not.toHaveStyle({ backgroundColor: "#b06060" });
    expect(el).toHaveStyle({ borderColor: "#b06060" });
  });

  it("accepting a tentative block is one gesture", () => {
    const onAccept = vi.fn();
    render(<WeekGrid vm={vm} areas={areas} onAccept={onAccept} onRename={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept moment" }));
    expect(onAccept).toHaveBeenCalledWith("m-2");
  });

  it("renames inline without a modal", () => {
    const onRename = vi.fn();
    render(<WeekGrid vm={vm} areas={areas} onAccept={noop} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText("standup"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "sync" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("m-1", "sync");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders more than three blocks in one phase band", () => {
    const five = ["12:00", "13:00", "14:00", "15:00", "16:00"].map((t, i) =>
      block({ momentId: `m-${i + 10}`, name: `b${i}`, startTime: t, gridRowStart: 26 + i * 4 }),
    );
    const crowded = { ...vm, days: [day("2026-08-24", five), ...vm.days.slice(1)] };
    render(<WeekGrid vm={crowded} areas={areas} onAccept={noop} onRename={noop} />);
    expect(screen.getAllByTestId("week-block")).toHaveLength(5);
  });
});
```

Area color must be applied via inline `style` (arbitrary hex cannot be a Tailwind class), which is also what the assertions read. The `data-testid` values above (`week-day-column`, `hour-rule`, `week-block`) are part of the component contract; use exactly these in Step 3.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/components/__tests__/WeekGrid.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the three components**

- `WeekGrid.tsx`: adapted from the Tailwind Plus week-view block (v4.3 markup; the repo is on Tailwind 4.1.14 and every utility it uses compiles there). **Take the mechanics, drop the chrome.** Keep its three-layer structure: a sticky day header, a sticky `w-14` hour gutter, a horizontal-rules layer and a vertical-rules layer (`divide-y`/`divide-x`), and an `<ol>` events layer sharing the same grid cell via `col-start-1 col-end-2 row-start-1`. Keep its mobile day-picker row. Drop everything else: the `bg-blue-*`/`pink`/`gray` event palette, the `bg-indigo-600` today pill and "Add event" button, the `el-dropdown`/`el-menu` view switcher (that is `ModeSelector`'s job, and a popover menu fights the spec's "no modals" rule), and its hardcoded 24 hour labels.

  Two deliberate departures from the block. Its rows are **5 minutes** (`repeat(288, ...)`); ours are **15**, so the layout unit is `CALENDAR_GRID_MINUTES` itself. And its span is a fixed 24 hours; ours is derived from visible `PhaseConfig` bounds, so the template is built from `vm`:

  ```tsx
  <ol style={{ gridTemplateRows: `1.75rem repeat(${vm.totalRows}, minmax(0, 1fr)) auto` }}
      className="col-start-1 col-end-2 row-start-1 grid grid-cols-1 sm:grid-cols-7">
  ```

  Row 1 (the block's `1.75rem` header track) is the **ambient lane**, rendering ambient moments as small chips (area-colored dot + name), read-only in this task. Hour rules and labels come from `vm.hours`, not a hardcoded list. Base stays stone per `DESIGN_SYSTEM.md:9` ("hairline rules, 1px grid gaps, and tonal stone steps"), which is what the block is already made of; only its color needs replacing. Today's column gets the subtle highlight `TimelineCell` uses, in stone rather than indigo.
- `WeekGridDayColumn.tsx`: one grid column; blocks placed by `gridRowStart`/`gridRowSpan`, not absolute positioning.
- `WeekMomentBlock.tsx`: accepted: `style={{ backgroundColor: area.color }}`, white/stone text, rounded-sm; tentative: `style={{ borderColor: area.color }}`, `border bg-transparent`, muted text, plus the check affordance (a `button` with `aria-label="Accept moment"`). Keyboard: block is focusable (`tabIndex={0}`), Enter accepts when tentative. Inline rename per the interface block above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/__tests__/WeekGrid.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint, full suite, commit**

```bash
pnpm lint && pnpm vitest run
git add src/components/week-grid src/components/__tests__/WeekGrid.test.tsx
git commit -m "feat(week): week grid components, tentative renders unfilled"
```

### Task 10: The /week route (Slice B ships here)

**Files:**
- Create: `src/app/week/page.tsx`
- Modify: `src/components/ModeSelector.tsx` (add `{ name: "Week", path: "/week" }` to the `modes` array and a `pathname.startsWith("/week")` branch to `currentMode`)

**Interfaces:**
- Consumes: `deriveWeekGridViewModel` (Task 8), `WeekGrid` (Task 9), store observables `moments$`, `areas$`, `phaseConfigs$` from `src/infrastructure/state/store.ts`, `updateMomentWithHistory(momentId: string, updates: Partial<Moment>)` from `src/infrastructure/state/history-middleware.ts`, `acceptMoment` semantics via `updates: { status: "accepted" }`.

- [ ] **Step 1: Implement the page**

`src/app/week/page.tsx`, client component modeled on `src/app/cultivate/page.tsx`: hydrate guard on `storeHydrated$`, `LandscapePrompt` (landscape only on mobile, same as the other surfaces), week navigation (previous/next week buttons + "This week" reset; `weekStart` in local component state, initialized to the Monday of today via the `src/lib/dates.ts` helpers). Wire:

```tsx
const onAccept = (momentId: string) =>
  updateMomentWithHistory(momentId, { status: "accepted" });
const onRename = (momentId: string, name: string) =>
  updateMomentWithHistory(momentId, { name });
```

(`updateMomentWithHistory` records undo history and refreshes `updatedAt`; renames still pass through the 1-3 word validation at the form level, reuse `validateMomentName` before calling.)

- [ ] **Step 2: Add the mode entry**

`ModeSelector.tsx`: add the fourth entry. Keyboard shortcut wiring for Cmd+4, if trivial in `useGlobalKeyboard.ts`, is a one-line addition; otherwise leave shortcuts untouched.

- [ ] **Step 3: Verify in the running app**

Run: `pnpm dev`, open `http://localhost:3000/week`.
Expected: the grid renders the current week from the live vault; existing timed moments (habits with schedules, like therapy or singing) appear as area-colored blocks at their clock positions; day view at `/cultivate` is unchanged, still capped at 3.

- [ ] **Step 4: Full suite, lint, commit**

```bash
pnpm lint && pnpm vitest run
git add src/app/week src/components/ModeSelector.tsx
git commit -m "feat(week): the week grid ships as its own surface"
```

**Slice B checkpoint: this commit is releasable.** No Swift exists; the principal has a working week calendar inside zenborg (the spec's main de-risking move). If Slice C slips, nothing above is wasted.

---

# Slice C: The EventKit sidecar

`zenborg-calendar`: a Swift binary, peer of `zenborg-mcp`, staged in `src-tauri/binaries/`, owning EventKit, reconciling with the truth table (ported, verified against the same JSON vectors as the TS tests), and writing the vault atomically. All judgement lives in Slice A; Swift is transport plus a faithful port of `reconcile`.

Swift cannot execute the TS `reconcile`, so the port is kept honest two ways: the shared vectors file from Task 4 replayed by a `self-test` subcommand, and a thin, mechanical translation (same branch order, same names).

### Task 11: Sidecar scaffold, build script, bundle wiring

**Files:**
- Create: `calendar-sidecar/Sources/main.swift`
- Modify: `src-tauri/scripts/build-sidecars.sh`
- Modify: `src-tauri/tauri.conf.json`
- Create: `src-tauri/Info.plist`, `src-tauri/Entitlements.plist`

**Interfaces:**
- Produces: a compiled `zenborg-calendar` staged as `src-tauri/binaries/zenborg-calendar-<triple>`; CLI surface `zenborg-calendar <status|run|reconcile-once|self-test <vectors.json>>` consumed by Tasks 12-14 and by the Tauri app.

- [ ] **Step 1: Minimal main.swift**

```swift
// calendar-sidecar/Sources/main.swift
import Foundation

let arguments = Array(CommandLine.arguments.dropFirst())
let command = arguments.first ?? "run"

switch command {
case "status":
    // Filled in Task 14: authorization + calendar listing.
    print("{\"authorization\": \"unknown\"}")
case "self-test":
    // Filled in Task 13: replay reconcile vectors.
    fputs("self-test not implemented yet\n", stderr)
    exit(1)
case "reconcile-once", "run":
    // Filled in Task 14.
    fputs("\(command) not implemented yet\n", stderr)
    exit(1)
default:
    fputs("unknown command: \(command)\n", stderr)
    exit(2)
}
```

- [ ] **Step 2: Grow the swiftc branch in build-sidecars.sh**

Append after the existing `zenborg-mcp` staging block, keeping the same `<name>-<triple>` convention:

```bash
# ── zenborg-calendar (Swift, EventKit) ───────────────────────────────
CAL_DIR="$WORKSPACE_ROOT/calendar-sidecar"
if [[ -d "$CAL_DIR/Sources" ]]; then
  echo "[sidecars] compiling zenborg-calendar (swiftc)"
  mkdir -p "$CAL_DIR/dist"
  xcrun swiftc -O "$CAL_DIR"/Sources/*.swift \
    -o "$CAL_DIR/dist/zenborg-calendar" \
    -framework EventKit -framework Foundation
  cp "$CAL_DIR/dist/zenborg-calendar" "$DEST/zenborg-calendar-$TARGET"
  chmod +x "$DEST/zenborg-calendar-$TARGET"
fi
```

- [ ] **Step 3: Bundle wiring**

`tauri.conf.json`: `"externalBin": ["binaries/zenborg-mcp", "binaries/zenborg-calendar"]`, and under `bundle.macOS` add `"entitlements": "./Entitlements.plist"`.

`src-tauri/Info.plist` (Tauri merges an `Info.plist` sitting next to `tauri.conf.json` into the app bundle):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSCalendarsUsageDescription</key>
  <string>Zenborg mirrors your planned moments into a dedicated Zenborg calendar and reads the calendars you select, so plans and calendar stay in step.</string>
  <key>NSCalendarsFullAccessUsageDescription</key>
  <string>Zenborg mirrors your planned moments into a dedicated Zenborg calendar and reads the calendars you select, so plans and calendar stay in step.</string>
</dict>
</plist>
```

`src-tauri/Entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.personal-information.calendars</key>
  <true/>
</dict>
</plist>
```

- [ ] **Step 4: Verify the build stages both sidecars**

Run: `bash src-tauri/scripts/build-sidecars.sh`
Expected: `binaries/zenborg-mcp-<triple>` and `binaries/zenborg-calendar-<triple>` both listed; `./calendar-sidecar/dist/zenborg-calendar status` prints the JSON stub.

- [ ] **Step 5: Full suite, commit**

```bash
pnpm lint && pnpm vitest run
git add calendar-sidecar src-tauri/scripts/build-sidecars.sh src-tauri/tauri.conf.json src-tauri/Info.plist src-tauri/Entitlements.plist
git commit -m "feat(sidecar): scaffold zenborg-calendar with swiftc build branch"
```

### Task 12: Swift vault I/O and hash port

**Files:**
- Create: `calendar-sidecar/Sources/Vault.swift`

**Interfaces:**
- Consumes: the vault at `~/.kairos` (`moments.json`, `phaseConfigs.json`; JSON objects keyed by entity id), plus a new singleton `calendarSync.json`.
- Produces (Swift, used by Tasks 13-14):

```swift
struct VaultMoment: Codable { /* id, name, areaId, habitId, cycleId, cyclePlanId,
  phase, day, order, startTime, durationMin, status, externalRef, tags,
  createdAt, updatedAt; unknown fields preserved via a raw-JSON side channel */ }

struct ExternalRef: Codable {
  var source: String  // "eventkit"
  var eventId: String
  var calendarId: String
  var lastWrittenHash: String   // timing only: day|startTime|durationMin
  var lastWrittenTitle: String  // last title zenborg wrote; names flow one way, out
  var lastSyncedAt: String
}

struct CalendarSyncConfig: Codable {
  var selectedCalendarIds: [String]
  var zenborgCalendarId: String?
  var updatedAt: String
}

func vaultRoot() -> URL          // ~/.kairos, overridable by ZENBORG_VAULT env for tests
func readMoments() throws -> [String: VaultMoment]
func writeMoments(_ moments: [String: VaultMoment]) throws // atomic temp-then-rename
func readCalendarSyncConfig() -> CalendarSyncConfig  // fail-soft to empty selection
func writeCalendarSyncConfig(_ config: CalendarSyncConfig) throws
func fnv1a64(_ input: String) -> String // byte-for-byte port of the TS fnv1a64
```

- **Field preservation is non-negotiable:** the vault is multi-writer; a Swift `Codable` round-trip that drops fields it does not model (like `refs`, `personIds`, `customMetric`, `emoji`) would destroy data written by the app or the MCP server. Implement read/write over `JSONSerialization` dictionaries (`[String: Any]`), mutating only the keys the sidecar owns (`day`, `phase`, `startTime`, `durationMin`, `status`, `externalRef`, `updatedAt`, plus whole-record insert/delete). `VaultMoment` is a typed **view** decoded per record for reading; writes patch the underlying dictionary.
- Atomic write mirrors `mcp-server/vault.ts:356`: serialize to `<file>.tmp-<pid>-<timestamp>` in the same directory, then `FileManager.moveItem` (rename) over the target, so the app's watcher sees a single `vault:collection-changed` event and there is never partial state (spec error table, vault-write row).
- Hash port:

```swift
func fnv1a64(_ input: String) -> String {
    var hash: UInt64 = 0xcbf29ce484222325
    for byte in Array(input.utf8) {
        hash ^= UInt64(byte)
        hash = hash &* 0x100000001b3
    }
    return String(format: "%016llx", hash)
}
```

- [ ] **Step 1: Implement Vault.swift per the interface above**

- [ ] **Step 2: Verify the hash port against the TS implementation**

First pin the digests on the TS side. Add to `CalendarSyncService.test.ts`:

```ts
it("fnv1a64 pins the cross-language digests the Swift port must match", () => {
  expect(fnv1a64("zenborg")).toBe("228301fdf1d234ee");
  expect(fnv1a64("2026-08-24|10:30|30")).toBe("ff236ccaea7fb964");
  expect(momentHash(fields)).toBe("ff236ccaea7fb964"); // title excluded, see Task 3
});
```

Then add a `hash <input>` case to `main.swift` (kept permanently; handy for debugging):

```swift
case "hash":
    print(fnv1a64(arguments.count > 1 ? arguments[1] : ""))
```

And compare:

```bash
pnpm vitest run src/domain/services/__tests__/CalendarSyncService.test.ts
bash src-tauri/scripts/build-sidecars.sh
./calendar-sidecar/dist/zenborg-calendar hash "zenborg"              # expect 228301fdf1d234ee
./calendar-sidecar/dist/zenborg-calendar hash "2026-08-24|10:30|30"  # expect ff236ccaea7fb964
```

Expected: identical 16-char digests from both languages. Record the two literals in a comment next to the Swift `fnv1a64` as well.

- [ ] **Step 3: Round-trip check on a scratch vault**

```bash
mkdir -p /tmp/zb-vault && cp ~/.kairos/moments.json /tmp/zb-vault/ 2>/dev/null || echo '{}' > /tmp/zb-vault/moments.json
ZENBORG_VAULT=/tmp/zb-vault ./calendar-sidecar/dist/zenborg-calendar status
diff <(python3 -m json.tool /tmp/zb-vault/moments.json) <(python3 -m json.tool /tmp/zb-vault/moments.json)
```

Add a `roundtrip` debug case that reads then rewrites moments unchanged; `diff` against the original must show only key-order/whitespace differences and **zero dropped fields** (synthetic data only in any committed fixture; never commit a real vault copy).

- [ ] **Step 4: Commit**

```bash
pnpm lint && pnpm vitest run
git add calendar-sidecar src/domain/services/__tests__/CalendarSyncService.test.ts
git commit -m "feat(sidecar): vault io with field preservation and fnv1a64 port"
```

### Task 13: Swift reconciler port, verified by the shared vectors

**Files:**
- Create: `calendar-sidecar/Sources/Reconciler.swift`
- Modify: `calendar-sidecar/Sources/main.swift` (`self-test` case)

**Interfaces:**
- Consumes: `calendar-sidecar/fixtures/reconcile-vectors.json` (Task 4), `fnv1a64` (Task 12).
- Produces (Swift mirrors of the Task 4 types, same names):

```swift
struct EventSnapshot: Codable { var eventId, calendarId, title, day, startTime: String; var durationMin: Int; var lastModified: String }
struct ReconcileContext: Codable { var zenborgCalendarId: String; var selectedCalendarIds: [String] }
enum ReconcileAction { /* one case per TS kind, same associated values */ }
func snapToGrid(startTime: String, durationMin: Int) -> (startTime: String, durationMin: Int)
func phaseForStartTime(_ startTime: String, _ configs: [PhaseConfig]) -> String? // port of Schedule.ts:151, night wrap included
func reconcile(moment: VaultMoment?, event: EventSnapshot?, context: ReconcileContext) -> ReconcileAction
```

- [ ] **Step 1: Port `snapToGrid`, `phaseForStartTime` (with `isHourInPhase`'s wrap rule: `endHour <= startHour` means `hour >= startHour || hour < endHour`), and `reconcile` following the ten-branch logic in Task 4 exactly, in the same order, with a comment per branch naming its truth-table row.**

- [ ] **Step 2: Implement `self-test`**

Decode the vectors file, run each case through the Swift `reconcile`, encode the resulting action to a canonical JSON dictionary, deep-compare with `expected`, print `PASS <name>` / `FAIL <name>: got ...` per case, exit non-zero on any failure.

- [ ] **Step 3: Run the self-test and verify all 22 vectors pass**

```bash
bash src-tauri/scripts/build-sidecars.sh
./calendar-sidecar/dist/zenborg-calendar self-test calendar-sidecar/fixtures/reconcile-vectors.json
```

Expected: `22 passed, 0 failed`. A failure means the port diverged; fix the Swift, never the vectors (the TS tests own them).

- [ ] **Step 4: Wire the self-test into the build script** so a diverging port cannot ship:

```bash
  "$CAL_DIR/dist/zenborg-calendar" self-test "$CAL_DIR/fixtures/reconcile-vectors.json"
```

(added right after the `swiftc` compile line, before staging).

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm vitest run
git add calendar-sidecar src-tauri/scripts/build-sidecars.sh
git commit -m "feat(sidecar): swift reconciler passes the shared truth-table vectors"
```

### Task 14: EventKit loop, app spawn, and the manual checklist

**Files:**
- Create: `calendar-sidecar/Sources/EventStore.swift`
- Modify: `calendar-sidecar/Sources/main.swift` (`status`, `reconcile-once`, `run`)
- Modify: `src-tauri/src/lib.rs` (spawn on launch)

**Interfaces:**
- Consumes: everything above.
- Produces: the five sidecar responsibilities from the spec, and nothing else:
  1. **Authorization**: `status` prints `{"authorization": "fullAccess" | "denied" | "notDetermined", "calendars": [{id, title, source}], "zenborgCalendarId": ...}`; `run`/`reconcile-once` request access via `EKEventStore.requestFullAccessToEvents` when `notDetermined`, and when denied print a structured warning and go **dormant** (exit 0 for `reconcile-once`, idle loop for `run`): the grid works, sync sleeps, never silently half-syncing (spec error table).
  2. **Publish**: accepted, allocated, timed moments without `externalRef` become events in the Zenborg calendar (`EKCalendar` titled "Zenborg", created on first need in the default source, id persisted to `calendarSync.json`; if the user deleted it, recreate on next publish and drop stale `externalRef`s whose `calendarId` no longer resolves).
  3. **Ingest**: events on `selectedCalendarIds` within the sync window (7 days back, 60 days forward, constants in `EventStore.swift`) become tentative moments per R1.
  4. **Watch**: subscribe to `NSNotification.Name.EKEventStoreChanged` on a `RunLoop` (`run` mode); each notification triggers a full reconcile pass. There is no incremental token to corrupt; recovery from anything is the same full pass (spec: recovery is always a full reconcile).
  5. **Write**: apply `ReconcileAction`s through `Vault.swift`; after every applied action, set `externalRef.lastWrittenHash` to the hash of the event's **current timing** (day, startTime, durationMin; never the title), `externalRef.lastWrittenTitle` to the title now on the event, and `lastSyncedAt` to now; log every `overwroteMomentEdit`/`overwroteEventEdit` loss to stderr with both timestamps (row R12: log the loss).
- Reconcile pass structure (`reconcile-once` and each watch tick): read vault + config, fetch events (Zenborg calendar + selected calendars, window), **partition moments by the sync window**, pair by `externalRef.eventId`, call `reconcile` per pair (moments without events, events without moments, matched pairs), apply actions, write moments once (single atomic write per pass; the app's watcher then emits one `vault:collection-changed` and the running UI reloads: the path that already exists, spec D7).
- **Window guard, in that order, before any pairing** (amended 2026-08-21; see the
  pairing convention in Task 4). Skipping this deletes history:
  1. Partition vault moments into in-window (`day` inside 7 back to 60 forward) and
     out-of-window. **Out-of-window moments are not reconciled at all**: not paired, not
     passed to `reconcile`, not written. They are invisible to the pass.
  2. For each in-window moment carrying an `externalRef` with no event in the fetched
     set, call `EKEventStore.event(withIdentifier: ref.eventId)`, which ignores the
     window. Only if that returns `nil` does the moment pair with `event = null` and
     become eligible for the delete rules.
  3. An identifier that resolves to an event outside the window is treated as present
     and in sync; no action.
  A `reconcile-once` over a vault with a year of linked history must produce **zero**
  actions when nothing changed in Calendar.app. That is the regression check.
- Wall-clock conversion at the EventKit boundary: `day`/`startTime` derive from the event's start in the **local** calendar/timezone via `DateComponents`; never store offsets (spec error table, DST row).
- App spawn, in `src-tauri/src/lib.rs` `setup` next to the mcp wiring block, release builds only, resolving the binary next to the exe exactly like `mcp_install.rs:131` resolves `zenborg-mcp`:

```rust
// Launch the bundled zenborg-calendar sidecar in watch mode. It owns
// EventKit and writes the vault directly; the watcher above picks up
// its writes. Failure to spawn degrades to "no sync", never to a
// broken app.
//
// Release always; in dev only when opted in, so the integrated loop
// (sidecar write -> vault:collection-changed -> week grid updates) is
// reachable from `pnpm tauri:dev` instead of needing a release build.
let sidecar_enabled = !cfg!(debug_assertions)
    || std::env::var("ZENBORG_CALENDAR_SIDECAR").as_deref() == Ok("1");
if sidecar_enabled {
    match sidecar_path("zenborg-calendar") {
        Ok(bin) => {
            if let Err(e) = std::process::Command::new(bin).arg("run").spawn() {
                log::warn!("[calendar] sidecar failed to spawn: {e}");
            }
        }
        Err(e) => log::info!("[calendar] sidecar not present: {e}"),
    }
}
```

- **Single instance, and only one writer at a time** (amended 2026-08-21). The app
  spawns `run` on every launch, so a second window, a relaunch that outlived its child,
  or a hand-run sidecar during development yields two watchers doing full passes
  against the same `moments.json`. Atomic rename prevents a torn file; it does not
  prevent a lost update, because both passes read the same state and the second write
  silently discards the first pass's actions. So `run` takes an exclusive `flock` on
  `<vault>/.calendar-sidecar.lock` at startup and exits 0 with a log line if the lock
  is already held. `reconcile-once` takes the same lock for the duration of its pass,
  which also makes a manual run safe while the app is up. The app additionally kills
  its child on exit (hold the `Child` and `kill()` it from the `RunEvent::Exit`
  handler) so a quit does not leave an orphan watcher writing the vault.

(extract `mcp_install.rs`'s exe-adjacent lookup into a small shared `sidecar_path(name)` helper rather than duplicating it).

- [ ] **Step 1: Implement `EventStore.swift` and the three commands per the interface above**

- [ ] **Step 2: Build, self-test, and run `reconcile-once` against a scratch vault and a scratch calendar**

```bash
bash src-tauri/scripts/build-sidecars.sh
ZENBORG_VAULT=/tmp/zb-vault ./calendar-sidecar/dist/zenborg-calendar status
ZENBORG_VAULT=/tmp/zb-vault ./calendar-sidecar/dist/zenborg-calendar reconcile-once
```

- [ ] **Step 3: Manual checklist (spec: Slice C gets a manual checklist against a scratch calendar rather than a mocked EventKit).** Use a scratch vault (`ZENBORG_VAULT=/tmp/zb-vault`, synthetic moments only) and a scratch calendar account. Verify each and record pass/fail in the task report:

1. First run on `notDetermined` shows the TCC prompt with the Info.plist copy; denying leaves `status` reporting `denied` and `run` dormant.
2. A "Zenborg" calendar appears in Calendar.app on first publish; toggling it off in Calendar.app hides every zenborg event (sovereignty: the layer can be switched off without uninstalling anything).
3. An accepted timed moment in the vault appears as a Zenborg-calendar event within one reconcile.
4. Dragging that event in Calendar.app moves the moment (time and, across a band boundary, phase) after the change notification; no echo loop follows (watch stderr: exactly one apply, then `echo` passes).
5. An event created on a selected calendar arrives as a tentative moment, snapped to the grid, rendered unfilled in the week grid; accepting it in the grid does not duplicate it in the Zenborg calendar.
6. Deleting the ingested event deletes the tentative moment; deleting an event behind an **accepted** moment returns the moment to the drawing board with `externalRef` gone.
7. Deleting a moment in zenborg deletes its Zenborg-calendar event on the next pass.
8. Deleting the whole Zenborg calendar in Calendar.app: next publish recreates it; no crash, stale refs dropped.
9. Kill the sidecar mid-pass: the app keeps working; relaunching runs a clean full reconcile; `moments.json` is never partially written.
10. Both-sides edit (drag the event while also retiming the moment in zenborg between passes): newer write wins, loss logged to stderr.
11. With the app running, a sidecar vault write triggers `vault:collection-changed` and the week grid updates without a reload. (Runnable in dev now: launch with `ZENBORG_CALENDAR_SIDECAR=1 pnpm tauri:dev`.)
12. **The window guard holds.** Seed the scratch vault with a linked moment dated 90 days ago and another 200 days out, both carrying an `externalRef`. Run `reconcile-once`. Expect **zero** actions: neither moment is deleted, unallocated, or stripped of its ref. Then delete a genuinely in-window ingested event and confirm its moment still goes. This is the regression guard for the amended pairing convention; without it the first pass eats your history.
13. **Renames settle in one direction.** Rename a Zenborg-calendar event in Calendar.app, run two passes, and confirm the new title survives and the moment keeps its own name. Then rename the moment in zenborg and confirm the event title follows on the next pass. Neither should ever revert the other.
14. **Two sidecars cannot both write.** With `run` already going, start a second `run`: it exits 0 immediately with the lock message. Quit the app and confirm no orphan `zenborg-calendar` remains (`pgrep zenborg-calendar` prints nothing).

- [ ] **Step 4: Full suite, lint, commit**

```bash
pnpm lint && pnpm vitest run
git add calendar-sidecar src-tauri/src/lib.rs src-tauri/src/mcp_install.rs
git commit -m "feat(sidecar): eventkit watch loop with app spawn and dormant denial"
```

---

## Truth table to test mapping

Every row of the spec's reconciliation table, its named test (Task 4, vector-driven, so each name below is both a TS test and a Swift self-test case):

| Spec row | Named test(s) |
|---|---|
| New event, selected calendar | `R1 new event on selected calendar creates snapped tentative moment` |
| New accepted timed moment, no externalRef | `R2 new accepted timed moment publishes an event` |
| Zenborg event edited, hash matches | `R3 zenborg event matching lastWrittenHash is our echo` |
| Zenborg event dragged, hash differs | `R4 dragged zenborg event updates the accepted moment` (+ `applyEventToMoment` phase re-derivation tests) |
| Ingested event moved (tentative) | `R5 moved ingested event updates its tentative moment` |
| Ingested event moved (accepted) | `R6 moved ingested event updates its accepted moment` |
| Ingested event deleted (tentative) | `R7 deleted ingested event deletes its tentative moment` |
| Ingested event deleted (accepted) | `R8 deleted ingested event returns its accepted moment to the drawing board` |
| Moment unallocated in zenborg | `R9 unallocated moment deletes its event` |
| Moment deleted in zenborg | `R10 orphan zenborg event with no moment is deleted` |
| Moment accepted (tentative) | `R11a accepted ingested moment with an existing event publishes nothing`, `R11b accepted tentative moment with no event publishes` |
| Both sides changed since last sync | `R12a both changed, newer event wins, moment edit loss flagged`, `R12b both changed, newer moment wins, event edit loss flagged` |

Plus five edge vectors (unselected calendar, ambient, ingest idempotence, moment-side republish, local edit of an ingested moment) and the D5 invariant tests at all four aggregation sites (Tasks 6 and 7).

## Out of scope (restating the spec so no task grows one of these)

Cycles as all-day spans; the circular day view; pinch-zoom re-rasterization; CalDAV; iOS; behavioral graph from co-occurrence; tentative-expiry sweep (spec open question 2, unanswered); configurable grid granularity (spec open question 3, answered no); a calendar-selection UI (Phase 1 selection is by editing `calendarSync.json` / the sidecar `status` output; see Questions).

## Questions for the principal

1. ~~**Ingested moment names vs the 1-3 word invariant.**~~ **Answered 2026-08-21: title
   is dropped from the hash.** Ingestion still derives the moment name from the first 3
   words of the event title. After that, names are one-way, zenborg to calendar, via
   `externalRef.lastWrittenTitle`. A rename in Calendar.app is ignored and stands; a
   rename in zenborg republishes. The hash covers timing only, which is the only thing a
   drag can change, so the revert-two-passes-later defect is gone. See Task 3.
2. **Sidecar lifecycle.** D7's rationale ("the principal's calendar changes all day; the app does not run all day") implies an always-on process, but the spec never names a mechanism. The plan ships the sidecar spawned by the app on launch (plus `reconcile-once` for manual runs). Always-on via a launchd agent (installed like the MCP wiring in `mcp_install.rs`) is a natural follow-up; it needs your call before anything installs itself into launchd.
3. **Calendar selection storage and UI.** Spec open question 1 proposes opt-in selection on first run but names no home for the selection. The plan stores it in a new vault singleton `calendarSync.json` (defaulting to none selected, matching your proposal); Phase 1 selection is done by CLI/`status` + editing that file, with a settings UI deferred. Confirm.
4. **Week grid placement.** The plan adds "Week" as a fourth mode in `ModeSelector` so Slice B is reachable and shippable. If the zoom ladder later wants it as a pinch rung of Cultivate instead, the route and components survive; only the nav entry moves.
5. **Ambient moments in the week grid.** The spec places ambient moments only in the day view ("a center cluster"). The week grid would silently hide a day's ambient allocations, so the plan gives each day column a thin untimed lane above the hour rows. Confirm or cut.
6. **reconcile() lives twice** (TS as the specification with the full vitest suite; Swift as a mechanical port gated by the same 22 JSON vectors in the build script). The spec implies but never states this duplication; flag if you would rather the sidecar shell out to a compiled TS reconciler instead.
