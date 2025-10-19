/**
 * Design Tokens
 *
 * Standardized design constants for the Zenborg UI
 * - Spacing, sizing, typography
 * - Touch targets (WCAG 2.1 AA compliant)
 * - Focus ring styles
 * - Animation durations
 */

/**
 * Spacing Scale
 * Based on Tailwind's spacing system (4px base unit)
 */
export const spacing = {
  xs: "0.5rem", // 8px
  sm: "0.75rem", // 12px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 48px
  "3xl": "4rem", // 64px
} as const;

/**
 * Touch Target Sizes
 * WCAG 2.1 AA requires minimum 44x44px for interactive elements
 */
export const touchTarget = {
  min: "44px", // Minimum touch target (WCAG AA)
  comfortable: "48px", // Comfortable touch target
  large: "56px", // Large touch target (moment cards)
} as const;

/**
 * Typography Scale
 * Optimized for readability and hierarchy
 */
export const typography = {
  // Moment names
  moment: {
    size: "1.25rem", // 20px
    weight: "600", // semibold
    lineHeight: "1.75rem", // 28px
    family: "var(--font-mono)", // monospace for Vim feel
  },

  // Phase labels
  phase: {
    size: "1rem", // 16px
    weight: "500", // medium
    lineHeight: "1.5rem", // 24px
    family: "inherit", // system font
  },

  // Command line / Vim mode indicator
  command: {
    size: "0.875rem", // 14px
    weight: "400", // normal
    lineHeight: "1.25rem", // 20px
    family: "var(--font-mono)", // monospace
  },

  // Body text / labels
  body: {
    size: "0.875rem", // 14px
    weight: "500", // medium
    lineHeight: "1.25rem", // 20px
    family: "inherit",
  },

  // Small text / hints
  small: {
    size: "0.75rem", // 12px
    weight: "400", // normal
    lineHeight: "1rem", // 16px
    family: "inherit",
  },
} as const;

/**
 * Border Radius
 * Consistent rounding across components
 */
export const borderRadius = {
  sm: "0.375rem", // 6px - small elements
  md: "0.5rem", // 8px - standard (moment cards, buttons)
  lg: "0.75rem", // 12px - larger containers
  full: "9999px", // pill shape (vim mode indicator)
} as const;

/**
 * Border Widths
 * Focus rings and component borders
 */
export const borderWidth = {
  thin: "1px", // subtle borders
  default: "2px", // standard (moment card borders)
  thick: "3px", // emphasis
  focusRing: "2px", // focus indicator
  accentBorder: "4px", // phase header left border accent
} as const;

/**
 * Animation Durations
 * Smooth, but not sluggish
 */
export const animation = {
  fast: "150ms", // Quick interactions (hover, focus)
  normal: "250ms", // Standard transitions
  slow: "350ms", // Deliberate animations (modals)
  easing: "cubic-bezier(0.4, 0, 0.2, 1)", // ease-in-out
} as const;

/**
 * Z-Index Layers
 * Consistent stacking order
 */
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30, // CompassView, AreaManager
  modal: 40, // Dialogs
  popover: 50, // Tooltips
  dragOverlay: 60,
  commandLine: 60, // Command line (always on top)
} as const;

/**
 * Grid Layout
 * Desktop timeline configuration
 */
export const grid = {
  desktop: {
    columns: "grid-cols-[48px_1fr_1fr_1fr]", // [phase labels (48px), yesterday, today, tomorrow (equal)]
    gap: "gap-4", // 16px between cells
    minCellHeight: "min-h-[240px]", // Fits 3 moments: 3×64px + 2×12px gap + padding
    rowGap: "space-y-4", // 16px between phase rows
  },
  tablet: {
    columns: "grid-cols-3", // [yesterday, today, tomorrow] - no phase labels column for more space
    gap: "gap-3", // 12px between cells
    minCellHeight: "min-h-[200px]", // Slightly shorter for iPad
    rowGap: "space-y-3", // 12px between phase rows
  },
  mobile: {
    gap: "gap-3", // 12px between sections
  },
} as const;

/**
 * Breakpoints
 * Responsive design thresholds
 */
export const breakpoints = {
  mobile: "640px", // sm
  tablet: "768px", // md - switch from single-day to 3-day grid
  tabletLarge: "900px", // xl - optimized for iPad Air/Pro 11" (744px portrait, 1194px landscape)
  desktop: "1024px", // lg
  wide: "1280px", // xl
} as const;

/**
 * Shadow Styles
 * Minimal shadows for flat design
 */
export const shadows = {
  none: "shadow-none",
  subtle: "shadow-sm", // Very subtle elevation
  card: "shadow-md", // Card elevation (sparingly used)
} as const;

/**
 * Moment Card Constraints
 * Business rule constants
 */
export const momentConstraints = {
  maxWordsInName: 3,
  maxMomentsPerCell: 3,
  minNameLength: 1,
  maxNameLength: 50, // Characters (rough estimate for 3 words)
} as const;

/**
 * Moment Card Dimensions
 * Optimized for 3 cards to fit vertically in timeline cells
 */
export const momentCard = {
  // Card height: 64px per card (3 cards = 192px + 2 gaps = ~220px total)
  minHeight: "64px",
  // Spacing between cards in a cell
  gap: "12px", // 3 gaps of 12px = 36px
  // Padding inside card
  paddingX: "16px", // 1rem
  paddingY: "12px", // 0.75rem
} as const;

/**
 * Phase Backgrounds
 * Slate-based gradients for timeline cells
 * Progressive gradient - gets darker as the day progresses
 * Light: 100 → 400 (lighter to darker)
 * Dark: 500 → 800 (lighter to darker)
 */
export const phaseBackgrounds: Record<number, string> = {
  0: "bg-gray-100 dark:bg-gray-700",
  1: "bg-gray-200 dark:bg-gray-800",
  2: "bg-gray-300 dark:bg-gray-900",
  3: "bg-gray-400 dark:bg-gray-950",
} as const;

/**
 * Phase Configuration
 * Default time boundaries
 */
export const defaultPhaseHours = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 18 },
  evening: { start: 18, end: 22 },
  night: { start: 22, end: 6 }, // Wraps to next day
} as const;

/**
 * Keyboard Shortcuts
 * Documentation for users
 */
export const keyboardShortcuts = {
  navigation: {
    hjkl: "Navigate grid (left/down/up/right)",
    gg: "Jump to first moment",
    G: "Jump to last moment",
    w: "Next moment",
    b: "Previous moment",
  },
  modes: {
    i: "Enter INSERT mode (create/edit)",
    ":": "Enter COMMAND mode",
    Esc: "Exit to NORMAL mode",
  },
  actions: {
    dd: "Delete moment",
    yy: "Yank (duplicate) moment",
    p: "Put (paste) yanked moment",
    x: "Quick delete (unallocated only)",
  },
  commands: {
    ":ty1": "Allocate to Today, phase 1 (Morning)",
    ":wy3": "Allocate to Tomorrow, phase 3 (Evening)",
    ":d": "Unallocate moment",
    ":area": "Manage areas",
    ":settings": "Configure phases",
  },
  view: {
    "Ctrl+/": "Toggle compass view",
  },
} as const;

/**
 * Accessibility Labels
 * Standard ARIA label patterns
 */
export const ariaLabels = {
  timeline: "Timeline - organize your moments",
  drawingBoard: "Drawing Board - unallocated moments",
  compass: "Compass View - current moment",
  vimMode: "Vim mode indicator",
  commandLine: "Command input",
  momentCard: (name: string, area: string) =>
    `${name} in ${area} area, press i to edit`,
  timelineCell: (day: string, phase: string, count: number, max: number) =>
    `${day} ${phase}, ${count} of ${max} moments allocated`,
  daySelector: "Day selector - navigate between days",
} as const;

/**
 * Helper: Validate moment name word count
 */
export function validateMomentName(name: string): {
  isValid: boolean;
  wordCount: number;
  error?: string;
} {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      wordCount: 0,
      error: "Moment name cannot be empty",
    };
  }

  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  if (wordCount > momentConstraints.maxWordsInName) {
    return {
      isValid: false,
      wordCount,
      error: `Maximum ${momentConstraints.maxWordsInName} words allowed`,
    };
  }

  return {
    isValid: true,
    wordCount,
  };
}

/**
 * Helper: Format word count indicator
 */
export function formatWordCount(wordCount: number): string {
  const max = momentConstraints.maxWordsInName;
  return `${wordCount}/${max} words`;
}

/**
 * Helper: Get accessible text color for colored background
 * Calculates relative luminance and returns white or dark text for WCAG AA compliance
 *
 * @param hexColor - Background color in hex format (e.g., "#10b981")
 * @returns "white" or "dark" text color class
 */
export function getTextColorForBackground(hexColor: string): "white" | "dark" {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Convert to RGB
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);

  // Calculate relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white text for dark backgrounds, dark text for light backgrounds
  // Threshold: 0.5 (adjust if needed for better contrast)
  return luminance > 0.5 ? "dark" : "white";
}

/**
 * Helper: Get Tailwind text color classes for a colored background
 * Returns appropriate text colors with opacity variants for hierarchy
 *
 * @param hexColor - Background color in hex format
 * @returns Object with primary, secondary, and tertiary text color classes
 */
export function getTextColorsForBackground(hexColor: string): {
  primary: string;
  secondary: string;
  tertiary: string;
  placeholder: string;
} {
  const textColor = getTextColorForBackground(hexColor);

  if (textColor === "white") {
    return {
      primary: "text-white",
      secondary: "text-white/80",
      tertiary: "text-white/60",
      placeholder: "placeholder:text-white/40",
    };
  }

  return {
    primary: "text-stone-900 dark:text-stone-900",
    secondary: "text-stone-700 dark:text-stone-700",
    tertiary: "text-stone-600 dark:text-stone-600",
    placeholder: "placeholder:text-stone-500 dark:placeholder:text-stone-500",
  };
}
