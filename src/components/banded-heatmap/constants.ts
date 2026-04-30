export const CELL_SIZE = 14;
export const CELL_GAP = 2;
export const STRIDE = CELL_SIZE + CELL_GAP;
export const ROW_GAP = 2;
export const ROW_HEIGHT = CELL_SIZE;
export const GRID_HEIGHT_3 = ROW_HEIGHT * 3 + ROW_GAP * 2;
export const GRID_HEIGHT_4 = ROW_HEIGHT * 4 + ROW_GAP * 3;
export const GUTTER_WIDTH = 48;
export const HEATMAP_HEIGHT = 160;
export const BRACKET_HEIGHT = 16;
export const AXIS_HEIGHT = 24;
export const HEADER_HEIGHT = 22;
export const BAND_SIDE_INSET = -3;
export const NEEDLE_WIDTH = 16;

export const NOW_COLOR = "oklch(0.55 0.14 25)";
export const NOW_FILL = "rgba(197, 90, 47, 0.04)";
export const HAIR_COLOR = "rgba(42, 37, 31, 0.1)";
export const FAINT_COLOR = "rgba(42, 37, 31, 0.28)";
export const FALLOW_BG = "rgba(42, 37, 31, 0.06)";

export const TENSE_OPACITY = {
  past: 0.55,
  active: 1,
  future: 0.7,
} as const;
