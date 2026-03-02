"use client";

import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useUpdater } from "@/hooks/useUpdater";

export function UpdateNotification() {
  const { update, downloading, error, downloadProgress, downloadAndInstall } =
    useUpdater(true);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when a new update is available
  useEffect(() => {
    if (update) {
      setDismissed(false);
    }
  }, [update]);

  // Don't show if no update, dismissed, or not in Tauri
  if (!update || dismissed || !isTauri()) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-medium text-stone-900">Update Available</h3>
            <p className="mt-1 text-sm text-stone-600">
              Version {update.version} is ready to install
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            {downloading && (
              <div className="mt-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full bg-stone-900 transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-stone-600">
                  Downloading... {Math.round(downloadProgress)}%
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-stone-400 hover:text-stone-600"
            disabled={downloading}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-label="Close notification"
            >
              <title>Close notification</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {!downloading && !error && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={downloadAndInstall}
              className="flex-1 rounded bg-stone-900 px-3 py-2 text-sm font-medium text-stone-50 hover:bg-stone-800"
            >
              Install Update
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
