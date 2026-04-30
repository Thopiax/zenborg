import type { HeatmapBand } from "@/infrastructure/state/bandedHeatmapViewModel";
import { BAND_SIDE_INSET, HAIR_COLOR, STRIDE } from "./constants";

interface BandedHeatmapBandProps {
  band: HeatmapBand;
}

export function BandedHeatmapBand({ band }: BandedHeatmapBandProps) {
  const left = band.startIndex * STRIDE + BAND_SIDE_INSET;
  const width =
    (band.endIndex - band.startIndex + 1) * STRIDE - 2 + Math.abs(BAND_SIDE_INSET) * 2;

  const isActive = band.tense === "active";
  const borderColor = isActive ? "var(--zb-ink, #2a251f)" : HAIR_COLOR;
  const background = isActive ? "var(--zb-paper, #faf8f5)" : "transparent";
  const boxShadow = isActive ? "0 1px 0 rgba(42,37,31,.04)" : undefined;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left,
        width,
        borderLeft: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        background,
        boxShadow,
        pointerEvents: "none",
      }}
    />
  );
}
