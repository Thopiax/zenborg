import type { Area } from "@/domain/entities/Area";
import type { Phase } from "@/domain/value-objects/Phase";
import type { HeatmapDay } from "@/infrastructure/state/bandedHeatmapViewModel";
import { BandedHeatmapCell } from "./BandedHeatmapCell";
import {
  BRACKET_HEIGHT,
  CELL_GAP,
  CELL_SIZE,
  ROW_GAP,
  STRIDE,
} from "./constants";

interface BandedHeatmapGapSegmentProps {
  days: HeatmapDay[];
  rows: Phase[];
  areaById: Map<string, Area>;
  phaseFallowClasses: string[];
}

export function BandedHeatmapGapSegment({
  days,
  rows,
  areaById,
  phaseFallowClasses,
}: BandedHeatmapGapSegmentProps) {
  const gridWidth = days.length * STRIDE - CELL_GAP;
  const segmentWidth = gridWidth;

  return (
    <div
      className="flex flex-col"
      style={{ width: segmentWidth, flexShrink: 0 }}
    >
      <div style={{ height: BRACKET_HEIGHT }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: ROW_GAP,
        }}
      >
        {rows.map((phase, rowIndex) => (
          <div
            key={phase}
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: `${CELL_SIZE}px`,
              gap: CELL_GAP,
              width: gridWidth,
              opacity: 0.55,
            }}
          >
            {days.map((day) => (
              <BandedHeatmapCell
                key={day.date}
                cell={day.cells[phase]}
                areaById={areaById}
                fallowClassName={phaseFallowClasses[rowIndex]}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
