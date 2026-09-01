/**
 * Read adapter for zenborg's activity log.
 *
 * One reader, shared by MCP tools and `scripts/shadow.mts`. Lifted from
 * `shadow.mts::readLog` — which now imports this — so the normalisation
 * rules live in one place.
 *
 * Normalisations:
 * - `app_switched`: drop `durationMs`. The field describes the span being
 *   closed (previous app's dwell), not the span being opened. Dwell is
 *   derived from consecutive timestamps anyway; leaving it would cause
 *   `reachOf` in `SpanDerivation` to extend the new app's span by the
 *   previous app's dwell.
 * - Lines missing `surface` (older files): inferred from the filename.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ActivityEvent,
  ActivitySurface,
} from "../src/domain/attention/ActivityEvent.ts";

const DAY_MS = 24 * 60 * 60_000;

const SURFACES: readonly ActivitySurface[] = [
  "agent",
  "desktop",
  "browser",
  "garmin",
];

function localDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function normalise(
  raw: ActivityEvent,
  surface: ActivitySurface,
): ActivityEvent {
  const event = raw.surface ? raw : { ...raw, surface };
  if (event.kind === "app_switched" && event.durationMs !== undefined) {
    const { durationMs: _, ...rest } = event;
    return rest;
  }
  return event;
}

/**
 * Read activity events for the given window and surfaces.
 *
 * `from` and `to` are epoch-ms, half-open `[from, to)`.
 * Files are bucketed by local calendar date, so the window always
 * touches `to / DAY_MS + 1` files to cover timezone roll.
 */
export function readActivityLog(
  logDir: string,
  from: number,
  to: number,
  surfaces: readonly ActivitySurface[] = SURFACES,
): readonly ActivityEvent[] {
  if (!existsSync(logDir)) return [];
  const events: ActivityEvent[] = [];

  for (let ts = from - DAY_MS; ts <= to + DAY_MS; ts += DAY_MS) {
    const dateStr = localDate(ts);
    for (const surface of surfaces) {
      const file = join(logDir, `${dateStr}.${surface}.jsonl`);
      if (!existsSync(file)) continue;
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (line.trim() === "") continue;
        try {
          events.push(normalise(JSON.parse(line) as ActivityEvent, surface));
        } catch {
          // torn line — one lost observation, not a reason to stop
        }
      }
    }
  }

  return events
    .filter((e) => e.ts >= from && e.ts < to)
    .sort((a, b) => a.ts - b.ts);
}

export function logDir(vaultRoot: string): string {
  return join(vaultRoot, "log");
}
