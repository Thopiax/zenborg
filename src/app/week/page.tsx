"use client";

import { useState, useMemo } from "react";
import { useValue } from "@legendapp/state/react";
import { addDays, startOfWeek, subDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LandscapePrompt } from "@/components/LandscapePrompt";
import { WeekGrid } from "@/components/week-grid/WeekGrid";
import { validateMomentName } from "@/domain/entities/Moment";
import {
  areas$,
  moments$,
  phaseConfigs$,
  storeHydrated$,
} from "@/infrastructure/state/store";
import { updateMomentWithHistory } from "@/infrastructure/state/history-middleware";
import { deriveWeekGridViewModel } from "@/infrastructure/state/weekGridViewModel.ts";
import { toISODate } from "@/lib/dates";

function getMonday(date: Date): string {
  return toISODate(startOfWeek(date, { weekStartsOn: 1 }));
}

export default function WeekPage() {
  const hydrated = useValue(storeHydrated$);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  const allMoments = useValue(moments$);
  const allAreas = useValue(areas$);
  const allPhaseConfigs = useValue(phaseConfigs$);

  const today = useMemo(() => toISODate(new Date()), []);
  const thisMonday = useMemo(() => getMonday(new Date()), []);

  const vm = useMemo(() => {
    if (!hydrated) return null;
    return deriveWeekGridViewModel({
      moments: Object.values(allMoments),
      phaseConfigs: Object.values(allPhaseConfigs),
      weekStart,
      today,
    });
  }, [hydrated, allMoments, allPhaseConfigs, weekStart, today]);

  const handleAccept = (momentId: string) => {
    updateMomentWithHistory(momentId, { status: "accepted" });
  };

  const handleRename = (momentId: string, name: string) => {
    const validation = validateMomentName(name);
    if (!validation.valid) return;
    updateMomentWithHistory(momentId, { name: name.trim() });
  };

  const goToPreviousWeek = () => {
    const current = new Date(weekStart);
    setWeekStart(toISODate(subDays(current, 7)));
  };

  const goToNextWeek = () => {
    const current = new Date(weekStart);
    setWeekStart(toISODate(addDays(current, 7)));
  };

  const goToThisWeek = () => {
    setWeekStart(thisMonday);
  };

  if (!hydrated || !vm) {
    return null;
  }

  return (
    <>
      <LandscapePrompt />
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Week navigation */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-stone-200 dark:border-stone-700">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousWeek}
              className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToNextWeek}
              className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {weekStart !== thisMonday && (
              <button
                type="button"
                onClick={goToThisWeek}
                className="px-2 py-0.5 text-xs rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
              >
                This week
              </button>
            )}
          </div>
        </div>

        {/* Week grid */}
        <main className="flex-1 overflow-hidden">
          <WeekGrid
            vm={vm}
            areas={allAreas}
            onAccept={handleAccept}
            onRename={handleRename}
          />
        </main>
      </div>
    </>
  );
}
