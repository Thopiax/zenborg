import type { Area } from "@/domain/entities/Area";
import type { Cycle } from "@/domain/entities/Cycle";
import type { Moment } from "@/domain/entities/Moment";
import type { PhaseConfig } from "@/domain/value-objects/Phase";

/**
 * Export/Import Data Format
 *
 * A complete snapshot of the user's garden data.
 * Includes all entities with timestamps for data integrity.
 */
export interface ZenborgExportData {
  version: string; // Schema version for future migrations
  exportedAt: string; // ISO timestamp
  data: {
    moments: Record<string, Moment>;
    areas: Record<string, Area>;
    cycles: Record<string, Cycle>;
    phaseConfigs: Record<string, PhaseConfig>;
  };
  metadata: {
    totalMoments: number;
    totalAreas: number;
    totalCycles: number;
    totalPhaseConfigs: number;
  };
}

/**
 * Current schema version
 * Increment when making breaking changes to the export format
 */
export const EXPORT_SCHEMA_VERSION = "1.0.0";

/**
 * Export all data to JSON format
 *
 * @param moments - All moments
 * @param areas - All areas
 * @param cycles - All cycles
 * @param phaseConfigs - All phase configurations
 * @returns Exportable data structure
 */
export function exportData(
  moments: Record<string, Moment>,
  areas: Record<string, Area>,
  cycles: Record<string, Cycle>,
  phaseConfigs: Record<string, PhaseConfig>
): ZenborgExportData {
  return {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      moments,
      areas,
      cycles,
      phaseConfigs,
    },
    metadata: {
      totalMoments: Object.keys(moments).length,
      totalAreas: Object.keys(areas).length,
      totalCycles: Object.keys(cycles).length,
      totalPhaseConfigs: Object.keys(phaseConfigs).length,
    },
  };
}

/**
 * Validation result for import data
 */
export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate imported data structure
 *
 * @param data - Data to validate
 * @returns Validation result with errors and warnings
 */
export function validateImportData(data: unknown): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if data is an object
  if (!data || typeof data !== "object") {
    errors.push("Invalid data format: must be a JSON object");
    return { valid: false, errors, warnings };
  }

  const exportData = data as Partial<ZenborgExportData>;

  // Check required fields
  if (!exportData.version) {
    errors.push("Missing version field");
  }

  if (!exportData.exportedAt) {
    errors.push("Missing exportedAt field");
  }

  if (!exportData.data) {
    errors.push("Missing data field");
    return { valid: false, errors, warnings };
  }

  // Check data structure
  const { moments, areas, cycles, phaseConfigs } = exportData.data;

  if (!moments || typeof moments !== "object") {
    errors.push("Invalid or missing moments data");
  }

  if (!areas || typeof areas !== "object") {
    errors.push("Invalid or missing areas data");
  }

  if (!cycles || typeof cycles !== "object") {
    errors.push("Invalid or missing cycles data");
  }

  if (!phaseConfigs || typeof phaseConfigs !== "object") {
    errors.push("Invalid or missing phaseConfigs data");
  }

  // Check version compatibility
  if (exportData.version !== EXPORT_SCHEMA_VERSION) {
    warnings.push(
      `Schema version mismatch: expected ${EXPORT_SCHEMA_VERSION}, got ${exportData.version}`
    );
  }

  // Validate referential integrity
  if (moments && areas) {
    for (const [id, moment] of Object.entries(moments)) {
      if (!moment.id || moment.id !== id) {
        errors.push(`Moment ${id} has mismatched ID`);
      }
      if (moment.areaId && !areas[moment.areaId]) {
        warnings.push(
          `Moment "${moment.name}" references non-existent area ${moment.areaId}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Import strategy options
 */
export type ImportStrategy = "merge" | "replace";

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  message: string;
  imported: {
    moments: number;
    areas: number;
    cycles: number;
    phaseConfigs: number;
  };
  conflicts?: {
    moments: string[];
    areas: string[];
    cycles: string[];
    phaseConfigs: string[];
  };
}

/**
 * Import data with specified strategy
 *
 * @param importData - Validated import data
 * @param strategy - "merge" (preserve existing) or "replace" (overwrite all)
 * @param currentData - Current state data
 * @returns Import result with statistics
 */
export function importDataWithStrategy(
  importData: ZenborgExportData,
  strategy: ImportStrategy,
  currentData: {
    moments: Record<string, Moment>;
    areas: Record<string, Area>;
    cycles: Record<string, Cycle>;
    phaseConfigs: Record<string, PhaseConfig>;
  }
): {
  moments: Record<string, Moment>;
  areas: Record<string, Area>;
  cycles: Record<string, Cycle>;
  phaseConfigs: Record<string, PhaseConfig>;
  result: ImportResult;
} {
  if (strategy === "replace") {
    // Replace strategy: use imported data as-is
    return {
      ...importData.data,
      result: {
        success: true,
        message: "All data replaced successfully",
        imported: {
          moments: Object.keys(importData.data.moments).length,
          areas: Object.keys(importData.data.areas).length,
          cycles: Object.keys(importData.data.cycles).length,
          phaseConfigs: Object.keys(importData.data.phaseConfigs).length,
        },
      },
    };
  }

  // Merge strategy: combine existing and imported data
  const conflicts = {
    moments: [] as string[],
    areas: [] as string[],
    cycles: [] as string[],
    phaseConfigs: [] as string[],
  };

  // Merge moments (imported overwrites existing on ID conflict)
  const mergedMoments = { ...currentData.moments };
  for (const [id, moment] of Object.entries(importData.data.moments)) {
    if (mergedMoments[id]) {
      conflicts.moments.push(id);
    }
    mergedMoments[id] = moment;
  }

  // Merge areas
  const mergedAreas = { ...currentData.areas };
  for (const [id, area] of Object.entries(importData.data.areas)) {
    if (mergedAreas[id]) {
      conflicts.areas.push(id);
    }
    mergedAreas[id] = area;
  }

  // Merge cycles
  const mergedCycles = { ...currentData.cycles };
  for (const [id, cycle] of Object.entries(importData.data.cycles)) {
    if (mergedCycles[id]) {
      conflicts.cycles.push(id);
    }
    mergedCycles[id] = cycle;
  }

  // Merge phase configs
  const mergedPhaseConfigs = { ...currentData.phaseConfigs };
  for (const [id, config] of Object.entries(importData.data.phaseConfigs)) {
    if (mergedPhaseConfigs[id]) {
      conflicts.phaseConfigs.push(id);
    }
    mergedPhaseConfigs[id] = config;
  }

  const totalConflicts =
    conflicts.moments.length +
    conflicts.areas.length +
    conflicts.cycles.length +
    conflicts.phaseConfigs.length;

  return {
    moments: mergedMoments,
    areas: mergedAreas,
    cycles: mergedCycles,
    phaseConfigs: mergedPhaseConfigs,
    result: {
      success: true,
      message:
        totalConflicts > 0
          ? `Data merged successfully with ${totalConflicts} conflicts (imported data took precedence)`
          : "Data merged successfully with no conflicts",
      imported: {
        moments: Object.keys(importData.data.moments).length,
        areas: Object.keys(importData.data.areas).length,
        cycles: Object.keys(importData.data.cycles).length,
        phaseConfigs: Object.keys(importData.data.phaseConfigs).length,
      },
      conflicts: totalConflicts > 0 ? conflicts : undefined,
    },
  };
}

/**
 * Download data as JSON file
 *
 * @param data - Export data to download
 * @param filename - Optional filename (defaults to "zenborg-export-{date}.json")
 */
export function downloadExportFile(
  data: ZenborgExportData,
  filename?: string
): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const defaultFilename = `zenborg-export-${
    new Date().toISOString().split("T")[0]
  }.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read and parse import file
 *
 * @param file - File to read
 * @returns Promise with parsed data or error
 */
export async function readImportFile(
  file: File
): Promise<ZenborgExportData | { error: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as ZenborgExportData;
        resolve(data);
      } catch (error) {
        resolve({
          error: `Failed to parse JSON: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }
    };

    reader.onerror = () => {
      resolve({ error: "Failed to read file" });
    };

    reader.readAsText(file);
  });
}
