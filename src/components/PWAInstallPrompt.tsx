"use client";

import { Download, RotateCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  dismissPWAPrompt,
  getPWAInstructions,
  hasDismissedPWAPrompt,
  isIOS,
  shouldShowPWAPrompt,
} from "@/lib/pwa-utils";

/**
 * PWAInstallPrompt - Persuasive overlay prompting users to install as PWA
 *
 * Shows when:
 * - Mobile device in landscape orientation
 * - Not already installed as PWA
 * - User hasn't dismissed it before
 *
 * Design:
 * - Beautiful, persuasive UI
 * - Platform-specific instructions (iOS vs Android)
 * - Can be dismissed (saved to localStorage)
 * - Monochrome stone design matching Zenborg aesthetic
 */
export function PWAInstallPrompt() {
  const [shouldShow, setShouldShow] = useState(false);
  const [instructions, setInstructions] = useState<{
    platform: "ios" | "android" | "desktop" | "unknown";
    instructions: string[];
  }>({ platform: "unknown", instructions: [] });

  useEffect(() => {
    const checkShouldShow = () => {
      const show =
        shouldShowPWAPrompt() && !hasDismissedPWAPrompt();
      setShouldShow(show);

      if (show) {
        const instructionData = getPWAInstructions();
        setInstructions({
          platform: instructionData.platform,
          instructions: instructionData.instructions,
        });
      }
    };

    // Check on mount
    checkShouldShow();

    // Listen for orientation and resize changes
    window.addEventListener("resize", checkShouldShow);
    window.addEventListener("orientationchange", checkShouldShow);

    return () => {
      window.removeEventListener("resize", checkShouldShow);
      window.removeEventListener("orientationchange", checkShouldShow);
    };
  }, []);

  const handleDismiss = () => {
    dismissPWAPrompt();
    setShouldShow(false);
  };

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="relative bg-stone-50 dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full border border-stone-200 dark:border-stone-700 overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 z-10"
          aria-label="Dismiss"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Icon & Title */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-stone-900 dark:bg-stone-100 flex items-center justify-center">
              {isIOS() ? (
                <RotateCw className="w-8 h-8 text-stone-50 dark:text-stone-900" />
              ) : (
                <Download className="w-8 h-8 text-stone-50 dark:text-stone-900" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">
                Install Zenborg
              </h2>
              <p className="text-base text-stone-600 dark:text-stone-400">
                Get the best experience with the full-screen app
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-stone-100 dark:bg-stone-800 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-3">
              Why install?
            </h3>
            <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <li className="flex items-start gap-2">
                <span className="text-stone-900 dark:text-stone-100 font-bold flex-shrink-0">
                  ✓
                </span>
                <span>
                  <strong className="text-stone-900 dark:text-stone-100">
                    Full-screen
                  </strong>{" "}
                  - No browser chrome, more space for your timeline
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-stone-900 dark:text-stone-100 font-bold flex-shrink-0">
                  ✓
                </span>
                <span>
                  <strong className="text-stone-900 dark:text-stone-100">
                    Faster access
                  </strong>{" "}
                  - Launch directly from your home screen
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-stone-900 dark:text-stone-100 font-bold flex-shrink-0">
                  ✓
                </span>
                <span>
                  <strong className="text-stone-900 dark:text-stone-100">
                    Works offline
                  </strong>{" "}
                  - Your data stays on device, always accessible
                </span>
              </li>
            </ul>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              How to install:
            </h3>
            <ol className="space-y-2">
              {instructions.instructions.map((instruction, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 text-sm text-stone-700 dark:text-stone-300"
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-3 border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 font-medium"
              type="button"
            >
              Maybe Later
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-3 bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 rounded-lg hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors font-medium"
              type="button"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
