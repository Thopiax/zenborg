/**
 * MetricLog → trend series, joined through moments to a habit.
 * Pure: points only, no slope, no delta-to-target, no percent.
 */

export interface MetricPoint {
  readonly date: string;
  readonly value: number;
  readonly momentId: string;
  readonly notes?: string;
}

export interface MetricSeries {
  readonly habitId: string;
  readonly metric: { name: string; unit: string };
  readonly points: readonly MetricPoint[];
}

interface MomentRef {
  readonly id: string;
  readonly habitId: string | null;
  readonly customMetric?: { name: string; unit: string; target?: number };
}

interface LogRef {
  readonly momentId: string;
  readonly date: string;
  readonly value: number;
  readonly notes?: string;
}

export function metricSeries(
  habitId: string,
  moments: readonly MomentRef[],
  logs: readonly LogRef[],
  metricName?: string,
): readonly MetricSeries[] {
  const habitMomentIds = new Set(
    moments.filter((m) => m.habitId === habitId).map((m) => m.id),
  );
  const momentById = new Map(moments.map((m) => [m.id, m]));

  const byMetric = new Map<string, { unit: string; points: MetricPoint[] }>();

  for (const log of logs) {
    if (!habitMomentIds.has(log.momentId)) continue;
    const moment = momentById.get(log.momentId);
    const metric = moment?.customMetric;
    if (!metric) continue;
    if (metricName && metric.name !== metricName) continue;

    const key = metric.name;
    let entry = byMetric.get(key);
    if (!entry) {
      entry = { unit: metric.unit, points: [] };
      byMetric.set(key, entry);
    }
    entry.points.push({
      date: log.date,
      value: log.value,
      momentId: log.momentId,
      ...(log.notes ? { notes: log.notes } : {}),
    });
  }

  return [...byMetric.entries()].map(([name, { unit, points }]) => ({
    habitId,
    metric: { name, unit },
    points: points.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}
