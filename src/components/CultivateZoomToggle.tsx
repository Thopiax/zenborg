"use client";

import { use$ } from "@legendapp/state/react";
import {
  type CultivateZoom,
  cultivateZoom$,
} from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

const options: { value: CultivateZoom; label: string }[] = [
  { value: "phase", label: "Phase" },
  { value: "time", label: "Time" },
];

export function CultivateZoomToggle() {
  const zoom = use$(cultivateZoom$);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5",
        "rounded bg-stone-100 dark:bg-stone-800 p-0.5",
      )}
      role="radiogroup"
      aria-label="Cultivate zoom"
    >
      {options.map((opt) => {
        const active = zoom === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => cultivateZoom$.set(opt.value)}
            className={cn(
              "px-2.5 py-0.5 rounded-sm text-xs font-medium transition-all duration-150",
              active
                ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
