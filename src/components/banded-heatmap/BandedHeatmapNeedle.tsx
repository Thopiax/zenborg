import { CELL_SIZE, STRIDE } from "./constants";

interface BandedHeatmapNeedleProps {
  todayIndex: number;
}

export function BandedHeatmapNeedle({ todayIndex }: BandedHeatmapNeedleProps) {
  if (todayIndex < 0) return null;
  const left = todayIndex * STRIDE + CELL_SIZE / 2;

  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none bg-stone-900 dark:bg-stone-100"
      style={{ left, width: 1, zIndex: 3 }}
    />
  );
}
