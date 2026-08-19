import { resolveArea } from "../../domain/attention/AreaMap.ts";
import type { Discrepancy } from "../../domain/attention/Discrepancy";
import { deriveSpans } from "../../domain/attention/SpanDerivation.ts";
import {
  detectAbsence,
  detectDrift,
} from "../../domain/services/DiscrepancyService.ts";
import type { DiscrepancyRecord, ShadowDeps, Window } from "../ports";

/**
 * Migration step 2: shadow mode.
 *
 * Derive discrepancy from the log that already exists, and act on none of it.
 * The spec calls this the step to protect and the one most likely to be cut
 * under enthusiasm, because it carries all the epistemic weight: the model
 * looked obviously right twice before and was wrong both times.
 *
 * So this function reads and returns. It does not write, deliver, arm, or
 * notify, and `runShadowMode` below adds exactly one side effect.
 */
export async function deriveDiscrepancies(
  deps: ShadowDeps,
  window: Window,
): Promise<DiscrepancyRecord> {
  const [events, areaMap, boundaries] = await Promise.all([
    deps.log.read(window.from, window.to),
    deps.garden.areaMap(),
    deps.garden.boundaries(window.from, window.to),
  ]);

  const spans = deriveSpans(events, (event) => resolveArea(areaMap, event), {
    ...deps.span,
    boundaries,
  });

  const discrepancies: Discrepancy[] = [];
  for (const span of spans) {
    const planting = await deps.garden.plantingsAt(span.start);
    const input = {
      plantedMomentIds: planting.momentIds,
      plantedAreaIds: planting.areaIds,
      span,
      events,
    };
    // Mutually exclusive by construction: drift needs a planting to be
    // discrepant with, absence needs the lack of one. At most one fires.
    const found = detectDrift(input) ?? detectAbsence(input);
    if (found !== null) discrepancies.push(found);
  }

  return {
    generatedAt: deps.clock.now(),
    window,
    discrepancies,
    shadow: true,
  };
}

/**
 * Derive, then publish to `discrepancy.json`. Nothing reads that file yet.
 *
 * The `GERARD_STATIONS_ARMED` discipline, reused verbatim: the full loop runs,
 * the verdict publishes, nothing mutates. Readers arrive at step 5.
 */
export async function runShadowMode(
  deps: ShadowDeps,
  window: Window,
): Promise<DiscrepancyRecord> {
  const record = await deriveDiscrepancies(deps, window);
  await deps.store.write(record);
  return record;
}
