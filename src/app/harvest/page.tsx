"use client";

import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import { CycleService } from "@/application/services/CycleService";
import { BandedHeatmap } from "@/components/banded-heatmap/BandedHeatmap";
import { SeasonReadback } from "@/components/harvest/SeasonReadback";
import {
  deriveHarvestSeason,
  resolveHarvestCycle,
} from "@/infrastructure/state/harvestViewModel";
import {
  areas$,
  cycles$,
  habits$,
  moments$,
  phaseConfigs$,
} from "@/infrastructure/state/store";
import { harvestSelectedCycleId$ } from "@/infrastructure/state/ui-store";
import { getTodayISO } from "@/lib/dates";

/**
 * Zenborg — Harvest
 *
 * The season reads back: what it intended, what it held, and what was planted
 * in it. Everything here comes from the vault the app already holds — no
 * network, no model, no photo permission. A garden with nothing closed yet
 * gets an empty state, never an error.
 *
 * The index is the banded heatmap, not a new timeline: the seasons are
 * already drawn there, so navigating them is picking one. Harvest opens on
 * the most recently closed season until you pick another.
 */
export default function HarvestPage() {
  const cycles = useValue(cycles$);
  const moments = useValue(moments$);
  const areas = useValue(areas$);
  const habits = useValue(habits$);
  const phaseConfigs = useValue(phaseConfigs$);
  const selectedCycleId = useValue(harvestSelectedCycleId$);

  const today = getTodayISO();

  const cycleList = useMemo(() => Object.values(cycles), [cycles]);
  const momentList = useMemo(() => Object.values(moments), [moments]);
  const areaList = useMemo(() => Object.values(areas), [areas]);
  const phaseConfigList = useMemo(
    () => Object.values(phaseConfigs),
    [phaseConfigs],
  );

  const cycle = useMemo(
    () => resolveHarvestCycle(cycleList, selectedCycleId, today),
    [cycleList, selectedCycleId, today],
  );

  const season = useMemo(() => {
    if (!cycle) {
      return null;
    }

    return deriveHarvestSeason({
      cycle,
      moments: momentList,
      areas: areaList,
      habits: Object.values(habits),
      phaseConfigs: phaseConfigList,
    });
  }, [cycle, momentList, areaList, habits, phaseConfigList]);

  const cycleService = useMemo(() => new CycleService(), []);

  // An edit here is a person writing, so the service stamps it "human" and a
  // summarizer re-run will leave it alone from then on.
  const handleEditReflection = useCallback(
    (reflection: string | null) => {
      if (!cycle) {
        return;
      }

      cycleService.updateCycle(cycle.id, { reflection });
    },
    [cycle, cycleService],
  );

  return (
    <div className="h-full bg-background transition-colors flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
        <BandedHeatmap
          areas={areaList}
          cycles={cycleList}
          moments={momentList}
          onCycleSelect={(id) => harvestSelectedCycleId$.set(id)}
          phaseConfigs={phaseConfigList}
          selectedCycleId={cycle?.id ?? null}
          today={today}
        />
      </div>

      <main className="flex-1 overflow-y-auto">
        <SeasonReadback
          onEditReflection={handleEditReflection}
          season={season}
        />
      </main>
    </div>
  );
}
