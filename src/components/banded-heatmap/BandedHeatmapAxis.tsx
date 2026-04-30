import type { HeatmapDay } from "@/infrastructure/state/bandedHeatmapViewModel";
import { AXIS_HEIGHT, CELL_GAP, CELL_SIZE, HAIR_COLOR, NOW_COLOR } from "./constants";

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

export function BandedHeatmapAxis({ days, todayIndex }: BandedHeatmapAxisProps) {
  return (
    <div
      style={{
        position: "relative",
        height: AXIS_HEIGHT,
        marginTop: 6,
        zIndex: 2,
        display: "grid",
        gridAutoFlow: "column",
        gridAutoColumns: `${CELL_SIZE}px`,
        gap: CELL_GAP,
        fontSize: 9,
        letterSpacing: "0.1em",
        color: "rgba(42, 37, 31, 0.55)",
      }}
    >
      {days.map((day, index) => {
        const isNow = index === todayIndex;
        const isMonth = isMonthStart(day.date);
        if (!isNow && !isMonth) {
          return <div key={day.date} />;
        }

        const month = Number(day.date.slice(5, 7)) - 1;
        const label = isNow ? "NOW" : MONTH_LABELS[month];
        const color = isNow ? NOW_COLOR : "rgba(42, 37, 31, 0.55)";
        const borderColor = isNow ? NOW_COLOR : HAIR_COLOR;

        return (
          <div
            key={day.date}
            style={{
              borderLeft: `1px solid ${borderColor}`,
              padding: "2px 0 0 3px",
              whiteSpace: "nowrap",
              color,
              fontWeight: isNow ? 600 : 400,
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
