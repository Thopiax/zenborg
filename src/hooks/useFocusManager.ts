import { useSelector } from "@legendapp/state/react";
import type { Phase } from "@/domain/value-objects/Phase";
import { moments$ } from "@/infrastructure/state/store";
import {
  focusedMomentId$,
  focusedCell$,
} from "@/infrastructure/state/ui-store";

/**
 * Focus manager hook for keyboard navigation
 *
 * Manages focus state for moments and timeline cells
 * Provides helpers for moving focus with hjkl, gg, G, w, b
 */
export function useFocusManager() {
  const focusedMomentId = useSelector(() => focusedMomentId$.get());
  const focusedCell = useSelector(() => focusedCell$.get());

  /**
   * Focus a specific moment by ID
   */
  const focusMoment = (momentId: string | null) => {
    focusedMomentId$.set(momentId);
    focusedCell$.set(null);

    // Scroll into view
    if (momentId) {
      setTimeout(() => {
        const element = document.querySelector(
          `[data-moment-id="${momentId}"]`
        );
        element?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 0);
    }
  };

  /**
   * Focus a specific timeline cell
   */
  const focusCell = (day: string, phase: Phase) => {
    focusedCell$.set({ day, phase });
    focusedMomentId$.set(null);

    // Scroll into view
    setTimeout(() => {
      const element = document.querySelector(`[data-cell="${day}-${phase}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);
  };

  /**
   * Clear all focus
   */
  const clearFocus = () => {
    focusedMomentId$.set(null);
    focusedCell$.set(null);
  };

  /**
   * Get all focusable moment IDs in order
   * (unallocated first, then allocated by day/phase/order)
   */
  const getFocusableIds = (): string[] => {
    const allMoments = Object.values(moments$.get());

    // Separate unallocated and allocated
    const unallocated = allMoments
      .filter((m) => m.day === null)
      .sort((a, b) => a.order - b.order);

    const allocated = allMoments
      .filter((m) => m.day !== null)
      .sort((a, b) => {
        // Sort by day, then phase, then order
        if (a.day !== b.day) return (a.day || "").localeCompare(b.day || "");
        if (a.phase !== b.phase)
          return (a.phase || "").localeCompare(b.phase || "");
        return a.order - b.order;
      });

    return [...unallocated, ...allocated].map((m) => m.id);
  };

  /**
   * Move focus to next moment (w in Vim)
   */
  const focusNext = () => {
    const ids = getFocusableIds();
    if (ids.length === 0) return;

    if (!focusedMomentId) {
      focusMoment(ids[0]);
      return;
    }

    const currentIndex = ids.indexOf(focusedMomentId);
    if (currentIndex === -1 || currentIndex === ids.length - 1) {
      focusMoment(ids[0]); // Wrap to first
    } else {
      focusMoment(ids[currentIndex + 1]);
    }
  };

  /**
   * Move focus to previous moment (b in Vim)
   */
  const focusPrevious = () => {
    const ids = getFocusableIds();
    if (ids.length === 0) return;

    if (!focusedMomentId) {
      focusMoment(ids[ids.length - 1]);
      return;
    }

    const currentIndex = ids.indexOf(focusedMomentId);
    if (currentIndex === -1 || currentIndex === 0) {
      focusMoment(ids[ids.length - 1]); // Wrap to last
    } else {
      focusMoment(ids[currentIndex - 1]);
    }
  };

  /**
   * Move focus to first moment (gg in Vim)
   */
  const focusFirst = () => {
    const ids = getFocusableIds();
    if (ids.length > 0) {
      focusMoment(ids[0]);
    }
  };

  /**
   * Move focus to last moment (G in Vim)
   */
  const focusLast = () => {
    const ids = getFocusableIds();
    if (ids.length > 0) {
      focusMoment(ids[ids.length - 1]);
    }
  };

  return {
    focusedMomentId,
    focusedCell,
    focusMoment,
    focusCell,
    clearFocus,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
  };
}
