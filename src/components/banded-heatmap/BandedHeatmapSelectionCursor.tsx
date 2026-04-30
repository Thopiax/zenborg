import { CELL_SIZE, STRIDE } from "./constants";

interface BandedHeatmapSelectionCursorProps {
  selectedIndex: number;
}

export function BandedHeatmapSelectionCursor({
  selectedIndex,
}: BandedHeatmapSelectionCursorProps) {
  if (selectedIndex < 0) return null;
  const left = selectedIndex * STRIDE - 2;
  const width = CELL_SIZE + 4;

  return (
    <div
      className="absolute pointer-events-none rounded-[2px] border border-stone-700 dark:border-stone-300"
      style={{
        left,
        width,
        top: -2,
        bottom: -2,
        zIndex: 4,
      }}
    />
  );
}
