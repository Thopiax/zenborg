"use client";

import { usePathname } from "next/navigation";

/**
 * ToolIndicator - Shows current tool in top-right corner
 *
 * Displays [PLAN], [CULTIVATE], or [HARVEST] based on route
 */
export function ToolIndicator() {
  const pathname = usePathname();

  const tool = pathname.startsWith("/plan")
    ? "PLAN"
    : pathname.startsWith("/harvest")
    ? "HARVEST"
    : "CULTIVATE";

  return (
    <div className="text-xs font-mono text-stone-400 select-none">[{tool}]</div>
  );
}
