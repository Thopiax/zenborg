"use client";

/**
 * PWA utility functions for detecting installation status and prompting installation
 */

/**
 * Check if the app is running as an installed PWA
 * Works on both iOS and other platforms
 */
export function isPWA(): boolean {
  if (typeof window === "undefined") return false;

  // Check if running in standalone mode (iOS and others)
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

  // iOS-specific check
  const isIOSStandalone =
    "standalone" in window.navigator &&
    (window.navigator as any).standalone === true;

  return isStandalone || isIOSStandalone;
}

/**
 * Check if the device is mobile (iOS or Android)
 */
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android/.test(userAgent);
}

/**
 * Check if the device is iOS
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

/**
 * Check if the device is Android
 */
export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /android/.test(userAgent);
}

/**
 * Check if device is in landscape orientation
 */
export function isLandscape(): boolean {
  if (typeof window === "undefined") return false;

  return window.innerWidth > window.innerHeight;
}

/**
 * Get platform-specific PWA installation instructions
 */
export function getPWAInstructions(): {
  platform: "ios" | "android" | "desktop" | "unknown";
  canShowInstallPrompt: boolean;
  instructions: string[];
} {
  if (typeof window === "undefined") {
    return {
      platform: "unknown",
      canShowInstallPrompt: false,
      instructions: [],
    };
  }

  if (isIOS()) {
    return {
      platform: "ios",
      canShowInstallPrompt: false, // iOS doesn't support beforeinstallprompt
      instructions: [
        'Tap the "Share" button at the bottom of Safari',
        'Scroll down and tap "Add to Home Screen"',
        'Tap "Add" in the top right corner',
        "Open Zenborg from your home screen",
      ],
    };
  }

  if (isAndroid()) {
    return {
      platform: "android",
      canShowInstallPrompt: true, // Android Chrome supports beforeinstallprompt
      instructions: [
        "Tap the menu button (⋮) in your browser",
        'Tap "Add to Home screen" or "Install app"',
        'Tap "Install" to confirm',
        "Open Zenborg from your home screen",
      ],
    };
  }

  // Desktop or unknown
  return {
    platform: "desktop",
    canShowInstallPrompt: true,
    instructions: [
      "Click the install icon in your browser address bar",
      'Or use the browser menu: "Install Zenborg..."',
      "Confirm the installation",
      "Launch Zenborg as a standalone app",
    ],
  };
}

/**
 * Check if we should show the PWA install prompt
 * Show if: mobile + landscape + not already installed
 */
export function shouldShowPWAPrompt(): boolean {
  if (typeof window === "undefined") return false;

  return isMobile() && isLandscape() && !isPWA();
}

/**
 * Store that the user has dismissed the PWA prompt
 */
export function dismissPWAPrompt(): void {
  if (typeof window === "undefined") return;

  localStorage.setItem("zenborg-pwa-prompt-dismissed", "true");
}

/**
 * Check if user has previously dismissed the PWA prompt
 */
export function hasDismissedPWAPrompt(): boolean {
  if (typeof window === "undefined") return false;

  return localStorage.getItem("zenborg-pwa-prompt-dismissed") === "true";
}

/**
 * Reset the dismissed state (useful for testing or settings)
 */
export function resetPWAPromptDismissal(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem("zenborg-pwa-prompt-dismissed");
}
