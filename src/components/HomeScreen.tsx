"use client";

import { Download, RotateCw } from "lucide-react";
import { getPWAInstructions, isIOS } from "@/lib/pwa-utils";

/**
 * HomeScreen - Welcome screen for first-time users (before PWA installation)
 *
 * Shows:
 * - Zenborg branding
 * - Rotate phone instruction with visual
 * - "Save to Home Screen" as primary CTA
 * - Platform-specific installation instructions
 *
 * Design:
 * - Full-screen, monochrome stone aesthetic
 * - Large, clear instructions
 * - Friendly, persuasive tone
 */
export function HomeScreen() {
  const instructions = getPWAInstructions();
  const isiOS = isIOS();

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-stone-900 dark:text-stone-100">
            Zenborg
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400">
            Intention Compass
          </p>
        </div>

        {/* Rotate Phone Visual */}
        <div className="bg-stone-100 dark:bg-stone-800 rounded-2xl p-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            {/* Phone rotation icon */}
            <div className="relative">
              {/* Phone outline */}
              <div className="w-24 h-40 border-4 border-stone-400 dark:border-stone-600 rounded-xl flex items-center justify-center">
                <RotateCw className="w-12 h-12 text-stone-400 dark:text-stone-600" />
              </div>
              {/* Arrow indicating rotation */}
              <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-stone-400 dark:text-stone-600"
                  aria-label="Rotate phone arrow"
                >
                  <path
                    d="M5 12h14M12 5l7 7-7 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              {/* Landscape phone */}
              <div className="absolute -right-24 top-1/2 -translate-y-1/2 w-40 h-24 border-4 border-stone-900 dark:border-stone-100 rounded-xl" />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                Rotate Your Phone
              </h2>
              <p className="text-base text-stone-600 dark:text-stone-400">
                Zenborg is designed for landscape orientation
              </p>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="space-y-4">
          <div className="bg-stone-900 dark:bg-stone-100 rounded-2xl p-8 text-center space-y-4">
            <div className="flex justify-center">
              {isiOS ? (
                <RotateCw className="w-12 h-12 text-stone-50 dark:text-stone-900" />
              ) : (
                <Download className="w-12 h-12 text-stone-50 dark:text-stone-900" />
              )}
            </div>
            <h3 className="text-2xl font-bold text-stone-50 dark:text-stone-900">
              Save to Home Screen
            </h3>
            <p className="text-base text-stone-300 dark:text-stone-700">
              Get the best experience with full-screen access
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-stone-100 dark:bg-stone-800 rounded-2xl p-6 space-y-4">
            <h4 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
              How to install:
            </h4>
            <ol className="space-y-3">
              {instructions.instructions.map((instruction) => (
                <li
                  key={instruction}
                  className="flex items-start gap-3 text-base text-stone-700 dark:text-stone-300"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 flex items-center justify-center text-sm font-bold">
                    {instructions.instructions.indexOf(instruction) + 1}
                  </span>
                  <span className="pt-0.5">{instruction}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 text-center">
            Why install?
          </h4>
          <div className="grid gap-2">
            <div className="bg-stone-100 dark:bg-stone-800 rounded-lg p-4 text-center">
              <p className="text-sm text-stone-700 dark:text-stone-300">
                <strong className="text-stone-900 dark:text-stone-100">
                  Full-screen
                </strong>{" "}
                - No browser chrome
              </p>
            </div>
            <div className="bg-stone-100 dark:bg-stone-800 rounded-lg p-4 text-center">
              <p className="text-sm text-stone-700 dark:text-stone-300">
                <strong className="text-stone-900 dark:text-stone-100">
                  Faster access
                </strong>{" "}
                - Launch from home
              </p>
            </div>
            <div className="bg-stone-100 dark:bg-stone-800 rounded-lg p-4 text-center">
              <p className="text-sm text-stone-700 dark:text-stone-300">
                <strong className="text-stone-900 dark:text-stone-100">
                  Works offline
                </strong>{" "}
                - Always accessible
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-stone-500 dark:text-stone-500">
          <p>Where will you place your consciousness today?</p>
        </div>
      </div>
    </div>
  );
}
