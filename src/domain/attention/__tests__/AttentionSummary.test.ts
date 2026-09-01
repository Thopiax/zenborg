import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "../ActivityEvent";
import {
  agentSessions,
  byArea,
  coverage,
  dwellRows,
} from "../AttentionSummary";

function ev(
  overrides: Partial<ActivityEvent> & { ts: number },
): ActivityEvent {
  return {
    id: `e-${overrides.ts}`,
    surface: "desktop",
    kind: "app_switched",
    sessionId: "",
    payload: {},
    ...overrides,
  };
}

const MINUTE = 60_000;
const resolve = (e: ActivityEvent) => {
  const app = e.payload.app_name;
  if (app === "Slack") return "area-work";
  if (app === "Firefox") return "area-browse";
  return undefined;
};

describe("dwellRows", () => {
  it("computes dwell from consecutive timestamps", () => {
    const events = [
      ev({ ts: 0, payload: { app_name: "Slack" } }),
      ev({ ts: 5 * MINUTE, payload: { app_name: "Firefox" } }),
      ev({ ts: 8 * MINUTE, payload: { app_name: "Slack" } }),
    ];
    const rows = dwellRows(events, "desktop", resolve, {
      capMs: 30 * MINUTE,
    });
    const slack = rows.find((r) => r.locator === "Slack")!;
    expect(slack.ms).toBe(5 * MINUTE);
    expect(slack.visits).toBe(2);
    expect(slack.areaId).toBe("area-work");

    const ff = rows.find((r) => r.locator === "Firefox")!;
    expect(ff.ms).toBe(3 * MINUTE);
    expect(ff.visits).toBe(1);
  });

  it("caps dwell at capMs", () => {
    const events = [
      ev({ ts: 0, payload: { app_name: "Slack" } }),
      ev({ ts: 60 * MINUTE, payload: { app_name: "Firefox" } }),
    ];
    const rows = dwellRows(events, "desktop", resolve, {
      capMs: 30 * MINUTE,
    });
    expect(rows[0].ms).toBe(30 * MINUTE);
  });

  it("last event gets zero dwell", () => {
    const events = [ev({ ts: 0, payload: { app_name: "Slack" } })];
    const rows = dwellRows(events, "desktop", resolve, {
      capMs: 30 * MINUTE,
    });
    expect(rows[0].ms).toBe(0);
    expect(rows[0].visits).toBe(1);
  });

  it("skips events from other surfaces", () => {
    const events = [
      ev({ ts: 0, surface: "agent", kind: "prompt", payload: { cwd: "/x" } }),
    ];
    const rows = dwellRows(events, "desktop", resolve, {
      capMs: 30 * MINUTE,
    });
    expect(rows).toHaveLength(0);
  });
});

describe("dwellRows — browser", () => {
  const browserResolve = (e: ActivityEvent) => {
    const domain = e.payload.domain;
    if (domain === "zoom.us") return "area-meetings";
    if (domain === "github.com") return "area-code";
    return undefined;
  };

  it("skips non-boundary events between tab_activated pairs", () => {
    const events = [
      ev({ ts: 0, surface: "browser", kind: "tab_activated", payload: { domain: "zoom.us" } }),
      ev({ ts: 1, surface: "browser", kind: "focus_start", payload: {} }),
      ev({ ts: 60 * MINUTE, surface: "browser", kind: "tab_activated", payload: { domain: "github.com" } }),
    ];
    const rows = dwellRows(events, "browser", browserResolve, { capMs: 120 * MINUTE });
    const zoom = rows.find((r) => r.locator === "zoom.us")!;
    expect(zoom.ms).toBe(60 * MINUTE);
  });

  it("uses focus_end as a boundary for long single-tab sessions", () => {
    const events = [
      ev({ ts: 0, surface: "browser", kind: "tab_activated", payload: { domain: "zoom.us" } }),
      ev({ ts: 0, surface: "browser", kind: "focus_start", payload: {} }),
      ev({ ts: 60 * MINUTE, surface: "browser", kind: "focus_end", payload: {} }),
    ];
    const rows = dwellRows(events, "browser", browserResolve, { capMs: 120 * MINUTE });
    const zoom = rows.find((r) => r.locator === "zoom.us")!;
    expect(zoom.ms).toBe(60 * MINUTE);
    expect(zoom.visits).toBe(1);
  });

  it("uses idle_start as a boundary", () => {
    const events = [
      ev({ ts: 0, surface: "browser", kind: "tab_activated", payload: { domain: "zoom.us" } }),
      ev({ ts: 30 * MINUTE, surface: "browser", kind: "idle_start", payload: {} }),
    ];
    const rows = dwellRows(events, "browser", browserResolve, { capMs: 120 * MINUTE });
    expect(rows[0].ms).toBe(30 * MINUTE);
  });

  it("gives zero dwell when no boundary follows", () => {
    const events = [
      ev({ ts: 0, surface: "browser", kind: "tab_activated", payload: { domain: "zoom.us" } }),
      ev({ ts: 1, surface: "browser", kind: "focus_start", payload: {} }),
    ];
    const rows = dwellRows(events, "browser", browserResolve, { capMs: 120 * MINUTE });
    expect(rows[0].ms).toBe(0);
    expect(rows[0].visits).toBe(1);
  });
});

describe("byArea", () => {
  it("aggregates rows by area, excluding unmapped", () => {
    const rows = [
      { surface: "desktop" as const, locator: "Slack", areaId: "a", ms: 100, visits: 2 },
      { surface: "desktop" as const, locator: "Firefox", areaId: "a", ms: 50, visits: 1 },
      { surface: "desktop" as const, locator: "Calculator", ms: 30, visits: 1 },
    ];
    const areas = byArea(rows);
    expect(areas).toHaveLength(1);
    expect(areas[0].areaId).toBe("a");
    expect(areas[0].ms).toBe(150);
    expect(areas[0].visits).toBe(3);
  });
});

describe("agentSessions", () => {
  it("groups agent events by sessionId", () => {
    const events = [
      ev({
        ts: 100,
        surface: "agent",
        kind: "session_start",
        sessionId: "s1",
        payload: { cwd: "/repo" },
      }),
      ev({
        ts: 200,
        surface: "agent",
        kind: "prompt",
        sessionId: "s1",
        payload: { cwd: "/repo" },
      }),
      ev({
        ts: 500,
        surface: "agent",
        kind: "prompt",
        sessionId: "s1",
        payload: {},
      }),
      ev({
        ts: 300,
        surface: "agent",
        kind: "prompt",
        sessionId: "s2",
        payload: { cwd: "/other" },
      }),
    ];
    const sessions = agentSessions(events);
    expect(sessions).toHaveLength(2);

    const s1 = sessions.find((s) => s.sessionId === "s1")!;
    expect(s1.start).toBe(100);
    expect(s1.end).toBe(500);
    expect(s1.prompts).toBe(2);
    expect(s1.cwd).toBe("/repo");

    const s2 = sessions.find((s) => s.sessionId === "s2")!;
    expect(s2.prompts).toBe(1);
  });
});

describe("coverage", () => {
  it("reports first/last/count per surface", () => {
    const events = [
      ev({ ts: 100, surface: "desktop" }),
      ev({ ts: 200, surface: "desktop" }),
      ev({ ts: 150, surface: "agent", kind: "prompt", sessionId: "s1" }),
    ];
    const cov = coverage(events);
    const desktop = cov.find((c) => c.surface === "desktop")!;
    expect(desktop.first).toBe(100);
    expect(desktop.last).toBe(200);
    expect(desktop.events).toBe(2);

    const browser = cov.find((c) => c.surface === "browser")!;
    expect(browser.events).toBe(0);
    expect(browser.first).toBeUndefined();
  });
});
