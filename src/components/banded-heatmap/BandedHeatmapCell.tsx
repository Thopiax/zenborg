import type { Area } from "@/domain/entities/Area";
import type { HeatmapCell } from "@/infrastructure/state/bandedHeatmapViewModel";
import { CELL_SIZE, TENSE_OPACITY } from "./constants";

interface BandedHeatmapCellProps {
  cell: HeatmapCell;
  areaById: Map<string, Area>;
  fallowColor?: string;
}

const baseClass = "box-border rounded-sm";

const DEFAULT_FALLOW = "rgba(168, 162, 158, 0.18)";

export function BandedHeatmapCell({
  cell,
  areaById,
  fallowColor,
}: BandedHeatmapCellProps) {
  const sizeStyle: React.CSSProperties = {
    width: CELL_SIZE,
    height: CELL_SIZE,
    opacity: TENSE_OPACITY[cell.tense],
  };

  if (cell.state === "unplanted") {
    return (
      <div
        className={`${baseClass} border border-dashed border-stone-300 dark:border-stone-600 bg-transparent`}
        style={sizeStyle}
      />
    );
  }

  if (cell.state === "fallow") {
    return (
      <div
        className={baseClass}
        style={{ ...sizeStyle, background: fallowColor ?? DEFAULT_FALLOW }}
      />
    );
  }

  const area = cell.areaId ? areaById.get(cell.areaId) : undefined;
  return (
    <div
      className={baseClass}
      style={{ ...sizeStyle, background: area?.color ?? DEFAULT_FALLOW }}
    />
  );
}
