/**
 * Where attention went — dwell rows, area roll-ups, agent sessions, coverage.
 *
 * Pure functions over ActivityEvent[]. The recap skill's awk one-liners,
 * made testable. No persistence — these views are computed on request.
 */
import {
  type ActivityEvent,
  type ActivitySurface,
  isHumanActor,
} from "./ActivityEvent.ts";
import type { AreaId, Duration, Instant } from "./ids.ts";
import type { AreaResolver } from "./SpanDerivation.ts";

export interface DwellRow {
  readonly surface: ActivitySurface;
  readonly locator: string;
  readonly areaId?: AreaId;
  readonly ms: Duration;
  readonly visits: number;
}

export interface DwellConfig {
  readonly capMs: Duration;
}

export type LocatorOf = (event: ActivityEvent) => string | undefined;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export const LOCATORS: Readonly<Record<string, LocatorOf>> = {
  desktop: (e) =>
    e.kind === "app_switched" ? str(e.payload.app_name) : undefined,
  agent: (e) => (e.kind === "prompt" ? str(e.payload.cwd) : undefined),
  browser: (e) =>
    e.kind === "tab_activated" ? str(e.payload.domain) : undefined,
  garmin: () => undefined,
};

export function dwellRows(
  events: readonly ActivityEvent[],
  surface: ActivitySurface,
  resolve: AreaResolver,
  config: DwellConfig,
  locator?: LocatorOf,
): readonly DwellRow[] {
  const getLocator = locator ?? LOCATORS[surface] ?? (() => undefined);
  const surfaceEvents = events
    .filter((e) => e.surface === surface && isHumanActor(e))
    .sort((a, b) => a.ts - b.ts);

  const acc = new Map<string, { ms: number; visits: number; areaId?: AreaId }>();

  for (let i = 0; i < surfaceEvents.length; i++) {
    const event = surfaceEvents[i];
    const loc = getLocator(event);
    if (loc === undefined) continue;

    const next = surfaceEvents[i + 1];
    const dwell = next
      ? Math.min(next.ts - event.ts, config.capMs)
      : 0;

    const entry = acc.get(loc);
    if (entry) {
      entry.ms += dwell;
      entry.visits += 1;
    } else {
      acc.set(loc, { ms: dwell, visits: 1, areaId: resolve(event) });
    }
  }

  return [...acc.entries()]
    .map(([locator, { ms, visits, areaId }]) => ({
      surface,
      locator,
      ...(areaId !== undefined ? { areaId } : {}),
      ms,
      visits,
    }))
    .sort((a, b) => b.ms - a.ms);
}

export interface AreaAttention {
  readonly areaId: AreaId;
  readonly ms: Duration;
  readonly visits: number;
}

export function byArea(rows: readonly DwellRow[]): readonly AreaAttention[] {
  const acc = new Map<AreaId, { ms: number; visits: number }>();
  for (const row of rows) {
    if (row.areaId === undefined) continue;
    const entry = acc.get(row.areaId);
    if (entry) {
      entry.ms += row.ms;
      entry.visits += row.visits;
    } else {
      acc.set(row.areaId, { ms: row.ms, visits: row.visits });
    }
  }
  return [...acc.entries()]
    .map(([areaId, { ms, visits }]) => ({ areaId, ms, visits }))
    .sort((a, b) => b.ms - a.ms);
}

export interface AgentSession {
  readonly sessionId: string;
  readonly cwd?: string;
  readonly start: Instant;
  readonly end: Instant;
  readonly prompts: number;
}

export function agentSessions(
  events: readonly ActivityEvent[],
): readonly AgentSession[] {
  const sessions = new Map<
    string,
    { cwd?: string; start: number; end: number; prompts: number }
  >();

  for (const e of events) {
    if (e.surface !== "agent") continue;
    const sid = e.sessionId;
    if (!sid) continue;

    const entry = sessions.get(sid);
    const cwd = str(e.payload.cwd);
    if (entry) {
      entry.start = Math.min(entry.start, e.ts);
      entry.end = Math.max(entry.end, e.ts);
      if (e.kind === "prompt") entry.prompts += 1;
      if (cwd && !entry.cwd) entry.cwd = cwd;
    } else {
      sessions.set(sid, {
        cwd,
        start: e.ts,
        end: e.ts,
        prompts: e.kind === "prompt" ? 1 : 0,
      });
    }
  }

  return [...sessions.entries()]
    .map(([sessionId, s]) => ({
      sessionId,
      ...(s.cwd ? { cwd: s.cwd } : {}),
      start: s.start,
      end: s.end,
      prompts: s.prompts,
    }))
    .sort((a, b) => a.start - b.start);
}

export interface Coverage {
  readonly surface: ActivitySurface;
  readonly first?: Instant;
  readonly last?: Instant;
  readonly events: number;
}

export function coverage(
  events: readonly ActivityEvent[],
  surfaces: readonly ActivitySurface[] = ["desktop", "agent", "browser"],
): readonly Coverage[] {
  return surfaces.map((surface) => {
    const surfaceEvents = events.filter((e) => e.surface === surface);
    if (surfaceEvents.length === 0) return { surface, events: 0 };
    const sorted = surfaceEvents.map((e) => e.ts).sort((a, b) => a - b);
    return {
      surface,
      first: sorted[0],
      last: sorted[sorted.length - 1],
      events: surfaceEvents.length,
    };
  });
}
