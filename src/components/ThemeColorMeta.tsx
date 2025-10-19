"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/**
 * ThemeColorMeta - Dynamically updates theme-color meta tag
 *
 * Updates the browser/PWA chrome colors based on active theme.
 * Essential for iOS Safari status bar and Android nav bar colors.
 */
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Get the meta tag or create it if it doesn't exist
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }

    // Update theme-color based on resolved theme
    const color = resolvedTheme === "dark" ? "#1c1917" : "#fafaf9"; // stone-900 : stone-50
    metaThemeColor.setAttribute("content", color);

    // Update iOS status bar style
    let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');

    if (!appleStatusBar) {
      appleStatusBar = document.createElement("meta");
      appleStatusBar.setAttribute("name", "apple-mobile-web-app-status-bar-style");
      document.head.appendChild(appleStatusBar);
    }

    // black-translucent works better with dark mode, default with light
    const statusBarStyle = resolvedTheme === "dark" ? "black-translucent" : "default";
    appleStatusBar.setAttribute("content", statusBarStyle);
  }, [resolvedTheme]);

  return null; // This component doesn't render anything
}
