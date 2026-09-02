"use client";

import { observer } from "@legendapp/state/react";
import {
  ChevronRight,
  Download,
  Info,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Settings2,
  Smartphone,
  Sun,
  Tv,
  Upload,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { ImportStrategy } from "@zenborg/core/application/use-cases/export-import";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdater } from "@/hooks/useUpdater";
import {
  exportGardenData,
  importGardenData,
} from "@/infrastructure/state/export-import";
import { resetStore } from "@/infrastructure/state/initialize";
import { getPWAInstructions, isPWA } from "@/lib/pwa-utils";
import { isTauri } from "@/lib/tauri-utils";
import { cn } from "@/lib/utils";
import { ConfirmableAction } from "./ConfirmableAction";
import { PeoplePlacesSection } from "./PeoplePlacesSection";
import { TrmnlSettingsSection } from "./TrmnlSettingsSection";
import { VaultStatusSection } from "./VaultStatusSection";

type SettingsPane =
  | "phases"
  | "people-places"
  | "data"
  | "integrations"
  | "appearance"
  | "about";

const navigationItems: readonly {
  id: SettingsPane;
  label: string;
  icon: typeof Settings2;
}[] = [
  { id: "phases", label: "Phases", icon: Settings2 },
  { id: "people-places", label: "People & Places", icon: User },
  { id: "data", label: "Data", icon: Download },
  { id: "integrations", label: "E-Ink Display", icon: Tv },
  { id: "appearance", label: "Appearance", icon: Sun },
  { id: "about", label: "About", icon: Info },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onOpenPhaseSettings: () => void;
}

export const SettingsModal = observer(function SettingsModal({
  open,
  onClose,
  onOpenPhaseSettings,
}: SettingsModalProps) {
  const [activePane, setActivePane] = useState<SettingsPane>("appearance");
  const [importMessage, setImportMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const {
    update,
    checking,
    downloading,
    error: updateError,
    downloadProgress,
    checkForUpdate,
    downloadAndInstall,
  } = useUpdater(false);
  const [hasChecked, setHasChecked] = useState(false);

  const handleCheckForUpdate = async () => {
    setHasChecked(false);
    await checkForUpdate();
    setHasChecked(true);
  };

  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [pwaInstructions, setPwaInstructions] = useState<{
    platform: "ios" | "android" | "desktop" | "unknown";
    instructions: string[];
  }>({ platform: "unknown", instructions: [] });

  useEffect(() => {
    setMounted(true);
    setPwaInstalled(isPWA());
    setPwaInstructions(getPWAInstructions());
  }, []);

  const handleExport = () => {
    try {
      exportGardenData();
      setImportMessage({ type: "success", text: "Data exported successfully" });
      setTimeout(() => setImportMessage(null), 3000);
    } catch (error) {
      setImportMessage({
        type: "error",
        text: `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
          setImportMessage({ type: "success", text: result.message });
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setImportMessage({
            type: "error",
            text: result.message + (result.errors ? `: ${result.errors.join(", ")}` : ""),
          });
        }
      } catch (error) {
        setImportMessage({
          type: "error",
          text: `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
      console.error("[SettingsModal] Failed to reset store:", error);
      setIsResetting(false);
      setImportMessage({
        type: "error",
        text: `Reset failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  };

  const showPwa = !isTauri() && !isPWA();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[600px] md:max-w-[700px]" showCloseButton={false}>
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Configure your Zenborg experience
        </DialogDescription>

        <div className="flex h-[min(600px,80dvh)]">
          {/* Sidebar nav */}
          <nav className="hidden md:flex w-48 shrink-0 flex-col border-r border-stone-200 dark:border-stone-700 bg-stone-100/50 dark:bg-stone-800/50 py-2">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "phases") {
                    onOpenPhaseSettings();
                  } else {
                    setActivePane(item.id);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm transition-colors text-left w-full",
                  activePane === item.id && item.id !== "phases"
                    ? "bg-stone-200/80 dark:bg-stone-700/80 text-stone-900 dark:text-stone-100"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/40 dark:hover:bg-stone-700/40",
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.id === "phases" && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
              </button>
            ))}

            {showPwa && (
              <button
                type="button"
                onClick={() => setActivePane("about")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm transition-colors text-left w-full",
                  "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/40 dark:hover:bg-stone-700/40",
                )}
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>Install App</span>
              </button>
            )}
          </nav>

          {/* Content pane */}
          <main className="flex-1 overflow-y-auto p-6">
            {activePane === "people-places" && <PeoplePlacesSection />}

            {activePane === "data" && (
              <div className="space-y-3">
                <VaultStatusSection />

                <button
                  type="button"
                  onClick={handleExport}
                  className="w-full flex items-center gap-3 px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-stone-100 dark:bg-stone-800">
                    <Download className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100">Export Data</div>
                    <div className="text-xs text-stone-500">Download as JSON</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleImport("merge")}
                  disabled={isImporting}
                  className="w-full flex items-center gap-3 px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-stone-100 dark:bg-stone-800">
                    <Upload className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100">Import (Merge)</div>
                    <div className="text-xs text-stone-500">Combine with existing</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleImport("replace")}
                  disabled={isImporting}
                  className="w-full flex items-center gap-3 px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-stone-100 dark:bg-stone-800">
                    <Upload className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100">Import (Replace)</div>
                    <div className="text-xs text-stone-500">Replace all data</div>
                  </div>
                </button>

                {importMessage && (
                  <div
                    className={cn(
                      "mt-3 px-3 py-2 rounded text-sm",
                      importMessage.type === "success"
                        ? "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800",
                    )}
                  >
                    {importMessage.text}
                  </div>
                )}

                {isImporting && (
                  <div className="mt-3 text-center text-sm text-stone-500">Importing data...</div>
                )}

                <div className="pt-3 mt-3 border-t border-red-200 dark:border-red-900/30">
                  <h4 className="text-xs font-medium text-red-900 dark:text-red-200 mb-2">Danger Zone</h4>
                  <p className="text-xs text-stone-500 mb-3">Reset all data to factory defaults</p>

                  {!showResetConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={isResetting}
                      className="w-full flex items-center gap-3 px-3 py-2.5 border border-red-300 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-red-100 dark:bg-red-900/20">
                        <RotateCcw className="w-4 h-4 text-red-700 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-red-900 dark:text-red-200">Reset All Data</div>
                      </div>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {isResetting ? (
                        <div className="text-center py-3 text-sm text-stone-500 font-mono">Resetting...</div>
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
            )}

            {activePane === "integrations" && <TrmnlSettingsSection />}

            {activePane === "appearance" && (
              <div className="space-y-2">
                {mounted ? (
                  <>
                    {([
                      { value: "light" as const, label: "Light", Icon: Sun },
                      { value: "dark" as const, label: "Dark", Icon: Moon },
                      { value: "system" as const, label: "System", Icon: Monitor },
                    ] as const).map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTheme(value)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 border rounded transition-colors text-left",
                          theme === value
                            ? "border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800"
                            : "border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800",
                        )}
                      >
                        <div
                          className={cn(
                            "flex-shrink-0 w-8 h-8 flex items-center justify-center rounded",
                            theme === value
                              ? "bg-stone-200 dark:bg-stone-700"
                              : "bg-stone-100 dark:bg-stone-800",
                          )}
                        >
                          <Icon className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-stone-900 dark:text-stone-100">{label}</div>
                        </div>
                        {theme === value && (
                          <div className="w-2 h-2 rounded-full bg-stone-900 dark:bg-stone-100" />
                        )}
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-6 text-sm text-stone-500">Loading...</div>
                )}
              </div>
            )}

            {activePane === "about" && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">Zenborg</h3>
                  <p className="text-sm text-stone-600 dark:text-stone-400 mb-1">
                    An attention orchestration system for budgeting moments toward personal flourishing.
                  </p>
                  <p className="text-xs text-stone-500 font-mono">
                    Version {process.env.NEXT_PUBLIC_APP_VERSION ?? "0.3.1"}
                  </p>
                </div>

                {isTauri() && (
                  <div className="pt-3 border-t border-stone-200 dark:border-stone-700 space-y-2">
                    <button
                      type="button"
                      onClick={handleCheckForUpdate}
                      disabled={checking || downloading}
                      className="w-full flex items-center gap-3 px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-stone-100 dark:bg-stone-800">
                        {checking ? (
                          <Loader2 className="w-4 h-4 text-stone-600 dark:text-stone-400 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          {checking ? "Checking..." : "Check for Updates"}
                        </div>
                      </div>
                    </button>

                    {hasChecked && update && !downloading && (
                      <div className="p-3 rounded border border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800">
                        <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          Version {update.version} available
                        </p>
                        <button
                          type="button"
                          onClick={downloadAndInstall}
                          className="mt-2 w-full rounded bg-stone-900 dark:bg-stone-100 px-3 py-2 text-sm font-medium text-stone-50 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
                        >
                          Install Update
                        </button>
                      </div>
                    )}

                    {downloading && (
                      <div className="p-3 rounded border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                          <div
                            className="h-full bg-stone-900 dark:bg-stone-100 transition-all duration-300"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-400">
                          Downloading... {Math.round(downloadProgress)}%
                        </p>
                      </div>
                    )}

                    {hasChecked && !update && !checking && !updateError && (
                      <p className="px-3 text-xs text-stone-500">You're on the latest version.</p>
                    )}

                    {updateError && (
                      <p className="px-3 text-xs text-red-600 dark:text-red-400">{updateError}</p>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-stone-200 dark:border-stone-700">
                  <blockquote className="text-xs text-stone-600 dark:text-stone-400 italic border-l-2 border-stone-300 dark:border-stone-700 pl-3">
                    "Where will I place my consciousness today?"
                  </blockquote>
                </div>
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
});
