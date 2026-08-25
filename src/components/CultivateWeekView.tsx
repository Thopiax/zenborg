"use client";

import { useMemo, useState } from "react";
import { useValue } from "@legendapp/state/react";
import { addDays, startOfWeek, subDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { validateMomentName } from "@/domain/entities/Moment";
import {
  areas$,
  moments$,
  phaseConfigs$,
  storeHydrated$,
} from "@/infrastructure/state/store";
import { updateMomentWithHistory } from "@/infrastructure/state/history-middleware";
import { deriveWeekGridViewModel } from "@/infrastructure/state/weekGridViewModel";
import { toISODate } from "@/lib/dates";
import { WeekGrid } from "./week-grid/WeekGrid";

function getMonday(date: Date): string {
  return toISODate(startOfWeek(date, { weekStartsOn: 1 }));
}

export function CultivateWeekView() {
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

  if (!hydrated || !vm) return null;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center px-4 py-2 border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setWeekStart(toISODate(subDays(new Date(weekStart), 7)))
            }
            className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setWeekStart(toISODate(addDays(new Date(weekStart), 7)))
            }
            className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {weekStart !== thisMonday && (
            <button
              type="button"
              onClick={() => setWeekStart(thisMonday)}
              className="px-2 py-0.5 text-xs rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            >
              This week
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <WeekGrid
          vm={vm}
          areas={allAreas}
          onAccept={handleAccept}
          onRename={handleRename}
        />
      </div>
    </div>
  );
}
