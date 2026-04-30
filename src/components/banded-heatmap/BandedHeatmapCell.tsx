import type { Area } from "@/domain/entities/Area";
import type { HeatmapCell } from "@/infrastructure/state/bandedHeatmapViewModel";
import { CELL_SIZE, TENSE_OPACITY } from "./constants";

interface BandedHeatmapCellProps {
  cell: HeatmapCell;
  areaById: Map<string, Area>;
}

const baseClass = "rounded-[2px] box-border";

export function BandedHeatmapCell({ cell, areaById }: BandedHeatmapCellProps) {
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
        className={`${baseClass} bg-stone-200/50 dark:bg-stone-700/40`}
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
