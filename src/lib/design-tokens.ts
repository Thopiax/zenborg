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
 * Includes fluid sizing with clamp() for responsive design
 */
export const typography = {
  // Moment names
  moment: {
    size: "1.25rem", // 20px (fixed for now, consider fluid in Phase 4)
    weight: "600", // semibold
    lineHeight: "1.75rem", // 28px
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

  // Fluid typography (Phase 4 - ready for implementation)
  fluid: {
    moment: "clamp(1.125rem, 2.5vw, 1.5rem)", // 18-24px
    dayLabel: "clamp(1.5rem, 4vw, 2rem)", // 24-32px
    phase: "clamp(0.875rem, 2vw, 1.125rem)", // 14-18px
    hero: "clamp(2rem, 8svw, 5rem)", // For future compass view
  },
} as const;

/**
 * Border Radius
 * Consistent rounding across components
 */
export const borderRadius = {
  none: "0", // default: square (sections, cells, grid matrices)
  sm: "0.125rem", // 2px - inline code, focus outlines
  md: "0.25rem", // 4px - the ceiling (moment cards, buttons)
  lg: "0.25rem", // 4px - alias; nothing rounds further
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
 * Animation Durations & Easing
 * Physics-based easing for natural, organic motion
 */
export const animation = {
  // Durations
  fast: "150ms", // Quick interactions (hover, focus)
  medium: "400ms", // Component transitions (expand, reveal)
  slow: "600ms", // Page transitions (modals, views)

  // Easing curves (physics-based). Two curves only: the exaggerated bounce
  // was cut, it is playful in a way the system is not. See ../../../DESIGN.md.
  elastic: "cubic-bezier(.25, 1, .5, 1)", // Settle with overshoot - for entering, hover, expand
  smooth: "cubic-bezier(.4, 0, .2, 1)", // Standard ease - for exits, fades

  // CSS variable references
  cssVars: {
    durationFast: "var(--duration-fast)",
    durationMedium: "var(--duration-medium)",
    durationSlow: "var(--duration-slow)",
    easeElastic: "var(--ease-elastic)",
    easeSmooth: "var(--ease-smooth)",
  },
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
 * Elevation
 *
 * The system is flat at rest, everywhere. No shadow, no gradient, no blur,
 * no glassmorphism. Depth comes from hairline rules, 1px grid gaps, and tonal
 * steps in the stone ramp. See ../../../DESIGN.md, "Elevation & Depth".
 *
 * The single exception is response to a hand: a draggable element may lift
 * (-2px translate on the elastic curve) while the cursor or finger is on it.
 * That lift is motion and geometry, never an ambient shadow.
 */
export const elevation = {
  rest: "shadow-none",
  /** The One Lift. Applied on hover only, on genuinely movable elements. */
  lift: "hover:-translate-y-0.5",
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
 * Column Width
 * Single source of truth for all column/card widths across the app.
 * Cards are always w-full inside these columns.
 *
 * Mobile: full-width (w-full) — fills the available space
 * Desktop (md+): fixed rem-based width for predictable grid
 *
 * rem-based so it scales with user font-size preferences (accessibility).
 * 20rem = 320px at default 16px base, 22.5rem = 360px.
 */
export const columnWidth = {
  base: "20rem", // 320px — mobile and default
  md: "22.5rem", // 360px — md breakpoint and above
  /** Tailwind class for column containers: full-width on mobile, fixed on desktop */
  className: "w-full md:w-[22.5rem]",
  /** Tailwind class with flex-shrink-0 for scrollable contexts */
  scrollableClassName: "w-full md:w-[22.5rem] md:flex-shrink-0",
} as const;

/**
 * Moment Card Dimensions
 * Optimized for 3 cards to fit vertically in timeline cells
 */
const MOMENT_CARD_HEIGHT_PX = 64;
const MOMENT_CARD_GAP_PX = 12;

export const momentCard = {
  // Card height: 64px per card (3 cards = 192px + 2 gaps = ~216px total)
  minHeight: `${MOMENT_CARD_HEIGHT_PX}px`,
  // Spacing between cards in a cell
  gap: `${MOMENT_CARD_GAP_PX}px`,
  // Padding inside card
  paddingX: "16px", // 1rem
  paddingY: "12px", // 0.75rem
} as const;

/**
 * Timeline Cell Viewport
 *
 * A cell is exactly three moment slots tall, always. That height is a display
 * affordance, not a capacity: a fourth moment scrolls inside the cell rather
 * than stretching the row and breaking the day's alignment.
 */
const PEEK_HEIGHT_PX = 10;

export const timelineCell = {
  visibleSlots: 3,
  viewportHeight: `${MOMENT_CARD_HEIGHT_PX * 3 + MOMENT_CARD_GAP_PX * 2}px`,
  /** Shows a sliver of the next card so the user sees there's more to scroll. */
  viewportHeightWithPeek: `${MOMENT_CARD_HEIGHT_PX * 3 + MOMENT_CARD_GAP_PX * 3 + PEEK_HEIGHT_PX}px`,
} as const;

/**
 * Phase Backgrounds
 * Slate-based gradients for timeline cells
 * Progressive gradient - gets darker as the day progresses
 * Light: 100 → 400 (lighter to darker)
 * Dark: 500 → 800 (lighter to darker)
 */
export const phaseBackgrounds: Record<number, string> = {
  0: "bg-stone-100 dark:bg-stone-700",
  1: "bg-stone-200 dark:bg-stone-800",
  2: "bg-stone-300 dark:bg-stone-900",
  3: "bg-stone-400 dark:bg-stone-950",
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
export function getTextColorForBackground(hexColor?: string): "white" | "dark" {
  // Safety check for undefined/null
  if (!hexColor) {
    console.warn(
      "getTextColorForBackground called with undefined color - using white text as fallback",
    );
    return "white";
  }

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
export function getTextColorsForBackground(hexColor?: string): {
  primary: string;
  secondary: string;
  tertiary: string;
  placeholder: string;
} {
  if (!hexColor) {
    // Default to dark text if no color provided
    return {
      primary: "text-stone-900 dark:text-stone-900",
      secondary: "text-stone-700 dark:text-stone-700",
      tertiary: "text-stone-600 dark:text-stone-600",
      placeholder: "placeholder:text-stone-500 dark:placeholder:text-stone-500",
    };
  }

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
