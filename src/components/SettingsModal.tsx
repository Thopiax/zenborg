"use client";

import { Download, Monitor, Moon, RotateCcw, Settings, Sun, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { ImportStrategy } from "@/application/use-cases/export-import";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  exportGardenData,
  importGardenData,
} from "@/infrastructure/state/export-import";
import { ConfirmableAction } from "./ConfirmableAction";
import { resetStore } from "@/infrastructure/state/initialize";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "data" | "appearance" | "about";

/**
 * Settings Modal - Centralized settings with tabbed interface
 *
 * Tabs:
 * - My Data: Export/import functionality
 * - Appearance: Theme settings (future)
 * - About: App info, version (future)
 */
export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("data");
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

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
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
          // Reload page to refresh all components with new data
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
      console.log("[SettingsModal] Starting database reset...");
      await resetStore();
      console.log("[SettingsModal] Reset complete, reloading page...");
      // Force page reload to ensure all components re-render with fresh data
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your data, appearance, and preferences
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-stone-200 dark:border-stone-700 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "data"
                ? "text-stone-900 dark:text-stone-100 border-b-2 border-stone-900 dark:border-stone-100"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            My Data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "appearance"
                ? "text-stone-900 dark:text-stone-100 border-b-2 border-stone-900 dark:border-stone-100"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            Appearance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("about")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "about"
                ? "text-stone-900 dark:text-stone-100 border-b-2 border-stone-900 dark:border-stone-100"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            About
          </button>
        </div>

        {/* Tab Content */}
        <div className="px-6 py-4">
          {/* My Data Tab */}
          {activeTab === "data" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-2">
                  Export & Import
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
                  Download your garden data as JSON or restore from a backup
                  file.
                </p>

                <div className="space-y-3">
                  {/* Export Button */}
                  <button
                    type="button"
                    onClick={handleExport}
                    className="w-full flex items-center gap-3 px-4 py-3 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-700">
                      <Download className="w-5 h-5 text-stone-600 dark:text-stone-300" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        Export Data
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        Download all moments, areas, and settings as JSON
                      </div>
                    </div>
                  </button>

                  {/* Import (Merge) Button */}
                  <button
                    type="button"
                    onClick={() => handleImport("merge")}
                    disabled={isImporting}
                    className="w-full flex items-center gap-3 px-4 py-3 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-700">
                      <Upload className="w-5 h-5 text-stone-600 dark:text-stone-300" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        Import Data (Merge)
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        Combine imported data with existing garden
                      </div>
                    </div>
                  </button>

                  {/* Import (Replace) Button */}
                  <button
                    type="button"
                    onClick={() => handleImport("replace")}
                    disabled={isImporting}
                    className="w-full flex items-center gap-3 px-4 py-3 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-700">
                      <Upload className="w-5 h-5 text-stone-600 dark:text-stone-300" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        Import Data (Replace)
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        Replace all existing data with imported garden
                      </div>
                    </div>
                  </button>
                </div>

                {/* Status Message */}
                {importMessage && (
                  <div
                    className={`mt-4 px-4 py-3 rounded-lg text-sm ${
                      importMessage.type === "success"
                        ? "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    {importMessage.text}
                  </div>
                )}

                {isImporting && (
                  <div className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
                    Importing data...
                  </div>
                )}
              </div>

              {/* Data Info */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-700">
                <h4 className="text-xs font-medium text-stone-900 dark:text-stone-100 mb-2">
                  What's included
                </h4>
                <ul className="text-xs text-stone-500 dark:text-stone-400 space-y-1">
                  <li>• All moments (allocated and unallocated)</li>
                  <li>• Custom areas and configurations</li>
                  <li>• Cycles and phase settings</li>
                  <li>• Timestamps and metadata</li>
                </ul>
              </div>

              {/* Danger Zone - Reset Database */}
              <div className="pt-6 border-t border-red-200 dark:border-red-900/30">
                <h3 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
                  Danger Zone
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
                  Permanently delete all moments and reset areas, phases, and cycles to factory defaults. This action cannot be undone.
                </p>

                {!showResetConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={isResetting}
                    className="w-full flex items-center gap-3 px-4 py-3 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20">
                      <RotateCcw className="w-5 h-5 text-red-700 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-red-900 dark:text-red-200">
                        Reset All Data
                      </div>
                      <div className="text-xs text-red-700 dark:text-red-400">
                        Clear everything and start fresh
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-3">
                    {isResetting ? (
                      <div className="text-center py-4 text-sm text-stone-500 dark:text-stone-400 font-mono">
                        Resetting database...
                      </div>
                    ) : (
                      <>
                        <ConfirmableAction
                          buttonLabel="Reset Everything"
                          confirmText="RESET"
                          variant="danger"
                          description="Type RESET below to permanently delete all data:"
                          onConfirm={handleReset}
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetConfirm(false)}
                          className="w-full px-4 py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
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

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-2">
                  Theme
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
                  Choose how Zenborg looks. System matches your device settings.
                </p>

                {mounted ? (
                  <div className="space-y-2">
                    {/* Light Theme */}
                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors text-left ${
                        theme === "light"
                          ? "border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800"
                          : "border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"
                      }`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${
                        theme === "light"
                          ? "bg-stone-200 dark:bg-stone-700"
                          : "bg-stone-100 dark:bg-stone-800"
                      }`}>
                        <Sun className="w-5 h-5 text-stone-700 dark:text-stone-300" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          Light
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          Always use light theme
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
                      className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors text-left ${
                        theme === "dark"
                          ? "border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800"
                          : "border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"
                      }`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${
                        theme === "dark"
                          ? "bg-stone-200 dark:bg-stone-700"
                          : "bg-stone-100 dark:bg-stone-800"
                      }`}>
                        <Moon className="w-5 h-5 text-stone-700 dark:text-stone-300" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          Dark
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          Always use dark theme
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
                      className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors text-left ${
                        theme === "system"
                          ? "border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800"
                          : "border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"
                      }`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${
                        theme === "system"
                          ? "bg-stone-200 dark:bg-stone-700"
                          : "bg-stone-100 dark:bg-stone-800"
                      }`}>
                        <Monitor className="w-5 h-5 text-stone-700 dark:text-stone-300" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          System
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          Match your device settings
                        </div>
                      </div>
                      {theme === "system" && (
                        <div className="w-2 h-2 rounded-full bg-stone-900 dark:bg-stone-100" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-stone-500 dark:text-stone-400">
                    Loading theme settings...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* About Tab */}
          {activeTab === "about" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-2">
                  Zenborg
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">
                  An attention orchestration system for budgeting moments toward
                  personal flourishing.
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 font-mono">
                  Version 1.0.0
                </p>
              </div>

              <div className="pt-4 border-t border-stone-200 dark:border-stone-700">
                <h4 className="text-xs font-medium text-stone-900 dark:text-stone-100 mb-2">
                  Philosophy
                </h4>
                <blockquote className="text-xs text-stone-500 dark:text-stone-400 italic border-l-2 border-stone-200 dark:border-stone-700 pl-3">
                  "Where will I place my consciousness today?"
                </blockquote>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Settings Button Trigger - Can be placed anywhere in the app
 */
export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 shadow-md hover:shadow-lg transition-all p-3 hover:scale-105"
      aria-label="Open settings"
    >
      <Settings className="w-4 h-4" />
    </button>
  );
}
