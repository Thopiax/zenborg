import type { Area } from "@/domain/entities/Area";
import type { HeatmapCell } from "@/infrastructure/state/bandedHeatmapViewModel";
import {
  CELL_SIZE,
  FAINT_COLOR,
  FALLOW_BG,
  TENSE_OPACITY,
} from "./constants";

interface BandedHeatmapCellProps {
  cell: HeatmapCell;
  areaById: Map<string, Area>;
}

export function BandedHeatmapCell({ cell, areaById }: BandedHeatmapCellProps) {
  const baseStyle: React.CSSProperties = {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 1.5,
    boxSizing: "border-box",
    opacity: TENSE_OPACITY[cell.tense],
  };

  if (cell.state === "unplanted") {
    return (
      <div
        style={{
          ...baseStyle,
          background: "transparent",
          border: `1px dashed ${FAINT_COLOR}`,
        }}
      />
    );
  }

  if (cell.state === "fallow") {
    return <div style={{ ...baseStyle, background: FALLOW_BG }} />;
  }

  const area = cell.areaId ? areaById.get(cell.areaId) : undefined;
  const background = area?.color ?? FALLOW_BG;
  return <div style={{ ...baseStyle, background }} />;
}
