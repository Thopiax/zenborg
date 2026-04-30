import { CELL_SIZE } from "./constants";

interface BandedHeatmapCreateDraftProps {
  startX: number;
  endX: number;
  valid: boolean;
}

export function BandedHeatmapCreateDraft({
  startX,
  endX,
  valid,
}: BandedHeatmapCreateDraftProps) {
  const left = startX - 2;
  const width = endX + CELL_SIZE - startX + 4;

  const className = valid
    ? "absolute pointer-events-none rounded-md border-2 border-dashed border-stone-700 dark:border-stone-300 bg-stone-900/5 dark:bg-stone-100/5"
    : "absolute pointer-events-none rounded-md border-2 border-dashed border-red-500/70 bg-red-500/5";

  return (
    <div
      className={className}
      style={{
        left,
        width,
        top: -4,
        bottom: -4,
        zIndex: 5,
      }}
    />
  );
}
