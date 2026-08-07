# People in zenborg — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a person a first-class concept in zenborg — a `Habit` carrying `kind: "person"`, with many people composable under a single `Moment`, and an outreach queue naming who has gone quiet.

**Architecture:** No new vault collection. People live in `habits.json` behind a `kind` discriminator. `Moment.personIds` carries the many-to-many. Person health is derived by a new, attitude-free pure function — deliberately *not* by reusing `HabitHealthService`, for reasons in "Correction to the decision doc" below. The outreach queue is a read-only MCP tool; no UI ships in this plan.

**Tech Stack:** TypeScript, vitest, Next.js (untouched here), Tauri/Rust (untouched here), the zenborg MCP server (`mcp-server/`, `@modelcontextprotocol/sdk` + zod).

**Source spec:** `docs/decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md`

## Correction to the decision doc

Three claims in the decision doc are wrong. The doc is a point-in-time record and is not being edited; this plan supersedes it on these points.

1. **"One line in `HabitHealthService`" understates it — health is implemented twice.** `src/domain/services/HabitHealthService.ts` (app) and `mcp-server/health.ts` (MCP server) each derive health independently. Any shared change is paid twice.

2. **Reusing the KEEPING branch does not work.** `computeHealth` gates on attitude *before* rhythm: `if (habit.attitude === null) return 'unstated'`. Across the 48 person-shaped habits today: 14 are `KEEPING` with a rhythm, 19 are `KEEPING` with no rhythm, 14 have no attitude at all, 1 is `BEGINNING`. Only the first 14 could ever reach `wilting`. Worse, it leaves attitude load-bearing for people — the exact coupling the decision doc set out to remove.

   **Resolution:** people get their own derivation that never consults attitude. `HabitHealthService` and `mcp-server/health.ts` `computeHealth` are left **completely untouched**, so no existing habit changes behaviour. This is both safer and less code than the doc proposed.

3. **UI filtering is deferred, not "accepted price".** The 48 person-habits already appear in the plant deck, cycle deck, autocomplete and command palette today. Tagging them with `kind` does not make that worse. Filtering them out is an improvement to schedule separately (~20 component touch points); it is not a prerequisite, and nothing in this plan depends on it.

One deviation from the doc's field signature: `Moment.personIds` is declared `personIds?: string[]` (optional, absent means none) rather than `string[] | null`. Required-nullable would force a write across every record in `moments.json`; optional gives a single empty representation and needs no migration.

## Global Constraints

- **Vault substrate rules apply** (`../kairos/kernel/substrate.md`): `id` is a UUID and is never regenerated; time is UTC ISO-8601 with milliseconds; unknown fields are preserved on write; a missing or malformed collection means empty, never an error.
- **Zenborg is the sole writer** of `habits.json` and `moments.json`. Nothing in this plan may write from a second process while the Tauri app is running.
- **New fields must be optional.** Any required field forces a migration of every existing record and breaks older builds.
- **`fs.rs` is not touched.** The Rust vault treats collections as opaque JSON strings; adding fields to `Habit` or `Moment` is TypeScript-only. Do not add anything to `ALLOWED_COLLECTIONS`.
- **Domain purity** (`src/domain/`): no framework imports, no React, no Tauri, no Chrome APIs. Pure functions, `readonly` where the surrounding code already is.
- **Code style:** functional preferred; `for...of` never `forEach`; always braced blocks, no braceless `if`/`for`; `pnpm` never npm/yarn.
- **Habit and moment names are 1–3 words.** Enforced by existing validators; the migration must not violate it.
- **Test runner:** root `vitest.config.mts` includes both `src/**/*.test.ts` and `mcp-server/**/*.test.ts`. Single-run form is `pnpm test run <path>` (bare `pnpm test` is watch mode).
- **`pnpm lint` is RED at baseline and is NOT a gate.** Measured at `b337dea`: 205 errors and 116 warnings across 242 files, none of them ours. Never run `pnpm lint` expecting green, and never "fix" findings in files you did not touch. The gate is instead: `pnpm exec biome check <the exact paths you changed>` must introduce **no new diagnostic** relative to the same paths at the task's base commit. Compare explicitly when in doubt — `git show <base>:<path> > /tmp/base-<name>` then biome-check both.
- **`pnpm exec tsc --noEmit` IS a gate** and is green at baseline. So is `pnpm test run`.
- **A husky pre-commit hook runs the full vitest suite on every commit** (~30s). Expected, not a hang.
- **`mcp-server/` is a separate package** with its own `package.json`, `pnpm-lock.yaml` and `node_modules` — it is not a pnpm workspace member. Its deps are already installed in this worktree. `pnpm --filter ./mcp-server typecheck` and `cd mcp-server && pnpm typecheck` both work.
- **Do not run `pnpm dev`, `tauri dev`, or any dev server.** The user runs those manually.
- **Commit only your own paths.** Never `git add -A`, never `git add .`, never `git checkout`/`restore`/`stash` any file. Stage exact paths only. This is a live user's repository.

---

### Task 1: `Habit.kind` discriminator

**Files:**
- Modify: `src/domain/entities/Habit.ts` (the `Habit` interface, and append the guard)
- Test: `src/domain/__tests__/Habit.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `type HabitKind = "person"`, optional field `Habit.kind?: HabitKind`, and `isPerson(habit: Habit): boolean`. Tasks 3, 5 and 6 depend on all three.

- [ ] **Step 1: Write the failing test**

Append to `src/domain/__tests__/Habit.test.ts`. Match the existing file's import style — check the top of the file and reuse whatever habit factory or literal the surrounding tests already use; if the file builds habit literals inline, build one inline here too.

```ts
import { isPerson, type Habit } from "@/domain/entities/Habit";

describe("isPerson", () => {
  const base: Habit = {
    id: "h1",
    name: "Yanik",
    areaId: "a1",
    attitude: null,
    phase: null,
    tags: [],
    emoji: null,
    isArchived: false,
    order: 0,
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-07T00:00:00.000Z",
  };

  it("is true when kind is person", () => {
    expect(isPerson({ ...base, kind: "person" })).toBe(true);
  });

  it("is false when kind is absent — a plain habit", () => {
    expect(isPerson(base)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test run src/domain/__tests__/Habit.test.ts`
Expected: FAIL — `isPerson` is not exported from `@/domain/entities/Habit`, and TypeScript rejects the `kind` property.

- [ ] **Step 3: Write minimal implementation**

In `src/domain/entities/Habit.ts`, add the type above the `Habit` interface:

```ts
/**
 * HabitKind — discriminates a person record from a practice.
 *
 * Absent means habit. People share the habits collection because a Habit
 * already carries every field a person needs (name, areaId, tags, aliases,
 * rhythm, emoji, order, description). The three fields a person does not
 * use — attitude, phase, guidance — are nullable and inert.
 *
 * See docs/decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md
 */
export type HabitKind = "person";
```

Add the field inside the `Habit` interface, next to the other optional fields:

```ts
  kind?: HabitKind; // Absent = habit. "person" = a person, not a practice.
```

Append the guard at the end of the file:

```ts
/**
 * Narrows a habit record to a person. Prefer this over comparing `kind`
 * inline so a typo cannot silently make someone not-a-person.
 */
export function isPerson(habit: Habit): boolean {
  return habit.kind === "person";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test run src/domain/__tests__/Habit.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. `kind` is optional, so no existing construction site breaks.

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/Habit.ts src/domain/__tests__/Habit.test.ts
git commit -m "feat(domain): add Habit.kind discriminator and isPerson guard"
```

---

### Task 2: `Moment.personIds`

**Files:**
- Modify: `src/domain/entities/Moment.ts` (the `Moment` interface)
- Test: `src/domain/__tests__/Moment.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: optional field `Moment.personIds?: string[]`. Tasks 3, 5 and 6 read it.

- [ ] **Step 1: Write the failing test**

Append to `src/domain/__tests__/Moment.test.ts`. Reuse the file's existing moment-construction style.

```ts
import type { Moment } from "@/domain/entities/Moment";

describe("Moment.personIds", () => {
  const base: Moment = {
    id: "m1",
    name: "dinner bcn",
    areaId: "a1",
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: "EVENING",
    day: "2026-08-07",
    order: 0,
    tags: null,
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-07T00:00:00.000Z",
  };

  it("composes several people under one moment", () => {
    const m: Moment = { ...base, personIds: ["p-yanik", "p-yoel", "p-manu"] };
    expect(m.personIds).toHaveLength(3);
  });

  it("is absent on a moment that involves nobody", () => {
    expect(base.personIds).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test run src/domain/__tests__/Moment.test.ts`
Expected: FAIL — TypeScript rejects `personIds` as an unknown property.

- [ ] **Step 3: Write minimal implementation**

In `src/domain/entities/Moment.ts`, add inside the `Moment` interface, beside `tags`:

```ts
  /**
   * People present at this moment. Many people compose under one moment —
   * a dinner with three friends is ONE moment carrying three ids, not three
   * moments (which would also collide with the max-3-per-(day,phase) cap).
   *
   * Ids reference habit records where `kind === "person"`.
   * Optional: absent means nobody. There is deliberately no `null` form.
   */
  personIds?: string[];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test run src/domain/__tests__/Moment.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/Moment.ts src/domain/__tests__/Moment.test.ts
git commit -m "feat(domain): add Moment.personIds for composing people under one moment"
```

---

### Task 3: Person derivations (domain)

**Files:**
- Create: `src/domain/services/PersonService.ts`
- Test: `src/domain/services/__tests__/PersonService.test.ts`

**Interfaces:**
- Consumes: `Habit`, `HabitKind`, `isPerson` (Task 1); `Moment.personIds` (Task 2); existing `Health` from `@/domain/value-objects/Health`; existing `rhythmSilenceThresholdDays` from `@/domain/value-objects/Rhythm`; existing `fromISODate` from `@/lib/dates`.
- Produces, all pure and all consumed by Task 4's mirror and Task 6's tool:
  - `personMoments(personId: string, moments: Moment[]): Moment[]`
  - `latestContactDate(personId: string, moments: Moment[], now: Date): Date | null`
  - `hasArrangedContact(personId: string, moments: Moment[], now: Date): boolean`
  - `daysSinceLastContact(personId: string, moments: Moment[], now: Date): number | null`
  - `personHealth(person: Habit, moments: Moment[], now: Date): Health`

**Why a separate module:** `HabitHealthService.computeHealth` returns `"unstated"` immediately when `attitude === null`, and people must not depend on attitude. Do not modify `HabitHealthService` in this task or any other.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/services/__tests__/PersonService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import {
  daysSinceLastContact,
  hasArrangedContact,
  latestContactDate,
  personHealth,
  personMoments,
} from "@/domain/services/PersonService";

const NOW = new Date("2026-08-07T12:00:00.000Z");

function person(over: Partial<Habit> = {}): Habit {
  return {
    id: "p-yanik",
    name: "Yanik",
    areaId: "a-friends",
    attitude: null,
    phase: null,
    tags: ["bcn"],
    emoji: null,
    isArchived: false,
    order: 0,
    kind: "person",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: "m1",
    name: "dinner",
    areaId: "a-friends",
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: "EVENING",
    day: "2026-08-01",
    order: 0,
    tags: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

describe("personMoments", () => {
  it("matches a moment that carries the person in personIds", () => {
    const m = moment({ personIds: ["p-yanik", "p-yoel"] });
    expect(personMoments("p-yanik", [m])).toEqual([m]);
  });

  it("matches a legacy moment that references the person via habitId", () => {
    const m = moment({ habitId: "p-yanik" });
    expect(personMoments("p-yanik", [m])).toEqual([m]);
  });

  it("does not match a moment about someone else", () => {
    const m = moment({ personIds: ["p-yoel"] });
    expect(personMoments("p-yanik", [m])).toEqual([]);
  });
});

describe("latestContactDate", () => {
  it("returns the most recent past day", () => {
    const ms = [
      moment({ id: "m1", day: "2026-07-01", personIds: ["p-yanik"] }),
      moment({ id: "m2", day: "2026-08-01", personIds: ["p-yanik"] }),
    ];
    expect(latestContactDate("p-yanik", ms, NOW)).toEqual(
      new Date("2026-08-01T00:00:00"),
    );
  });

  it("ignores future days — an arranged dinner is not contact yet", () => {
    const ms = [moment({ day: "2026-09-01", personIds: ["p-yanik"] })];
    expect(latestContactDate("p-yanik", ms, NOW)).toBeNull();
  });

  it("ignores unallocated moments with no day", () => {
    const ms = [moment({ day: null, personIds: ["p-yanik"] })];
    expect(latestContactDate("p-yanik", ms, NOW)).toBeNull();
  });
});

describe("hasArrangedContact", () => {
  it("is true when a moment is dated in the future", () => {
    const ms = [moment({ day: "2026-09-01", personIds: ["p-yanik"] })];
    expect(hasArrangedContact("p-yanik", ms, NOW)).toBe(true);
  });

  it("is false when every moment is in the past", () => {
    const ms = [moment({ day: "2026-08-01", personIds: ["p-yanik"] })];
    expect(hasArrangedContact("p-yanik", ms, NOW)).toBe(false);
  });
});

describe("daysSinceLastContact", () => {
  it("counts whole days back to the last past moment", () => {
    const ms = [moment({ day: "2026-08-01", personIds: ["p-yanik"] })];
    expect(daysSinceLastContact("p-yanik", ms, NOW)).toBe(6);
  });

  it("is null when there has never been contact", () => {
    expect(daysSinceLastContact("p-yanik", [], NOW)).toBeNull();
  });
});

describe("personHealth", () => {
  it("is unstated without a rhythm — a roster is not a commitment", () => {
    expect(personHealth(person(), [], NOW)).toBe("unstated");
  });

  it("is wilting when there is a rhythm but no contact at all", () => {
    const p = person({ rhythm: { period: "weekly", count: 1 } });
    expect(personHealth(p, [], NOW)).toBe("wilting");
  });

  it("is blooming inside the silence threshold", () => {
    const p = person({ rhythm: { period: "weekly", count: 1 } });
    const ms = [moment({ day: "2026-08-05", personIds: ["p-yanik"] })];
    expect(personHealth(p, ms, NOW)).toBe("blooming");
  });

  it("is wilting past the silence threshold", () => {
    const p = person({ rhythm: { period: "weekly", count: 1 } });
    const ms = [moment({ day: "2026-06-01", personIds: ["p-yanik"] })];
    expect(personHealth(p, ms, NOW)).toBe("wilting");
  });

  it("never consults attitude — a null-attitude person still wilts", () => {
    const p = person({
      attitude: null,
      rhythm: { period: "weekly", count: 1 },
    });
    const ms = [moment({ day: "2026-06-01", personIds: ["p-yanik"] })];
    expect(personHealth(p, ms, NOW)).toBe("wilting");
  });

  it("counts a moment shared with several people for each of them", () => {
    const p = person({ rhythm: { period: "weekly", count: 1 } });
    const ms = [
      moment({ day: "2026-08-05", personIds: ["p-yanik", "p-yoel", "p-manu"] }),
    ];
    expect(personHealth(p, ms, NOW)).toBe("blooming");
    expect(personHealth(person({ id: "p-yoel", rhythm: { period: "weekly", count: 1 } }), ms, NOW)).toBe("blooming");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test run src/domain/services/__tests__/PersonService.test.ts`
Expected: FAIL — cannot resolve `@/domain/services/PersonService`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/services/PersonService.ts`:

```ts
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import type { Health } from "@/domain/value-objects/Health";
import { rhythmSilenceThresholdDays } from "@/domain/value-objects/Rhythm";
import { fromISODate } from "@/lib/dates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * PersonService — pure derivations for people (habits with kind "person").
 *
 * Deliberately independent of HabitHealthService. That service gates on
 * attitude before rhythm (`attitude === null` short-circuits to "unstated"),
 * which would make attitude load-bearing for people — the exact coupling the
 * people design set out to remove. A person is never BUILDING or PUSHING;
 * their health is rhythm and silence, nothing else.
 *
 * Health is NEVER stored. Recomputed on every read.
 */

/**
 * Every moment involving this person.
 *
 * `habitId` is matched as well as `personIds` so that history predating the
 * people migration still counts — those moments were planted against the
 * person's own habit record, whose id the person kept.
 */
export function personMoments(personId: string, moments: Moment[]): Moment[] {
  const found: Moment[] = [];
  for (const m of moments) {
    if (m.habitId === personId || (m.personIds?.includes(personId) ?? false)) {
      found.push(m);
    }
  }
  return found;
}

/**
 * The most recent day this person was actually seen or spoken to.
 *
 * Future-dated moments are excluded: an arranged dinner is not contact yet.
 * Use `hasArrangedContact` for the "already sorted, stop nagging" signal.
 */
export function latestContactDate(
  personId: string,
  moments: Moment[],
  now: Date,
): Date | null {
  let latest: Date | null = null;
  for (const m of personMoments(personId, moments)) {
    if (m.day === null) {
      continue;
    }
    const d = fromISODate(m.day);
    if (d > now) {
      continue;
    }
    if (latest === null || d > latest) {
      latest = d;
    }
  }
  return latest;
}

/**
 * True when something with this person is already on the calendar ahead.
 *
 * The outreach queue uses this to stay quiet about someone you have already
 * reached out to. Known hole: a moment that keeps being postponed holds a
 * person out of the queue indefinitely. Accepted — it is visible in the
 * moment itself.
 */
export function hasArrangedContact(
  personId: string,
  moments: Moment[],
  now: Date,
): boolean {
  for (const m of personMoments(personId, moments)) {
    if (m.day === null) {
      continue;
    }
    if (fromISODate(m.day) > now) {
      return true;
    }
  }
  return false;
}

/** Whole days since the last real contact. Null means never. */
export function daysSinceLastContact(
  personId: string,
  moments: Moment[],
  now: Date,
): number | null {
  const last = latestContactDate(personId, moments, now);
  if (last === null) {
    return null;
  }
  return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
}

/**
 * Person health: rhythm and silence only.
 *
 *   no rhythm      -> "unstated"  (a roster entry, not a commitment)
 *   never seen     -> "wilting"
 *   within period  -> "blooming"
 *   past period    -> "wilting"
 */
export function personHealth(
  person: Habit,
  moments: Moment[],
  now: Date,
): Health {
  if (!person.rhythm) {
    return "unstated";
  }
  const last = latestContactDate(person.id, moments, now);
  if (last === null) {
    return "wilting";
  }
  const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
  return daysSince <= rhythmSilenceThresholdDays(person.rhythm)
    ? "blooming"
    : "wilting";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test run src/domain/services/__tests__/PersonService.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Confirm habit health is unchanged**

Run: `pnpm test run src/domain/services/__tests__/HabitHealthService.test.ts`
Expected: PASS with no modifications to that file or its subject. If anything here required touching `HabitHealthService.ts`, stop — the design says it must not be touched.

- [ ] **Step 6: Commit**

```bash
git add src/domain/services/PersonService.ts src/domain/services/__tests__/PersonService.test.ts
git commit -m "feat(domain): add PersonService — attitude-free person health and contact derivations"
```

---

### Task 4: Mirror the types and derivations into the MCP server

**Files:**
- Modify: `mcp-server/vault.ts` (the `Habit` and `Moment` interfaces)
- Create: `mcp-server/people.ts`
- Test: `mcp-server/people.test.ts`

**Interfaces:**
- Consumes: `parseVaultDay` from `mcp-server/health.ts`; `rhythmSilenceThresholdDays`, `Habit`, `Moment`, `Rhythm` from `mcp-server/vault.ts`; `Health` from `mcp-server/health.ts`.
- Produces the same five function names as Task 3, in `mcp-server/people.ts`, with identical semantics: `personMoments`, `latestContactDate`, `hasArrangedContact`, `daysSinceLastContact`, `personHealth`. Task 5 and Task 6 import from here.

**Why duplicated:** `mcp-server/` is a separate package that ships standalone; it already re-implements health in `mcp-server/health.ts` rather than importing from `src/domain/`. Follow the established pattern. Note the drift risk in the module docblock, as `health.ts` already does.

Note the date function differs by design: the MCP side uses `parseVaultDay` (local midnight), the domain side uses `fromISODate`. Both parse `YYYY-MM-DD` as local midnight; do not substitute bare `new Date(day)`, which parses as UTC and drifts a day in negative offsets.

- [ ] **Step 1: Add the two fields to the MCP-side types**

In `mcp-server/vault.ts`, add to the `Habit` interface:

```ts
  kind?: 'person'; // Absent = habit. Mirrors src/domain/entities/Habit.ts
```

and to the `Moment` interface, beside `tags`:

```ts
  personIds?: string[]; // People present. Mirrors src/domain/entities/Moment.ts
```

- [ ] **Step 2: Write the failing tests**

Create `mcp-server/people.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Habit, Moment } from './vault.js';
import {
  daysSinceLastContact,
  hasArrangedContact,
  latestContactDate,
  personHealth,
  personMoments,
} from './people.js';

const NOW = new Date('2026-08-07T12:00:00.000Z');

function person(over: Partial<Habit> = {}): Habit {
  return {
    id: 'p-yanik',
    name: 'Yanik',
    areaId: 'a-friends',
    attitude: null,
    phase: null,
    tags: ['bcn'],
    emoji: null,
    isArchived: false,
    order: 0,
    kind: 'person',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    name: 'dinner',
    areaId: 'a-friends',
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: 'EVENING',
    day: '2026-08-01',
    order: 0,
    tags: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('personMoments', () => {
  it('matches via personIds and via legacy habitId', () => {
    const a = moment({ id: 'a', personIds: ['p-yanik'] });
    const b = moment({ id: 'b', habitId: 'p-yanik' });
    const c = moment({ id: 'c', personIds: ['p-yoel'] });
    expect(personMoments('p-yanik', [a, b, c]).map((m) => m.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('latestContactDate', () => {
  it('ignores future days', () => {
    const ms = [moment({ day: '2026-09-01', personIds: ['p-yanik'] })];
    expect(latestContactDate('p-yanik', ms, NOW)).toBeNull();
  });
});

describe('hasArrangedContact', () => {
  it('is true for a future-dated moment', () => {
    const ms = [moment({ day: '2026-09-01', personIds: ['p-yanik'] })];
    expect(hasArrangedContact('p-yanik', ms, NOW)).toBe(true);
  });

  it('is false when everything is past', () => {
    const ms = [moment({ day: '2026-08-01', personIds: ['p-yanik'] })];
    expect(hasArrangedContact('p-yanik', ms, NOW)).toBe(false);
  });
});

describe('daysSinceLastContact', () => {
  it('counts whole days, null when never', () => {
    const ms = [moment({ day: '2026-08-01', personIds: ['p-yanik'] })];
    expect(daysSinceLastContact('p-yanik', ms, NOW)).toBe(6);
    expect(daysSinceLastContact('p-yanik', [], NOW)).toBeNull();
  });
});

describe('personHealth', () => {
  it('is unstated without a rhythm', () => {
    expect(personHealth(person(), [], NOW)).toBe('unstated');
  });

  it('is wilting with a rhythm and no contact', () => {
    const p = person({ rhythm: { period: 'weekly', count: 1 } });
    expect(personHealth(p, [], NOW)).toBe('wilting');
  });

  it('is blooming inside the threshold', () => {
    const p = person({ rhythm: { period: 'weekly', count: 1 } });
    const ms = [moment({ day: '2026-08-05', personIds: ['p-yanik'] })];
    expect(personHealth(p, ms, NOW)).toBe('blooming');
  });

  it('is wilting past the threshold and ignores attitude', () => {
    const p = person({
      attitude: null,
      rhythm: { period: 'weekly', count: 1 },
    });
    const ms = [moment({ day: '2026-06-01', personIds: ['p-yanik'] })];
    expect(personHealth(p, ms, NOW)).toBe('wilting');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test run mcp-server/people.test.ts`
Expected: FAIL — cannot resolve `./people.js`.

- [ ] **Step 4: Write minimal implementation**

Create `mcp-server/people.ts`:

```ts
import type { Health } from './health.js';
import { parseVaultDay } from './health.js';
import type { Habit, Moment } from './vault.js';
import { rhythmSilenceThresholdDays } from './vault.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * People derivations for the MCP server.
 *
 * Mirrors src/domain/services/PersonService.ts. Kept separate because
 * mcp-server ships standalone and does not import from src/domain — the same
 * arrangement health.ts already has with HabitHealthService.ts. The two must
 * stay in lockstep; they are small and fully covered by tests on both sides.
 *
 * Deliberately independent of computeHealth: that gates on attitude before
 * rhythm, and people must not depend on attitude.
 */

export function personMoments(personId: string, moments: Moment[]): Moment[] {
  const found: Moment[] = [];
  for (const m of moments) {
    if (m.habitId === personId || (m.personIds?.includes(personId) ?? false)) {
      found.push(m);
    }
  }
  return found;
}

/** Most recent past day of real contact. Future moments are not contact yet. */
export function latestContactDate(
  personId: string,
  moments: Moment[],
  now: Date,
): Date | null {
  let latest: Date | null = null;
  for (const m of personMoments(personId, moments)) {
    if (m.day === null) {
      continue;
    }
    const d = parseVaultDay(m.day);
    if (d > now) {
      continue;
    }
    if (latest === null || d > latest) {
      latest = d;
    }
  }
  return latest;
}

/** Something is already on the calendar ahead — stop nagging. */
export function hasArrangedContact(
  personId: string,
  moments: Moment[],
  now: Date,
): boolean {
  for (const m of personMoments(personId, moments)) {
    if (m.day === null) {
      continue;
    }
    if (parseVaultDay(m.day) > now) {
      return true;
    }
  }
  return false;
}

/** Whole days since last real contact. Null means never. */
export function daysSinceLastContact(
  personId: string,
  moments: Moment[],
  now: Date,
): number | null {
  const last = latestContactDate(personId, moments, now);
  if (last === null) {
    return null;
  }
  return Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
}

/** Rhythm and silence only. Attitude is never consulted. */
export function personHealth(
  person: Habit,
  moments: Moment[],
  now: Date,
): Health {
  if (!person.rhythm) {
    return 'unstated';
  }
  const last = latestContactDate(person.id, moments, now);
  if (last === null) {
    return 'wilting';
  }
  const daysSince = (now.getTime() - last.getTime()) / MS_PER_DAY;
  return daysSince <= rhythmSilenceThresholdDays(person.rhythm)
    ? 'blooming'
    : 'wilting';
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test run mcp-server/people.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck the MCP package**

Run: `pnpm --filter ./mcp-server typecheck` (if the filter fails, run `pnpm exec tsc --noEmit -p mcp-server/tsconfig.json`)
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/vault.ts mcp-server/people.ts mcp-server/people.test.ts
git commit -m "feat(mcp): mirror person types and derivations into the MCP server"
```

---

### Task 5: Accept `kind` and `personIds` through the write tools

**Files:**
- Modify: `mcp-server/index.ts` — `create_habit` (schema at line 363, record literal at line ~404), `update_habit` (schema at line 433, `next` literal at line ~470), `buildMoment` (line 1323), `create_moment` (schema at line 1364), `create_standalone_moment` (schema at line 1669)
- Modify: `mcp-server/TOOLS.md`

**Interfaces:**
- Consumes: `Habit.kind` and `Moment.personIds` from Task 4.
- Produces: `create_habit` and `update_habit` accept an optional `kind`; `create_moment` and `create_standalone_moment` accept an optional `personIds: string[]`, threaded through the shared `buildMoment` helper. Task 6's tool depends on records written this way; Task 7's migration writes `habits.json` directly and does not depend on this task.

Both moment tools construct their record through one shared helper, `buildMoment` at line 1323. Thread `personIds` there, not in each handler.

- [ ] **Step 1: Add `kind` to `create_habit`**

In the zod schema object for `create_habit` (line 363), add after `aliases`:

```ts
    kind: z.literal('person').optional(),
```

In the `const habit: Habit = {` literal (line ~404), add beside the other conditional spreads, immediately after the `aliases` spread:

```ts
      ...(params.kind ? { kind: params.kind } : {}),
```

- [ ] **Step 2: Add `kind` to `update_habit`**

In the zod schema for `update_habit` (line 433), add:

```ts
    kind: z.literal('person').nullable().optional(),
```

It is nullable so a mistagged person can be turned back into a habit. In the handler, follow the existing `rhythm` pattern exactly — add this block right after the `if ('rhythm' in updates) { ... }` block:

```ts
    if ('kind' in updates) {
      if (updates.kind === null) {
        delete next.kind;
      } else if (updates.kind !== undefined) {
        next.kind = updates.kind;
      }
    }
```

Do NOT add `kind` to the `next` object literal — the `...habit` spread already carries an existing value forward, and this block is what changes it.

- [ ] **Step 3: Thread `personIds` through `buildMoment`**

In the `buildMoment` params type (line 1323), add after `tags`:

```ts
  personIds?: string[];
```

In its returned object, add immediately after the `tags` line:

```ts
    ...(params.personIds && params.personIds.length > 0
      ? { personIds: params.personIds }
      : {}),
```

An empty array writes nothing, keeping "absent means nobody" as the single empty representation.

- [ ] **Step 4: Expose `personIds` on both moment tools**

Add to the zod schema of `create_moment` (line 1364) and of `create_standalone_moment` (line 1669):

```ts
    personIds: z.array(z.string()).optional(),
```

In each handler's `buildMoment({ ... })` call, add:

```ts
      personIds: params.personIds,
```

`create_standalone_moment` is the one to use for logging a shared dinner. Note it does not reject a full phase — it returns a `dayViewOverflow` notice alongside the created moment, so the max-3 cap the decision doc worried about never blocks a log.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter ./mcp-server typecheck` (fallback: `pnpm exec tsc --noEmit -p mcp-server/tsconfig.json`)
Expected: no errors.

- [ ] **Step 6: Verify by round-trip against a scratch vault**

Do NOT run this against `~/.kairos`. Point the server at a throwaway root:

```bash
mkdir -p /tmp/kairos-people-test
KAIROS_HOME=/tmp/kairos-people-test pnpm --filter ./mcp-server smoke
```

Expected: the smoke test passes. If `smoke-test.mjs` does not cover these tools, that is fine — this step is a regression check that the schema edits did not break the server's startup or existing tools.

- [ ] **Step 7: Document the new parameters**

In `mcp-server/TOOLS.md`, add `kind` to the `create_habit` and `update_habit` entries and `personIds` to the `create_moment` and `create_standalone_moment` entries, matching the file's existing formatting for optional parameters.

- [ ] **Step 8: Commit**

```bash
git add mcp-server/index.ts mcp-server/TOOLS.md
git commit -m "feat(mcp): accept kind on habit tools and personIds on moment tools"
```

---

### Task 6: `list_people_to_reach` — the outreach queue

**Files:**
- Modify: `mcp-server/index.ts` (add a new tool immediately after `list_wilting_habits`, which ends at line ~676)
- Modify: `mcp-server/TOOLS.md`
- Test: `mcp-server/people.test.ts` (append — the ranking helper only)

**Interfaces:**
- Consumes: `personHealth`, `hasArrangedContact`, `daysSinceLastContact` from `mcp-server/people.ts` (Task 4); `readCollection`, `VAULT_ROOT`, `ok` already in `index.ts`.
- Produces: MCP tool `list_people_to_reach`, and an exported helper `overdueRank(daysSinceLastContact: number | null): number` in `mcp-server/people.ts`.

This is the only genuinely new behaviour in the plan. It answers one question: who should I reach out to right now.

- [ ] **Step 1: Write the failing test for the ranking helper**

Never-contacted people must sort ahead of everyone, and two never-contacted people must not produce `NaN` from an `Infinity - Infinity` comparison. Append to `mcp-server/people.test.ts`:

```ts
import { overdueRank } from './people.js';

describe('overdueRank', () => {
  it('ranks never-contacted above any elapsed count', () => {
    expect(overdueRank(null)).toBeGreaterThan(overdueRank(3650));
  });

  it('is finite so two never-contacted people compare to zero, not NaN', () => {
    expect(overdueRank(null) - overdueRank(null)).toBe(0);
  });

  it('passes a real day count straight through', () => {
    expect(overdueRank(12)).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test run mcp-server/people.test.ts`
Expected: FAIL — `overdueRank` is not exported.

- [ ] **Step 3: Add the helper**

Append to `mcp-server/people.ts`:

```ts
/**
 * Sort key for the outreach queue. Never-contacted ranks above every elapsed
 * count, and stays finite so two of them compare to 0 rather than NaN.
 */
export function overdueRank(daysSince: number | null): number {
  return daysSince === null ? Number.MAX_SAFE_INTEGER : daysSince;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test run mcp-server/people.test.ts`
Expected: PASS

- [ ] **Step 5: Add the tool**

Add the import at the top of `mcp-server/index.ts`, alongside the existing `./health.js` import:

```ts
import {
  daysSinceLastContact,
  hasArrangedContact,
  overdueRank,
  personHealth,
} from './people.js';
```

Insert this tool immediately after the `list_wilting_habits` registration:

```ts
server.tool(
  'list_people_to_reach',
  'List people who have gone quiet past their rhythm and have nothing already arranged. Most overdue first. Filter by areaId or by a place tag such as paris, bcn, sp, london, nyc.',
  {
    areaId: z.string().optional(),
    tag: z.string().optional(),
    limit: z.number().int().positive().optional(),
  },
  async ({ areaId, tag, limit }): Promise<ToolResult> => {
    const habits = readCollection(VAULT_ROOT, 'habits');
    const moments = Object.values(readCollection(VAULT_ROOT, 'moments'));
    const now = new Date();

    const results: Array<{
      personId: string;
      name: string;
      areaId: string;
      tags: string[];
      rhythm: Rhythm | null;
      daysSinceLastContact: number | null;
    }> = [];

    for (const habit of Object.values(habits)) {
      if (habit.kind !== 'person') {
        continue;
      }
      if (habit.isArchived) {
        continue;
      }
      if (areaId && habit.areaId !== areaId) {
        continue;
      }
      if (tag && !habit.tags.includes(tag)) {
        continue;
      }
      if (personHealth(habit, moments, now) !== 'wilting') {
        continue;
      }
      // Already reached out and agreed a date — stay quiet.
      if (hasArrangedContact(habit.id, moments, now)) {
        continue;
      }

      results.push({
        personId: habit.id,
        name: habit.name,
        areaId: habit.areaId,
        tags: habit.tags,
        rhythm: habit.rhythm ?? null,
        daysSinceLastContact: daysSinceLastContact(habit.id, moments, now),
      });
    }

    results.sort(
      (a, b) =>
        overdueRank(b.daysSinceLastContact) -
        overdueRank(a.daysSinceLastContact),
    );

    return ok(limit ? results.slice(0, limit) : results);
  },
);
```

If `Rhythm` is not already imported in `index.ts`, add it to the existing `./vault.js` type import.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter ./mcp-server typecheck` (fallback: `pnpm exec tsc --noEmit -p mcp-server/tsconfig.json`)
Expected: no errors.

- [ ] **Step 7: Document the tool**

Add `list_people_to_reach` to `mcp-server/TOOLS.md` in the same section as `list_wilting_habits`, describing the three optional parameters and noting that people with a future-dated moment are excluded.

- [ ] **Step 8: Commit**

```bash
git add mcp-server/index.ts mcp-server/people.ts mcp-server/people.test.ts mcp-server/TOOLS.md
git commit -m "feat(mcp): add list_people_to_reach outreach queue"
```

---

### Task 7: Migrate the 48 person-habits

**Files:**
- Create: `scripts/people-migration.mts`
- Test: run against a copied vault before the real one — see steps.

**Interfaces:**
- Consumes: `Habit.kind` (Task 1/4). Writes `habits.json` directly.
- Produces: 48 habits marked `kind: "person"`, and two pair-records split into four.

**Precedent:** `scripts/things-area-align.mts` is the existing one-shot script pattern. Follow its shape for argument parsing and output.

**Hard requirement: the Tauri app must be closed while this runs.** Zenborg is the sole writer of `habits.json`; a running app will overwrite the migration from its in-memory store. Confirm with the user before the write step.

**The roster.** People are every non-archived habit in the Family, Friends and Sensitive areas EXCEPT these four, which are rituals and stay habits:

- `family breakfast` (Family)
- `colloc auber` (Friends)
- `poetry` (Sensitive)
- `tantric` (Sensitive)

**The splits.** Two records fuse two people. Each keeps its original id for the first-named person — so existing moments referencing that id stay attached — and gains a new sibling with a fresh UUID:

- `Paul & Mari` → rename to `Paul` (keeps id), create `Mari` (new UUID, same areaId, same tags, same rhythm, `order` = max order in that area + 1)
- `Yaya & Abuelo` → rename to `Yaya` (keeps id), create `Abuelo` (same rule)

- [ ] **Step 1: Write the script**

Create `scripts/people-migration.mts`:

```ts
/**
 * One-shot: mark person-shaped habits with kind "person" and split the two
 * fused pair records.
 *
 * Dry-run by default. Pass --write to actually write habits.json.
 * The Tauri app MUST be closed: zenborg is the sole writer of this file.
 *
 * See docs/decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md
 */
import { randomUUID } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const VAULT =
  process.env.KAIROS_HOME ?? path.join(homedir(), ".kairos");
const HABITS = path.join(VAULT, "habits.json");

const PERSON_AREAS = new Set(["Family", "Friends", "Sensitive"]);
/** Rituals, not people. Matched by exact habit name. */
const NOT_PEOPLE = new Set([
  "family breakfast",
  "colloc auber",
  "poetry",
  "tantric",
]);
/** name -> [keeps the original id, gets a new record] */
const SPLITS: Record<string, [string, string]> = {
  "Paul & Mari": ["Paul", "Mari"],
  "Yaya & Abuelo": ["Yaya", "Abuelo"],
};

const write = process.argv.includes("--write");

const areas = JSON.parse(readFileSync(path.join(VAULT, "areas.json"), "utf8"));
const habits = JSON.parse(readFileSync(HABITS, "utf8"));

const personAreaIds = new Set(
  Object.entries(areas)
    .filter(([, a]: [string, any]) => PERSON_AREAS.has(a.name))
    .map(([id]) => id),
);

const now = new Date().toISOString();
const marked: string[] = [];
const created: string[] = [];

const maxOrderByArea = new Map<string, number>();
for (const h of Object.values<any>(habits)) {
  const current = maxOrderByArea.get(h.areaId) ?? -1;
  if (h.order > current) {
    maxOrderByArea.set(h.areaId, h.order);
  }
}

for (const h of Object.values<any>(habits)) {
  if (!personAreaIds.has(h.areaId)) {
    continue;
  }
  if (h.isArchived) {
    continue;
  }
  if (NOT_PEOPLE.has(h.name)) {
    continue;
  }

  const split = SPLITS[h.name];
  if (split) {
    const [keeps, sibling] = split;
    h.name = keeps;
    h.kind = "person";
    h.updatedAt = now;
    marked.push(`${h.name} (renamed from a pair, id kept)`);

    const nextOrder = (maxOrderByArea.get(h.areaId) ?? 0) + 1;
    maxOrderByArea.set(h.areaId, nextOrder);
    const id = randomUUID();
    habits[id] = {
      ...h,
      id,
      name: sibling,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    };
    created.push(`${sibling} (new id ${id})`);
    continue;
  }

  h.kind = "person";
  h.updatedAt = now;
  marked.push(h.name);
}

console.log(`vault: ${VAULT}`);
console.log(`marked kind="person": ${marked.length}`);
for (const n of marked) {
  console.log(`  · ${n}`);
}
console.log(`created from splits: ${created.length}`);
for (const n of created) {
  console.log(`  + ${n}`);
}

if (!write) {
  console.log("\nDRY RUN — nothing written. Re-run with --write to apply.");
  process.exit(0);
}

const backup = `${HABITS}.bak.${now.replace(/[:.]/g, "").slice(0, 15)}`;
copyFileSync(HABITS, backup);
writeFileSync(HABITS, `${JSON.stringify(habits, null, 2)}\n`);
console.log(`\nbackup: ${backup}`);
console.log(`written: ${HABITS}`);
```

- [ ] **Step 2: Dry-run against a copy of the real vault**

```bash
mkdir -p /tmp/kairos-migration-test
cp ~/.kairos/areas.json ~/.kairos/habits.json /tmp/kairos-migration-test/
KAIROS_HOME=/tmp/kairos-migration-test node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/people-migration.mts
```

Expected: `marked kind="person": 46` and `created from splits: 2`, for 48 people total. The four ritual names must NOT appear in the marked list. If the count differs, stop and reconcile against the vault before going further — do not "fix" it by loosening the filter.

- [ ] **Step 3: Apply to the copy and verify the result**

```bash
KAIROS_HOME=/tmp/kairos-migration-test node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/people-migration.mts --write
python3 -c "
import json
h = json.load(open('/tmp/kairos-migration-test/habits.json'))
people = [v for v in h.values() if v.get('kind') == 'person']
print('people:', len(people))
names = {v['name'] for v in people}
for n in ['Paul', 'Mari', 'Yaya', 'Abuelo']:
    assert n in names, f'missing {n}'
for n in ['Paul & Mari', 'Yaya & Abuelo', 'family breakfast', 'colloc auber', 'poetry', 'tantric']:
    assert n not in names, f'should not be a person: {n}'
assert len({v['id'] for v in h.values()}) == len(h), 'duplicate ids'
print('OK')
"
```

Expected: `people: 48` then `OK`.

- [ ] **Step 4: Commit the script before touching the real vault**

```bash
git add scripts/people-migration.mts
git commit -m "chore(scripts): one-shot people migration — mark kind and split fused pairs"
```

- [ ] **Step 5: Ask the user to close the Tauri app, then apply for real**

Stop and confirm with the user. Only after they confirm the app is closed:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/people-migration.mts
```

Review the dry-run output with the user, then:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/people-migration.mts --write
```

The script writes a timestamped `.bak` beside `habits.json` before writing. Do not delete it.

- [ ] **Step 6: Verify the queue answers**

With the app still closed, exercise the new tool through the MCP server against the real vault, read-only:

```bash
pnpm --filter ./mcp-server build
```

Then call `list_people_to_reach` from a Claude session and confirm it returns people, sorted most-overdue-first, with nobody who has a future-dated moment. Expect a short list: only 15 of the 48 currently carry a rhythm, and people without one are `unstated`, not `wilting`.

- [ ] **Step 7: Full suite and final commit**

```bash
pnpm test run
pnpm exec tsc --noEmit
```

Expected: both green. Do NOT run `pnpm lint` as a gate — it is red at baseline with 205 pre-existing errors (see Global Constraints). Instead biome-check only the paths this plan created or modified and confirm no new diagnostic against their base versions.

---

## Deferred, deliberately

Not in this plan, and each needs its own decision before it is built:

- **Filtering people out of the app UI.** ~20 components read habits; people already appear in all of them today. Separate piece of work.
- **Excluding people from cycle budgeting.** Same reason. The plan adds no budgeting affordance for people, so nothing new appears; the pre-existing ability to budget one is untouched.
- **A people view or any UI at all.** Day one is MCP-only.
- **Modality** (call versus in-person) — a tag on the moment covers it until it demonstrably does not.
- **A Things consumer.** The loop is prospective: arranging forward writes the record.
- **Staleness on arranged contact.** A perpetually-postponed moment holds someone out of the queue forever. Known, accepted, revisit with real usage.
