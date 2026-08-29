import { describe, expect, it } from "vitest";
import { normalizeSchedule, withResolvedTimezone } from "./validation.js";
import { isValidTimezone, type Schedule, type Weekday } from "./vault.js";

/**
 * The write boundary for `schedule.timezone`.
 *
 * Two things are load-bearing here. First, only a resolvable IANA identifier
 * gets stored — the Swift sidecar turns the string into a `TimeZone` and a nil
 * there degrades silently to the device zone, so a bad value would fire the
 * event at the wrong hour with nothing logged. Second, a schedule rewrite must
 * not unanchor a habit as a side effect: callers that only know how to move
 * the hour (the UI, an older tool schema, an agent) omit `timezone`, and
 * omitting it has to mean "leave it alone", not "clear it".
 */
const MONDAY_9AM: {
  weekdays: Weekday[];
  startTime: string;
  durationMin: number;
} = {
  weekdays: ["MON"],
  startTime: "09:00",
  durationMin: 60,
};

function stored(timezone?: string): Schedule {
  return {
    weekdays: ["MON"],
    startTime: "09:00",
    durationMin: 60,
    ...(timezone ? { timezone } : {}),
  };
}

describe("isValidTimezone (mcp mirror of the domain rule)", () => {
  it.each(["UTC", "Europe/Paris", "America/Sao_Paulo"])(
    "accepts %s",
    (zone) => {
      expect(isValidTimezone(zone)).toBe(true);
    },
  );

  it.each(["+05:00", "Paris", "Mars/Olympus_Mons", ""])(
    "rejects %s",
    (zone) => {
      expect(isValidTimezone(zone)).toBe(false);
    },
  );
});

describe("normalizeSchedule with a timezone", () => {
  it("carries a valid zone through", () => {
    const result = normalizeSchedule({
      ...MONDAY_9AM,
      timezone: "America/Sao_Paulo",
    });
    expect(result).toEqual({
      weekdays: ["MON"],
      startTime: "09:00",
      durationMin: 60,
      timezone: "America/Sao_Paulo",
    });
  });

  it("omits the key when no zone is given, leaving the schedule floating", () => {
    const result = normalizeSchedule(MONDAY_9AM);
    expect("timezone" in result).toBe(false);
  });

  it("refuses a fixed offset with a message naming the expected form", () => {
    const result = normalizeSchedule({ ...MONDAY_9AM, timezone: "+05:00" });
    expect(result).toHaveProperty("error");
    expect("error" in result && result.error).toContain("IANA identifier");
  });

  it("refuses a zone the runtime cannot resolve", () => {
    const result = normalizeSchedule({
      ...MONDAY_9AM,
      timezone: "Mars/Olympus_Mons",
    });
    expect(result).toHaveProperty("error");
  });
});

describe("withResolvedTimezone", () => {
  it("inherits the stored anchor when the caller omits timezone", () => {
    const merged = withResolvedTimezone(
      { weekdays: ["MON"], startTime: "10:00", durationMin: 60 },
      stored("America/Sao_Paulo"),
    );
    expect(merged.timezone).toBe("America/Sao_Paulo");
    expect(merged.startTime).toBe("10:00");
  });

  it("drops the anchor only on an explicit null", () => {
    const merged = withResolvedTimezone(
      { ...MONDAY_9AM, timezone: null },
      stored("America/Sao_Paulo"),
    );
    expect("timezone" in merged).toBe(false);
  });

  it("replaces the anchor when the caller names a different zone", () => {
    const merged = withResolvedTimezone(
      { ...MONDAY_9AM, timezone: "Europe/Paris" },
      stored("America/Sao_Paulo"),
    );
    expect(merged.timezone).toBe("Europe/Paris");
  });

  it("stays floating when nothing is stored and nothing is given", () => {
    const merged = withResolvedTimezone({ ...MONDAY_9AM }, stored());
    expect("timezone" in merged).toBe(false);
  });

  it("anchors a previously floating habit", () => {
    const merged = withResolvedTimezone(
      { ...MONDAY_9AM, timezone: "America/Sao_Paulo" },
      stored(),
    );
    expect(merged.timezone).toBe("America/Sao_Paulo");
  });

  it("stays floating when there is no stored schedule at all (create)", () => {
    const merged = withResolvedTimezone({ ...MONDAY_9AM }, undefined);
    expect("timezone" in merged).toBe(false);
  });

  it("carries no keys beyond the schedule shape", () => {
    const merged = withResolvedTimezone(
      { ...MONDAY_9AM, timezone: "UTC" },
      undefined,
    );
    expect(Object.keys(merged).sort()).toEqual([
      "durationMin",
      "startTime",
      "timezone",
      "weekdays",
    ]);
  });
});
