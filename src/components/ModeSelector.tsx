"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * ModeSelector - Centered top bar for switching between Plant, Cultivate, Harvest
 *
 * Design:
 * - Calm, minimal design using stone tones
 * - Centered horizontally
 * - Active mode is indicated with darker background
 * - Clickable to switch modes
 * - Keyboard shortcuts: Cmd+1/2/3
 */
export function ModeSelector() {
  const pathname = usePathname();
  const router = useRouter();

  const modes = [
    { name: "Plant", path: "/plan" },
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
      className="fixed top-0 left-1/2 -translate-x-1/2 z-30"
      style={{
        top: "max(1rem, env(safe-area-inset-top) + 0.5rem)",
      }}
    >
      <div className="flex items-center gap-1 bg-stone-100/80 dark:bg-stone-900/80 backdrop-blur-sm rounded-full px-2 py-1.5 shadow-sm border border-stone-200/50 dark:border-stone-800/50">
        {modes.map((mode) => {
          const isActive = currentMode === mode.name;
          return (
            <button
              key={mode.path}
              onClick={() => router.push(mode.path)}
              className={`
                px-4 py-1.5 rounded-full text-sm font-mono transition-all duration-200
                ${
                  isActive
                    ? "bg-stone-800 dark:bg-stone-200 text-stone-50 dark:text-stone-900 shadow-sm"
                    : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800/50"
                }
              `}
            >
              {mode.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
