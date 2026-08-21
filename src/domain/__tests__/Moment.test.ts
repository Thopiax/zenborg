import { describe, expect, expectTypeOf, it } from "vitest";
import {
  allocateMoment,
  canAllocateToPhase,
  createMoment,
  isMomentError,
  isParseableRef,
  type Moment,
  normalizeRefs,
  slugify,
  unallocateMoment,
  updateMomentName,
  validateMomentName,
  validatePlaceUrl,
  validateRefs,
} from "../entities/Moment";
import { Phase } from "../value-objects/Phase";

describe("Moment", () => {
  describe("validateMomentName", () => {
    it("should accept 1 word", () => {
      const result = validateMomentName("Running");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("should accept 2 words", () => {
      const result = validateMomentName("Morning Run");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(2);
    });

    it("should accept 3 words", () => {
      const result = validateMomentName("Deep Work Session");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(3);
    });

    it("should reject 4 words", () => {
      const result = validateMomentName("This is too many words");
      expect(result.valid).toBe(false);
      expect(result.wordCount).toBe(5);
      expect(result.error).toBe("Moment name cannot exceed 3 words");
    });

    it("should reject empty string", () => {
      const result = validateMomentName("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Moment name cannot be empty");
    });

    it("should reject whitespace only", () => {
      const result = validateMomentName("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Moment name cannot be empty");
    });

    it("should handle multiple spaces between words", () => {
      const result = validateMomentName("Deep    Work");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(2);
    });

    it("should trim leading and trailing spaces", () => {
      const result = validateMomentName("  Morning Run  ");
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBe(2);
    });
  });

  describe("createMoment", () => {
    it("should create a valid moment", () => {
      const result = createMoment({ name: "Morning Run", areaId: "area-1" });

      expect(isMomentError(result)).toBe(false);
      if (!isMomentError(result)) {
        expect(result.id).toBeDefined();
        expect(result.name).toBe("Morning Run");
        expect(result.areaId).toBe("area-1");
        expect(result.phase).toBeNull();
        expect(result.day).toBeNull();
        expect(result.order).toBe(0);
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
      }
    });

    it("should reject invalid name", () => {
      const result = createMoment({
        name: "Too many words here",
        areaId: "area-1",
      });

      expect(isMomentError(result)).toBe(true);
      if (isMomentError(result)) {
        expect(result.error).toBe("Moment name cannot exceed 3 words");
      }
    });

    it("should reject empty areaId", () => {
      const result = createMoment({ name: "Running", areaId: "" });

      expect(isMomentError(result)).toBe(true);
      if (isMomentError(result)) {
        expect(result.error).toBe("Moment must have an areaId");
      }
    });

    it("should trim name", () => {
      const result = createMoment({ name: "  Running  ", areaId: "area-1" });

      expect(isMomentError(result)).toBe(false);
      if (!isMomentError(result)) {
        expect(result.name).toBe("Running");
      }
    });

    it("should create moment with habitId (linked to habit)", () => {
      const moment = createMoment({
        name: "Morning Run",
        areaId: "area-123",
        habitId: "habit-456",
      });

      if ("error" in moment) throw new Error(moment.error);

      expect(moment.habitId).toBe("habit-456");
      expect(moment.areaId).toBe("area-123");
    });

    it("should create orphaned moment (no habitId)", () => {
      const moment = createMoment({
        name: "One Time Thing",
        areaId: "area-123",
      });

      if ("error" in moment) throw new Error(moment.error);

      expect(moment.habitId).toBeNull();
    });
  });

  describe("allocateMoment", () => {
    it("should allocate moment to a phase", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        const allocated = allocateMoment(moment, {
          day: "2025-01-15",
          phase: Phase.MORNING,
          order: 0,
        });

        expect(allocated.day).toBe("2025-01-15");
        expect(allocated.phase).toBe(Phase.MORNING);
        expect(allocated.order).toBe(0);
        expect(allocated.updatedAt).toBeDefined();
      }
    });

    it("should throw error for negative order", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        expect(() =>
          allocateMoment(moment, {
            day: "2025-01-15",
            phase: Phase.MORNING,
            order: -1,
          }),
        ).toThrow("Order must be non-negative");
      }
    });

    it("should accept an order beyond the day-view capacity", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        const allocated = allocateMoment(moment, {
          day: "2025-01-15",
          phase: Phase.MORNING,
          order: 3,
        });

        expect(allocated.order).toBe(3);
      }
    });
  });

  describe("unallocateMoment", () => {
    it("should unallocate a moment", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        const allocated = allocateMoment(moment, {
          day: "2025-01-15",
          phase: Phase.MORNING,
          order: 1,
        });
        const unallocated = unallocateMoment(allocated);

        expect(unallocated.day).toBeNull();
        expect(unallocated.phase).toBeNull();
        expect(unallocated.order).toBe(0);
        expect(unallocated.updatedAt).toBeDefined();
      }
    });
  });

  describe("updateMomentName", () => {
    it("should update moment name", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        const updated = updateMomentName(moment, { name: "Morning Jog" });

        expect(isMomentError(updated)).toBe(false);
        if (!isMomentError(updated)) {
          expect(updated.name).toBe("Morning Jog");
          expect(updated.updatedAt).toBeDefined();
        }
      }
    });

    it("should reject invalid new name", () => {
      const moment = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment)).toBe(false);

      if (!isMomentError(moment)) {
        const updated = updateMomentName(moment, {
          name: "Too many words here",
        });

        expect(isMomentError(updated)).toBe(true);
        if (isMomentError(updated)) {
          expect(updated.error).toBe("Moment name cannot exceed 3 words");
        }
      }
    });
  });

  describe("canAllocateToPhase", () => {
    const day = "2025-01-15";
    const phase = Phase.MORNING;

    it("should allow allocation when phase has 0 moments", () => {
      const moments: Moment[] = [];
      expect(canAllocateToPhase(moments, day, phase)).toBe(true);
    });

    it("should allow allocation when phase has 1 moment", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);

      if (!isMomentError(moment1)) {
        const allocated = allocateMoment(moment1, { day, phase, order: 0 });
        expect(canAllocateToPhase([allocated], day, phase)).toBe(true);
      }
    });

    it("should allow allocation when phase has 2 moments", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      const moment2 = createMoment({ name: "Meditation", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);
      expect(isMomentError(moment2)).toBe(false);

      if (!isMomentError(moment1) && !isMomentError(moment2)) {
        const allocated1 = allocateMoment(moment1, { day, phase, order: 0 });
        const allocated2 = allocateMoment(moment2, { day, phase, order: 1 });
        expect(canAllocateToPhase([allocated1, allocated2], day, phase)).toBe(
          true,
        );
      }
    });

    it("should reject allocation when phase has 3 moments", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      const moment2 = createMoment({ name: "Meditation", areaId: "area-1" });
      const moment3 = createMoment({ name: "Breakfast", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);
      expect(isMomentError(moment2)).toBe(false);
      expect(isMomentError(moment3)).toBe(false);

      if (
        !isMomentError(moment1) &&
        !isMomentError(moment2) &&
        !isMomentError(moment3)
      ) {
        const allocated1 = allocateMoment(moment1, { day, phase, order: 0 });
        const allocated2 = allocateMoment(moment2, { day, phase, order: 1 });
        const allocated3 = allocateMoment(moment3, { day, phase, order: 2 });
        expect(
          canAllocateToPhase([allocated1, allocated2, allocated3], day, phase),
        ).toBe(false);
      }
    });

    it("should not count moments from different days", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      const moment2 = createMoment({ name: "Meditation", areaId: "area-1" });
      const moment3 = createMoment({ name: "Breakfast", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);
      expect(isMomentError(moment2)).toBe(false);
      expect(isMomentError(moment3)).toBe(false);

      if (
        !isMomentError(moment1) &&
        !isMomentError(moment2) &&
        !isMomentError(moment3)
      ) {
        const allocated1 = allocateMoment(moment1, { day, phase, order: 0 });
        const allocated2 = allocateMoment(moment2, { day, phase, order: 1 });
        const allocated3 = allocateMoment(moment3, {
          day: "2025-01-16",
          phase,
          order: 0,
        });
        expect(
          canAllocateToPhase([allocated1, allocated2, allocated3], day, phase),
        ).toBe(true);
      }
    });

    it("should not count moments from different phases", () => {
      const moment1 = createMoment({ name: "Running", areaId: "area-1" });
      const moment2 = createMoment({ name: "Meditation", areaId: "area-1" });
      const moment3 = createMoment({ name: "Breakfast", areaId: "area-1" });
      expect(isMomentError(moment1)).toBe(false);
      expect(isMomentError(moment2)).toBe(false);
      expect(isMomentError(moment3)).toBe(false);

      if (
        !isMomentError(moment1) &&
        !isMomentError(moment2) &&
        !isMomentError(moment3)
      ) {
        const allocated1 = allocateMoment(moment1, { day, phase, order: 0 });
        const allocated2 = allocateMoment(moment2, { day, phase, order: 1 });
        const allocated3 = allocateMoment(moment3, {
          day,
          phase: Phase.AFTERNOON,
          order: 0,
        });
        expect(
          canAllocateToPhase([allocated1, allocated2, allocated3], day, phase),
        ).toBe(true);
      }
    });
  });

  describe("refs", () => {
    it("accepts any parseable URL, including app schemes", () => {
      expect(isParseableRef("https://linear.app/acme/issue/ABC-1")).toBe(true);
      expect(isParseableRef("things:///show?id=abc")).toBe(true);
      expect(isParseableRef("obsidian://open?vault=v&file=f")).toBe(true);
    });

    it("rejects a string the URL parser cannot read", () => {
      expect(isParseableRef("example.com")).toBe(false);
      expect(isParseableRef("not a url")).toBe(false);
      expect(validateRefs(["not a url"])).toBe(
        "Moment ref is not a parseable URL: not a url",
      );
      expect(validateRefs(undefined)).toBeNull();
    });

    it("normalizes: trims, drops empties, de-duplicates, keeps order", () => {
      expect(
        normalizeRefs([
          " https://b.example/2 ",
          "https://a.example/1",
          "",
          "https://b.example/2",
        ]),
      ).toEqual(["https://b.example/2", "https://a.example/1"]);
    });

    it("stores refs on a created moment", () => {
      const result = createMoment({
        name: "Ship refs",
        areaId: "area-1",
        refs: ["https://linear.app/acme/issue/ABC-1", "things:///show?id=abc"],
      });
      expect(isMomentError(result)).toBe(false);
      if (!isMomentError(result)) {
        expect(result.refs).toEqual([
          "https://linear.app/acme/issue/ABC-1",
          "things:///show?id=abc",
        ]);
      }
    });

    it("leaves the field absent when no refs are given", () => {
      const result = createMoment({ name: "Meditation", areaId: "area-1" });
      expect(isMomentError(result)).toBe(false);
      if (!isMomentError(result)) {
        expect(result.refs).toBeUndefined();
        expect("refs" in result).toBe(false);
      }
    });

    it("refuses to create a moment with an unparseable ref", () => {
      const result = createMoment({
        name: "Broken ref",
        areaId: "area-1",
        refs: ["nope"],
      });
      expect(isMomentError(result)).toBe(true);
      if (isMomentError(result)) {
        expect(result.error).toBe("Moment ref is not a parseable URL: nope");
      }
    });
  });
});

describe("Moment.personIds", () => {
  const base: Moment = {
    id: "m1",
    name: "dinner bcn",
    areaId: "a1",
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: Phase.EVENING,
    day: "2026-08-07",
    order: 0,
    tags: null,
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-07T00:00:00.000Z",
  };

  it("composes several people under one moment", () => {
    const m: Moment = { ...base, personIds: ["p-uma", "p-cleo", "p-manu"] };
    expect(m.personIds).toHaveLength(3);
  });

  it("is absent on a moment that involves nobody", () => {
    expect(base.personIds).toBeUndefined();
  });

  it("types personIds as an optional string array", () => {
    expectTypeOf<Moment["personIds"]>().toEqualTypeOf<string[] | undefined>();
  });

  it("rejects a non-array personIds at the type level", () => {
    // @ts-expect-error personIds is string[] — a bare string must not assign
    const bad: Moment = { ...base, personIds: "p-uma" };
    expect(bad.personIds).toBe("p-uma");
  });
});

describe("slugify", () => {
  it("strips diacritics and lowercases", () => {
    expect(slugify("São Paulo")).toBe("sao-paulo");
  });

  it("turns every non-alphanumeric run into a single dash", () => {
    expect(slugify("Café Lab, Vila Madalena")).toBe("cafe-lab-vila-madalena");
  });

  it("collapses dash runs", () => {
    expect(slugify("a  --  b")).toBe("a-b");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("  -Atlantis-  ")).toBe("atlantis");
  });

  it("agrees with wake on a key it will have to mint", () => {
    expect(slugify("Ávalon Café")).toBe("avalon-cafe");
  });

  it("is idempotent — slugging a slug changes nothing", () => {
    expect(slugify(slugify("Café Lab, Vila Madalena"))).toBe(
      "cafe-lab-vila-madalena",
    );
  });
});

describe("validatePlaceUrl", () => {
  it("accepts a map link", () => {
    expect(validatePlaceUrl("https://maps.app.goo.gl/abc123")).toBeNull();
  });

  it("accepts any parseable scheme, as refs do", () => {
    expect(validatePlaceUrl("things:///show?id=xyz")).toBeNull();
  });

  it("rejects a string the URL parser cannot read", () => {
    expect(validatePlaceUrl("avalon coffee")).toBe(
      "Moment placeUrl is not a parseable URL: avalon coffee",
    );
  });

  it("is fine with the field being absent", () => {
    expect(validatePlaceUrl(undefined)).toBeNull();
  });
});

describe("Moment.placeIds and Moment.placeUrl", () => {
  const base: Moment = {
    id: "m1",
    name: "coffee",
    areaId: "a1",
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase: Phase.MORNING,
    day: "2026-08-18",
    order: 0,
    tags: null,
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
  };

  it("names whatever grain the moment knows", () => {
    const m: Moment = { ...base, placeIds: ["avalon-cafe", "avalon"] };
    expect(m.placeIds).toEqual(["avalon-cafe", "avalon"]);
  });

  it("is absent on a moment that knows no place", () => {
    expect(base.placeIds).toBeUndefined();
    expect(base.placeUrl).toBeUndefined();
  });

  it("types placeIds as an optional string array", () => {
    expectTypeOf<Moment["placeIds"]>().toEqualTypeOf<string[] | undefined>();
  });

  it("rejects a non-array placeIds at the type level", () => {
    // @ts-expect-error placeIds is string[] — a bare string must not assign
    const bad: Moment = { ...base, placeIds: "avalon" };
    expect(bad.placeIds).toBe("avalon");
  });

  it("carries the pasted string as minting evidence", () => {
    const m: Moment = { ...base, placeUrl: "https://maps.app.goo.gl/abc123" };
    expect(m.placeUrl).toBe("https://maps.app.goo.gl/abc123");
  });

  it("types placeUrl as an optional string", () => {
    expectTypeOf<Moment["placeUrl"]>().toEqualTypeOf<string | undefined>();
  });
});
