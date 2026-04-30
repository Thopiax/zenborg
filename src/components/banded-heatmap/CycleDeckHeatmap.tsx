"use client";

import { useValue } from "@legendapp/state/react";
import { useCallback } from "react";
import {
  areas$,
  cycles$,
  moments$,
  phaseConfigs$,
} from "@/infrastructure/state/store";
import {
  cycleDeckSelectedCycleId$,
  selectedDay$,
} from "@/infrastructure/state/ui-store";
import { getTodayISO } from "@/lib/dates";
import { BandedHeatmap } from "./BandedHeatmap";

export function CycleDeckHeatmap() {
  const allCycles = useValue(() => cycles$.get());
  const allMoments = useValue(() => moments$.get());
  const allAreas = useValue(() => areas$.get());
  const allPhaseConfigs = useValue(() => phaseConfigs$.get());
  const selectedCycleId = useValue(cycleDeckSelectedCycleId$);
  const selectedDay = useValue(selectedDay$);

  const cycles = Object.values(allCycles);
  const moments = Object.values(allMoments);
  const areas = Object.values(allAreas);
  const phaseConfigs = Object.values(allPhaseConfigs);

  const handleCycleSelect = useCallback((cycleId: string) => {
    cycleDeckSelectedCycleId$.set(cycleId);
  }, []);

  const handleDaySelect = useCallback(
    (date: string) => {
      selectedDay$.set(date);
      const containing = cycles.find(
        (c) =>
          date >= c.startDate &&
          date <= (c.endDate ?? "9999-12-31")
      );
      if (containing) {
        cycleDeckSelectedCycleId$.set(containing.id);
      }
    },
    [cycles]
  );

  return (
    <BandedHeatmap
      cycles={cycles}
      moments={moments}
      areas={areas}
      phaseConfigs={phaseConfigs}
      today={getTodayISO()}
      selectedCycleId={selectedCycleId}
      selectedDay={selectedDay}
      onCycleSelect={handleCycleSelect}
      onDaySelect={handleDaySelect}
    />
  );
}
