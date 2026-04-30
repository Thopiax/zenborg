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
      className="absolute pointer-events-none rounded-md border border-stone-700 dark:border-stone-300"
      style={{
        left: x - 3,
        width: CELL_SIZE + 6,
        top: -3,
        bottom: -3,
        zIndex: 4,
      }}
    />
  );
}
