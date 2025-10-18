import type { Moment } from './Moment'

/**
 * Area - Life domain categorization for moments
 *
 * Areas represent different aspects of life (Wellness, Craft, Social, etc.)
 * Each area has a color and emoji for visual identification.
 */
export interface Area {
  readonly id: string
  name: string
  color: string      // hex color
  emoji: string
  isDefault: boolean // true for the 5 seeded defaults
  order: number
  createdAt: string
  updatedAt: string
}

/**
 * Result type for operations that may fail
 */
export type AreaResult = Area | { error: string }

/**
 * Default area definitions
 */
export const DEFAULT_AREAS: Omit<Area, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Wellness',
    color: '#10b981',
    emoji: '🟢',
    isDefault: true,
    order: 0
  },
  {
    name: 'Craft',
    color: '#3b82f6',
    emoji: '🔵',
    isDefault: true,
    order: 1
  },
  {
    name: 'Social',
    color: '#f97316',
    emoji: '🟠',
    isDefault: true,
    order: 2
  },
  {
    name: 'Joyful',
    color: '#eab308',
    emoji: '🟡',
    isDefault: true,
    order: 3
  },
  {
    name: 'Introspective',
    color: '#6b7280',
    emoji: '⚪',
    isDefault: true,
    order: 4
  }
]

/**
 * Creates the 5 default areas with generated IDs and timestamps
 *
 * @returns Array of default areas
 */
export function getDefaultAreas(): Area[] {
  const now = new Date().toISOString()

  return DEFAULT_AREAS.map(area => ({
    ...area,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  }))
}

/**
 * Creates a new custom area
 *
 * @param name - Area name
 * @param color - Hex color code
 * @param emoji - Single emoji character
 * @param order - Display order
 * @returns New area
 */
export function createArea(
  name: string,
  color: string,
  emoji: string,
  order: number
): AreaResult {
  const trimmedName = name.trim()

  if (!trimmedName) {
    return { error: 'Area name cannot be empty' }
  }

  if (!color.match(/^#[0-9a-fA-F]{6}$/)) {
    return { error: 'Color must be a valid hex code (e.g., #10b981)' }
  }

  if (!emoji.trim()) {
    return { error: 'Emoji cannot be empty' }
  }

  if (order < 0) {
    return { error: 'Order must be non-negative' }
  }

  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    color: color.toLowerCase(),
    emoji: emoji.trim(),
    isDefault: false,
    order,
    createdAt: now,
    updatedAt: now
  }
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
  updates: Partial<Pick<Area, 'name' | 'color' | 'emoji' | 'order'>>
): AreaResult {
  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim()
    if (!trimmedName) {
      return { error: 'Area name cannot be empty' }
    }
  }

  if (updates.color !== undefined) {
    if (!updates.color.match(/^#[0-9a-fA-F]{6}$/)) {
      return { error: 'Color must be a valid hex code (e.g., #10b981)' }
    }
  }

  if (updates.emoji !== undefined) {
    if (!updates.emoji.trim()) {
      return { error: 'Emoji cannot be empty' }
    }
  }

  if (updates.order !== undefined) {
    if (updates.order < 0) {
      return { error: 'Order must be non-negative' }
    }
  }

  return {
    ...area,
    ...updates,
    name: updates.name ? updates.name.trim() : area.name,
    color: updates.color ? updates.color.toLowerCase() : area.color,
    emoji: updates.emoji ? updates.emoji.trim() : area.emoji,
    updatedAt: new Date().toISOString()
  }
}

/**
 * Checks if an area can be deleted
 * Areas cannot be deleted if they have moments referencing them
 *
 * @param area - Area to check
 * @param moments - All moments in the system
 * @returns True if the area can be safely deleted
 */
export function canDeleteArea(area: Area, moments: Moment[]): boolean {
  return !moments.some(moment => moment.areaId === area.id)
}

/**
 * Type guard to check if result is an error
 */
export function isAreaError(result: AreaResult): result is { error: string } {
  return 'error' in result
}
