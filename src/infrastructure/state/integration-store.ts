import { observable } from "@legendapp/state";

// ============================================================================
// Types
// ============================================================================

export type PublishMode = "direct" | "relay";

export interface TrmnlSettings {
  enabled: boolean;
  publishMode: PublishMode;
  // Direct mode: push straight to TRMNL webhook
  webhookUuid: string;
  // Relay mode: push to same-origin /api/trmnl/push
  relayApiKey: string;
  // Status tracking
  lastSyncAt: string | null;
  lastError: string | null;
}

// ============================================================================
// Observables
// ============================================================================

/**
 * TRMNL integration settings (persisted to localStorage)
 */
export const trmnlSettings$ = observable<TrmnlSettings>({
  enabled: false,
  publishMode: "direct",
  webhookUuid: "",
  relayApiKey: "",
  lastSyncAt: null,
  lastError: null,
});

/**
 * Ephemeral sync status (NOT persisted - resets on reload)
 */
export const trmnlSyncStatus$ = observable<
  "idle" | "syncing" | "success" | "error"
>("idle");

// ============================================================================
// Helpers
// ============================================================================

export function updateTrmnlSettings(updates: Partial<TrmnlSettings>): void {
  const current = trmnlSettings$.peek();
  trmnlSettings$.set({ ...current, ...updates });
}

export function resetTrmnlSettings(): void {
  trmnlSettings$.set({
    enabled: false,
    publishMode: "direct",
    webhookUuid: "",
    relayApiKey: "",
    lastSyncAt: null,
    lastError: null,
  });
  trmnlSyncStatus$.set("idle");
}

/**
 * Returns true if the current settings have enough config to sync
 */
export function isTrmnlConfigured(): boolean {
  const settings = trmnlSettings$.peek();
  if (settings.publishMode === "direct") {
    return settings.webhookUuid.trim().length > 0;
  }
  return settings.relayApiKey.trim().length > 0;
}

/**
 * Returns the relay push URL for the Zenborg API
 */
export function getRelayPushUrl(): string {
  return "https://zenborg.vercel.app/api/trmnl/push";
}
