/**
 * The calendar grid: 15 minutes (spec D6). Coarse enough that the garden
 * does not become a scheduling tool, fine enough to sit beside a real
 * 10:30 meeting. A constant, deliberately not configurable in Phase 1.
 */
export const CALENDAR_GRID_MINUTES = 15;

const LAST_GRID_MINUTE = 24 * 60 - CALENDAR_GRID_MINUTES;

function snapMinutes(total: number): number {
  return Math.round(total / CALENDAR_GRID_MINUTES) * CALENDAR_GRID_MINUTES;
}

function formatTime(totalMinutes: number): string {
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Snap a clock time and duration to the 15 minute grid.
 * Start rounds to nearest (clamped so the day never wraps);
 * duration rounds to nearest with a 15 minute floor.
 */
export function snapToGrid(
  startTime: string,
  durationMin: number,
): { startTime: string; durationMin: number } {
  const [h, m] = startTime.split(":").map(Number);
  const snappedStart = Math.min(snapMinutes(h * 60 + m), LAST_GRID_MINUTE);
  const snappedDuration = Math.max(
    CALENDAR_GRID_MINUTES,
    snapMinutes(durationMin),
  );
  return { startTime: formatTime(snappedStart), durationMin: snappedDuration };
}
