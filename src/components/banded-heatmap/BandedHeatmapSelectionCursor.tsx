import { CELL_SIZE } from "./constants";

interface BandedHeatmapSelectionCursorProps {
  x: number | null;
}

export function BandedHeatmapSelectionCursor({
  x,
}: BandedHeatmapSelectionCursorProps) {
  if (x === null) return null;

  return (
    <div
      className="absolute pointer-events-none rounded-[3px] border border-stone-700 dark:border-stone-300"
      style={{
        left: x - 2,
        width: CELL_SIZE + 4,
        top: -2,
        bottom: -2,
        zIndex: 4,
      }}
    />
  );
}
