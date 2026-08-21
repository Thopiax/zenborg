"use client";

import { cn } from "@/lib/utils";

interface TagSummaryProps {
  tags?: readonly string[] | null;
  className?: string;
  /** How many tags to spell out before the rest collapse into a count. */
  visible?: number;
}

/**
 * TagSummary - one tag, then a count.
 *
 * A card exists to say what the habit or moment is. Tags are secondary
 * context, so only the first survives in full; the rest collapse to "+N" and
 * stay readable on hover. The name always wins the horizontal fight.
 */
export function TagSummary({ tags, className, visible = 1 }: TagSummaryProps) {
  if (!tags || tags.length === 0) return null;

  const shown = tags.slice(0, Math.max(visible, 0));
  const hidden = tags.length - shown.length;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-mono opacity-50",
        className,
      )}
      title={tags.map((tag) => `#${tag}`).join(" ")}
    >
      {shown.map((tag) => (
        <span key={tag} className="truncate max-w-[12ch]">
          #{tag}
        </span>
      ))}
      {hidden > 0 && <span className="tabular-nums">+{hidden}</span>}
    </span>
  );
}
