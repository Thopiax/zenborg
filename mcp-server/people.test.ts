import { describe, expect, it } from 'vitest';
import {
  daysSinceLastContact,
  hasArrangedContact,
  latestContactDate,
  personHealth,
  personMoments,
} from './people.js';
import type { Attitude, Habit, Moment, Rhythm } from './vault.js';

const NOW = new Date('2026-08-07T12:00:00.000Z');

/** Local-calendar day string — exactly the form `parseVaultDay` reads back. */
function isoDay(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The day `n` local calendar days before `d`. Shifts the calendar date rather
 * than subtracting milliseconds, so a DST boundary cannot slide it by a day.
 */
function dayBefore(d: Date, n: number): string {
  const shifted = new Date(d.getTime());
  shifted.setDate(shifted.getDate() - n);
  return isoDay(shifted);
}

/**
 * Local midnight of NOW's own day. Passed as `now` where a test needs
 * `daysSince` to land on the threshold EXACTLY — from a mid-day `now` the
 * elapsed fraction is never zero, so `<=` and `<` stay indistinguishable.
 */
const MIDNIGHT = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

/** Today, derived from the frozen NOW — never from the wall clock. */
const TODAY = isoDay(NOW);

const WEEKLY: Rhythm = { period: 'weekly', count: 1 };
const TWICE_WEEKLY: Rhythm = { period: 'weekly', count: 2 };

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
    // MCP `Phase` is a string-literal union (z.enum), not a TS enum — the bare
    // string is the correct spelling on this side of the mirror.
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

  it('matches a moment carrying the person among several personIds', () => {
    const m = moment({ personIds: ['p-yanik', 'p-yoel'] });
    expect(personMoments('p-yanik', [m])).toEqual([m]);
  });

  it('does not match a moment about someone else', () => {
    const m = moment({ personIds: ['p-yoel'] });
    expect(personMoments('p-yanik', [m])).toEqual([]);
  });

  // The vault is mostly moments that predate `personIds` and were never about
  // a person at all: habitId null, personIds absent. The optional chain is the
  // only thing standing between that shape and a TypeError, and nothing above
  // reaches it — `habitId === personId` short-circuits, or personIds is there.
  it('does not match — and does not throw — when a moment has neither habitId nor personIds', () => {
    const m = moment({ habitId: null });
    expect(() => personMoments('p-yanik', [m])).not.toThrow();
    expect(personMoments('p-yanik', [m])).toEqual([]);
  });

  it('matches on personIds alone, with habitId null', () => {
    const m = moment({ habitId: null, personIds: ['p-yanik'] });
    expect(personMoments('p-yanik', [m])).toEqual([m]);
  });

  it('walks a vault where most moments carry no personIds at all', () => {
    const ms = [
      moment({ id: 'm1', habitId: null }),
      moment({ id: 'm2', habitId: 'h-yoga' }),
      moment({ id: 'm3', habitId: null, personIds: ['p-yanik'] }),
      moment({ id: 'm4', habitId: null }),
    ];
    expect(personMoments('p-yanik', ms)).toEqual([ms[2]]);
  });
});

describe('latestContactDate', () => {
  it('returns the most recent past day', () => {
    const ms = [
      moment({ id: 'm1', day: '2026-07-01', personIds: ['p-yanik'] }),
      moment({ id: 'm2', day: '2026-08-01', personIds: ['p-yanik'] }),
    ];
    expect(latestContactDate('p-yanik', ms, NOW)).toEqual(
      new Date('2026-08-01T00:00:00'),
    );
  });

  it('ignores future days', () => {
    const ms = [moment({ day: '2026-09-01', personIds: ['p-yanik'] })];
    expect(latestContactDate('p-yanik', ms, NOW)).toBeNull();
  });

  it('ignores unallocated moments with no day', () => {
    const ms = [moment({ day: null, personIds: ['p-yanik'] })];
    expect(latestContactDate('p-yanik', ms, NOW)).toBeNull();
  });

  // A day parses to LOCAL MIDNIGHT, so a moment dated today is already behind
  // `now` and counts as contact. `d > now` is the most semantically loaded
  // line in the module; today is the case that sits right on it.
  it('counts a moment dated today — local midnight is already behind us', () => {
    const ms = [moment({ day: TODAY, personIds: ['p-yanik'] })];
    expect(latestContactDate('p-yanik', ms, NOW)).toEqual(MIDNIGHT);
  });

  it('prefers today over an earlier day', () => {
    const ms = [
      moment({ id: 'm1', day: dayBefore(NOW, 3), personIds: ['p-yanik'] }),
      moment({ id: 'm2', day: TODAY, personIds: ['p-yanik'] }),
    ];
    expect(latestContactDate('p-yanik', ms, NOW)).toEqual(MIDNIGHT);
  });

  it('parses the day as local midnight, not UTC', () => {
    const ms = [moment({ day: '2026-08-01', personIds: ['p-yanik'] })];
    const last = latestContactDate('p-yanik', ms, NOW);
    expect(last?.getFullYear()).toBe(2026);
    expect(last?.getMonth()).toBe(7);
    expect(last?.getDate()).toBe(1);
    expect(last?.getHours()).toBe(0);
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

  it('is false when there are no moments at all', () => {
    expect(hasArrangedContact('p-yanik', [], NOW)).toBe(false);
  });

  it('ignores an unallocated moment with no day', () => {
    const ms = [moment({ day: null, personIds: ['p-yanik'] })];
    expect(hasArrangedContact('p-yanik', ms, NOW)).toBe(false);
  });

  // Today is contact, not an arrangement — seeing someone this evening is not
  // a reason for the outreach queue to call you sorted.
  it('is false for a moment dated today', () => {
    const ms = [moment({ day: TODAY, personIds: ['p-yanik'] })];
    expect(hasArrangedContact('p-yanik', ms, NOW)).toBe(false);
  });

  it('is true when tomorrow is booked even though today already happened', () => {
    const ms = [
      moment({ id: 'm1', day: TODAY, personIds: ['p-yanik'] }),
      moment({ id: 'm2', day: dayBefore(NOW, -1), personIds: ['p-yanik'] }),
    ];
    expect(hasArrangedContact('p-yanik', ms, NOW)).toBe(true);
  });

  // Right-hand branch alone: no habitId to short-circuit on.
  it('reads personIds when habitId is null', () => {
    const ms = [
      moment({ id: 'm1', habitId: null }),
      moment({
        id: 'm2',
        habitId: null,
        day: dayBefore(NOW, -1),
        personIds: ['p-yanik'],
      }),
    ];
    expect(hasArrangedContact('p-yanik', ms, NOW)).toBe(true);
  });
});

describe('daysSinceLastContact', () => {
  it('counts whole days, null when never', () => {
    const ms = [moment({ day: '2026-08-01', personIds: ['p-yanik'] })];
    expect(daysSinceLastContact('p-yanik', ms, NOW)).toBe(6);
    expect(daysSinceLastContact('p-yanik', [], NOW)).toBeNull();
  });

  it('is zero for a moment dated today', () => {
    const ms = [moment({ day: TODAY, personIds: ['p-yanik'] })];
    expect(daysSinceLastContact('p-yanik', ms, NOW)).toBe(0);
  });

  it('floors — the count ticks over at local midnight, not at the hour of contact', () => {
    const ms = [moment({ day: dayBefore(NOW, 1), personIds: ['p-yanik'] })];
    expect(daysSinceLastContact('p-yanik', ms, NOW)).toBe(1);
  });

  it('derives contact from a personIds-only moment without touching habitId', () => {
    const ms = [
      moment({ id: 'm1', habitId: null }),
      moment({ id: 'm2', habitId: null, day: TODAY, personIds: ['p-yanik'] }),
    ];
    expect(daysSinceLastContact('p-yanik', ms, NOW)).toBe(0);
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

  it('counts a moment shared with several people for each of them', () => {
    const ms = [
      moment({ day: '2026-08-05', personIds: ['p-yanik', 'p-yoel', 'p-manu'] }),
    ];
    expect(personHealth(person({ rhythm: WEEKLY }), ms, NOW)).toBe('blooming');
    expect(
      personHealth(person({ id: 'p-yoel', rhythm: WEEKLY }), ms, NOW),
    ).toBe('blooming');
  });
});

/**
 * The reason this module exists. `health.ts`'s `computeHealth` reads attitude
 * BEFORE rhythm — null short-circuits to "unstated", BEING to "evergreen",
 * BUILDING into a budding/pace branch. If any of that leaked in here, most of
 * the real roster would be judged on a field people do not set. These cases
 * therefore vary attitude and see the health NOT move.
 */
describe('personHealth — attitude is never consulted', () => {
  const seen = [moment({ day: dayBefore(NOW, 2), personIds: ['p-yanik'] })];
  const silent = [moment({ day: dayBefore(NOW, 40), personIds: ['p-yanik'] })];

  it('judges a BUILDING person on rhythm and silence, where computeHealth would branch', () => {
    const p = person({ attitude: 'BUILDING', rhythm: WEEKLY });
    expect(personHealth(p, seen, NOW)).toBe('blooming');
    expect(personHealth(p, silent, NOW)).toBe('wilting');
  });

  it('returns the same health for every attitude, including BEING and null', () => {
    const attitudes: (Attitude | null)[] = [
      null,
      'BEGINNING',
      'RETURNING',
      'KEEPING',
      'BUILDING',
      'PUSHING',
      'BEING',
    ];
    for (const attitude of attitudes) {
      const p = person({ attitude, rhythm: WEEKLY });
      expect(personHealth(p, seen, NOW)).toBe('blooming');
      expect(personHealth(p, silent, NOW)).toBe('wilting');
    }
  });

  it('is unstated for a BEING person with no rhythm — not evergreen', () => {
    const p = person({ attitude: 'BEING' });
    expect(personHealth(p, seen, NOW)).toBe('unstated');
  });
});

/**
 * The threshold is `PERIOD_DAYS[period] / count` compared with `<=`. Every
 * part of that must be pinned: drop `count`, shift by a day, or flip the
 * comparison, and one of these has to go red.
 */
describe('personHealth — silence threshold arithmetic', () => {
  it('blooms when silence equals the threshold exactly (<=, not <)', () => {
    // MIDNIGHT as `now` is the only way to make daysSince land on exactly 7.0 —
    // from a mid-day `now` the fraction is never zero and `<` would still pass.
    const ms = [
      moment({ day: dayBefore(MIDNIGHT, 7), personIds: ['p-yanik'] }),
    ];
    expect(personHealth(person({ rhythm: WEEKLY }), ms, MIDNIGHT)).toBe(
      'blooming',
    );
  });

  it('wilts one day past the threshold', () => {
    const ms = [
      moment({ day: dayBefore(MIDNIGHT, 8), personIds: ['p-yanik'] }),
    ];
    expect(personHealth(person({ rhythm: WEEKLY }), ms, MIDNIGHT)).toBe(
      'wilting',
    );
  });

  it('blooms just inside the threshold and wilts just outside it', () => {
    const inside = [moment({ day: dayBefore(NOW, 6), personIds: ['p-yanik'] })];
    const outside = [
      moment({ day: dayBefore(NOW, 7), personIds: ['p-yanik'] }),
    ];
    expect(personHealth(person({ rhythm: WEEKLY }), inside, NOW)).toBe(
      'blooming',
    );
    expect(personHealth(person({ rhythm: WEEKLY }), outside, NOW)).toBe(
      'wilting',
    );
  });

  it('honours rhythm.count — twice weekly halves the threshold to 3.5 days', () => {
    // Same person, same moment, same period. Only `count` differs, and it flips
    // the verdict: 5 days of silence is fine weekly, not fine twice weekly.
    const ms = [moment({ day: dayBefore(NOW, 5), personIds: ['p-yanik'] })];
    expect(personHealth(person({ rhythm: WEEKLY }), ms, NOW)).toBe('blooming');
    expect(personHealth(person({ rhythm: TWICE_WEEKLY }), ms, NOW)).toBe(
      'wilting',
    );
  });

  it('blooms inside a twice-weekly threshold', () => {
    const ms = [moment({ day: dayBefore(NOW, 2), personIds: ['p-yanik'] })];
    expect(personHealth(person({ rhythm: TWICE_WEEKLY }), ms, NOW)).toBe(
      'blooming',
    );
  });

  it('stretches the threshold for a longer period — monthly tolerates 20 days', () => {
    const ms = [moment({ day: dayBefore(NOW, 20), personIds: ['p-yanik'] })];
    expect(
      personHealth(
        person({ rhythm: { period: 'monthly', count: 1 } }),
        ms,
        NOW,
      ),
    ).toBe('blooming');
    expect(personHealth(person({ rhythm: WEEKLY }), ms, NOW)).toBe('wilting');
  });
});
