import { observe } from "@legendapp/state";
import { formatTodayForTrmnl } from "@/domain/services/TrmnlFormatter";
import {
  getRelayPushUrl,
  isTrmnlConfigured,
  trmnlSettings$,
  trmnlSyncStatus$,
} from "@/infrastructure/state/integration-store";
import {
  activeCycle$,
  areas$,
  moments$,
  momentsByDayAndPhase$,
  phaseConfigs$,
} from "@/infrastructure/state/store";
import { pushToRelay, pushToTrmnlDirect } from "./trmnl-client";

// ============================================================================
// State
// ============================================================================

let syncDisposer: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pushTimestamps: number[] = [];

const DEBOUNCE_MS = 5000;
const MAX_PUSHES_PER_HOUR = 10;

// ============================================================================
// Rate Limiting
// ============================================================================

function canPushNow(): boolean {
  const oneHourAgo = Date.now() - 3_600_000;
  // Prune old timestamps
  while (pushTimestamps.length > 0 && pushTimestamps[0] < oneHourAgo) {
    pushTimestamps.shift();
  }
  return pushTimestamps.length < MAX_PUSHES_PER_HOUR;
}

// ============================================================================
// Core Sync
// ============================================================================

export async function syncTrmnlNow(): Promise<void> {
  const settings = trmnlSettings$.peek();

  if (!settings.enabled || !isTrmnlConfigured()) {
    return;
  }

  if (!canPushNow()) {
    console.log("[TRMNL] Rate limited - skipping push");
    trmnlSyncStatus$.set("error");
    trmnlSettings$.lastError.set("Rate limited - too many pushes this hour");
    return;
  }

  trmnlSyncStatus$.set("syncing");

  const today = new Date().toISOString().split("T")[0];
  const payload = formatTodayForTrmnl(
    moments$.peek(),
    areas$.peek(),
    phaseConfigs$.peek(),
    activeCycle$.peek(),
    today,
  );

  let result: { success: boolean; error?: string };
  if (settings.publishMode === "direct") {
    result = await pushToTrmnlDirect(settings.webhookUuid, payload);
  } else {
    result = await pushToRelay(
      getRelayPushUrl(),
      settings.relayApiKey,
      payload,
    );
  }

  pushTimestamps.push(Date.now());

  if (result.success) {
    trmnlSyncStatus$.set("success");
    trmnlSettings$.lastSyncAt.set(new Date().toISOString());
    trmnlSettings$.lastError.set(null);
    console.log("[TRMNL] Push successful");
  } else {
    trmnlSyncStatus$.set("error");
    trmnlSettings$.lastError.set(result.error ?? "Unknown error");
    console.warn("[TRMNL] Push failed:", result.error);
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

export function startTrmnlSync(): void {
  if (syncDisposer) {
    return;
  }

  const settings = trmnlSettings$.peek();
  if (!settings.enabled || !isTrmnlConfigured()) {
    return;
  }

  console.log("[TRMNL] Starting reactive sync");

  syncDisposer = observe(() => {
    // Subscribe to reactive dependencies
    momentsByDayAndPhase$.get();
    areas$.get();
    phaseConfigs$.get();
    activeCycle$.get();

    // Debounce the push
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      syncTrmnlNow();
    }, DEBOUNCE_MS);
  });
}

export function stopTrmnlSync(): void {
  if (syncDisposer) {
    syncDisposer();
    syncDisposer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  console.log("[TRMNL] Sync stopped");
}
