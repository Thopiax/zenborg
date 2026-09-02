/**
 * plantSleep — the application use case that bridges Garmin sleep and the garden.
 *
 * Pure orchestration: takes nights + a binding + what's already planted,
 * returns moment seeds ready to write. No I/O, no UUID generation, no clock.
 * The caller (the script edge) stamps ids, timestamps, and persists.
 */

import type { IntegrationBinding } from "../../domain/integration/IntegrationBinding.ts";
import {
  isSleepAlreadyPlanted,
  sleepToMomentFields,
  type SleepMomentFields,
} from "../../domain/garmin/SleepMomentService.ts";
import type { SleepNight } from "../../domain/garmin/SleepPhaseService.ts";

export interface PlantSleepInput {
  readonly nights: readonly SleepNight[];
  readonly binding: IntegrationBinding;
  readonly plantedDays: ReadonlySet<string>;
  readonly timeZone?: string;
}

export interface PlantSleepResult {
  readonly seeds: readonly SleepMomentFields[];
  readonly skipped: number;
}

export function plantSleep(input: PlantSleepInput): PlantSleepResult {
  const seeds: SleepMomentFields[] = [];
  let skipped = 0;
  const seenDays = new Set(input.plantedDays);

  for (const night of input.nights) {
    const fields = sleepToMomentFields(night, input.binding, input.timeZone);
    if (fields === null) {
      skipped++;
      continue;
    }

    if (isSleepAlreadyPlanted(fields.day, seenDays)) {
      skipped++;
      continue;
    }

    seenDays.add(fields.day);
    seeds.push(fields);
  }

  return { seeds, skipped };
}
