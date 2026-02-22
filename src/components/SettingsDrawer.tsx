"use client";

import { observer } from "@legendapp/state/react";
import {
  ChevronRight,
  Download,
  Info,
  Monitor,
  Moon,
  RotateCcw,
  Settings2,
  Smartphone,
  Sun,
  Tv,
  Upload,
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
import { getPWAInstructions, isPWA } from "@/lib/pwa-utils";
import { ConfirmableAction } from "./ConfirmableAction";
import { TrmnlSettingsSection } from "./TrmnlSettingsSection";

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
                                  key={`pwa-instruction-${index + 1}`}
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
