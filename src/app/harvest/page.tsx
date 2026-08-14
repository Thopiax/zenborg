"use client";

import { useValue } from "@legendapp/state/react";
import { useMemo } from "react";
import { SeasonReadback } from "@/components/harvest/SeasonReadback";
import {
  deriveHarvestSeason,
  pickHarvestSeason,
} from "@/infrastructure/state/harvestViewModel";
import {
  areas$,
  cycles$,
  habits$,
  moments$,
  phaseConfigs$,
} from "@/infrastructure/state/store";
import { getTodayISO } from "@/lib/dates";

/**
 * Zenborg — Harvest
 *
 * The season reads back: what it intended, what it held, and what was planted
 * in it. Everything here comes from the vault the app already holds — no
 * network, no model, no photo permission. A garden with nothing closed yet
 * gets an empty state, never an error.
 *
 * Which season it opens on is `pickHarvestSeason`. Navigating between seasons
 * is a separate slice — the banded heatmap is harvest's index.
 */
export default function HarvestPage() {
  const cycles = useValue(cycles$);
  const moments = useValue(moments$);
  const areas = useValue(areas$);
  const habits = useValue(habits$);
  const phaseConfigs = useValue(phaseConfigs$);

  const season = useMemo(() => {
    const cycle = pickHarvestSeason(Object.values(cycles), getTodayISO());

    if (!cycle) {
      return null;
    }

    return deriveHarvestSeason({
      cycle,
      moments: Object.values(moments),
      areas: Object.values(areas),
      habits: Object.values(habits),
      phaseConfigs: Object.values(phaseConfigs),
    });
  }, [cycles, moments, areas, habits, phaseConfigs]);

  return (
    <div className="h-full bg-background transition-colors flex flex-col overflow-hidden">
      <main className="flex-1 overflow-y-auto">
        <SeasonReadback season={season} />
      </main>
    </div>
  );
}
