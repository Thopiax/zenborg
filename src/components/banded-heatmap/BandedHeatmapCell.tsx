import type { Area } from "@/domain/entities/Area";
import type { HeatmapCell } from "@/infrastructure/state/bandedHeatmapViewModel";
import { CELL_SIZE, TENSE_OPACITY } from "./constants";

interface BandedHeatmapCellProps {
  cell: HeatmapCell;
  areaById: Map<string, Area>;
  fallowClassName?: string;
}

const baseClass = "box-border rounded-sm overflow-hidden flex flex-col";

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

  return (
    <div className={baseClass} style={sizeStyle}>
      {cell.areas.length === 0 ? (
        <div className="flex-1" style={{ background: "transparent" }} />
      ) : (
        cell.areas.map((share) => {
          const area = areaById.get(share.areaId);
          if (!area) return null;
          return (
            <div
              key={share.areaId}
              style={{
                flexGrow: share.count,
                flexShrink: 0,
                flexBasis: 0,
                minHeight: 1,
                background: area.color,
              }}
              title={`${area.name} · ${share.count}`}
            />
          );
        })
      )}
    </div>
  );
}
