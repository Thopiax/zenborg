/**
 * MetricLog - Performance tracking entry for PUSHING attitude
 *
 * Only used when a moment has PUSHING attitude and a custom metric defined.
 * Logs are created optionally after each allocation.
 *
 * Philosophy: Performance tracking only when explicitly chosen.
 * Not mandatory, not automatic, not gamified.
 */

export interface MetricLog {
  readonly id: string;
  /** ID of the moment this log belongs to */
  momentId: string;
  /** Date of the logged metric (ISO date string) */
  date: string;
  /** Numeric value of the metric */
  value: number;
  /** Optional notes about this entry */
  notes?: string;
  createdAt: string;
}

/**
 * Creates a new metric log entry
 */
export function createMetricLog(
  momentId: string,
  date: string,
  value: number,
  notes?: string
): MetricLog {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    momentId: momentId.trim(),
    date,
    value,
    notes: notes?.trim(),
    createdAt: now,
  };
}

/**
 * Result type for metric operations
 */
export type MetricLogResult = MetricLog | { error: string };

/**
 * Validates metric value
 */
export function validateMetricValue(value: number): { valid: boolean; error?: string } {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return {
      valid: false,
      error: "Metric value must be a valid number",
    };
  }

  if (!Number.isFinite(value)) {
    return {
      valid: false,
      error: "Metric value must be finite",
    };
  }

  return { valid: true };
}

/**
 * Type guard to check if result is an error
 */
export function isMetricLogError(result: MetricLogResult): result is { error: string } {
  return "error" in result;
}
