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
 * Focus Ring Styles
 * Consistent purple focus indicator for all states
 */
export const focusRing = {
  // All focus states use consistent purple
  default: {
    ring: "ring-2",
    offset: "ring-offset-2",
    color: "ring-purple-500 dark:ring-purple-400",
  },

  // Kept for backward compatibility - all use same purple
  insert: {
    ring: "ring-2",
    offset: "ring-offset-2",
    color: "ring-purple-500 dark:ring-purple-400",
  },

  normal: {
    ring: "ring-2",
    offset: "ring-offset-2",
    color: "ring-purple-500 dark:ring-purple-400",
  },

  cell: {
    ring: "ring-2",
    offset: "ring-offset-2",
    color: "ring-purple-500 dark:ring-purple-400",
  },
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
  vimIndicator: 60, // Vim mode indicator (always on top)
  commandLine: 60, // Command line (always on top)
} as const;

/**
 * Grid Layout
 * Desktop timeline configuration
 */
export const grid = {
  desktop: {
    columns: "grid-cols-[auto_1fr_1fr_1fr]", // [phase labels, yesterday, today, tomorrow]
    gap: "gap-4", // 16px between cells
    minCellHeight: "min-h-[180px]", // Enough for 3 moments
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
 * Helper: Get focus ring classes based on mode
 */
export function getFocusRingClasses(
  mode: "default" | "insert" | "normal" | "cell" = "default",
): string {
  const ring = focusRing[mode];
  return `${ring.ring} ${ring.offset} ${ring.color}`;
}

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
