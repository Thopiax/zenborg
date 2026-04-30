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
      className="absolute pointer-events-none rounded-sm ring-1 ring-stone-500/70 dark:ring-stone-400/70"
      style={{
        left: x - 1,
        width: CELL_SIZE + 2,
        top: -1,
        bottom: -1,
        zIndex: 4,
      }}
    />
  );
}
