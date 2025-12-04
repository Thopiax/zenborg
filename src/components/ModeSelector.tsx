"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * ModeSelector - Minimal centered text navigation for Plant, Cultivate, Harvest
 *
 * Design:
 * - Ultra-minimal: just text, no backgrounds or borders
 * - Inactive: grey text
 * - Active: bold + underline
 * - Keyboard shortcuts: Cmd+1/2/3
 */
export function ModeSelector() {
  const pathname = usePathname();
  const router = useRouter();

  const modes = [
    { name: "Plant", path: "/plant" },
    { name: "Cultivate", path: "/cultivate" },
    { name: "Harvest", path: "/harvest" },
  ] as const;

  const currentMode = pathname.startsWith("/plan")
    ? "Plant"
    : pathname.startsWith("/harvest")
    ? "Harvest"
    : "Cultivate";

  return (
    <div
      className={cn(
        "fixed top-0 left-1/2 -translate-x-1/2 z-30",
        "backdrop-blur-sm rounded-md px-8 py-4"
      )}
      style={{
        top: "max(1rem, env(safe-area-inset-top) + 0.5rem)",
      }}
    >
      <div className="flex items-center gap-8">
        {modes.map((mode) => {
          const isActive = currentMode === mode.name;
          return (
            <button
              key={mode.path}
              type="button"
              onClick={() => router.push(mode.path)}
              className={cn(
                "text-sm transition-colors duration-200",
                isActive
                  ? "font-bold underline underline-offset-4 text-stone-900 dark  :text-stone-100"
                  : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-400"
              )}
            >
              {mode.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
