import { describe, expect, it } from "vitest";
import { type ActivityEvent, actorOf, isHumanActor } from "../ActivityEvent";

function event(
  partial: Partial<ActivityEvent> & { kind: string },
): ActivityEvent {
  return {
    id: "e1",
    surface: "agent",
    ts: 1_700_000_000_000,
    sessionId: "s1",
    payload: {},
    ...partial,
  };
}

describe("actorOf", () => {
  it("reads prompt as human", () => {
    expect(actorOf(event({ kind: "prompt" }))).toBe("human");
  });

  it("reads tool_dispatched as agent", () => {
    expect(actorOf(event({ kind: "tool_dispatched" }))).toBe("agent");
  });

  it("reads session_start as joint", () => {
    expect(actorOf(event({ kind: "session_start" }))).toBe("joint");
  });

  it("reads intention_switched as human, since zenborg owns the pointer", () => {
    expect(actorOf(event({ kind: "intention_switched" }))).toBe("human");
  });

  it("treats non-agent surfaces as human regardless of kind", () => {
    expect(actorOf(event({ surface: "desktop", kind: "app_switched" }))).toBe(
      "human",
    );
    expect(actorOf(event({ surface: "browser", kind: "tab_activated" }))).toBe(
      "human",
    );
  });

  it("treats garmin as agent, since it transcribes rather than observes exertion", () => {
    expect(actorOf(event({ surface: "garmin", kind: "sleep_recorded" }))).toBe(
      "agent",
    );
  });

  it("fails soft on an unknown agent-surface kind by calling it agent", () => {
    expect(actorOf(event({ kind: "some_future_kind" }))).toBe("agent");
  });
});

describe("isHumanActor", () => {
  it("is true only for human", () => {
    expect(isHumanActor(event({ kind: "prompt" }))).toBe(true);
    expect(isHumanActor(event({ kind: "tool_dispatched" }))).toBe(false);
    expect(isHumanActor(event({ kind: "session_start" }))).toBe(false);
  });
});
