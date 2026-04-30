import type { HeatmapDay } from "@/infrastructure/state/bandedHeatmapViewModel";
import { AXIS_HEIGHT } from "./constants";

interface BandedHeatmapAxisProps {
  days: HeatmapDay[];
  todayIndex: number;
  dayX: number[];
}

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const isMonthStart = (date: string) => date.slice(8, 10) === "01";

export function BandedHeatmapAxis({
  days,
  todayIndex,
  dayX,
}: BandedHeatmapAxisProps) {
  return (
    <div
      className="relative font-mono text-[9px] tracking-[0.1em] text-stone-500 dark:text-stone-500"
      style={{ height: AXIS_HEIGHT, marginTop: 6, zIndex: 2 }}
    >
      {days.map((day, index) => {
        const isNow = index === todayIndex;
        const isMonth = isMonthStart(day.date);
        if (!isNow && !isMonth) return null;
        const x = dayX[index];
        if (x === undefined) return null;

        if (isNow) {
          return (
            <div
              key={day.date}
              className="absolute top-0 bottom-0 border-l border-stone-900 dark:border-stone-100"
              style={{ left: x }}
            />
          );
        }
        const month = Number(day.date.slice(5, 7)) - 1;
        return (
          <div
            key={day.date}
            className="absolute top-0 border-l border-stone-300/60 dark:border-stone-700/60 pl-1 pt-0.5 whitespace-nowrap"
            style={{ left: x }}
          >
            {MONTH_LABELS[month]}
          </div>
        );
      })}
    </div>
  );
}
