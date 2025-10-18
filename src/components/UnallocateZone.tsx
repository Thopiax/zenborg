"use client";

/**
 * Unallocate Zone Component
 *
 * Fixed-position droppable zone at viewport edge for unallocating moments.
 * Only visible during drag operations from timeline cells.
 *
 * Design:
 * - Desktop: Left edge (vertical bar)
 * - Mobile: Bottom edge (horizontal bar)
 * - Expands on hover from 20px to 80px
 * - Ambient gray color matching drawing board
 */

import { useDroppable } from "@dnd-kit/core";
import { Archive, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DropTargetType } from "@/types/dnd";

interface UnallocateZoneProps {
  /** Only show when dragging allocated moments */
  isVisible: boolean;
}

export function UnallocateZone({ isVisible }: UnallocateZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "unallocate-zone",
    data: {
      targetType: "unallocate-zone" as DropTargetType,
    },
  });

  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* Desktop: Bottom edge horizontal bar */}
      <div
        ref={setNodeRef}
        className={cn(
          "fixed bottom-0 left-0 z-50 hidden w-full transition-all duration-200 md:flex",
          "flex-row items-center justify-center",
          "bg-stone-100/20 dark:bg-stone-800/20 backdrop-blur-sm",
          "border-t border-stone-200 dark:border-stone-800",
          // Size: expand on hover with more space
          isOver ? "h-32" : "h-24",
          // Subtle glow effect when hovering
          isOver && "border-stone-300 bg-stone-200/70 shadow-md"
        )}
      >
        <div
          className={cn(
            "flex flex-row items-center gap-3 text-stone-500 transition-opacity",
            isOver ? "opacity-100" : "opacity-40"
          )}
        >
          <Archive className="h-5 w-5" />
          {isOver && (
            <span className="text-sm font-medium">Drop to unallocate</span>
          )}
        </div>
      </div>

      {/* Mobile: Bottom edge horizontal bar */}
      <div
        ref={setNodeRef}
        className={cn(
          "fixed bottom-0 left-0 z-50 flex w-full transition-all duration-200 md:hidden",
          "flex-row items-center justify-center",
          "bg-stone-100/60 backdrop-blur-sm",
          "border-t border-stone-200",
          // Size: expand on hover with more space
          isOver ? "h-32" : "h-12",
          // Subtle glow effect when hovering
          isOver && "border-stone-300 bg-stone-200/70 shadow-md"
        )}
      >
        <div
          className={cn(
            "flex flex-row items-center gap-3 text-stone-500 transition-opacity",
            isOver ? "opacity-100" : "opacity-40"
          )}
        >
          <ArrowDown className="h-5 w-5" />
          {isOver && (
            <span className="text-sm font-medium">Drop to unallocate</span>
          )}
        </div>
      </div>
    </>
  );
}
