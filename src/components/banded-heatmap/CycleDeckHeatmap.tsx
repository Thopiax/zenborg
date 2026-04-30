"use client";

import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
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

  const cycles = useMemo(() => Object.values(allCycles), [allCycles]);
  const moments = useMemo(() => Object.values(allMoments), [allMoments]);
  const areas = useMemo(() => Object.values(allAreas), [allAreas]);
  const phaseConfigs = useMemo(
    () => Object.values(allPhaseConfigs),
    [allPhaseConfigs],
  );

  const today = getTodayISO();

  const handleCycleSelect = useCallback((cycleId: string) => {
    cycleDeckSelectedCycleId$.set(cycleId);
  }, []);

  const handleDaySelect = useCallback(
    (date: string) => {
      if (selectedDay$.peek() !== date) selectedDay$.set(date);
      const containing = cycles.find(
        (c) => date >= c.startDate && date <= (c.endDate ?? "9999-12-31"),
      );
      const nextCycleId = containing?.id ?? null;
      if (cycleDeckSelectedCycleId$.peek() !== nextCycleId) {
        cycleDeckSelectedCycleId$.set(nextCycleId);
      }
    },
    [cycles],
  );

  return (
    <BandedHeatmap
      cycles={cycles}
      moments={moments}
      areas={areas}
      phaseConfigs={phaseConfigs}
      today={today}
      selectedCycleId={selectedCycleId}
      selectedDay={selectedDay}
      onCycleSelect={handleCycleSelect}
      onDaySelect={handleDaySelect}
    />
  );
}
