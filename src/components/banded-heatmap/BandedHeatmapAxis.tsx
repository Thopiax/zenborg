import type { HeatmapDay } from "@/infrastructure/state/bandedHeatmapViewModel";
import { AXIS_HEIGHT, CELL_GAP, CELL_SIZE } from "./constants";

interface BandedHeatmapAxisProps {
  days: HeatmapDay[];
  todayIndex: number;
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

function isMonthStart(date: string): boolean {
  return date.slice(8, 10) === "01";
}

export function BandedHeatmapAxis({
  days,
  todayIndex,
}: BandedHeatmapAxisProps) {
  return (
    <div
      className="relative grid font-mono text-[9px] tracking-[0.1em] text-stone-500 dark:text-stone-500"
      style={{
        height: AXIS_HEIGHT,
        marginTop: 6,
        zIndex: 2,
        gridAutoFlow: "column",
        gridAutoColumns: `${CELL_SIZE}px`,
        gap: CELL_GAP,
      }}
    >
      {days.map((day, index) => {
        const isNow = index === todayIndex;
        const isMonth = isMonthStart(day.date);
        if (isNow) {
          return (
            <div
              key={day.date}
              className="border-l border-stone-900 dark:border-stone-100"
            />
          );
        }
        if (!isMonth) return <div key={day.date} />;
        const month = Number(day.date.slice(5, 7)) - 1;
        return (
          <div
            key={day.date}
            className="border-l border-stone-300/60 dark:border-stone-700/60 pl-1 pt-0.5 whitespace-nowrap"
          >
            {MONTH_LABELS[month]}
          </div>
        );
      })}
    </div>
  );
}
