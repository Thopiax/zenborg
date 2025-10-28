/**
 * Tauri environment detection and utilities
 */

/**
 * Check if the app is running inside Tauri
 */
export function isTauri(): boolean {
	if (typeof window === "undefined") return false;
	return "__TAURI__" in window;
}

/**
 * Get the Tauri API if available
 */
export function getTauriAPI() {
	if (!isTauri()) return null;
	return (window as any).__TAURI__;
}

/**
 * Check if this Tauri instance should run as a Garden (server)
 * Desktop apps are always Gardens, web/mobile are Portals
 */
export function isTauriGarden(): boolean {
	return isTauri(); // Tauri = desktop = garden
}
