import type { Attitude } from "../value-objects/Attitude";
import type { Moment } from "./Moment";

/**
 * Area - Life domain categorization for moments
 *
 * Areas represent different aspects of life (Wellness, Craft, Social, etc.)
 * Each area has a color and emoji for visual identification.
 *
 * Areas are never truly deleted - they are archived instead to preserve
 * historical data integrity. Archived areas are filtered out from the UI
 * but remain in the database for moments that reference them.
 */
export interface Area {
  readonly id: string;
  name: string;
  attitude: Attitude | null; // Default relationship mode
  tags: string[]; // Meta-grouping tags
  color: string; // hex color
  emoji: string;
  isDefault: boolean; // true for the 5 seeded defaults
  isArchived: boolean; // archived areas are hidden from UI but preserved for data integrity
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result type for operations that may fail
 */
export type AreaResult = Area | { error: string };

/**
 * Default area definitions
 */
export const DEFAULT_AREAS: Omit<Area, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Wellness",
    attitude: null,
    tags: [],
    color: "#10b981",
    emoji: "🧘",
    isDefault: true,
    isArchived: false,
    order: 0,
  },
  {
    name: "Craft",
    attitude: null,
    tags: [],
    color: "#3b82f6",
    emoji: "🎨",
    isDefault: true,
    isArchived: false,
    order: 1,
  },
  {
    name: "Social",
    attitude: null,
    tags: [],
    color: "#f97316",
    emoji: "🤝",
    isDefault: true,
    isArchived: false,
    order: 2,
  },
  {
    name: "Joyful",
    attitude: null,
    tags: [],
    color: "#eab308",
    emoji: "😄",
    isDefault: true,
    isArchived: false,
    order: 3,
  },
  {
    name: "Introspective",
    attitude: null,
    tags: [],
    color: "#6b7280",
    emoji: "🤔",
    isDefault: true,
    isArchived: false,
    order: 4,
  },
  {
    name: "Chore",
    attitude: null,
    tags: [],
    color: "#8b5cf6",
    emoji: "🧹",
    isDefault: true,
    isArchived: false,
    order: 5,
  },
];

/**
 * Creates the 5 default areas with generated IDs and timestamps
 *
 * @returns Array of default areas
 */
export function getDefaultAreas(): Area[] {
  const now = new Date().toISOString();

  return DEFAULT_AREAS.map((area) => ({
    ...area,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Normalizes tag to lowercase with hyphens
 */
function normalizeAreaTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/\s+/g, "-");
}

/**
 * Props for creating an area
 */
export interface CreateAreaProps {
  name: string;
  color: string;
  emoji: string;
  order: number;
  attitude?: Attitude | null;
  tags?: string[];
}

/**
 * Creates a new custom area
 *
 * @param props - Area creation parameters
 * @returns New area or error if validation fails
 */
export function createArea(props: CreateAreaProps): AreaResult {
  const { name, color, emoji, order, attitude = null, tags = [] } = props;
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { error: "Area name cannot be empty" };
  }

  if (!color.match(/^#[0-9a-fA-F]{6}$/)) {
    return { error: "Color must be a valid hex code (e.g., #10b981)" };
  }

  if (!emoji.trim()) {
    return { error: "Emoji cannot be empty" };
  }

  if (order < 0) {
    return { error: "Order must be non-negative" };
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    attitude,
    tags: tags.map(normalizeAreaTag),
    color: color.toLowerCase(),
    emoji: emoji.trim(),
    isDefault: false,
    isArchived: false,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Updates an area's properties
 *
 * @param area - Area to update
 * @param updates - Partial area properties to update
 * @returns Updated area or error
 */
export function updateArea(
  area: Area,
  updates: Partial<
    Pick<Area, "name" | "color" | "emoji" | "order" | "attitude" | "tags">
  >
): AreaResult {
  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    if (!trimmedName) {
      return { error: "Area name cannot be empty" };
    }
  }

  if (updates.color !== undefined) {
    if (!updates.color.match(/^#[0-9a-fA-F]{6}$/)) {
      return { error: "Color must be a valid hex code (e.g., #10b981)" };
    }
  }

  if (updates.emoji !== undefined) {
    if (!updates.emoji.trim()) {
      return { error: "Emoji cannot be empty" };
    }
  }

  if (updates.order !== undefined) {
    if (updates.order < 0) {
      return { error: "Order must be non-negative" };
    }
  }

  return {
    ...area,
    ...updates,
    name: updates.name ? updates.name.trim() : area.name,
    color: updates.color ? updates.color.toLowerCase() : area.color,
    emoji: updates.emoji ? updates.emoji.trim() : area.emoji,
    tags: updates.tags ? updates.tags.map(normalizeAreaTag) : area.tags,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Archives an area (soft delete)
 *
 * Areas are never truly deleted to preserve data integrity.
 * Archived areas are hidden from the UI but remain accessible
 * for moments that reference them.
 *
 * @param area - Area to archive
 * @returns Updated area with isArchived = true
 */
export function archiveArea(area: Area): Area {
  return {
    ...area,
    isArchived: true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Unarchives an area (restore from archive)
 *
 * @param area - Area to unarchive
 * @returns Updated area with isArchived = false
 */
export function unarchiveArea(area: Area): Area {
  return {
    ...area,
    isArchived: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Checks if an area has any moments assigned to it
 *
 * @param area - Area to check
 * @param moments - All moments in the system
 * @returns True if the area has moments assigned
 */
export function hasAreaMoments(area: Area, moments: Moment[]): boolean {
  return moments.some((moment) => moment.areaId === area.id);
}

/**
 * Checks if an archived area can be permanently deleted
 * Only archived areas with no moments can be deleted
 *
 * @param area - Area to check
 * @param moments - All moments in the system
 * @returns True if the area can be permanently deleted
 */
export function canDeleteArchivedArea(area: Area, moments: Moment[]): boolean {
  return area.isArchived && !hasAreaMoments(area, moments);
}

/**
 * Type guard to check if result is an error
 */
export function isAreaError(result: AreaResult): result is { error: string } {
  return "error" in result;
}
