import { isTauri } from "./vault/is-tauri";

export interface GapNotification {
  readonly habitName: string;
  readonly durationLabel: string;
  readonly gapType: string;
}

/**
 * Send a silent gap proposal notification via Tauri.
 * No sound, no badge, no action buttons. The name IS the proposal.
 */
export async function sendGapNotification(
  notif: GapNotification,
): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { sendNotification, isPermissionGranted, requestPermission } =
      await import("@tauri-apps/plugin-notification");
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === "granted";
    }
    if (!granted) return false;

    sendNotification({
      title: notif.habitName,
      body: `${notif.durationLabel} · ${notif.gapType}`,
      sound: undefined,
    });
    return true;
  } catch {
    return false;
  }
}
