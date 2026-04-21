# TRMNL E-Ink Display Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Push today's moments by phase to a TRMNL e-ink display, recreating the ambient visibility of the physical whiteboard that inspired Zenborg.

**Architecture:** Two publishing paths (user chooses): (A) direct webhook push to TRMNL, (B) Vercel relay for persistent availability. Both share a pure domain formatter and a reactive sync orchestrator that observes Legend State changes with debouncing.

**Tech Stack:** Legend State observables, browser `fetch()`, Vitest, Vercel Edge Functions + KV (for relay path)

**Background:** See `docs/plans/2026-02-22-behavioral-feedback-loops.md` for the behavioral science analysis (BCT/PDP) that motivated this feature. This implements "Option C: Phase-Aware Current State" from that analysis.

---

## Completed Work

Task 1 (TrmnlFormatter domain layer) is already done:
- `src/domain/services/TrmnlFormatter.ts` - Pure formatter function + types
- `src/domain/services/__tests__/TrmnlFormatter.test.ts` - 16 passing tests
- All 330 tests pass

---

## Task 2: Integration Store

**Files:**
- Create: `src/infrastructure/state/integration-store.ts`

**Step 1: Create the integration store**

```typescript
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
  // Relay mode: push to Vercel function that TRMNL polls
  relayUrl: string;
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
  relayUrl: "",
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

export function updateTrmnlSettings(
  updates: Partial<TrmnlSettings>
): void {
  const current = trmnlSettings$.peek();
  trmnlSettings$.set({ ...current, ...updates });
}

export function resetTrmnlSettings(): void {
  trmnlSettings$.set({
    enabled: false,
    publishMode: "direct",
    webhookUuid: "",
    relayUrl: "",
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
  return (
    settings.relayUrl.trim().length > 0 &&
    settings.relayApiKey.trim().length > 0
  );
}
```

**Step 2: Verify no test regressions**

Run: `pnpm test --run`
Expected: All 330 tests pass

**Step 3: Commit**

```
git add src/infrastructure/state/integration-store.ts
git commit -m "feat(trmnl): add integration store for TRMNL settings"
```

---

## Task 3: Persistence Wiring

**Files:**
- Modify: `src/infrastructure/state/persistence.ts` (after line 174)

**Step 1: Add localStorage sync for trmnlSettings$**

Add import at top of file:
```typescript
import { trmnlSettings$ } from "./integration-store";
```

Add after the `drawingBoardGroupBy$` sync (after line 174, inside `configurePersistence()`):
```typescript
    syncObservable(
      trmnlSettings$,
      persistLocalStorageOptions({
        persist: {
          name: "zenborg_trmnlSettings",
        },
      })
    );
```

**Step 2: Verify no test regressions**

Run: `pnpm test --run`
Expected: All 330 tests pass

**Step 3: Commit**

```
git add src/infrastructure/state/persistence.ts
git commit -m "feat(trmnl): wire settings persistence to localStorage"
```

---

## Task 4: TRMNL HTTP Client

**Files:**
- Create: `src/infrastructure/integrations/trmnl-client.ts`
- Create: `src/infrastructure/integrations/__tests__/trmnl-client.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { pushToTrmnlDirect, pushToRelay } from "../trmnl-client";
import type { TrmnlPayload } from "@/domain/services/TrmnlFormatter";

const mockPayload: TrmnlPayload = {
  merge_variables: {
    date: "2026-02-22",
    date_label: "Sunday, Feb 22",
    cycle_name: "",
    phases: [],
    total_allocated: 0,
    total_unallocated: 0,
    updated_at: "2026-02-22T12:00:00.000Z",
  },
};

describe("trmnl-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("pushToTrmnlDirect", () => {
    it("returns success on 200 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 200 })
      );

      const result = await pushToTrmnlDirect("test-uuid", mockPayload);

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://trmnl.com/api/custom_plugins/test-uuid",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("returns rateLimited on 429 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 429 })
      );

      const result = await pushToTrmnlDirect("test-uuid", mockPayload);

      expect(result.success).toBe(false);
      expect(result.rateLimited).toBe(true);
    });

    it("returns error on network failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error")
      );

      const result = await pushToTrmnlDirect("test-uuid", mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("returns error on 4xx response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Bad Request", { status: 400 })
      );

      const result = await pushToTrmnlDirect("test-uuid", mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("400");
    });

    it("rejects empty UUID", async () => {
      const result = await pushToTrmnlDirect("", mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("UUID");
    });
  });

  describe("pushToRelay", () => {
    it("returns success on 200 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 200 })
      );

      const result = await pushToRelay(
        "https://my-relay.vercel.app/api/push",
        "my-api-key",
        mockPayload
      );

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://my-relay.vercel.app/api/push",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer my-api-key",
          },
        })
      );
    });

    it("returns error on network failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Connection refused")
      );

      const result = await pushToRelay(
        "https://my-relay.vercel.app/api/push",
        "key",
        mockPayload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection refused");
    });

    it("rejects empty relay URL", async () => {
      const result = await pushToRelay("", "key", mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("URL");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/infrastructure/integrations/__tests__/trmnl-client.test.ts --run`
Expected: FAIL - module `../trmnl-client` not found

**Step 3: Write minimal implementation**

```typescript
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
  payload: TrmnlPayload
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
      return { success: false, rateLimited: true, error: "Rate limited by TRMNL" };
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
  payload: TrmnlPayload
): Promise<TrmnlPushResult> {
  if (!relayUrl.trim()) {
    return { success: false, error: "Relay URL is required" };
  }

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
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/infrastructure/integrations/__tests__/trmnl-client.test.ts --run`
Expected: All 8 tests PASS

**Step 5: Commit**

```
git add src/infrastructure/integrations/trmnl-client.ts src/infrastructure/integrations/__tests__/trmnl-client.test.ts
git commit -m "feat(trmnl): add HTTP client for direct webhook and relay push"
```

---

## Task 5: Reactive Sync Orchestrator

**Files:**
- Create: `src/infrastructure/integrations/trmnl-sync.ts`

This file uses Legend State's `observe()` to reactively detect changes to today's moments and auto-push. It cannot be meaningfully unit tested in isolation (depends on Legend State reactivity + timers), so we test it via integration in later manual testing.

**Step 1: Write the sync orchestrator**

```typescript
import { observe } from "@legendapp/state";
import { formatTodayForTrmnl } from "@/domain/services/TrmnlFormatter";
import {
  activeCycle$,
  areas$,
  moments$,
  momentsByDayAndPhase$,
  phaseConfigs$,
} from "@/infrastructure/state/store";
import {
  isTrmnlConfigured,
  trmnlSettings$,
  trmnlSyncStatus$,
} from "@/infrastructure/state/integration-store";
import { pushToTrmnlDirect, pushToRelay } from "./trmnl-client";

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
    today
  );

  let result;
  if (settings.publishMode === "direct") {
    result = await pushToTrmnlDirect(settings.webhookUuid, payload);
  } else {
    result = await pushToRelay(settings.relayUrl, settings.relayApiKey, payload);
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
  if (syncDisposer) return;

  const settings = trmnlSettings$.peek();
  if (!settings.enabled || !isTrmnlConfigured()) return;

  console.log("[TRMNL] Starting reactive sync");

  syncDisposer = observe(() => {
    // Subscribe to reactive dependencies
    momentsByDayAndPhase$.get();
    areas$.get();
    phaseConfigs$.get();
    activeCycle$.get();

    // Debounce the push
    if (debounceTimer) clearTimeout(debounceTimer);
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
```

**Step 2: Verify no test regressions**

Run: `pnpm test --run`
Expected: All tests pass (330 existing + 8 new client tests = 338)

**Step 3: Commit**

```
git add src/infrastructure/integrations/trmnl-sync.ts
git commit -m "feat(trmnl): add reactive sync orchestrator with debouncing and rate limiting"
```

---

## Task 6: Settings UI Component

**Files:**
- Create: `src/components/TrmnlSettingsSection.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useValue } from "@legendapp/state/react";
import { Loader2, RefreshCw } from "lucide-react";
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
            : "Push to Vercel relay. Works even when computer is off."}
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
              Relay URL
            </label>
            <input
              type="text"
              value={settings.relayUrl}
              onChange={(e) => trmnlSettings$.relayUrl.set(e.target.value)}
              placeholder="https://your-relay.vercel.app/api/push"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              API Key
            </label>
            <input
              type="password"
              value={settings.relayApiKey}
              onChange={(e) => trmnlSettings$.relayApiKey.set(e.target.value)}
              placeholder="Your relay API key"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-500"
            />
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
```

**Step 2: Verify no test regressions**

Run: `pnpm test --run`
Expected: All tests pass

**Step 3: Commit**

```
git add src/components/TrmnlSettingsSection.tsx
git commit -m "feat(trmnl): add settings UI for e-ink display configuration"
```

---

## Task 7: Wire into SettingsDrawer

**Files:**
- Modify: `src/components/SettingsDrawer.tsx`

**Step 1: Add import and icon**

Add to imports (line 9, alongside existing lucide icons):
```typescript
import { Tv } from "lucide-react";
```

Add component import after existing imports:
```typescript
import { TrmnlSettingsSection } from "./TrmnlSettingsSection";
```

**Step 2: Add accordion item**

Insert between the "Data Management" AccordionItem closing tag (line 362) and the "PWA Installation" AccordionItem (line 365):

```tsx
            {/* E-Ink Display Integration */}
            <AccordionItem
              value="integrations"
              className="border-stone-200 dark:border-stone-700"
            >
              <AccordionTrigger className="text-stone-900 dark:text-stone-100 hover:no-underline px-2">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4" />
                  <span>E-Ink Display</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <TrmnlSettingsSection />
              </AccordionContent>
            </AccordionItem>
```

**Step 3: Verify no test regressions**

Run: `pnpm test --run`
Expected: All tests pass

**Step 4: Commit**

```
git add src/components/SettingsDrawer.tsx
git commit -m "feat(trmnl): add E-Ink Display section to settings drawer"
```

---

## Task 8: Wire Sync at Boot

**Files:**
- Modify: `src/app/StoreInitializer.tsx`

**Step 1: Add import**

```typescript
import { startTrmnlSync } from "@/infrastructure/integrations/trmnl-sync";
```

**Step 2: Call startTrmnlSync after initialization**

Change the `.then()` callback (line 19) to:

```typescript
    initializeStore()
      .then(() => {
        setIsInitialized(true);
        startTrmnlSync();
      })
```

`startTrmnlSync()` checks settings internally and no-ops if disabled or unconfigured.

**Step 3: Verify no test regressions**

Run: `pnpm test --run`
Expected: All tests pass

**Step 4: Commit**

```
git add src/app/StoreInitializer.tsx
git commit -m "feat(trmnl): start reactive sync on app boot"
```

---

## Task 9: TRMNL Liquid Template

**Files:**
- Create: `docs/trmnl-template.liquid`

This is reference documentation - the markup the user pastes into TRMNL's private plugin Markup Editor.

**Step 1: Create the template**

```liquid
<div class="view view--full">
  <div class="layout">
    <div class="columns">
      <div class="column">
        <div class="markdown">

          <div class="title_bar">
            <img class="image image--logo" src="https://usetrmnl.com/images/plugins/trmnl--render.svg" />
            <span class="title_bar__title">Zenborg</span>
            <span class="title_bar__instance">{{ date_label }}</span>
          </div>

          {% if cycle_name != "" %}
            <p class="description">{{ cycle_name }}</p>
          {% endif %}

          {% for phase in phases %}
            {% if phase.moment_count > 0 %}
              <p class="label label--underline">
                {{ phase.emoji }} {{ phase.label }}{% if phase.is_current %} [NOW]{% endif %}
              </p>
              {% for moment in phase.moments %}
                <p class="content">
                  {{ moment.area_emoji }} {{ moment.name }}
                  <span class="label"> {{ moment.area_name }}</span>
                </p>
              {% endfor %}
            {% endif %}
          {% endfor %}

          {% if total_allocated == 0 %}
            <p class="title" style="text-align: center; margin-top: 2em;">
              No moments allocated
            </p>
            <p class="description" style="text-align: center;">
              Open Zenborg to plan your day
            </p>
          {% endif %}

          <p class="label" style="margin-top: 1em;">
            {{ total_allocated }} allocated
            {% if total_unallocated > 0 %}
              &middot; {{ total_unallocated }} in deck
            {% endif %}
          </p>

        </div>
      </div>
    </div>
  </div>
</div>
```

**Note:** This template uses TRMNL's built-in CSS classes (`title_bar`, `label`, `content`, `description`). The exact rendering should be tested in TRMNL's preview tool. Adjust class names if needed based on their current framework version.

**Step 2: Commit**

```
git add docs/trmnl-template.liquid
git commit -m "docs: add TRMNL e-ink display Liquid template"
```

---

## Task 10: Vercel Relay Project

**Files:**
- Create: `packages/trmnl-relay/package.json`
- Create: `packages/trmnl-relay/api/push.ts`
- Create: `packages/trmnl-relay/api/markup.ts`
- Create: `packages/trmnl-relay/vercel.json`

This is a separate deployable Vercel project. Minimal: 2 API routes, ~100 lines.

**Step 1: Create package.json**

```json
{
  "name": "zenborg-trmnl-relay",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vercel dev",
    "deploy": "vercel --prod"
  },
  "dependencies": {
    "@vercel/kv": "^2.0.0"
  },
  "devDependencies": {
    "vercel": "^39.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create vercel.json**

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ]
}
```

**Step 3: Create the push endpoint**

`packages/trmnl-relay/api/push.ts`:

```typescript
import { kv } from "@vercel/kv";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();

    // Store payload keyed by API key
    await kv.set(`zenborg:${apiKey}`, JSON.stringify(body), { ex: 86400 }); // 24h TTL

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Bad request", { status: 400 });
  }
}
```

**Step 4: Create the markup endpoint (TRMNL polls this)**

`packages/trmnl-relay/api/markup.ts`:

```typescript
import { kv } from "@vercel/kv";

export const config = { runtime: "edge" };

interface TrmnlPhase {
  label: string;
  emoji: string;
  moments: Array<{ name: string; area_name: string; area_emoji: string }>;
  moment_count: number;
  is_current: boolean;
}

interface TrmnlMergeVariables {
  date_label: string;
  cycle_name: string;
  phases: TrmnlPhase[];
  total_allocated: number;
  total_unallocated: number;
}

function renderMarkup(vars: TrmnlMergeVariables): string {
  let phasesHtml = "";

  for (const phase of vars.phases) {
    if (phase.moment_count === 0) continue;

    const nowMarker = phase.is_current ? " [NOW]" : "";
    let momentsHtml = "";
    for (const m of phase.moments) {
      momentsHtml += `<p class="content">${m.area_emoji} ${m.name} <span class="label">${m.area_name}</span></p>`;
    }

    phasesHtml += `<p class="label label--underline">${phase.emoji} ${phase.label}${nowMarker}</p>${momentsHtml}`;
  }

  if (vars.total_allocated === 0) {
    phasesHtml = `<p class="title" style="text-align:center;margin-top:2em;">No moments allocated</p><p class="description" style="text-align:center;">Open Zenborg to plan your day</p>`;
  }

  const cycleHtml = vars.cycle_name ? `<p class="description">${vars.cycle_name}</p>` : "";
  const deckLabel = vars.total_unallocated > 0 ? ` &middot; ${vars.total_unallocated} in deck` : "";

  return `<div class="view view--full"><div class="layout"><div class="columns"><div class="column"><div class="markdown"><div class="title_bar"><span class="title_bar__title">Zenborg</span><span class="title_bar__instance">${vars.date_label}</span></div>${cycleHtml}${phasesHtml}<p class="label" style="margin-top:1em;">${vars.total_allocated} allocated${deckLabel}</p></div></div></div></div></div>`;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // TRMNL sends access_token in authorization header
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Read stored payload
  const raw = await kv.get<string>(`zenborg:${accessToken}`);

  if (!raw) {
    const emptyMarkup = renderMarkup({
      date_label: "Today",
      cycle_name: "",
      phases: [],
      total_allocated: 0,
      total_unallocated: 0,
    });

    return new Response(JSON.stringify({ markup: emptyMarkup }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
  const vars = payload.merge_variables as TrmnlMergeVariables;
  const markup = renderMarkup(vars);

  return new Response(
    JSON.stringify({
      markup,
      markup_half_horizontal: markup,
      markup_half_vertical: markup,
      markup_quadrant: markup,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

**Step 5: Commit**

```
git add packages/trmnl-relay/
git commit -m "feat(trmnl): add Vercel relay project for persistent e-ink display"
```

---

## Task 11: Final Verification

**Step 1: Run all tests**

Run: `pnpm test --run`
Expected: All tests pass (330 original + 16 formatter + 8 client = 354)

**Step 2: Manual smoke test checklist**

- [ ] Open Settings > E-Ink Display section appears
- [ ] Switch between Direct/Relay mode - correct fields appear
- [ ] Enter a UUID - enable toggle becomes active
- [ ] Toggle on - console shows `[TRMNL] Starting reactive sync`
- [ ] Click Sync Now - console shows `[TRMNL] Push successful` or error
- [ ] Allocate a moment to today - auto-sync fires after 5s
- [ ] Status line shows "Last sync: X ago"
- [ ] Toggle off - console shows `[TRMNL] Sync stopped`

**Step 3: Commit any fixes, then final commit**

```
git add -A
git commit -m "feat(trmnl): complete e-ink display integration"
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/domain/services/TrmnlFormatter.ts` | Pure data transformer (DONE) |
| `src/domain/services/__tests__/TrmnlFormatter.test.ts` | Formatter tests (DONE) |
| `src/infrastructure/state/integration-store.ts` | Settings observable |
| `src/infrastructure/state/persistence.ts` | Wire localStorage sync |
| `src/infrastructure/integrations/trmnl-client.ts` | HTTP push functions |
| `src/infrastructure/integrations/__tests__/trmnl-client.test.ts` | Client tests |
| `src/infrastructure/integrations/trmnl-sync.ts` | Reactive sync orchestrator |
| `src/components/TrmnlSettingsSection.tsx` | Settings UI |
| `src/components/SettingsDrawer.tsx` | Add accordion item |
| `src/app/StoreInitializer.tsx` | Boot integration |
| `docs/trmnl-template.liquid` | TRMNL markup template |
| `packages/trmnl-relay/` | Vercel relay project |

## Existing Code to Reuse

| Function | File | Used For |
|----------|------|----------|
| `getCurrentPhase()` | `src/domain/value-objects/Phase.ts:127` | Detect active phase for `is_current` flag |
| `getVisiblePhases()` | `src/domain/value-objects/Phase.ts:170` | Filter hidden phases |
| `momentsByDayAndPhase$` | `src/infrastructure/state/store.ts:265` | Reactive dependency for sync trigger |
| `activeCycle$` | `src/infrastructure/state/store.ts:148` | Current cycle name |
| `syncObservable` | `@legendapp/state/sync` | Persist settings to localStorage |
| `observe()` | `@legendapp/state` | Reactive change detection |
