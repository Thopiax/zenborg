"use client";

/**
 * The active moment — read the intention pointer, and set it.
 *
 * Kept out of the Legend State stores on purpose: the pointer is a singleton,
 * not a collection, and it changes at human cadence (a few times a day). A
 * `useState` + a vault subscription is the whole requirement.
 *
 * The subscription is what makes the agent path visible: when keel's session
 * nudge leads to `set_active_moment` on the MCP server, the watcher fires and
 * the board updates without a reload.
 */

import { useCallback, useEffect, useState } from "react";
import {
  clearActiveMoment,
  readActiveMoment,
  subscribeToActiveMoment,
  writeActiveMoment,
} from "@/infrastructure/vault/active-moment";

export function useActiveMoment() {
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const pointer = await readActiveMoment();
    setActiveMomentId(pointer?.momentId ?? null);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    void refresh();
    void subscribeToActiveMoment(() => {
      void refresh();
    }).then((fn) => {
      // The effect may have torn down while we were awaiting the listener.
      if (cancelled) fn?.();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refresh]);

  /** Make a moment the intention, or release it if it already is one. */
  const toggleActive = useCallback(
    async (momentId: string) => {
      if (activeMomentId === momentId) {
        setActiveMomentId(null); // optimistic — the watcher confirms
        await clearActiveMoment();
      } else {
        setActiveMomentId(momentId);
        await writeActiveMoment(momentId);
      }
    },
    [activeMomentId],
  );

  return { activeMomentId, toggleActive, refresh };
}
