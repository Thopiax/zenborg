import { describe, expect, it } from "vitest";
import {
  type HabitRecord,
  type MomentRecord,
  migrate,
  placeKeysOf,
  slugify,
} from "../moments-to-entity-keys.mts";

/**
 * Synthetic throughout. The real input is the principal's own history, and no
 * name or place from it may reach a fixture.
 */
const NOW = "2026-08-18T12:00:00.000Z";

const habits = (...list: HabitRecord[]): Record<string, HabitRecord> =>
  Object.fromEntries(list.map((h) => [h.id, h]));

const moments = (...list: MomentRecord[]): Record<string, MomentRecord> =>
  Object.fromEntries(list.map((m) => [m.id, m]));

const person = (over: Partial<HabitRecord> = {}): HabitRecord => ({
  id: "h-ada",
  name: "Ada",
  areaId: "a-friends",
  kind: "person",
  ...over,
});

const ritual = (over: Partial<HabitRecord> = {}): HabitRecord => ({
  id: "h-coffee",
  name: "coffee",
  areaId: "a-friends",
  ...over,
});

const moment = (over: Partial<MomentRecord> = {}): MomentRecord => ({
  id: "m1",
  name: "breakfast",
  areaId: "a-friends",
  habitId: null,
  ...over,
});

describe("placeKeysOf", () => {
  it("reads the prefixed form, in order, without duplicates", () => {
    expect(
      placeKeysOf(["gap", "place-atlantis", "place-avalon", "place-atlantis"]),
    ).toEqual(["atlantis", "avalon"]);
  });

  it("ignores everything that is not a place tag", () => {
    expect(placeKeysOf(["gap", "close", "parent"])).toEqual([]);
  });
});

describe("slugify", () => {
  it("is the same rule the other three copies implement", () => {
    expect(slugify("São Paulo")).toBe("sao-paulo");
    expect(slugify("Café Lab, Vila Madalena")).toBe("cafe-lab-vila-madalena");
  });
});

describe("migrate — people", () => {
  it("repoints a moment from a person-habit to a personIds key", () => {
    // The false claim goes (this was not an instance of a perennial); the true
    // one stays (he saw her).
    const { moments: out, plan } = migrate(
      habits(person()),
      moments(moment({ habitId: "h-ada" })),
      NOW,
    );
    expect(out.m1?.habitId).toBeNull();
    expect(out.m1?.personIds).toEqual(["ada"]);
    expect(plan.personRewrites).toBe(1);
  });

  it("leaves a moment pointing at a real ritual alone", () => {
    const { moments: out, plan } = migrate(
      habits(ritual()),
      moments(moment({ habitId: "h-coffee" })),
      NOW,
    );
    expect(out.m1?.habitId).toBe("h-coffee");
    expect(out.m1?.personIds).toBeUndefined();
    expect(plan.personRewrites).toBe(0);
  });

  it("does not duplicate a key the moment already carries", () => {
    const { moments: out } = migrate(
      habits(person()),
      moments(moment({ habitId: "h-ada", personIds: ["ada"] })),
      NOW,
    );
    expect(out.m1?.personIds).toEqual(["ada"]);
  });

  it("keeps the other guests when it adds the one from the habit", () => {
    const { moments: out } = migrate(
      habits(person()),
      moments(moment({ habitId: "h-ada", personIds: ["bea"] })),
      NOW,
    );
    expect(out.m1?.personIds).toEqual(["bea", "ada"]);
  });

  it("archives the person-habits rather than deleting them", () => {
    // Archive so nothing dangles if a moment was missed.
    const { habits: out, plan } = migrate(habits(person()), moments(), NOW);
    expect(out["h-ada"]?.isArchived).toBe(true);
    expect(out["h-ada"]).toBeDefined();
    expect(plan.habitsArchived).toBe(1);
  });

  it("does not archive a ritual", () => {
    const { habits: out, plan } = migrate(habits(ritual()), moments(), NOW);
    expect(out["h-coffee"]?.isArchived).toBeUndefined();
    expect(plan.habitsArchived).toBe(0);
  });

  it("refuses to merge two people into one key", () => {
    const { plan } = migrate(
      habits(
        person({ id: "h1", name: "Bea Q" }),
        person({ id: "h2", name: "Bea-Q" }),
      ),
      moments(),
      NOW,
    );
    expect(plan.problems).toHaveLength(1);
    expect(plan.problems[0]).toContain("bea-q");
  });
});

describe("migrate — places on moments", () => {
  it("converts a place tag the moment recorded for itself", () => {
    const { moments: out, plan } = migrate(
      habits(ritual()),
      moments(moment({ habitId: "h-coffee", tags: ["place-atlantis"] })),
      NOW,
    );
    expect(out.m1?.placeIds).toEqual(["atlantis"]);
    expect(out.m1?.tags).toBeNull();
    expect(plan.placeConversions).toBe(1);
  });

  it("keeps the tags that were never places", () => {
    const { moments: out } = migrate(
      habits(ritual()),
      moments(
        moment({ habitId: "h-coffee", tags: ["morning", "place-atlantis"] }),
      ),
      NOW,
    );
    expect(out.m1?.tags).toEqual(["morning"]);
    expect(out.m1?.placeIds).toEqual(["atlantis"]);
  });

  it("drops the short forms, each of which duplicates a place tag", () => {
    const { moments: out, plan } = migrate(
      habits(ritual()),
      moments(
        moment({ habitId: "h-coffee", tags: ["place-london", "london"] }),
      ),
      NOW,
    );
    expect(out.m1?.placeIds).toEqual(["london"]);
    expect(out.m1?.tags).toBeNull();
    expect(plan.shortFormsDropped).toBe(1);
  });

  it("converts several places on one moment", () => {
    const { moments: out } = migrate(
      habits(ritual()),
      moments(
        moment({
          habitId: "h-coffee",
          tags: ["place-avalon", "place-arcadia"],
        }),
      ),
      NOW,
    );
    expect(out.m1?.placeIds).toEqual(["avalon", "arcadia"]);
  });

  it("leaves a moment with no place tags untouched", () => {
    const { moments: out, plan } = migrate(
      habits(ritual()),
      moments(moment({ habitId: "h-coffee", tags: ["morning"] })),
      NOW,
    );
    expect(out.m1?.placeIds).toBeUndefined();
    expect(out.m1?.tags).toEqual(["morning"]);
    expect(plan.placeConversions).toBe(0);
  });
});

describe("migrate — the inherited lie", () => {
  it("refuses a place tag inherited from the person the moment was with", () => {
    // The breakfast inherited the city its guest lives in. Nobody recorded
    // where the breakfast happened. `placeIds` is for places observed, and
    // once a guess is in there it is indistinguishable from an observation.
    const { moments: out, plan } = migrate(
      habits(person({ tags: ["place-avalon"] })),
      moments(moment({ habitId: "h-ada", tags: ["place-avalon"] })),
      NOW,
    );
    expect(out.m1?.placeIds).toBeUndefined();
    expect(out.m1?.tags).toBeNull();
    expect(plan.inheritedPlacesDropped).toBe(1);
    expect(plan.placeConversions).toBe(0);
  });

  it("still converts a place the moment recorded that the person does not live in", () => {
    // He saw her somewhere that is not her city, and that IS an observation.
    const { moments: out, plan } = migrate(
      habits(person({ tags: ["place-avalon"] })),
      moments(moment({ habitId: "h-ada", tags: ["place-atlantis"] })),
      NOW,
    );
    expect(out.m1?.placeIds).toEqual(["atlantis"]);
    expect(plan.inheritedPlacesDropped).toBe(0);
  });

  it("splits a moment carrying both, keeping only the observed one", () => {
    const { moments: out, plan } = migrate(
      habits(person({ tags: ["place-avalon"] })),
      moments(
        moment({
          habitId: "h-ada",
          tags: ["place-avalon", "place-atlantis"],
        }),
      ),
      NOW,
    );
    expect(out.m1?.placeIds).toEqual(["atlantis"]);
    expect(plan.inheritedPlacesDropped).toBe(1);
  });

  it("converts the same city for a moment that never pointed at the person", () => {
    // Only a moment that pointed AT the person could have inherited. One that
    // merely names the same city recorded it for itself.
    const { moments: out, plan } = migrate(
      habits(person({ tags: ["place-avalon"] }), ritual()),
      moments(moment({ habitId: "h-coffee", tags: ["place-avalon"] })),
      NOW,
    );
    expect(out.m1?.placeIds).toEqual(["avalon"]);
    expect(plan.inheritedPlacesDropped).toBe(0);
  });

  it("leaves no place tag behind, converted or refused", () => {
    // A refused tag left readable keeps the lie alive for anything still
    // parsing tags. The namespace is retired either way.
    const { moments: out } = migrate(
      habits(person({ tags: ["place-avalon"] })),
      moments(moment({ habitId: "h-ada", tags: ["place-avalon", "dinner"] })),
      NOW,
    );
    expect(out.m1?.tags).toEqual(["dinner"]);
  });
});

describe("migrate — places on habits", () => {
  it("moves a practice's place tags into the field the roster reads", () => {
    const { habits: out, plan } = migrate(
      habits(ritual({ tags: ["gap", "gap-30s", "place-atlantis"] })),
      moments(),
      NOW,
    );
    expect(out["h-coffee"]?.placeIds).toEqual(["atlantis"]);
    expect(out["h-coffee"]?.tags).toEqual(["gap", "gap-30s"]);
    expect(plan.habitPlacesMigrated).toBe(1);
  });

  it("does not move a person-habit's place — that is the registry's base place", () => {
    const { habits: out, plan } = migrate(
      habits(person({ tags: ["place-avalon"] })),
      moments(),
      NOW,
    );
    expect(out["h-ada"]?.placeIds).toBeUndefined();
    expect(plan.habitPlacesMigrated).toBe(0);
  });

  it("merges into an existing field without duplicating", () => {
    const { habits: out } = migrate(
      habits(ritual({ tags: ["place-atlantis"], placeIds: ["atlantis"] })),
      moments(),
      NOW,
    );
    expect(out["h-coffee"]?.placeIds).toEqual(["atlantis"]);
  });

  it("leaves an unplaced practice alone", () => {
    const { habits: out, plan } = migrate(
      habits(ritual({ tags: ["gap"] })),
      moments(),
      NOW,
    );
    expect(out["h-coffee"]?.placeIds).toBeUndefined();
    expect(out["h-coffee"]?.tags).toEqual(["gap"]);
    expect(plan.habitPlacesMigrated).toBe(0);
  });
});

describe("migrate — the contract of the pass", () => {
  it("does not mutate its input", () => {
    const habitsIn = habits(person());
    const momentsIn = moments(moment({ habitId: "h-ada" }));
    migrate(habitsIn, momentsIn, NOW);
    expect(momentsIn.m1?.habitId).toBe("h-ada");
    expect(habitsIn["h-ada"]?.isArchived).toBeUndefined();
  });

  it("stamps updatedAt only on what it touched", () => {
    const { moments: out } = migrate(
      habits(ritual()),
      moments(
        moment({ id: "m1", habitId: "h-coffee", tags: ["place-atlantis"] }),
        moment({ id: "m2", habitId: "h-coffee", tags: ["morning"] }),
      ),
      NOW,
    );
    expect(out.m1?.updatedAt).toBe(NOW);
    expect(out.m2?.updatedAt).toBeUndefined();
  });

  it("is a no-op on an empty vault", () => {
    const { plan } = migrate({}, {}, NOW);
    expect(plan).toMatchObject({
      personRewrites: 0,
      placeConversions: 0,
      habitsArchived: 0,
      problems: [],
    });
  });

  it("is idempotent — a second run changes nothing more", () => {
    const first = migrate(
      habits(
        person({ tags: ["place-avalon"] }),
        ritual({ tags: ["place-atlantis"] }),
      ),
      moments(moment({ habitId: "h-ada", tags: ["place-arcadia"] })),
      NOW,
    );
    const second = migrate(first.habits, first.moments, NOW);
    expect(second.plan).toMatchObject({
      personRewrites: 0,
      placeConversions: 0,
      shortFormsDropped: 0,
      habitsArchived: 0,
      habitPlacesMigrated: 0,
    });
    expect(second.moments).toEqual(first.moments);
  });
});
