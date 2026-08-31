import { defineConfig } from "@playwright/test";

/**
 * Tauri E2E tests — runs against the real Tauri webview via the
 * tauri-plugin-playwright socket bridge.
 *
 * Prerequisites:
 *   pnpm tauri dev --features e2e-testing
 *
 * Then:
 *   pnpm test:e2e:tauri
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.tauri.spec.ts",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    mode: "tauri" as any,
  },
});
