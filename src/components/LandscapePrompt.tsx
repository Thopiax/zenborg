"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * LandscapePrompt - Overlay that prompts users to rotate to landscape mode on mobile
 *
 * Shows when:
 * - Device is iOS mobile (iPhone/iPod)
 * - Device is in portrait orientation
 *
 * Design:
 * - Full-screen overlay with monochrome design
 * - Animated phone rotation icon
 * - Clear instruction text
 * - Only shows on iOS mobile portrait mode
 */
export function LandscapePrompt() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check if device is iOS mobile (iPhone or iPod, not iPad)
    const isIOSMobile = () => {
      const ua = navigator.userAgent;
      // Check for iPhone or iPod (exclude iPad)
      return /iPhone|iPod/.test(ua);
    };

    const checkOrientation = () => {
      const isMobile = isIOSMobile();
      const isPortrait = window.innerHeight > window.innerWidth;
      setShouldShow(isMobile && isPortrait);
    };

    // Check on mount
    checkOrientation();

    // Listen for orientation and resize changes
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="flex flex-col items-center gap-8 px-6 text-center">
        {/* Animated rotation icon */}
        <div className="animate-[spin_3s_ease-in-out_infinite]">
          <RotateCw className="w-16 h-16 text-stone-900 dark:text-stone-100" />
        </div>

        {/* Instruction text */}
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
            Rotate Your Device
          </h2>
          <p className="text-base text-stone-600 dark:text-stone-400 max-w-sm">
            Zenborg works best in landscape mode for a better timeline view
          </p>
        </div>
      </div>
    </div>
  );
}
