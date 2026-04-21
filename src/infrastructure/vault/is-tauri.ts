/**
 * Detect whether we're running inside the Tauri desktop shell.
 *
 * Zenborg ships as both a Next.js web app and a Tauri-wrapped desktop app.
 * The vault is only available in desktop; web users stay on IDB-only.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  // Tauri 2.x exposes a global marker on the window object.
  return (
    "__TAURI_INTERNALS__" in window || "__TAURI_METADATA__" in window
  );
}
