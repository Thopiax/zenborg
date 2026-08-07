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
import { Phase } from "@/domain/value-objects/Phase";

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
    phase: Phase.EVENING,
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
    expect(
      personHealth(
        person({ id: "p-yoel", rhythm: { period: "weekly", count: 1 } }),
        ms,
        NOW,
      ),
    ).toBe("blooming");
  });
});
