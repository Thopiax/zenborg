import { describe, expect, it } from "vitest";
import {
  createSchedule,
  isScheduleAnchored,
  isScheduleError,
  isValidTimezone,
  type Schedule,
  scheduleLocalStartTime,
  Weekday,
} from "../Schedule";

/**
 * Timezone — floating vs anchored schedules.
 *
 * The fixture pair is the real one: a singing lesson kept by a teacher in São
 * Paulo, read from Paris. Brazil abolished DST in 2019, so America/Sao_Paulo
 * is UTC-3 all year; Europe/Paris swings between +1 and +2. The gap between
 * them is therefore 4 hours in January and 5 in August — which is exactly why
 * an offset is never stored, only ever computed against a day.
 */
function anchored(timezone?: string): Schedule {
  const result = createSchedule({
    weekdays: [Weekday.MON],
    startTime: "09:00",
    durationMin: 60,
    ...(timezone ? { timezone } : {}),
  });
  if (isScheduleError(result)) {
    throw new Error(result.error);
  }
  return result;
}

describe("isValidTimezone", () => {
  it.each(["UTC", "Europe/Paris", "America/Sao_Paulo", "Etc/GMT+5"])(
    "accepts the IANA identifier %s",
    (zone) => {
      expect(isValidTimezone(zone)).toBe(true);
    },
  );

  it("rejects a fixed offset, which the Swift sidecar cannot resolve", () => {
    expect(isValidTimezone("+05:00")).toBe(false);
    expect(isValidTimezone("-03:00")).toBe(false);
  });

  it("rejects a bare city with no region", () => {
    expect(isValidTimezone("Paris")).toBe(false);
  });

  it("rejects an identifier the runtime does not know", () => {
    expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isValidTimezone("")).toBe(false);
  });
});

describe("createSchedule with a timezone", () => {
  it("stores a valid zone", () => {
    expect(anchored("America/Sao_Paulo").timezone).toBe("America/Sao_Paulo");
  });

  it("omits the key entirely when no zone is given", () => {
    expect("timezone" in anchored()).toBe(false);
  });

  it("refuses an offset rather than storing something unresolvable", () => {
    const result = createSchedule({
      weekdays: [Weekday.MON],
      startTime: "09:00",
      durationMin: 60,
      timezone: "+05:00",
    });
    expect(isScheduleError(result)).toBe(true);
    expect(isScheduleError(result) && result.error).toContain(
      "IANA identifier",
    );
  });
});

describe("isScheduleAnchored", () => {
  it("is false without a zone — the hour floats with you", () => {
    expect(isScheduleAnchored(anchored())).toBe(false);
  });

  it("is true with one — the instant is fixed", () => {
    expect(isScheduleAnchored(anchored("America/Sao_Paulo"))).toBe(true);
  });
});

describe("scheduleLocalStartTime", () => {
  it("returns a floating schedule's time untouched", () => {
    expect(
      scheduleLocalStartTime(anchored(), "Europe/Paris", "2026-08-31"),
    ).toBe("09:00");
  });

  it("returns the stored time when viewing from the anchor zone", () => {
    expect(
      scheduleLocalStartTime(
        anchored("America/Sao_Paulo"),
        "America/Sao_Paulo",
        "2026-08-31",
      ),
    ).toBe("09:00");
  });

  it("converts 09:00 Sao Paulo to 14:00 Paris in August (CEST, +2)", () => {
    expect(
      scheduleLocalStartTime(
        anchored("America/Sao_Paulo"),
        "Europe/Paris",
        "2026-08-31",
      ),
    ).toBe("14:00");
  });

  it("converts the same lesson to 13:00 Paris in January (CET, +1)", () => {
    expect(
      scheduleLocalStartTime(
        anchored("America/Sao_Paulo"),
        "Europe/Paris",
        "2026-01-05",
      ),
    ).toBe("13:00");
  });

  it("crosses midnight backwards without corrupting the clock", () => {
    const early = createSchedule({
      weekdays: [Weekday.MON],
      startTime: "01:00",
      durationMin: 60,
      timezone: "Europe/Paris",
    });
    if (isScheduleError(early)) {
      throw new Error(early.error);
    }
    // 01:00 Paris (CEST, +2) is 20:00 the previous day in Sao Paulo (-3).
    expect(
      scheduleLocalStartTime(early, "America/Sao_Paulo", "2026-08-31"),
    ).toBe("20:00");
  });

  it("fails soft to the stored time when the viewer zone is unusable", () => {
    expect(
      scheduleLocalStartTime(
        anchored("America/Sao_Paulo"),
        "Mars/Olympus_Mons",
        "2026-08-31",
      ),
    ).toBe("09:00");
  });

  it("fails soft to the stored time when the day is malformed", () => {
    expect(
      scheduleLocalStartTime(
        anchored("America/Sao_Paulo"),
        "Europe/Paris",
        "31-08-2026",
      ),
    ).toBe("09:00");
  });
});
