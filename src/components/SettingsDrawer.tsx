"use client";

import { observer } from "@legendapp/state/react";
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  Info,
  Keyboard,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Settings2,
  Smartphone,
  Sun,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { ImportStrategy } from "@/application/use-cases/export-import";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  exportGardenData,
  importGardenData,
} from "@/infrastructure/state/export-import";
import { resetStore } from "@/infrastructure/state/initialize";
import {
  gardenSyncSettings$,
  gardenSyncStatus$,
  gardenSyncPeers$,
  generateRoomName,
} from "@/infrastructure/state/ui-store";
import { ConfirmableAction } from "./ConfirmableAction";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { getPWAInstructions, isPWA } from "@/lib/pwa-utils";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenPhaseSettings: () => void;
  onOpenAreaManagement: () => void;
}

/**
 * Settings Drawer - Professional settings interface
 * - Right-sliding drawer (desktop sidebar, mobile full-screen landscape)
 * - Accordion sections for organization
 * - Integrated area management
 * - Monochromatic stone design
 */
export const SettingsDrawer = observer(function SettingsDrawer({
  open,
  onClose,
  onOpenPhaseSettings,
  onOpenAreaManagement,
}: SettingsDrawerProps) {
  const [importMessage, setImportMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Theme management
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // PWA state
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [pwaInstructions, setPwaInstructions] = useState<{
    platform: "ios" | "android" | "desktop" | "unknown";
    instructions: string[];
  }>({ platform: "unknown", instructions: [] });

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setPwaInstalled(isPWA());
    setPwaInstructions(getPWAInstructions());
  }, []);

  const handleExport = () => {
    try {
      exportGardenData();
      setImportMessage({
        type: "success",
        text: "Data exported successfully",
      });
      setTimeout(() => setImportMessage(null), 3000);
    } catch (error) {
      setImportMessage({
        type: "error",
        text: `Export failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  };

  const handleImport = async (strategy: ImportStrategy) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      setImportMessage(null);

      try {
        const result = await importGardenData(file, strategy);

        if (result.success) {
          setImportMessage({
            type: "success",
            text: result.message,
          });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setImportMessage({
            type: "error",
            text:
              result.message +
              (result.errors ? `: ${result.errors.join(", ")}` : ""),
          });
        }
      } catch (error) {
        setImportMessage({
          type: "error",
          text: `Import failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      } finally {
        setIsImporting(false);
      }
    };

    input.click();
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetStore();
      window.location.reload();
    } catch (error) {
      console.error("[SettingsDrawer] Failed to reset store:", error);
      setIsResetting(false);
      setImportMessage({
        type: "error",
        text: `Reset failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  };

  return (
    <Drawer open={open} onOpenChange={onClose} direction="right">
      <DrawerContent className="w-full md:w-[400px] h-full md:h-auto bg-stone-50 dark:bg-stone-900 border-l border-stone-200 dark:border-stone-700">
        <DrawerHeader className="border-b border-stone-200 dark:border-stone-700">
          <DrawerTitle className="text-stone-900 dark:text-stone-100">
            Settings
          </DrawerTitle>
          <DrawerDescription className="text-stone-600 dark:text-stone-400">
            Configure your Zenborg experience
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <Accordion type="single" collapsible className="space-y-2">
            {/* Areas Section (Link Button) */}
            <AccordionItem
              value="areas"
              className="border-stone-200 dark:border-stone-700"
            >
              <button
                onClick={onOpenAreaManagement}
                className="flex w-full items-center justify-between px-2 py-4 text-left text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                type="button"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  <span>Areas</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </AccordionItem>

            {/* Phase Settings Section (Link Button) */}
            <AccordionItem
              value="phases"
              className="border-stone-200 dark:border-stone-700"
            >
              <button
                onClick={onOpenPhaseSettings}
                className="flex w-full items-center justify-between px-2 py-4 text-left text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                type="button"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  <span>Phase Settings</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </AccordionItem>

            {/* Data Management Section */}
            <AccordionItem
              value="data"
              className="border-stone-200 dark:border-stone-700"
            >
              <AccordionTrigger className="text-stone-900 dark:text-stone-100 hover:no-underline px-2">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Data Management</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 px-2">
                  {/* Export Button */}
                  <button
                    type="button"
                    onClick={handleExport}
                    className="w-full flex items-center gap-3 px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800">
                      <Download className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        Export Data
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-500">
                        Download as JSON
                      </div>
                    </div>
                  </button>

                  {/* Import (Merge) Button */}
                  <button
                    type="button"
                    onClick={() => handleImport("merge")}
                    disabled={isImporting}
                    className="w-full flex items-center gap-3 px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800">
                      <Upload className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        Import (Merge)
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-500">
                        Combine with existing
                      </div>
                    </div>
                  </button>

                  {/* Import (Replace) Button */}
                  <button
                    type="button"
                    onClick={() => handleImport("replace")}
                    disabled={isImporting}
                    className="w-full flex items-center gap-3 px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800">
                      <Upload className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        Import (Replace)
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-500">
                        Replace all data
                      </div>
                    </div>
                  </button>

                  {/* Status Message */}
                  {importMessage && (
                    <div
                      className={`mt-3 px-3 py-2 rounded-lg text-sm ${
                        importMessage.type === "success"
                          ? "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                          : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                      }`}
                    >
                      {importMessage.text}
                    </div>
                  )}

                  {isImporting && (
                    <div className="mt-3 text-center text-sm text-stone-500 dark:text-stone-500">
                      Importing data...
                    </div>
                  )}

                  {/* Danger Zone - Reset */}
                  <div className="pt-3 mt-3 border-t border-red-200 dark:border-red-900/30">
                    <h4 className="text-xs font-medium text-red-900 dark:text-red-200 mb-2">
                      Danger Zone
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-500 mb-3">
                      Reset all data to factory defaults
                    </p>

                    {!showResetConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(true)}
                        disabled={isResetting}
                        className="w-full flex items-center gap-3 px-3 py-2.5 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20">
                          <RotateCcw className="w-4 h-4 text-red-700 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-red-900 dark:text-red-200">
                            Reset All Data
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {isResetting ? (
                          <div className="text-center py-3 text-sm text-stone-500 dark:text-stone-500 font-mono">
                            Resetting...
                          </div>
                        ) : (
                          <>
                            <ConfirmableAction
                              buttonLabel="Reset Everything"
                              confirmText="RESET"
                              variant="danger"
                              description="Type RESET below:"
                              onConfirm={handleReset}
                            />
                            <button
                              type="button"
                              onClick={() => setShowResetConfirm(false)}
                              className="w-full px-3 py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Garden Sync Section */}
            <AccordionItem
              value="garden"
              className="border-stone-200 dark:border-stone-700"
            >
              <AccordionTrigger className="text-stone-900 dark:text-stone-100 hover:no-underline px-2">
                <div className="flex items-center gap-2">
                  {gardenSyncSettings$.enabled.get() && gardenSyncStatus$.get() === "connected" ? (
                    <Wifi className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  )}
                  <span>Garden Sync</span>
                  {gardenSyncSettings$.enabled.get() && gardenSyncStatus$.get() === "connected" && (
                    <span className="text-xs text-stone-500 dark:text-stone-500">
                      ({gardenSyncPeers$.get()} peers)
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 px-2">
                  {/* Description */}
                  <div className="p-3 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                    <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                      <strong className="text-stone-900 dark:text-stone-100">
                        Local-first sync
                      </strong>
                      : Connect devices on the same network. Your desktop acts as a "garden" and your
                      laptop/phone as "portals" that sync together.
                    </p>
                    {mounted && (
                      <p className="mt-2 text-xs text-stone-500 dark:text-stone-500 font-mono">
                        {typeof window !== "undefined" && "__TAURI__" in window
                          ? "Mode: WebSocket (Tauri local server)"
                          : "Mode: WebRTC P2P (Web browser)"}
                      </p>
                    )}
                  </div>

                  {/* Enable Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        Enable Garden Sync
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-500">
                        Sync with other devices
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        gardenSyncSettings$.enabled.set(!gardenSyncSettings$.enabled.get());
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        gardenSyncSettings$.enabled.get()
                          ? "bg-stone-900 dark:bg-stone-100"
                          : "bg-stone-300 dark:bg-stone-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-stone-900 transition-transform ${
                          gardenSyncSettings$.enabled.get() ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {gardenSyncSettings$.enabled.get() && (
                    <>
                      {/* Device Role Selector */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-900 dark:text-stone-100 block">
                          Device Role
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => gardenSyncSettings$.role.set("garden")}
                            className={`px-3 py-2.5 border rounded-lg transition-colors text-left ${
                              gardenSyncSettings$.role.get() === "garden"
                                ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
                                : "border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                            }`}
                          >
                            <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                              Garden
                            </div>
                            <div className="text-xs text-stone-500 dark:text-stone-500">
                              Primary device
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => gardenSyncSettings$.role.set("portal")}
                            className={`px-3 py-2.5 border rounded-lg transition-colors text-left ${
                              gardenSyncSettings$.role.get() === "portal"
                                ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
                                : "border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                            }`}
                          >
                            <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                              Portal
                            </div>
                            <div className="text-xs text-stone-500 dark:text-stone-500">
                              Secondary device
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Room Name Input */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-900 dark:text-stone-100 block">
                          Room Name
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={gardenSyncSettings$.roomName.get()}
                            onChange={(e) => gardenSyncSettings$.roomName.set(e.target.value.toUpperCase())}
                            placeholder="ABC123"
                            maxLength={6}
                            className="flex-1 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm font-mono uppercase placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-600"
                          />
                          <button
                            type="button"
                            onClick={() => gardenSyncSettings$.roomName.set(generateRoomName())}
                            className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            title="Generate random room name"
                          >
                            <RefreshCw className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const roomName = gardenSyncSettings$.roomName.get();
                              if (roomName) {
                                await navigator.clipboard.writeText(roomName);
                              }
                            }}
                            className="px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            title="Copy room name"
                            disabled={!gardenSyncSettings$.roomName.get()}
                          >
                            <Copy className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                          </button>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-500">
                          Share this code with other devices to sync
                        </p>
                      </div>

                      {/* Password (Optional) */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-900 dark:text-stone-100 block">
                          Password (Optional)
                        </label>
                        <input
                          type="password"
                          value={gardenSyncSettings$.password.get() || ""}
                          onChange={(e) => gardenSyncSettings$.password.set(e.target.value || null)}
                          placeholder="Leave empty for no encryption"
                          className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-600"
                        />
                        <p className="text-xs text-stone-500 dark:text-stone-500">
                          Encrypt sync data (all devices must use same password)
                        </p>
                      </div>

                      {/* Connection Status */}
                      <div className="pt-3 border-t border-stone-200 dark:border-stone-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {gardenSyncStatus$.get() === "connected" ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-sm text-stone-900 dark:text-stone-100">
                                  Connected
                                </span>
                              </>
                            ) : gardenSyncStatus$.get() === "connecting" ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                <span className="text-sm text-stone-900 dark:text-stone-100">
                                  Connecting...
                                </span>
                              </>
                            ) : gardenSyncStatus$.get() === "syncing" ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-sm text-stone-900 dark:text-stone-100">
                                  Syncing...
                                </span>
                              </>
                            ) : gardenSyncStatus$.get() === "error" ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-sm text-red-600 dark:text-red-400">
                                  Connection Error
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 rounded-full bg-stone-400" />
                                <span className="text-sm text-stone-500 dark:text-stone-500">
                                  Disconnected
                                </span>
                              </>
                            )}
                          </div>
                          {gardenSyncStatus$.get() === "connected" && (
                            <span className="text-xs text-stone-500 dark:text-stone-500">
                              {gardenSyncPeers$.get()} {gardenSyncPeers$.get() === 1 ? "peer" : "peers"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Debug Mode Toggle */}
                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                            Debug Mode
                          </div>
                          <div className="text-xs text-stone-500 dark:text-stone-500">
                            Show sync logs in console
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            gardenSyncSettings$.debug.set(!gardenSyncSettings$.debug.get());
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            gardenSyncSettings$.debug.get()
                              ? "bg-stone-900 dark:bg-stone-100"
                              : "bg-stone-300 dark:bg-stone-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-stone-900 transition-transform ${
                              gardenSyncSettings$.debug.get() ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PWA Installation Section */}
            <AccordionItem
              value="pwa"
              className="border-stone-200 dark:border-stone-700"
            >
              <AccordionTrigger className="text-stone-900 dark:text-stone-100 hover:no-underline px-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span>Install App</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 px-2">
                  {mounted ? (
                    pwaInstalled ? (
                      // Already installed
                      <div className="p-4 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-stone-900 dark:bg-stone-100 flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-stone-50 dark:text-stone-900" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
                              App Installed
                            </h4>
                            <p className="text-xs text-stone-600 dark:text-stone-400">
                              You're using Zenborg as a standalone app. Enjoy
                              the full-screen experience!
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Not installed - show instructions
                      <>
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2">
                              Why install Zenborg?
                            </h4>
                            <ul className="space-y-1.5 text-sm text-stone-600 dark:text-stone-400">
                              <li className="flex items-start gap-2">
                                <span className="text-stone-900 dark:text-stone-100 font-bold flex-shrink-0">
                                  ✓
                                </span>
                                <span>Full-screen without browser chrome</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-stone-900 dark:text-stone-100 font-bold flex-shrink-0">
                                  ✓
                                </span>
                                <span>Faster access from home screen</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-stone-900 dark:text-stone-100 font-bold flex-shrink-0">
                                  ✓
                                </span>
                                <span>Works offline with local data</span>
                              </li>
                            </ul>
                          </div>

                          <div className="pt-3 border-t border-stone-200 dark:border-stone-700">
                            <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-3">
                              How to install:
                            </h4>
                            <ol className="space-y-2.5">
                              {pwaInstructions.instructions.map(
                                (instruction, index) => (
                                  <li
                                    key={index}
                                    className="flex items-start gap-3 text-sm text-stone-700 dark:text-stone-300"
                                  >
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 flex items-center justify-center text-xs font-bold">
                                      {index + 1}
                                    </span>
                                    <span className="pt-0.5">{instruction}</span>
                                  </li>
                                )
                              )}
                            </ol>
                          </div>

                          {pwaInstructions.platform === "ios" && (
                            <div className="p-3 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                              <p className="text-xs text-stone-600 dark:text-stone-400">
                                <strong className="text-stone-900 dark:text-stone-100">
                                  Note:
                                </strong>{" "}
                                On iOS, you must use Safari to install the app.
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )
                  ) : (
                    <div className="text-center py-6 text-sm text-stone-500 dark:text-stone-500">
                      Loading...
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Appearance Section */}
            <AccordionItem
              value="appearance"
              className="border-stone-200 dark:border-stone-700"
            >
              <AccordionTrigger className="text-stone-900 dark:text-stone-100 hover:no-underline px-2">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  <span>Appearance</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 px-2">
                  {mounted ? (
                    <>
                      {/* Light Theme */}
                      <button
                        type="button"
                        onClick={() => setTheme("light")}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-lg transition-colors text-left ${
                          theme === "light"
                            ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
                            : "border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${
                            theme === "light"
                              ? "bg-stone-200 dark:bg-stone-700"
                              : "bg-stone-100 dark:bg-stone-800"
                          }`}
                        >
                          <Sun className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                            Light
                          </div>
                        </div>
                        {theme === "light" && (
                          <div className="w-2 h-2 rounded-full bg-stone-900 dark:bg-stone-100" />
                        )}
                      </button>

                      {/* Dark Theme */}
                      <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-lg transition-colors text-left ${
                          theme === "dark"
                            ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
                            : "border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${
                            theme === "dark"
                              ? "bg-stone-200 dark:bg-stone-700"
                              : "bg-stone-100 dark:bg-stone-800"
                          }`}
                        >
                          <Moon className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                            Dark
                          </div>
                        </div>
                        {theme === "dark" && (
                          <div className="w-2 h-2 rounded-full bg-stone-900 dark:bg-stone-100" />
                        )}
                      </button>

                      {/* System Theme */}
                      <button
                        type="button"
                        onClick={() => setTheme("system")}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-lg transition-colors text-left ${
                          theme === "system"
                            ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
                            : "border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${
                            theme === "system"
                              ? "bg-stone-200 dark:bg-stone-700"
                              : "bg-stone-100 dark:bg-stone-800"
                          }`}
                        >
                          <Monitor className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                            System
                          </div>
                        </div>
                        {theme === "system" && (
                          <div className="w-2 h-2 rounded-full bg-stone-900 dark:bg-stone-100" />
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-6 text-sm text-stone-500 dark:text-stone-500">
                      Loading...
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Keyboard Shortcuts Section */}
            <AccordionItem
              value="shortcuts"
              className="border-stone-200 dark:border-stone-700"
            >
              <AccordionTrigger className="text-stone-900 dark:text-stone-100 hover:no-underline px-2">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4" />
                  <span>Keyboard Shortcuts</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-2">
                  <KeyboardShortcutsHelp />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* About Section */}
            <AccordionItem
              value="about"
              className="border-stone-200 dark:border-stone-700"
            >
              <AccordionTrigger className="text-stone-900 dark:text-stone-100 hover:no-underline px-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  <span>About</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 px-2">
                  <div>
                    <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">
                      Zenborg
                    </h3>
                    <p className="text-sm text-stone-600 dark:text-stone-400 mb-1">
                      An attention orchestration system for budgeting moments
                      toward personal flourishing.
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-500 font-mono">
                      Version 1.0.0
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-200 dark:border-stone-700">
                    <h4 className="text-xs font-medium text-stone-900 dark:text-stone-100 mb-2">
                      Philosophy
                    </h4>
                    <blockquote className="text-xs text-stone-600 dark:text-stone-400 italic border-l-2 border-stone-300 dark:border-stone-700 pl-3">
                      "Where will I place my consciousness today?"
                    </blockquote>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DrawerContent>
    </Drawer>
  );
});
