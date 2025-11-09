import {
  exportData,
  importDataWithStrategy,
  validateImportData,
  downloadExportFile,
  readImportFile,
  type ImportStrategy,
  type ZenborgExportData,
} from "@/application/use-cases/export-import";
import {
  moments$,
  areas$,
  habits$,
  cycles$,
  phaseConfigs$,
  crystallizedRoutines$,
  metricLogs$
} from "./store";

/**
 * Export all garden data to JSON file
 *
 * Downloads a JSON file containing all moments, areas, habits, cycles, phase configs,
 * crystallized routines, and metric logs.
 * File is named "zenborg-export-{date}.json" by default.
 *
 * @param filename - Optional custom filename
 */
export function exportGardenData(filename?: string): void {
  const moments = moments$.get();
  const areas = areas$.get();
  const habits = habits$.get();
  const cycles = cycles$.get();
  const phaseConfigs = phaseConfigs$.get();
  const crystallizedRoutines = crystallizedRoutines$.get();
  const metricLogs = metricLogs$.get();

  const exportedData = exportData(
    moments,
    areas,
    habits,
    cycles,
    phaseConfigs,
    crystallizedRoutines,
    metricLogs
  );

  downloadExportFile(exportedData, filename);

  console.log(
    "[exportGardenData] Exported:",
    exportedData.metadata.totalMoments,
    "moments,",
    exportedData.metadata.totalAreas,
    "areas,",
    exportedData.metadata.totalHabits,
    "habits,",
    exportedData.metadata.totalCycles,
    "cycles,",
    exportedData.metadata.totalPhaseConfigs,
    "phase configs,",
    exportedData.metadata.totalCrystallizedRoutines,
    "crystallized routines,",
    exportedData.metadata.totalMetricLogs,
    "metric logs"
  );
}

/**
 * Import garden data from JSON file
 *
 * @param file - File to import
 * @param strategy - "merge" (preserve existing) or "replace" (overwrite all)
 * @returns Promise with import result
 */
export async function importGardenData(
  file: File,
  strategy: ImportStrategy = "merge"
): Promise<{ success: boolean; message: string; errors?: string[] }> {
  // Read file
  const fileData = await readImportFile(file);

  if ("error" in fileData) {
    return {
      success: false,
      message: fileData.error,
      errors: [fileData.error],
    };
  }

  // Validate data
  const validation = validateImportData(fileData);

  if (!validation.valid) {
    return {
      success: false,
      message: "Invalid import file",
      errors: validation.errors,
    };
  }

  // Warn about version mismatch but continue
  if (validation.warnings.length > 0) {
    console.warn("[importGardenData] Warnings:", validation.warnings);
  }

  // Get current data
  const currentData = {
    moments: moments$.get(),
    areas: areas$.get(),
    habits: habits$.get(),
    cycles: cycles$.get(),
    phaseConfigs: phaseConfigs$.get(),
    crystallizedRoutines: crystallizedRoutines$.get(),
    metricLogs: metricLogs$.get(),
  };

  // Import with strategy
  const {
    moments,
    areas,
    habits,
    cycles,
    phaseConfigs,
    crystallizedRoutines,
    metricLogs,
    result
  } = importDataWithStrategy(fileData, strategy, currentData);

  // Update state
  moments$.set(moments);
  areas$.set(areas);
  habits$.set(habits);
  cycles$.set(cycles);
  phaseConfigs$.set(phaseConfigs);
  crystallizedRoutines$.set(crystallizedRoutines);
  metricLogs$.set(metricLogs);

  console.log("[importGardenData] Import complete:", result);

  return {
    success: result.success,
    message: result.message,
  };
}

/**
 * Trigger file input for import
 *
 * Opens a file picker dialog and imports the selected file.
 * Useful for Vim command integration.
 *
 * @param strategy - "merge" or "replace"
 * @param onComplete - Callback with result
 */
export function triggerImportDialog(
  strategy: ImportStrategy = "merge",
  onComplete?: (result: { success: boolean; message: string }) => void
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      onComplete?.({ success: false, message: "No file selected" });
      return;
    }

    const result = await importGardenData(file, strategy);
    onComplete?.(result);
  };

  input.click();
}
