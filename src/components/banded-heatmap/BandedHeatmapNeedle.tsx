interface BandedHeatmapNeedleProps {
  x: number | null;
}

export function BandedHeatmapNeedle({ x }: BandedHeatmapNeedleProps) {
  if (x === null) return null;
  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none bg-stone-900 dark:bg-stone-100"
      style={{ left: x, width: 1, zIndex: 3 }}
    />
  );
}
