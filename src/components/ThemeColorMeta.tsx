"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/**
 * ThemeColorMeta - Dynamically updates theme-color for manual theme changes
 *
 * Server-side meta tags with media queries (in layout.tsx) handle system
 * preference automatically. This component ensures the general theme-color
 * tag stays in sync when users manually toggle between themes.
 *
 * Essential for iOS Safari status bar and Android nav bar colors.
 */
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Only update if theme has actually resolved (not undefined)
    if (!resolvedTheme) return;

    const color = resolvedTheme === "dark" ? "#1c1917" : "#fafaf9"; // stone-900 : stone-50

    // Update or create general theme-color meta tag for browsers without media query support
    // and to override when user manually changes theme
    let generalThemeMeta = document.querySelector('meta[name="theme-color"]:not([media])');

    if (!generalThemeMeta) {
      generalThemeMeta = document.createElement("meta");
      generalThemeMeta.setAttribute("name", "theme-color");
      document.head.appendChild(generalThemeMeta);
    }

    generalThemeMeta.setAttribute("content", color);

    // Update iOS status bar style for PWA
    let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');

    if (!appleStatusBar) {
      appleStatusBar = document.createElement("meta");
      appleStatusBar.setAttribute("name", "apple-mobile-web-app-status-bar-style");
      document.head.appendChild(appleStatusBar);
    }

    // Use default for light, black-translucent for dark (better contrast)
    const statusBarStyle = resolvedTheme === "dark" ? "black-translucent" : "default";
    appleStatusBar.setAttribute("content", statusBarStyle);
  }, [resolvedTheme]);

  return null;
}
