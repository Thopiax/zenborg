import { describe, expect, it } from "vitest";
import { metricSeries } from "../MetricTrendService";

const moments = [
  { id: "m1", habitId: "h1", customMetric: { name: "weight", unit: "kg" } },
  { id: "m2", habitId: "h1", customMetric: { name: "weight", unit: "kg" } },
  { id: "m3", habitId: "h1", customMetric: { name: "reps", unit: "count" } },
  { id: "m4", habitId: "h2", customMetric: { name: "weight", unit: "kg" } },
];

const logs = [
  { momentId: "m1", date: "2026-09-01", value: 80.5 },
  { momentId: "m2", date: "2026-09-03", value: 80.2 },
  { momentId: "m3", date: "2026-09-02", value: 12 },
  { momentId: "m4", date: "2026-09-01", value: 75 },
];

describe("metricSeries", () => {
  it("groups logs by metric name for a habit", () => {
    const series = metricSeries("h1", moments, logs);
    expect(series).toHaveLength(2);
    const weight = series.find((s) => s.metric.name === "weight")!;
    expect(weight.points).toHaveLength(2);
    expect(weight.points[0].date).toBe("2026-09-01");
    expect(weight.points[1].date).toBe("2026-09-03");
    const reps = series.find((s) => s.metric.name === "reps")!;
    expect(reps.points).toHaveLength(1);
  });

  it("filters by metricName when provided", () => {
    const series = metricSeries("h1", moments, logs, "reps");
    expect(series).toHaveLength(1);
    expect(series[0].metric.name).toBe("reps");
  });

  it("excludes logs from other habits", () => {
    const series = metricSeries("h1", moments, logs);
    for (const s of series) {
      for (const p of s.points) {
        expect(p.momentId).not.toBe("m4");
      }
    }
  });

  it("returns empty for a habit with no logged metrics", () => {
    expect(metricSeries("h99", moments, logs)).toHaveLength(0);
  });
});
