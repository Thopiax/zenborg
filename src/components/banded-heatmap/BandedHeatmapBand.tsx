import type { HeatmapBand } from "@/infrastructure/state/bandedHeatmapViewModel";
import { BAND_SIDE_INSET, STRIDE } from "./constants";

interface BandedHeatmapBandProps {
  band: HeatmapBand;
}

export function BandedHeatmapBand({ band }: BandedHeatmapBandProps) {
  const left = band.startIndex * STRIDE + BAND_SIDE_INSET;
  const width =
    (band.endIndex - band.startIndex + 1) * STRIDE -
    2 +
    Math.abs(BAND_SIDE_INSET) * 2;

  const isActive = band.tense === "active";
  const className = isActive
    ? "absolute top-0 bottom-0 bg-white dark:bg-stone-800 border-l border-r border-stone-700 dark:border-stone-300 shadow-[0_1px_0_rgba(0,0,0,0.04)] pointer-events-none"
    : "absolute top-0 bottom-0 bg-transparent border-l border-r border-stone-300/60 dark:border-stone-700/60 pointer-events-none";

  return <div className={className} style={{ left, width }} />;
}
