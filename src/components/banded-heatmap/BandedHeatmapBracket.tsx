import type { HeatmapBand } from "@/infrastructure/state/bandedHeatmapViewModel";
import { BAND_SIDE_INSET, BRACKET_HEIGHT, STRIDE } from "./constants";

interface BandedHeatmapBracketProps {
  band: HeatmapBand;
  onSelect?: (cycleId: string) => void;
}

export function BandedHeatmapBracket({
  band,
  onSelect,
}: BandedHeatmapBracketProps) {
  const left = band.startIndex * STRIDE + BAND_SIDE_INSET;
  const width =
    (band.endIndex - band.startIndex + 1) * STRIDE -
    2 +
    Math.abs(BAND_SIDE_INSET) * 2;

  const tenseClass = (() => {
    switch (band.tense) {
      case "active":
        return "text-stone-900 dark:text-stone-100 font-semibold border-stone-700 dark:border-stone-300";
      case "past":
        return "text-stone-500 dark:text-stone-500 opacity-60 border-stone-300/60 dark:border-stone-700/60";
      case "future":
        return "text-stone-500 dark:text-stone-500 italic border-stone-300/60 dark:border-stone-700/60";
    }
  })();

  return (
    <button
      type="button"
      onClick={() => onSelect?.(band.cycleId)}
      className={`absolute top-0 flex items-center px-1.5 text-[9px] tracking-[0.04em] font-mono whitespace-nowrap overflow-hidden text-ellipsis bg-transparent text-left border-b ${tenseClass} ${onSelect ? "cursor-pointer hover:opacity-100" : "cursor-default"}`}
      style={{ left, width, height: BRACKET_HEIGHT }}
    >
      {band.name}
    </button>
  );
}
