import { describe, expect, it } from "vitest";
import {
  conciseArea,
  conciseCycle,
  conciseHabit,
  conciseMoment,
  concisePerson,
  concisePlace,
  conciseRelationship,
  conciseWriteEcho,
  stripNulls,
} from "./serialize.js";

describe("stripNulls", () => {
  it("removes null and undefined keys", () => {
    expect(stripNulls({ a: 1, b: null, c: undefined, d: "ok" })).toEqual({
      a: 1,
      d: "ok",
    });
  });

  it("removes empty arrays", () => {
    expect(stripNulls({ a: [], b: [1] })).toEqual({ b: [1] });
  });

  it("preserves false, 0, and empty string", () => {
    expect(stripNulls({ a: false, b: 0, c: "" })).toEqual({
      a: false,
      b: 0,
      c: "",
    });
  });
});

const TS = "2026-08-28T12:00:00.000Z";

describe("conciseMoment", () => {
  const full = {
    id: "m1",
    name: "themia data",
    areaId: "a1",
    habitId: "h1",
    cycleId: "c1",
    cyclePlanId: "cp1",
    phase: "MORNING" as const,
    day: "2026-08-28",
    order: 2,
    startTime: "09:00",
    durationMin: 90,
    emoji: null,
    tags: ["data"],
    personIds: ["ada"],
    placeIds: ["home"],
    status: "accepted" as const,
    createdAt: TS,
    updatedAt: TS,
  };

  it("includes identity and placement, drops timestamps/order/emoji-null/cyclePlanId", () => {
    const c = conciseMoment(full);
    expect(c).toEqual({
      id: "m1",
      name: "themia data",
      areaId: "a1",
      habitId: "h1",
      cycleId: "c1",
      day: "2026-08-28",
      phase: "MORNING",
      startTime: "09:00",
      durationMin: 90,
      tags: ["data"],
      personIds: ["ada"],
      placeIds: ["home"],
      status: "accepted",
    });
    expect(c).not.toHaveProperty("createdAt");
    expect(c).not.toHaveProperty("updatedAt");
    expect(c).not.toHaveProperty("order");
    expect(c).not.toHaveProperty("cyclePlanId");
    expect(c).not.toHaveProperty("emoji");
  });

  it("preserves day/phase as null for drawing-board moments", () => {
    const drawing = { ...full, day: null, phase: null, habitId: null };
    const c = conciseMoment(drawing);
    expect(c.day).toBeNull();
    expect(c.phase).toBeNull();
    expect(c).not.toHaveProperty("habitId");
  });

  it("omits empty tags and personIds", () => {
    const sparse = {
      ...full,
      tags: [] as string[],
      personIds: undefined,
      placeIds: undefined,
    };
    const c = conciseMoment(sparse);
    expect(c).not.toHaveProperty("tags");
    expect(c).not.toHaveProperty("personIds");
    expect(c).not.toHaveProperty("placeIds");
  });
});

describe("conciseHabit", () => {
  const full = {
    id: "h1",
    name: "meditate",
    areaId: "a1",
    attitude: "KEEPING" as const,
    phase: "MORNING" as const,
    tags: ["mindfulness"],
    aliases: ["sit"],
    emoji: "🧘",
    isArchived: false,
    order: 3,
    description: "A long description",
    guidance: "Some guidance text",
    rhythm: { period: "weekly" as const, count: 5 },
    schedule: {
      weekdays: ["MON" as const],
      startTime: "07:00",
      durationMin: 30,
    },
    placeIds: ["home"],
    createdAt: TS,
    updatedAt: TS,
  };

  it("includes decision fields, drops timestamps/order/description/guidance", () => {
    const c = conciseHabit(full);
    expect(c.id).toBe("h1");
    expect(c.name).toBe("meditate");
    expect(c.attitude).toBe("KEEPING");
    expect(c.rhythm).toEqual({ period: "weekly", count: 5 });
    expect(c).not.toHaveProperty("createdAt");
    expect(c).not.toHaveProperty("updatedAt");
    expect(c).not.toHaveProperty("order");
    expect(c).not.toHaveProperty("description");
    expect(c).not.toHaveProperty("guidance");
  });

  it("omits isArchived when false", () => {
    expect(conciseHabit(full)).not.toHaveProperty("isArchived");
  });

  it("includes isArchived when true", () => {
    expect(conciseHabit({ ...full, isArchived: true })).toHaveProperty(
      "isArchived",
      true,
    );
  });
});

describe("conciseArea", () => {
  it("includes identity + color, drops timestamps/order/isDefault", () => {
    const c = conciseArea({
      id: "a1",
      name: "work",
      emoji: "💼",
      color: "#aabbcc",
      isDefault: true,
      order: 0,
      attitude: null,
      tags: [],
      createdAt: TS,
      updatedAt: TS,
    });
    expect(c).toEqual({
      id: "a1",
      name: "work",
      emoji: "💼",
      color: "#aabbcc",
    });
    expect(c).not.toHaveProperty("isDefault");
    expect(c).not.toHaveProperty("order");
    expect(c).not.toHaveProperty("createdAt");
  });
});

describe("conciseCycle", () => {
  it("keeps startDate/endDate, drops timestamps", () => {
    const c = conciseCycle({
      id: "c1",
      name: "Sprint 1",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      intention: "ship redesign",
      placeIds: ["sp"],
      createdAt: TS,
      updatedAt: TS,
    });
    expect(c).toEqual({
      id: "c1",
      name: "Sprint 1",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      intention: "ship redesign",
      placeIds: ["sp"],
    });
    expect(c).not.toHaveProperty("createdAt");
  });

  it("omits intention and placeIds when absent", () => {
    const c = conciseCycle({
      id: "c1",
      name: "Open",
      startDate: "2026-08-01",
      endDate: null,
      createdAt: TS,
      updatedAt: TS,
    });
    expect(c).not.toHaveProperty("intention");
    expect(c).not.toHaveProperty("placeIds");
    expect(c.endDate).toBeNull();
  });
});

describe("concisePerson", () => {
  it("drops timestamps and null keys", () => {
    const c = concisePerson({
      id: "p1",
      name: "Ada",
      key: "ada",
      aliases: ["mom"],
      cadence: null,
      tags: [],
      basePlace: null,
      emoji: "👩",
      isArchived: false,
      createdAt: TS,
      updatedAt: TS,
    });
    expect(c).toEqual({
      id: "p1",
      name: "Ada",
      key: "ada",
      aliases: ["mom"],
      emoji: "👩",
    });
  });
});

describe("concisePlace", () => {
  it("drops timestamps and null keys", () => {
    const c = concisePlace({
      id: "pl1",
      name: "Home",
      key: "home",
      parentKey: null,
      tags: [],
      address: null,
      coordinates: null,
      emoji: "🏠",
      url: null,
      isArchived: false,
      createdAt: TS,
      updatedAt: TS,
    });
    expect(c).toEqual({
      id: "pl1",
      name: "Home",
      key: "home",
      emoji: "🏠",
    });
  });
});

describe("conciseRelationship", () => {
  it("drops timestamps", () => {
    const c = conciseRelationship({
      id: "r1",
      fromType: "person",
      fromId: "p1",
      toType: "place",
      toId: "pl1",
      label: "lives-in",
      direction: "directed",
      createdAt: TS,
      updatedAt: TS,
    });
    expect(c).not.toHaveProperty("createdAt");
    expect(c).not.toHaveProperty("updatedAt");
    expect(c.label).toBe("lives-in");
  });
});

describe("conciseWriteEcho", () => {
  it("returns id + name by default", () => {
    expect(conciseWriteEcho({ id: "x", name: "foo", color: "#fff" })).toEqual({
      id: "x",
      name: "foo",
    });
  });

  it("picks listed changed fields", () => {
    expect(
      conciseWriteEcho({ id: "x", name: "foo", color: "#fff", order: 3 }, [
        "color",
      ]),
    ).toEqual({ id: "x", name: "foo", color: "#fff" });
  });

  it("strips null values from changed fields", () => {
    expect(
      conciseWriteEcho({ id: "x", name: "foo", attitude: null }, ["attitude"]),
    ).toEqual({ id: "x", name: "foo" });
  });
});
