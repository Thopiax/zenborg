"use client";

import { useValue } from "@legendapp/state/react";
import { Dice5, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { PublishMode } from "@/infrastructure/state/integration-store";
import {
  isTrmnlConfigured,
  trmnlSettings$,
  trmnlSyncStatus$,
} from "@/infrastructure/state/integration-store";
import {
  startTrmnlSync,
  stopTrmnlSync,
  syncTrmnlNow,
} from "@/infrastructure/integrations/trmnl-sync";

function generateApiKey(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function TrmnlSettingsSection() {
  const settings = useValue(trmnlSettings$);
  const syncStatus = useValue(trmnlSyncStatus$);
  const configured = isTrmnlConfigured();
  const isSyncing = syncStatus === "syncing";

  const handleToggle = () => {
    if (settings.enabled) {
      trmnlSettings$.enabled.set(false);
      stopTrmnlSync();
    } else {
      trmnlSettings$.enabled.set(true);
      startTrmnlSync();
    }
  };

  const handleModeChange = (mode: PublishMode) => {
    trmnlSettings$.publishMode.set(mode);
  };

  const handleGenerateApiKey = () => {
    trmnlSettings$.relayApiKey.set(generateApiKey());
  };

  const lastSyncLabel = settings.lastSyncAt
    ? formatDistanceToNow(new Date(settings.lastSyncAt), { addSuffix: true })
    : "Never";

  return (
    <div className="space-y-4 px-2">
      <p className="text-xs text-stone-500 dark:text-stone-500">
        Display today&apos;s moments on an ambient e-ink screen.
      </p>

      {/* Publish Mode */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
          Mode
        </label>
        <div className="flex gap-2">
          {(["direct", "relay"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeChange(mode)}
              className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                settings.publishMode === mode
                  ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800/50"
              }`}
            >
              {mode === "direct" ? "Direct" : "Relay"}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-600">
          {settings.publishMode === "direct"
            ? "Push directly to TRMNL webhook. Works when app is open."
            : "Push via server relay. Works even when browser is closed."}
        </p>
      </div>

      {/* Direct Mode Fields */}
      {settings.publishMode === "direct" && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
            Plugin UUID
          </label>
          <input
            type="text"
            value={settings.webhookUuid}
            onChange={(e) => trmnlSettings$.webhookUuid.set(e.target.value)}
            placeholder="Paste your TRMNL webhook UUID"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-500"
          />
          <p className="text-xs text-stone-400 dark:text-stone-600">
            Find this in your TRMNL private plugin settings.
          </p>
        </div>
      )}

      {/* Relay Mode Fields */}
      {settings.publishMode === "relay" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.relayApiKey}
                onChange={(e) => trmnlSettings$.relayApiKey.set(e.target.value)}
                placeholder="Click generate to create one"
                readOnly
                className="flex-1 px-3 py-2 text-sm font-mono bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateApiKey}
                title="Generate API Key"
                className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-700 dark:text-stone-300"
              >
                <Dice5 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-400 dark:text-stone-600">
              Shared secret between Zenborg and the relay. Copy this to your TRMNL plugin&apos;s polling headers.
            </p>
          </div>
        </div>
      )}

      {/* Enable Toggle */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={!configured && !settings.enabled}
        className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-lg transition-colors text-left ${
          settings.enabled
            ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
            : "border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            settings.enabled
              ? "bg-green-500"
              : "bg-stone-300 dark:bg-stone-600"
          }`}
        />
        <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
          {settings.enabled ? "Sync Enabled" : "Sync Disabled"}
        </span>
      </button>

      {/* Sync Now + Status */}
      {settings.enabled && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => syncTrmnlNow()}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-stone-700 dark:text-stone-300"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>

          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-500">
            <span>Last sync: {lastSyncLabel}</span>
            {settings.lastError && (
              <span className="text-red-500 dark:text-red-400 truncate ml-2">
                {settings.lastError}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
