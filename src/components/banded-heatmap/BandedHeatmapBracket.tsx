import type { HeatmapBand } from "@/infrastructure/state/bandedHeatmapViewModel";
import { BAND_SIDE_INSET, BRACKET_HEIGHT, HAIR_COLOR, STRIDE } from "./constants";

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
    (band.endIndex - band.startIndex + 1) * STRIDE - 2 + Math.abs(BAND_SIDE_INSET) * 2;

  const tenseStyle: React.CSSProperties = (() => {
    switch (band.tense) {
      case "active":
        return {
          color: "var(--zb-ink, #2a251f)",
          fontWeight: 600,
          borderBottomColor: "var(--zb-ink, #2a251f)",
        };
      case "past":
        return {
          color: "rgba(42, 37, 31, 0.55)",
          opacity: 0.55,
          borderBottomColor: HAIR_COLOR,
        };
      case "future":
        return {
          color: "rgba(42, 37, 31, 0.55)",
          fontStyle: "italic",
          borderBottomColor: HAIR_COLOR,
        };
    }
  })();

  return (
    <button
      type="button"
      onClick={() => onSelect?.(band.cycleId)}
      style={{
        position: "absolute",
        top: 0,
        height: BRACKET_HEIGHT,
        left,
        width,
        fontSize: 9,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "flex",
        alignItems: "center",
        padding: "0 5px",
        borderBottom: "1px solid",
        background: "transparent",
        cursor: onSelect ? "pointer" : "default",
        textAlign: "left",
        ...tenseStyle,
      }}
    >
      {band.name}
    </button>
  );
}
