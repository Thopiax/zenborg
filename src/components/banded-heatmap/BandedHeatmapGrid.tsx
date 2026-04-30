import type { Area } from "@/domain/entities/Area";
import type { Phase } from "@/domain/value-objects/Phase";
import type { HeatmapDay } from "@/infrastructure/state/bandedHeatmapViewModel";
import { BandedHeatmapCell } from "./BandedHeatmapCell";
import { CELL_GAP, CELL_SIZE, ROW_GAP } from "./constants";

interface BandedHeatmapGridProps {
  days: HeatmapDay[];
  rows: Phase[];
  areaById: Map<string, Area>;
}

export function BandedHeatmapGrid({
  days,
  rows,
  areaById,
}: BandedHeatmapGridProps) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        gap: ROW_GAP,
      }}
    >
      {rows.map((phase) => (
        <div
          key={phase}
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: `${CELL_SIZE}px`,
            gap: CELL_GAP,
          }}
        >
          {days.map((day) => (
            <BandedHeatmapCell
              key={day.date}
              cell={day.cells[phase]}
              areaById={areaById}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
