"use client";

import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";

interface UpdateState {
  update: Update | null;
  checking: boolean;
  downloading: boolean;
  error: string | null;
  downloadProgress: number;
}

export function useUpdater(checkOnMount = true) {
  const [state, setState] = useState<UpdateState>({
    update: null,
    checking: false,
    downloading: false,
    error: null,
    downloadProgress: 0,
  });

  const checkForUpdate = useCallback(async () => {
    // Only run in Tauri environment
    if (!isTauri()) {
      return;
    }

    setState((prev) => ({ ...prev, checking: true, error: null }));

    try {
      const update = await check();
      setState((prev) => ({
        ...prev,
        update: update ?? null,
        checking: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        checking: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check for updates",
      }));
    }
  }, []);

  const downloadAndInstall = async () => {
    if (!state.update) return;

    setState((prev) => ({ ...prev, downloading: true, error: null }));

    let contentLength: number | undefined;
    let downloadedBytes = 0;

    try {
      await state.update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength;
            setState((prev) => ({ ...prev, downloadProgress: 0 }));
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            if (contentLength) {
              const progress = (downloadedBytes / contentLength) * 100;
              setState((prev) => ({ ...prev, downloadProgress: progress }));
            }
            break;
          case "Finished":
            setState((prev) => ({ ...prev, downloadProgress: 100 }));
            break;
        }
      });

      // Relaunch the app to apply the update
      await relaunch();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error:
          error instanceof Error ? error.message : "Failed to download update",
      }));
    }
  };

  useEffect(() => {
    if (checkOnMount) {
      // Delay check to not interfere with app startup
      const timer = setTimeout(checkForUpdate, 3000);
      return () => clearTimeout(timer);
    }
  }, [checkOnMount, checkForUpdate]);

  return {
    ...state,
    checkForUpdate,
    downloadAndInstall,
  };
}
