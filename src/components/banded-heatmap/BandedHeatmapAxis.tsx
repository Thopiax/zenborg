import type { HeatmapDay } from "@/infrastructure/state/bandedHeatmapViewModel";
import { AXIS_HEIGHT, CELL_SIZE } from "./constants";

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

const isWeekend = (date: string): boolean => {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
};

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
        const x = dayX[index];
        if (x === undefined) return null;
        const isNow = index === todayIndex;
        const isMonth = isMonthStart(day.date);
        const weekend = isWeekend(day.date);
        if (!isNow && !isMonth && !weekend) return null;

        if (isNow) {
          return (
            <div
              key={day.date}
              className="absolute top-0 bottom-0 border-l border-stone-900 dark:border-stone-100"
              style={{ left: x }}
            />
          );
        }
        if (isMonth) {
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
        }
        // Weekend tick — tiny dot centered under the day column.
        return (
          <div
            key={day.date}
            className="absolute bottom-1 rounded-full bg-stone-400/40 dark:bg-stone-500/40"
            style={{
              left: x + CELL_SIZE / 2 - 1,
              width: 2,
              height: 2,
            }}
          />
        );
      })}
    </div>
  );
}
