"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "@legendapp/state/react";
import {
  clearGapTimer,
  gapTimer$,
} from "@/infrastructure/state/ui-store";

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function TimerOverlay() {
  const timer = useSelector(gapTimer$);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!timer.active) return;
    const tick = () => {
      const elapsed = Date.now() - timer.startedAt;
      const left = timer.durationMs - elapsed;
      if (left <= 0) {
        clearGapTimer();
        return;
      }
      setRemainingMs(left);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [timer.active, timer.startedAt, timer.durationMs]);

  if (!timer.active) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-baseline gap-3 rounded bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 px-4 py-2.5 select-none"
      style={{ borderRadius: 4 }}
    >
      <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">
        {timer.habitName}
      </span>
      <span className="ml-auto font-mono text-lg font-bold tabular-nums text-stone-600 dark:text-stone-300">
        {formatRemaining(remainingMs)}
      </span>
      <span className="text-[0.65rem] uppercase tracking-wide text-stone-400 dark:text-stone-500">
        remaining
      </span>
    </div>
  );
}
