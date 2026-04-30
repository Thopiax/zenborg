import type { Area } from "@/domain/entities/Area";
import type { HeatmapCell } from "@/infrastructure/state/bandedHeatmapViewModel";
import { CELL_SIZE, TENSE_OPACITY } from "./constants";

interface BandedHeatmapCellProps {
  cell: HeatmapCell;
  areaById: Map<string, Area>;
  fallowClassName?: string;
}

const baseClass = "box-border rounded-sm";

const DEFAULT_FALLOW_CLASS = "bg-stone-200/60 dark:bg-stone-700/40";

export function BandedHeatmapCell({
  cell,
  areaById,
  fallowClassName,
}: BandedHeatmapCellProps) {
  const sizeStyle: React.CSSProperties = {
    width: CELL_SIZE,
    height: CELL_SIZE,
    opacity: TENSE_OPACITY[cell.tense],
  };

  if (cell.state === "fallow" || cell.state === "unplanted") {
    return (
      <div
        className={`${baseClass} ${fallowClassName ?? DEFAULT_FALLOW_CLASS}`}
        style={sizeStyle}
      />
    );
  }

  const area = cell.areaId ? areaById.get(cell.areaId) : undefined;
  return (
    <div
      className={baseClass}
      style={{ ...sizeStyle, background: area?.color ?? "transparent" }}
    />
  );
}
