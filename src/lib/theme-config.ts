/**
 * Theme Configuration
 *
 * Centralized color variables for light/dark themes
 * Supports the Zenborg design philosophy:
 * - Monochromatic base with phase/area color accents
 * - Vim-inspired clean aesthetic
 * - High contrast for accessibility
 */

export const themeConfig = {
  light: {
    // Base colors (monochromatic)
    base: {
      background: "#fafaf9", // stone-50 - primary background
      surface: "#ffffff", // white - cards, elevated elements
      surfaceAlt: "#f5f5f4", // stone-100 - alternate surface
      border: "#e7e5e4", // stone-200 - borders, dividers
      text: {
        primary: "#1c1917", // stone-900 - primary text
        secondary: "#57534e", // stone-600 - secondary text
        tertiary: "#78716c", // stone-500 - disabled, hints
      },
    },

    // Vim mode indicator
    vim: {
      background: "#1c1917", // stone-900 - mode indicator bg
      text: "#fafaf9", // stone-50 - mode indicator text
    },

    // Focus states (mode-specific)
    focus: {
      default: "#3b82f6", // blue-500 - general focus
      insert: "#f59e0b", // amber-500 - INSERT mode
      normal: "#a855f7", // purple-500 - NORMAL mode navigation
      cell: "#8b5cf6", // violet-500 - timeline cell focus
    },

    // Phase colors (as accents, NOT backgrounds)
    phase: {
      morning: {
        color: "#f59e0b", // amber-500
        tint: "rgba(245, 158, 11, 0.10)", // 10% opacity for subtle backgrounds
        gradient: "rgba(245, 158, 11, 0.05)", // 5% for gradients
      },
      afternoon: {
        color: "#eab308", // yellow-500
        tint: "rgba(234, 179, 8, 0.10)",
        gradient: "rgba(234, 179, 8, 0.05)",
      },
      evening: {
        color: "#8b5cf6", // purple-500
        tint: "rgba(139, 92, 246, 0.10)",
        gradient: "rgba(139, 92, 246, 0.05)",
      },
      night: {
        color: "#1e293b", // slate-800
        tint: "rgba(30, 41, 59, 0.10)",
        gradient: "rgba(30, 41, 59, 0.05)",
      },
    },

    // Area colors (default areas - user can customize)
    area: {
      wellness: "#10b981", // emerald-500
      craft: "#3b82f6", // blue-500
      social: "#f97316", // orange-500
      joyful: "#eab308", // yellow-500
      introspective: "#6b7280", // gray-500
    },

    // State colors
    state: {
      error: "#ef4444", // red-500
      warning: "#f59e0b", // amber-500
      success: "#10b981", // emerald-500
      info: "#3b82f6", // blue-500
    },
  },

  dark: {
    // Base colors (monochromatic dark)
    base: {
      background: "#0c0a09", // stone-950 - primary background
      surface: "#1c1917", // stone-900 - cards, elevated elements
      surfaceAlt: "#292524", // stone-800 - alternate surface
      border: "#44403c", // stone-700 - borders, dividers
      text: {
        primary: "#fafaf9", // stone-50 - primary text
        secondary: "#d6d3d1", // stone-300 - secondary text
        tertiary: "#a8a29e", // stone-400 - disabled, hints
      },
    },

    // Vim mode indicator
    vim: {
      background: "#fafaf9", // stone-50 - mode indicator bg (inverted)
      text: "#1c1917", // stone-900 - mode indicator text (inverted)
    },

    // Focus states (mode-specific, slightly brighter for dark)
    focus: {
      default: "#60a5fa", // blue-400 - general focus
      insert: "#fbbf24", // amber-400 - INSERT mode
      normal: "#c084fc", // purple-400 - NORMAL mode navigation
      cell: "#a78bfa", // violet-400 - timeline cell focus
    },

    // Phase colors (slightly brighter for dark mode visibility)
    phase: {
      morning: {
        color: "#fbbf24", // amber-400 (brighter)
        tint: "rgba(251, 191, 36, 0.15)", // 15% opacity for better visibility
        gradient: "rgba(251, 191, 36, 0.08)",
      },
      afternoon: {
        color: "#facc15", // yellow-400 (brighter)
        tint: "rgba(250, 204, 21, 0.15)",
        gradient: "rgba(250, 204, 21, 0.08)",
      },
      evening: {
        color: "#a78bfa", // purple-400 (brighter)
        tint: "rgba(167, 139, 250, 0.15)",
        gradient: "rgba(167, 139, 250, 0.08)",
      },
      night: {
        color: "#475569", // slate-600 (brighter than 800)
        tint: "rgba(71, 85, 105, 0.15)",
        gradient: "rgba(71, 85, 105, 0.08)",
      },
    },

    // Area colors (slightly brighter for dark mode)
    area: {
      wellness: "#34d399", // emerald-400
      craft: "#60a5fa", // blue-400
      social: "#fb923c", // orange-400
      joyful: "#facc15", // yellow-400
      introspective: "#9ca3af", // gray-400
    },

    // State colors (brighter for dark)
    state: {
      error: "#f87171", // red-400
      warning: "#fbbf24", // amber-400
      success: "#34d399", // emerald-400
      info: "#60a5fa", // blue-400
    },
  },
} as const;

/**
 * Helper to get current theme colors
 * Use with next-themes useTheme hook
 */
export function getThemeColors(theme: "light" | "dark" | "system" = "light") {
  // If system, default to light (browser will handle via CSS)
  return themeConfig[theme === "system" ? "light" : theme];
}

/**
 * CSS custom properties for dynamic theme switching
 * These should be injected into :root and [data-theme="dark"]
 */
export const cssVariables = {
  light: {
    "--color-background": themeConfig.light.base.background,
    "--color-surface": themeConfig.light.base.surface,
    "--color-surface-alt": themeConfig.light.base.surfaceAlt,
    "--color-border": themeConfig.light.base.border,
    "--color-text-primary": themeConfig.light.base.text.primary,
    "--color-text-secondary": themeConfig.light.base.text.secondary,
    "--color-text-tertiary": themeConfig.light.base.text.tertiary,
    "--color-vim-bg": themeConfig.light.vim.background,
    "--color-vim-text": themeConfig.light.vim.text,
    "--color-focus-default": themeConfig.light.focus.default,
    "--color-focus-insert": themeConfig.light.focus.insert,
    "--color-focus-normal": themeConfig.light.focus.normal,
    "--color-focus-cell": themeConfig.light.focus.cell,
  },
  dark: {
    "--color-background": themeConfig.dark.base.background,
    "--color-surface": themeConfig.dark.base.surface,
    "--color-surface-alt": themeConfig.dark.base.surfaceAlt,
    "--color-border": themeConfig.dark.base.border,
    "--color-text-primary": themeConfig.dark.base.text.primary,
    "--color-text-secondary": themeConfig.dark.base.text.secondary,
    "--color-text-tertiary": themeConfig.dark.base.text.tertiary,
    "--color-vim-bg": themeConfig.dark.vim.background,
    "--color-vim-text": themeConfig.dark.vim.text,
    "--color-focus-default": themeConfig.dark.focus.default,
    "--color-focus-insert": themeConfig.dark.focus.insert,
    "--color-focus-normal": themeConfig.dark.focus.normal,
    "--color-focus-cell": themeConfig.dark.focus.cell,
  },
};
