import { CELL_SIZE, NEEDLE_WIDTH, NOW_COLOR, NOW_FILL, STRIDE } from "./constants";

interface BandedHeatmapNeedleProps {
  todayIndex: number;
}

export function BandedHeatmapNeedle({ todayIndex }: BandedHeatmapNeedleProps) {
  if (todayIndex < 0) return null;
  const left = todayIndex * STRIDE - (NEEDLE_WIDTH - CELL_SIZE) / 2;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left,
        width: NEEDLE_WIDTH,
        border: `1px solid ${NOW_COLOR}`,
        background: NOW_FILL,
        zIndex: 3,
        pointerEvents: "none",
      }}
    />
  );
}
