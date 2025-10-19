import type * as React from "react";

/**
 * VisuallyHidden - Hides content visually but keeps it accessible to screen readers
 *
 * Use this for labels, titles, or descriptions that should be announced by
 * assistive technologies but don't need to be visible on screen.
 */
export function VisuallyHidden({
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      style={{
        position: "absolute",
        border: 0,
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        wordWrap: "normal",
      }}
      {...props}
    >
      {children}
    </span>
  );
}
