import type { TrmnlPayload } from "@/domain/services/TrmnlFormatter";

// ============================================================================
// Types
// ============================================================================

export interface TrmnlPushResult {
  success: boolean;
  error?: string;
  rateLimited?: boolean;
}

// ============================================================================
// Direct Push (Path A)
// ============================================================================

const TRMNL_API_BASE = "https://trmnl.com/api/custom_plugins";

export async function pushToTrmnlDirect(
  uuid: string,
  payload: TrmnlPayload,
): Promise<TrmnlPushResult> {
  if (!uuid.trim()) {
    return { success: false, error: "TRMNL webhook UUID is required" };
  }

  try {
    const response = await fetch(`${TRMNL_API_BASE}/${uuid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      return {
        success: false,
        rateLimited: true,
        error: "Rate limited by TRMNL",
      };
    }

    if (!response.ok) {
      return { success: false, error: `TRMNL returned ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Relay Push (Path B)
// ============================================================================

export async function pushToRelay(
  relayUrl: string,
  apiKey: string,
  payload: TrmnlPayload,
): Promise<TrmnlPushResult> {
  if (!relayUrl.trim()) {
    return { success: false, error: "Relay URL is required" };
  }

  console.log(
    "[TRMNL] Pushing to relay at",
    relayUrl,
    "with payload:",
    JSON.stringify(payload, null, 2),
  );

  try {
    const response = await fetch(relayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `Relay returned ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
