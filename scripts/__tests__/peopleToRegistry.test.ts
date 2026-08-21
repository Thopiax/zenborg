import { describe, expect, it } from "vitest";
import {
  basePlaceOf,
  buildRegistryExport,
  type CsvRow,
  cadenceFromRhythm,
  type HabitRecord,
  parseCadence,
  parseCsv,
  parseFavorite,
  parseStatus,
  slugify,
} from "../people-to-registry.mts";

/**
 * Every fixture here is synthetic. The real input to this script is the
 * principal's contact list, and no name from it may reach a test file, a
 * commit message, or stdout.
 */
const habit = (over: Partial<HabitRecord> = {}): HabitRecord => ({
  id: "h-ada",
  name: "Ada",
  areaId: "a-friends",
  kind: "person",
  ...over,
});

const row = (over: Partial<CsvRow> = {}): CsvRow => ({
  Name: "Ada",
  Category: "friend",
  Frequency: "Weekly",
  Status: "Active",
  Favorite: "false",
  ...over,
});

describe("slugify", () => {
  it("matches the contract rule the other two copies implement", () => {
    expect(slugify("São Paulo")).toBe("sao-paulo");
    expect(slugify("Café Lab, Vila Madalena")).toBe("cafe-lab-vila-madalena");
    expect(slugify("  -Atlantis-  ")).toBe("atlantis");
    expect(slugify("Ávalon Café")).toBe("avalon-cafe");
  });
});

describe("parseCadence", () => {
  it("reads the four buckets however the column spells them", () => {
    expect(parseCadence("Weekly")).toBe("weekly");
    expect(parseCadence("month")).toBe("monthly");
    expect(parseCadence("Quarterly")).toBe("quarterly");
    expect(parseCadence("Annual")).toBe("yearly");
  });

  it("is null rather than a guess when it does not recognise the value", () => {
    // A wrong cadence nags on a rhythm nobody chose; an absent one stays quiet.
    expect(parseCadence("now and then")).toBeNull();
    expect(parseCadence(undefined)).toBeNull();
    expect(parseCadence("")).toBeNull();
  });
});

describe("cadenceFromRhythm", () => {
  it("reads a habit rhythm as a bucket, for conflict detection", () => {
    expect(cadenceFromRhythm({ period: "weekly", count: 2 })).toBe("weekly");
    expect(cadenceFromRhythm({ period: "yearly", count: 1 })).toBe("yearly");
  });

  it("ignores the count — the bucket has no second dimension", () => {
    expect(cadenceFromRhythm({ period: "weekly", count: 1 })).toBe(
      cadenceFromRhythm({ period: "weekly", count: 3 }),
    );
  });

  it("is null with no rhythm", () => {
    expect(cadenceFromRhythm(undefined)).toBeNull();
  });
});

describe("parseStatus and parseFavorite", () => {
  it("reads paused, which is a real state and not a lapse", () => {
    expect(parseStatus("Paused")).toBe("paused");
    expect(parseStatus("Active")).toBe("active");
    expect(parseStatus(undefined)).toBe("active");
  });

  it("reads the several ways a spreadsheet spells true", () => {
    expect(parseFavorite("true")).toBe(true);
    expect(parseFavorite("Yes")).toBe(true);
    expect(parseFavorite("1")).toBe(true);
    expect(parseFavorite("false")).toBe(false);
    expect(parseFavorite(undefined)).toBe(false);
  });
});

describe("basePlaceOf", () => {
  it("reads the explicit prefixed form", () => {
    expect(basePlaceOf(["close", "place-atlantis"])).toBe("atlantis");
  });

  it("ignores a short form, which is ambiguous against an ordinary tag", () => {
    expect(basePlaceOf(["atl", "close"])).toBeUndefined();
  });

  it("is undefined when the habit says nothing about where they are", () => {
    expect(basePlaceOf([])).toBeUndefined();
  });
});

describe("buildRegistryExport", () => {
  it("joins a habit to its csv row on the slugged name", () => {
    const { people } = buildRegistryExport([habit()], [row()]);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      key: "ada",
      display: "Ada",
      category: "friend",
      cadence: "weekly",
      status: "active",
      favorite: false,
    });
  });

  it("lets the csv win the cadence, and reports that it did", () => {
    // Only twelve habits carry a rhythm and several were set once and forgotten;
    // the CRM column is the one that was curated on purpose.
    const report = buildRegistryExport(
      [habit({ rhythm: { period: "yearly", count: 1 } })],
      [row({ Frequency: "Weekly" })],
    );
    expect(report.people[0]?.cadence).toBe("weekly");
    expect(report.cadenceConflicts).toEqual(["ada"]);
  });

  it("does not report a conflict when they agree", () => {
    const report = buildRegistryExport(
      [habit({ rhythm: { period: "weekly", count: 1 } })],
      [row({ Frequency: "Weekly" })],
    );
    expect(report.cadenceConflicts).toEqual([]);
  });

  it("falls back to the habit rhythm when the csv says nothing", () => {
    const report = buildRegistryExport(
      [habit({ rhythm: { period: "monthly", count: 1 } })],
      [row({ Frequency: "" })],
    );
    expect(report.people[0]?.cadence).toBe("monthly");
    expect(report.cadenceConflicts).toEqual([]);
  });

  it("reports a name in one source and not the other, never guessing a match", () => {
    const report = buildRegistryExport(
      [habit({ id: "h-bea", name: "Bea" })],
      [row({ Name: "Cai" })],
    );
    expect(report.habitOnly).toEqual(["bea"]);
    expect(report.csvOnly).toEqual(["cai"]);
    expect(report.people[0]?.category).toBeNull();
  });

  it("refuses to let one key swallow two people", () => {
    // "Bea Q" and "Bea-Q" slug the same. Overwriting silently loses a person,
    // so the collision is raised and the second is not exported.
    const report = buildRegistryExport(
      [habit({ id: "h1", name: "Bea Q" }), habit({ id: "h2", name: "Bea-Q" })],
      [],
    );
    expect(report.keyCollisions).toEqual(["bea-q"]);
    expect(report.people).toHaveLength(1);
  });

  it("lifts the D8 attributes out of the tag drawer", () => {
    const report = buildRegistryExport(
      [habit({ tags: ["parent", "close", "imperial", "place-atlantis"] })],
      [row()],
    );
    expect(report.people[0]).toMatchObject({
      relation: "parent",
      closeness: "close",
      metAt: "imperial",
      basePlace: "atlantis",
    });
  });

  it("carries aliases and emoji, and omits them when empty", () => {
    const withBoth = buildRegistryExport(
      [habit({ aliases: ["Adie"], emoji: "🌿" })],
      [row()],
    ).people[0];
    expect(withBoth).toMatchObject({ aliases: ["Adie"], emoji: "🌿" });

    const without = buildRegistryExport(
      [habit({ aliases: [], emoji: null })],
      [row()],
    ).people[0];
    expect(without).not.toHaveProperty("aliases");
    expect(without).not.toHaveProperty("emoji");
  });

  it("carries notes only when the row has any", () => {
    const filled = buildRegistryExport(
      [habit()],
      [row({ feedbacks: "likes long walks" })],
    ).people[0];
    expect(filled?.notes).toBe("likes long walks");
    expect(
      buildRegistryExport([habit()], [row({ feedbacks: "   " })]).people[0],
    ).not.toHaveProperty("notes");
  });

  it("exports only people, never a ritual", () => {
    const report = buildRegistryExport(
      [habit(), habit({ id: "h-run", name: "run", kind: undefined })],
      [],
    );
    expect(report.people.map((p) => p.key)).toEqual(["ada"]);
  });

  it("skips an archived person", () => {
    expect(
      buildRegistryExport([habit({ isArchived: true })], [row()]).people,
    ).toEqual([]);
  });

  it("is empty on empty input rather than throwing", () => {
    expect(buildRegistryExport([], [])).toMatchObject({
      people: [],
      habitOnly: [],
      csvOnly: [],
    });
  });

  it("orders by key, so two runs produce the same file", () => {
    const report = buildRegistryExport(
      [
        habit({ id: "h3", name: "Cai" }),
        habit({ id: "h1", name: "Ada" }),
        habit({ id: "h2", name: "Bea" }),
      ],
      [],
    );
    expect(report.people.map((p) => p.key)).toEqual(["ada", "bea", "cai"]);
  });
});

describe("parseCsv", () => {
  it("survives a comma inside a quoted free-text field", () => {
    // `feedbacks` is prose. A naive split corrupts every row that has a comma.
    const rows = parseCsv(
      'Name,Category,feedbacks\nAda,friend,"walks, coffee, books"\n',
    );
    expect(rows[0]?.feedbacks).toBe("walks, coffee, books");
  });

  it("survives a newline inside a quoted field", () => {
    const rows = parseCsv('Name,feedbacks\nAda,"line one\nline two"\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.feedbacks).toBe("line one\nline two");
  });

  it("reads an escaped quote", () => {
    const rows = parseCsv('Name,feedbacks\nAda,"said ""hello"""\n');
    expect(rows[0]?.feedbacks).toBe('said "hello"');
  });

  it("drops blank lines rather than emitting empty people", () => {
    const rows = parseCsv("Name,Category\nAda,friend\n\nBea,family\n");
    expect(rows.map((r) => r.Name)).toEqual(["Ada", "Bea"]);
  });

  it("is empty on an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
