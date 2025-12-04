# DDD Service Extraction - Implementation Plan

**Date:** 2025-01-15
**Status:** Ready for Implementation
**Effort:** ~3-5 days (phased approach)

---

## Executive Summary

This plan extracts business logic from `lib/`, components, and value objects into proper DDD domain and application services. The refactoring improves discoverability, testability, and maintainability while preserving all existing functionality.

**Key Metrics:**
- 5 new domain services to create
- 1 new application service to create
- ~460 lines removed from React components
- 100% backward compatibility maintained

---

## Phase 1: Foundation Services (Day 1)

### 1.1 AttitudeService

**Objective:** Extract attitude inheritance logic from `lib/` into domain service.

**Current Location:** `src/lib/moment-attitude.ts`
**New Location:** `src/domain/services/AttitudeService.ts`

#### Implementation Steps

**Step 1:** Create domain service file
```typescript
// src/domain/services/AttitudeService.ts
import type { Moment } from "@/domain/entities/Moment";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import type { Attitude } from "@/domain/value-objects/Attitude";

/**
 * Domain Service: Attitude Resolution
 *
 * Handles attitude inheritance chain: moment -> habit?.attitude -> area?.attitude -> null
 * This is a domain service because it encapsulates business rules about
 * how attitudes flow through the domain model hierarchy.
 */
export class AttitudeService {
  /**
   * Computes the effective attitude for a moment using inheritance chain
   *
   * Business Rule: Moments inherit attitudes from habits, then areas, then default to null
   *
   * @param moment - The moment to compute attitude for
   * @param habits - Record of all habits by ID
   * @param areas - Record of all areas by ID
   * @returns The computed attitude or null (pure presence)
   */
  getMomentAttitude(
    moment: Moment,
    habits: Record<string, Habit>,
    areas: Record<string, Area>
  ): Attitude | null {
    // Try to get attitude from linked habit first
    if (moment.habitId) {
      const habit = habits[moment.habitId];
      if (habit && habit.attitude !== null) {
        return habit.attitude;
      }
    }

    // Fall back to area attitude
    const area = areas[moment.areaId];
    if (area && area.attitude !== null) {
      return area.attitude;
    }

    // Default to null (pure presence)
    return null;
  }

  /**
   * Batch compute attitudes for multiple moments
   *
   * @param moments - Array of moments to compute attitudes for
   * @param habits - Record of all habits by ID
   * @param areas - Record of all areas by ID
   * @returns Map of moment ID to computed attitude
   */
  getMomentsAttitudes(
    moments: Moment[],
    habits: Record<string, Habit>,
    areas: Record<string, Area>
  ): Map<string, Attitude | null> {
    const result = new Map<string, Attitude | null>();

    for (const moment of moments) {
      result.set(moment.id, this.getMomentAttitude(moment, habits, areas));
    }

    return result;
  }
}

// Export singleton instance for convenience
export const attitudeService = new AttitudeService();
```

**Step 2:** Update imports in consuming files

Files to update:
- `src/lib/grouping.ts:18` - Change import
- `src/lib/grouping.ts:198` - Use `attitudeService.getMomentAttitude()`
- Any components using `getMomentAttitude()` directly

**Step 3:** Delete old file
```bash
rm src/lib/moment-attitude.ts
```

**Step 4:** Update tests
```typescript
// src/domain/services/__tests__/AttitudeService.test.ts
import { describe, it, expect } from 'vitest';
import { AttitudeService } from '../AttitudeService';
import { Attitude } from '@/domain/value-objects/Attitude';

describe('AttitudeService', () => {
  const service = new AttitudeService();

  describe('getMomentAttitude', () => {
    it('returns habit attitude when moment has habitId', () => {
      const moment = { habitId: 'h1', areaId: 'a1' };
      const habits = { h1: { attitude: Attitude.BUILDING } };
      const areas = { a1: { attitude: Attitude.KEEPING } };

      expect(service.getMomentAttitude(moment, habits, areas))
        .toBe(Attitude.BUILDING);
    });

    it('falls back to area attitude when no habit', () => {
      const moment = { habitId: null, areaId: 'a1' };
      const habits = {};
      const areas = { a1: { attitude: Attitude.KEEPING } };

      expect(service.getMomentAttitude(moment, habits, areas))
        .toBe(Attitude.KEEPING);
    });

    it('returns null when no habit or area attitude', () => {
      const moment = { habitId: null, areaId: 'a1' };
      const habits = {};
      const areas = { a1: { attitude: null } };

      expect(service.getMomentAttitude(moment, habits, areas))
        .toBe(null);
    });
  });
});
```

**Verification:**
```bash
# Run tests
pnpm test src/domain/services/__tests__/AttitudeService.test.ts

# Type check
pnpm exec tsc --noEmit

# Build check
pnpm build
```

---

### 1.2 TimeService

**Objective:** Consolidate time/phase-related domain logic into one service.

**Current Locations:**
- `src/lib/dates.ts:144-154` (getActiveDay)
- `src/domain/value-objects/Phase.ts:102-148` (getCurrentPhase, isHourInPhase)

**New Location:** `src/domain/services/TimeService.ts`

#### Implementation Steps

**Step 1:** Create domain service
```typescript
// src/domain/services/TimeService.ts
import { addDays, format, subDays } from "date-fns";
import type { Phase } from "@/domain/value-objects/Phase";
import type { PhaseConfig } from "@/domain/value-objects/Phase";

/**
 * Domain Service: Time and Phase Logic
 *
 * Centralizes all time-related business rules:
 * - Active day calculation (phase-aware)
 * - Current phase detection
 * - Phase boundary checking
 *
 * This is a domain service because these are business rules about
 * how time maps to the domain model (phases, active days).
 */
export class TimeService {
  /**
   * Get ISO date string (YYYY-MM-DD) for a given date
   */
  private toISODate(date: Date): string {
    return format(date, "yyyy-MM-dd");
  }

  /**
   * Get the active day ISO string, accounting for phase schedule
   *
   * Business Rule: The "active day" shifts only when morning starts.
   * If it's 2 AM (NIGHT phase), the active day is still yesterday.
   * This aligns the calendar with human circadian rhythm.
   *
   * @param morningStartHour - Hour when morning starts (default: 6)
   * @returns ISO date string for the active day
   */
  getActiveDay(morningStartHour = 6): string {
    const now = new Date();
    const currentHour = now.getHours();

    // If current hour is before morning starts, the active day is yesterday
    if (currentHour < morningStartHour) {
      return this.toISODate(subDays(now, 1));
    }

    return this.toISODate(now);
  }

  /**
   * Get the active day based on phase configurations
   * Uses the morning phase start hour from phase configs
   *
   * @param phaseConfigs - Array of phase configurations
   * @returns ISO date string for the active day
   */
  getActiveDayFromPhaseConfigs(phaseConfigs: PhaseConfig[]): string {
    const morningConfig = phaseConfigs.find(
      (config) => config.phase === 'MORNING'
    );
    const morningStartHour = morningConfig?.startHour ?? 6;

    return this.getActiveDay(morningStartHour);
  }

  /**
   * Checks if an hour falls within a phase's time boundary
   * Handles wrap-around for phases that cross midnight (e.g., NIGHT: 22-6)
   *
   * Business Rule: Phases can wrap around midnight
   *
   * @param hour - Hour to check (0-23)
   * @param config - Phase configuration
   * @returns True if hour falls within the phase
   */
  isHourInPhase(hour: number, config: PhaseConfig): boolean {
    if (hour < 0 || hour > 23) {
      throw new Error("Hour must be between 0 and 23");
    }

    const { startHour, endHour } = config;

    // Handle wrap-around (e.g., 22-6 for night)
    if (endHour <= startHour) {
      // Phase crosses midnight
      return hour >= startHour || hour < endHour;
    }

    // Normal case: start < end
    return hour >= startHour && hour < endHour;
  }

  /**
   * Detects the current phase based on hour and phase settings
   * Respects phase visibility settings
   *
   * Business Rule: Only visible phases are considered
   *
   * @param hour - Current hour (0-23)
   * @param phaseConfigs - Array of phase configurations
   * @returns The current phase, or null if no visible phase matches
   */
  getCurrentPhase(
    hour: number,
    phaseConfigs: PhaseConfig[]
  ): Phase | null {
    if (hour < 0 || hour > 23) {
      throw new Error("Hour must be between 0 and 23");
    }

    // Filter visible phases and sort by order
    const visiblePhases = phaseConfigs
      .filter((config) => config.isVisible)
      .sort((a, b) => a.order - b.order);

    // Find first matching phase
    for (const config of visiblePhases) {
      if (this.isHourInPhase(hour, config)) {
        return config.phase;
      }
    }

    return null;
  }

  /**
   * Get the current phase for the current time
   *
   * @param phaseConfigs - Array of phase configurations
   * @returns The current phase, or null if no visible phase matches
   */
  getCurrentPhaseNow(phaseConfigs: PhaseConfig[]): Phase | null {
    const currentHour = new Date().getHours();
    return this.getCurrentPhase(currentHour, phaseConfigs);
  }

  /**
   * Get the current hour (0-23)
   */
  getCurrentHour(): number {
    return new Date().getHours();
  }
}

// Export singleton instance
export const timeService = new TimeService();
```

**Step 2:** Update Phase.ts value object
```typescript
// src/domain/value-objects/Phase.ts
// Remove functions: isHourInPhase, getCurrentPhase
// Keep: enum Phase, interface PhaseConfig, DEFAULT_PHASE_CONFIGS,
//       getDefaultPhaseConfigs, getPhaseConfig, getVisiblePhases
```

**Step 3:** Update lib/dates.ts
```typescript
// src/lib/dates.ts
// Remove: getActiveDay function (lines 144-154)
// Keep all other utility functions (they're infrastructure, not domain)
```

**Step 4:** Update all imports

Files to update:
- Search for `getCurrentPhase` imports → Use `timeService.getCurrentPhase()`
- Search for `getActiveDay` imports → Use `timeService.getActiveDay()`
- Update `src/lib/dates.ts` exports (remove getActiveDay)

```bash
# Find all usages
grep -r "getCurrentPhase" src/
grep -r "getActiveDay" src/
```

**Step 5:** Create tests
```typescript
// src/domain/services/__tests__/TimeService.test.ts
import { describe, it, expect } from 'vitest';
import { TimeService } from '../TimeService';
import { Phase } from '@/domain/value-objects/Phase';

describe('TimeService', () => {
  const service = new TimeService();

  describe('getActiveDay', () => {
    it('returns today when hour is after morning start', () => {
      // Test with mocked date at 10 AM
      // Should return today
    });

    it('returns yesterday when hour is before morning start', () => {
      // Test with mocked date at 2 AM
      // Should return yesterday
    });
  });

  describe('isHourInPhase', () => {
    it('handles normal phase boundaries', () => {
      const config = { startHour: 6, endHour: 12 };
      expect(service.isHourInPhase(8, config)).toBe(true);
      expect(service.isHourInPhase(14, config)).toBe(false);
    });

    it('handles wrap-around phases', () => {
      const config = { startHour: 22, endHour: 6 };
      expect(service.isHourInPhase(23, config)).toBe(true);
      expect(service.isHourInPhase(2, config)).toBe(true);
      expect(service.isHourInPhase(10, config)).toBe(false);
    });
  });

  describe('getCurrentPhase', () => {
    it('returns matching visible phase', () => {
      const configs = [
        { phase: Phase.MORNING, startHour: 6, endHour: 12, isVisible: true, order: 0 },
        { phase: Phase.AFTERNOON, startHour: 12, endHour: 18, isVisible: true, order: 1 },
      ];

      expect(service.getCurrentPhase(8, configs)).toBe(Phase.MORNING);
      expect(service.getCurrentPhase(14, configs)).toBe(Phase.AFTERNOON);
    });

    it('returns null when no phase matches', () => {
      const configs = [
        { phase: Phase.MORNING, startHour: 6, endHour: 12, isVisible: true, order: 0 },
      ];

      expect(service.getCurrentPhase(14, configs)).toBe(null);
    });

    it('ignores invisible phases', () => {
      const configs = [
        { phase: Phase.NIGHT, startHour: 22, endHour: 6, isVisible: false, order: 0 },
      ];

      expect(service.getCurrentPhase(23, configs)).toBe(null);
    });
  });
});
```

**Verification:**
```bash
pnpm test src/domain/services/__tests__/TimeService.test.ts
pnpm exec tsc --noEmit
```

---

## Phase 2: Core Business Logic (Day 2-3)

### 2.1 MomentAllocationService

**Objective:** Extract cell allocation constraints and ordering logic.

**Current Locations:**
- `src/lib/drag-validation.ts` (entire file)
- `src/domain/entities/Moment.ts:112-122` (canAllocateToPhase)

**New Location:** `src/domain/services/MomentAllocationService.ts`

#### Implementation Steps

**Step 1:** Create domain service
```typescript
// src/domain/services/MomentAllocationService.ts
import type { Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";

/**
 * Validation result for allocation operations
 */
export interface AllocationValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Domain Service: Moment Allocation
 *
 * Encapsulates business rules for allocating moments to timeline cells:
 * - Cell capacity constraints (max 3 per cell)
 * - Order management within cells
 * - Reordering after removal
 *
 * Business Rule: Max 3 moments per (day, phase) combination
 */
export class MomentAllocationService {
  /**
   * Maximum moments allowed per timeline cell
   */
  private readonly MAX_MOMENTS_PER_CELL = 3;

  /**
   * Check if a moment can be allocated to a specific timeline cell
   *
   * Business Rule: Maximum 3 moments per (day, phase) combination
   *
   * @param targetDay - ISO date string of target cell
   * @param targetPhase - Phase of target cell
   * @param allMoments - All moments in the system (as array or record)
   * @param excludeMomentId - Optional moment ID to exclude from count (for moves)
   * @returns Validation result with isValid flag and optional reason
   */
  canAllocateToCell(
    targetDay: string,
    targetPhase: Phase,
    allMoments: Moment[] | Record<string, Moment>,
    excludeMomentId?: string
  ): AllocationValidationResult {
    const moments = Array.isArray(allMoments)
      ? allMoments
      : Object.values(allMoments);

    // Count moments currently in target cell (excluding the one being dragged)
    const momentsInCell = moments.filter(
      (m) =>
        m.day === targetDay &&
        m.phase === targetPhase &&
        m.id !== excludeMomentId
    );

    if (momentsInCell.length >= this.MAX_MOMENTS_PER_CELL) {
      return {
        isValid: false,
        reason: `Cell already has ${this.MAX_MOMENTS_PER_CELL} moments (max allowed)`,
      };
    }

    return { isValid: true };
  }

  /**
   * Calculate the next available order (0, 1, or 2) for a moment in a cell
   *
   * @param targetDay - ISO date string of target cell
   * @param targetPhase - Phase of target cell
   * @param allMoments - All moments in the system (as array or record)
   * @param excludeMomentId - Optional moment ID to exclude from calculation
   * @returns Next available order index (0-2)
   */
  calculateNextOrder(
    targetDay: string,
    targetPhase: Phase,
    allMoments: Moment[] | Record<string, Moment>,
    excludeMomentId?: string
  ): number {
    const moments = Array.isArray(allMoments)
      ? allMoments
      : Object.values(allMoments);

    const momentsInCell = moments
      .filter(
        (m) =>
          m.day === targetDay &&
          m.phase === targetPhase &&
          m.id !== excludeMomentId
      )
      .sort((a, b) => a.order - b.order);

    // Find first available slot (0, 1, or 2)
    for (let i = 0; i <= 2; i++) {
      if (!momentsInCell.some((m) => m.order === i)) {
        return i;
      }
    }

    // If all slots taken, return next index (should never happen due to validation)
    return momentsInCell.length;
  }

  /**
   * Reorder moments in a cell after one is removed
   * Closes gaps in order sequence (e.g., [0, 2] becomes [0, 1])
   *
   * @param targetDay - ISO date string of cell
   * @param targetPhase - Phase of cell
   * @param allMoments - All moments in the system (as array or record)
   * @param removedMomentId - ID of moment that was removed
   * @returns Array of {momentId, newOrder} for moments that need reordering
   */
  reorderAfterRemoval(
    targetDay: string,
    targetPhase: Phase,
    allMoments: Moment[] | Record<string, Moment>,
    removedMomentId: string
  ): Array<{ momentId: string; newOrder: number }> {
    const moments = Array.isArray(allMoments)
      ? allMoments
      : Object.values(allMoments);

    const momentsInCell = moments
      .filter(
        (m) =>
          m.day === targetDay &&
          m.phase === targetPhase &&
          m.id !== removedMomentId
      )
      .sort((a, b) => a.order - b.order);

    // Reassign sequential orders
    return momentsInCell.map((m, index) => ({
      momentId: m.id,
      newOrder: index,
    }));
  }

  /**
   * Check if moving a moment would be a no-op (same location)
   *
   * @param moment - The moment to check
   * @param targetDay - Target day (null for drawing board)
   * @param targetPhase - Target phase (null for drawing board)
   * @returns True if target is same as current location
   */
  isSameLocation(
    moment: Moment,
    targetDay: string | null,
    targetPhase: Phase | null
  ): boolean {
    return moment.day === targetDay && moment.phase === targetPhase;
  }

  /**
   * Get all moments in a specific cell
   *
   * @param targetDay - ISO date string
   * @param targetPhase - Phase
   * @param allMoments - All moments in the system
   * @returns Array of moments in the cell, sorted by order
   */
  getMomentsInCell(
    targetDay: string,
    targetPhase: Phase,
    allMoments: Moment[] | Record<string, Moment>
  ): Moment[] {
    const moments = Array.isArray(allMoments)
      ? allMoments
      : Object.values(allMoments);

    return moments
      .filter((m) => m.day === targetDay && m.phase === targetPhase)
      .sort((a, b) => a.order - b.order);
  }
}

// Export singleton instance
export const momentAllocationService = new MomentAllocationService();
```

**Step 2:** Update Moment entity
```typescript
// src/domain/entities/Moment.ts
// Remove canAllocateToPhase function (lines 112-122)
// It's now in the domain service
```

**Step 3:** Update consuming files

Files to update:
- `src/lib/drag-validation.ts` → DELETE (all logic moved)
- `src/components/DnDProvider.tsx:43-46` → Import and use service
- Any other files importing from `lib/drag-validation.ts`

```typescript
// Example update in DnDProvider.tsx
import { momentAllocationService } from "@/domain/services/MomentAllocationService";

// Before:
import { canDropInCell, calculateNextOrder } from "@/lib/drag-validation";

// After:
const validation = momentAllocationService.canAllocateToCell(
  targetDay,
  targetPhase,
  allMoments,
  draggingMomentId
);

if (!validation.isValid) {
  console.warn(validation.reason);
  return;
}

const nextOrder = momentAllocationService.calculateNextOrder(
  targetDay,
  targetPhase,
  allMoments,
  draggingMomentId
);
```

**Step 4:** Create tests
```typescript
// src/domain/services/__tests__/MomentAllocationService.test.ts
import { describe, it, expect } from 'vitest';
import { MomentAllocationService } from '../MomentAllocationService';
import { Phase } from '@/domain/value-objects/Phase';
import type { Moment } from '@/domain/entities/Moment';

describe('MomentAllocationService', () => {
  const service = new MomentAllocationService();

  const createMoment = (id: string, day: string | null, phase: Phase | null, order: number): Moment => ({
    id,
    name: `Moment ${id}`,
    areaId: 'area1',
    habitId: null,
    cycleId: null,
    cyclePlanId: null,
    phase,
    day,
    order,
    tags: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  describe('canAllocateToCell', () => {
    it('allows allocation when cell has less than 3 moments', () => {
      const moments = [
        createMoment('1', '2025-01-15', Phase.MORNING, 0),
        createMoment('2', '2025-01-15', Phase.MORNING, 1),
      ];

      const result = service.canAllocateToCell(
        '2025-01-15',
        Phase.MORNING,
        moments
      );

      expect(result.isValid).toBe(true);
    });

    it('denies allocation when cell already has 3 moments', () => {
      const moments = [
        createMoment('1', '2025-01-15', Phase.MORNING, 0),
        createMoment('2', '2025-01-15', Phase.MORNING, 1),
        createMoment('3', '2025-01-15', Phase.MORNING, 2),
      ];

      const result = service.canAllocateToCell(
        '2025-01-15',
        Phase.MORNING,
        moments
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('already has 3 moments');
    });

    it('excludes dragging moment from count', () => {
      const moments = [
        createMoment('1', '2025-01-15', Phase.MORNING, 0),
        createMoment('2', '2025-01-15', Phase.MORNING, 1),
        createMoment('3', '2025-01-15', Phase.MORNING, 2),
      ];

      const result = service.canAllocateToCell(
        '2025-01-15',
        Phase.MORNING,
        moments,
        '1' // Exclude moment 1
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateNextOrder', () => {
    it('returns 0 for empty cell', () => {
      const moments: Moment[] = [];

      const order = service.calculateNextOrder(
        '2025-01-15',
        Phase.MORNING,
        moments
      );

      expect(order).toBe(0);
    });

    it('returns first available slot', () => {
      const moments = [
        createMoment('1', '2025-01-15', Phase.MORNING, 0),
        createMoment('2', '2025-01-15', Phase.MORNING, 2), // Gap at 1
      ];

      const order = service.calculateNextOrder(
        '2025-01-15',
        Phase.MORNING,
        moments
      );

      expect(order).toBe(1);
    });
  });

  describe('reorderAfterRemoval', () => {
    it('closes gaps in order sequence', () => {
      const moments = [
        createMoment('1', '2025-01-15', Phase.MORNING, 0),
        createMoment('2', '2025-01-15', Phase.MORNING, 1),
        createMoment('3', '2025-01-15', Phase.MORNING, 2),
      ];

      const reordered = service.reorderAfterRemoval(
        '2025-01-15',
        Phase.MORNING,
        moments,
        '2' // Remove middle moment
      );

      expect(reordered).toEqual([
        { momentId: '1', newOrder: 0 },
        { momentId: '3', newOrder: 1 }, // Shifted from 2 to 1
      ]);
    });
  });
});
```

**Verification:**
```bash
pnpm test src/domain/services/__tests__/MomentAllocationService.test.ts
pnpm exec tsc --noEmit
```

---

### 2.2 MomentGroupingService

**Objective:** Extract grouping logic into domain service.

**Current Location:** `src/lib/grouping.ts` (entire file)
**New Location:** `src/domain/services/MomentGroupingService.ts`

#### Implementation Steps

**Step 1:** Create domain service
```typescript
// src/domain/services/MomentGroupingService.ts
import {
  format,
  isThisMonth,
  isThisWeek,
  isToday,
  isYesterday,
} from "date-fns";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import type { Moment } from "@/domain/entities/Moment";
import { ATTITUDE_METADATA, Attitude } from "@/domain/value-objects/Attitude";
import { Phase, type PhaseConfig } from "@/domain/value-objects/Phase";
import { PHASE_ICONS } from "@/domain/value-objects/phaseStyles";
import { attitudeService } from "./AttitudeService";

/**
 * Grouped collection of moments
 */
export interface MomentGroup {
  groupId: string;
  groupLabel: string;
  color?: string;
  emoji?: string;
  icon?: React.ComponentType<{ className?: string }>;
  showEmptyState?: boolean;
  moments: Moment[];
}

/**
 * Grouping mode type
 */
export type GroupByMode = "none" | "area" | "created" | "attitude" | "tag" | "phase";

/**
 * Domain Service: Moment Grouping
 *
 * Organizes moments into groups based on various criteria.
 * This is a domain service because grouping rules are business logic
 * that determine how moments are organized and displayed.
 */
export class MomentGroupingService {
  /**
   * Sort moments by order (primary) and createdAt (secondary)
   *
   * Business Rule: Consistent ordering for unallocated moments
   */
  sortMoments(moments: Moment[]): Moment[] {
    return moments.sort((a, b) => {
      // Primary sort: by order
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Secondary sort: by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * Group moments by area
   * Shows all provided areas (caller is responsible for filtering)
   *
   * Business Rule: Moments are organized by their life domains
   */
  groupByArea(
    moments: Moment[],
    habits?: Record<string, Habit>,
    areas?: Record<string, Area>
  ): MomentGroup[] {
    if (!areas) {
      return [];
    }

    // Initialize all provided areas as empty groups
    const allAreas = Object.values(areas).sort((a, b) => a.order - b.order);
    const grouped = new Map<string, MomentGroup>(
      allAreas.map((area) => [
        area.id,
        {
          groupId: area.id,
          groupLabel: area.name,
          color: area.color,
          emoji: area.emoji,
          moments: [],
        },
      ])
    );

    // Fill in moments for each area
    for (const moment of moments) {
      const group = grouped.get(moment.areaId);
      if (group) {
        group.moments.push(moment);
      }
    }

    // Sort moments within each group
    for (const group of grouped.values()) {
      this.sortMoments(group.moments);
    }

    return Array.from(grouped.values());
  }

  /**
   * Group moments by creation date
   *
   * Business Rule: Temporal organization (Today, Yesterday, This Week, etc.)
   */
  groupByCreated(moments: Moment[]): MomentGroup[] {
    const groups = {
      today: [] as Moment[],
      yesterday: [] as Moment[],
      thisWeek: [] as Moment[],
      thisMonth: [] as Moment[],
      allTime: [] as Moment[],
    };

    for (const moment of moments) {
      const createdDate = new Date(moment.createdAt);

      if (isToday(createdDate)) {
        groups.today.push(moment);
      } else if (isYesterday(createdDate)) {
        groups.yesterday.push(moment);
      } else if (isThisWeek(createdDate, { weekStartsOn: 1 })) {
        groups.thisWeek.push(moment);
      } else if (isThisMonth(createdDate)) {
        groups.thisMonth.push(moment);
      } else {
        groups.allTime.push(moment);
      }
    }

    const result: MomentGroup[] = [];

    if (groups.today.length > 0) {
      result.push({
        groupId: "created-today",
        groupLabel: "Today",
        moments: this.sortMoments(groups.today),
      });
    }

    if (groups.yesterday.length > 0) {
      result.push({
        groupId: "created-yesterday",
        groupLabel: "Yesterday",
        moments: this.sortMoments(groups.yesterday),
      });
    }

    if (groups.thisWeek.length > 0) {
      result.push({
        groupId: "created-this-week",
        groupLabel: "This Week",
        moments: this.sortMoments(groups.thisWeek),
      });
    }

    if (groups.thisMonth.length > 0) {
      result.push({
        groupId: "created-this-month",
        groupLabel: "This Month",
        moments: this.sortMoments(groups.thisMonth),
      });
    }

    if (groups.allTime.length > 0) {
      result.push({
        groupId: "created-all-time",
        groupLabel: "All Time",
        moments: this.sortMoments(groups.allTime),
      });
    }

    return result;
  }

  /**
   * Group moments by attitude
   *
   * Business Rule: Organize by relationship mode
   * Attitudes are computed from: habit?.attitude ?? area?.attitude ?? null
   */
  groupByAttitude(
    moments: Moment[],
    habits?: Record<string, Habit>,
    areas?: Record<string, Area>
  ): MomentGroup[] {
    const groups: Record<string, Moment[]> = {
      beginning: [],
      keeping: [],
      building: [],
      pushing: [],
      being: [],
      none: [],
    };

    if (!habits || !areas) {
      return [];
    }

    for (const moment of moments) {
      const attitude = attitudeService.getMomentAttitude(moment, habits, areas);

      switch (attitude) {
        case Attitude.BEGINNING:
          groups.beginning.push(moment);
          break;
        case Attitude.KEEPING:
          groups.keeping.push(moment);
          break;
        case Attitude.BUILDING:
          groups.building.push(moment);
          break;
        case Attitude.PUSHING:
          groups.pushing.push(moment);
          break;
        case Attitude.BEING:
          groups.being.push(moment);
          break;
        default:
          groups.none.push(moment);
          break;
      }
    }

    return [
      {
        groupId: "attitude-none",
        groupLabel: "Pure presence",
        emoji: "○",
        moments: this.sortMoments(groups.none),
      },
      {
        groupId: "attitude-beginning",
        groupLabel: ATTITUDE_METADATA[Attitude.BEGINNING].label,
        emoji: ATTITUDE_METADATA[Attitude.BEGINNING].icon,
        moments: this.sortMoments(groups.beginning),
      },
      {
        groupId: "attitude-keeping",
        groupLabel: ATTITUDE_METADATA[Attitude.KEEPING].label,
        emoji: ATTITUDE_METADATA[Attitude.KEEPING].icon,
        moments: this.sortMoments(groups.keeping),
      },
      {
        groupId: "attitude-building",
        groupLabel: ATTITUDE_METADATA[Attitude.BUILDING].label,
        emoji: ATTITUDE_METADATA[Attitude.BUILDING].icon,
        moments: this.sortMoments(groups.building),
      },
      {
        groupId: "attitude-pushing",
        groupLabel: ATTITUDE_METADATA[Attitude.PUSHING].label,
        emoji: ATTITUDE_METADATA[Attitude.PUSHING].icon,
        moments: this.sortMoments(groups.pushing),
      },
      {
        groupId: "attitude-being",
        groupLabel: ATTITUDE_METADATA[Attitude.BEING].label,
        emoji: ATTITUDE_METADATA[Attitude.BEING].icon,
        moments: this.sortMoments(groups.being),
      },
    ];
  }

  /**
   * Group moments by tags
   *
   * Business Rule: Flexible organization by user-defined labels
   * Moments with multiple tags appear in multiple groups
   */
  groupByTag(moments: Moment[]): MomentGroup[] {
    const tagSet = new Set<string>();
    const untagged: Moment[] = [];

    for (const moment of moments) {
      const hasTags = moment.tags && moment.tags.length > 0;

      if (!hasTags) {
        untagged.push(moment);
      } else {
        for (const tag of moment.tags!) {
          tagSet.add(tag);
        }
      }
    }

    const sortedTags = Array.from(tagSet).sort();

    const groups: MomentGroup[] = sortedTags.map((tag) => {
      const taggedMoments = moments.filter((moment) =>
        moment.tags?.includes(tag)
      );

      return {
        groupId: `tag-${tag}`,
        groupLabel: `#${tag}`,
        moments: this.sortMoments(taggedMoments),
      };
    });

    if (untagged.length > 0) {
      groups.push({
        groupId: "tag-none",
        groupLabel: "Untagged",
        moments: this.sortMoments(untagged),
      });
    }

    return groups;
  }

  /**
   * Monochrome colors for phase grouping (stone palette)
   */
  private readonly PHASE_COLORS: Record<Phase, string> = {
    [Phase.MORNING]: "#d6d3d1",
    [Phase.AFTERNOON]: "#a8a29e",
    [Phase.EVENING]: "#78716c",
    [Phase.NIGHT]: "#57534e",
  };

  /**
   * Group moments by phase of day
   *
   * Business Rule: Organize by time-of-day preferences
   */
  groupByPhase(
    moments: Moment[],
    phaseConfigs: PhaseConfig[]
  ): MomentGroup[] {
    const visiblePhases = phaseConfigs
      .filter((config) => config.isVisible)
      .sort((a, b) => a.order - b.order);

    const groups: MomentGroup[] = visiblePhases.map((config) => ({
      groupId: `phase-${config.phase}`,
      groupLabel: config.label,
      color: this.PHASE_COLORS[config.phase],
      icon: PHASE_ICONS[config.phase],
      moments: [],
    }));

    groups.push({
      groupId: "phase-unset",
      groupLabel: "No Phase",
      color: "#e7e5e4",
      showEmptyState: false,
      moments: [],
    });

    const groupsMap = new Map<string, Moment[]>();
    for (const group of groups) {
      groupsMap.set(group.groupId, []);
    }

    for (const moment of moments) {
      if (moment.phase) {
        const groupId = `phase-${moment.phase}`;
        const groupMoments = groupsMap.get(groupId);
        if (groupMoments) {
          groupMoments.push(moment);
        }
      } else {
        const groupMoments = groupsMap.get("phase-unset");
        if (groupMoments) {
          groupMoments.push(moment);
        }
      }
    }

    for (const group of groups) {
      const groupMoments = groupsMap.get(group.groupId);
      if (groupMoments) {
        group.moments = this.sortMoments(groupMoments);
      }
    }

    return groups;
  }

  /**
   * Get grouping function based on grouping mode
   *
   * @param groupBy - Grouping mode
   * @returns Grouping function or null for "none"
   */
  getGroupingFunction(
    groupBy: Exclude<GroupByMode, "phase">
  ):
    | ((
        moments: Moment[],
        habits?: Record<string, Habit>,
        areas?: Record<string, Area>
      ) => MomentGroup[])
    | null {
    switch (groupBy) {
      case "area":
        return this.groupByArea.bind(this);
      case "created":
        return (moments: Moment[]) => this.groupByCreated(moments);
      case "attitude":
        return this.groupByAttitude.bind(this);
      case "tag":
        return (moments: Moment[]) => this.groupByTag(moments);
      case "none":
      default:
        return null;
    }
  }
}

// Export singleton instance
export const momentGroupingService = new MomentGroupingService();
```

**Step 2:** Update consuming files

Files to update:
- `src/lib/grouping.ts` → DELETE entire file
- All components importing from `lib/grouping.ts` → Import from domain service
- Search codebase for `groupBy*` function calls

```bash
grep -r "from.*grouping" src/
```

**Step 3:** Create tests
```typescript
// src/domain/services/__tests__/MomentGroupingService.test.ts
// Copy existing tests from lib/__tests__/grouping.test.ts if they exist
// Or create new comprehensive tests
```

**Verification:**
```bash
pnpm test src/domain/services/__tests__/MomentGroupingService.test.ts
pnpm exec tsc --noEmit
```

---

## Phase 3: Orchestration Layer (Day 4-5)

### 3.1 MomentReorderingService

**Objective:** Extract complex drag-and-drop orchestration from React component.

**Current Location:** `src/components/DnDProvider.tsx` (lines 228-460+)
**New Location:** `src/application/services/MomentReorderingService.ts`

#### Implementation Steps

**Step 1:** Create application service
```typescript
// src/application/services/MomentReorderingService.ts
import type { Moment } from "@/domain/entities/Moment";
import type { Phase } from "@/domain/value-objects/Phase";
import { momentAllocationService } from "@/domain/services/MomentAllocationService";
import {
  moveMomentWithHistory,
  reorderMomentsWithHistory,
  duplicateMomentWithHistory,
} from "@/infrastructure/state/history-middleware";
import { startBatch, endBatch } from "@/infrastructure/state/history";

/**
 * Application Service: Moment Reordering
 *
 * Orchestrates complex moment reordering operations including:
 * - Within-cell reordering
 * - Drawing board reordering
 * - Batch operations (multi-select)
 * - Duplication during drag
 *
 * This is an application service because it orchestrates multiple
 * domain operations and coordinates with infrastructure (history, state).
 */
export class MomentReorderingService {
  /**
   * Reorder moments within a timeline cell
   *
   * @param activeId - ID of moment being dragged
   * @param overId - ID of moment being dragged over
   * @param day - Day of the cell
   * @param phase - Phase of the cell
   * @param allMoments - All moments in the system
   */
  reorderInCell(
    activeId: string,
    overId: string,
    day: string,
    phase: Phase,
    allMoments: Record<string, Moment>
  ): void {
    const activeMoment = allMoments[activeId];
    const overMoment = allMoments[overId];

    if (!activeMoment || !overMoment) {
      console.warn("[Reordering] Moments not found", { activeId, overId });
      return;
    }

    // Get all moments in this cell, sorted by order
    const cellMoments = momentAllocationService.getMomentsInCell(
      day,
      phase,
      allMoments
    );

    const oldIndex = cellMoments.findIndex((m) => m.id === activeId);
    const newIndex = cellMoments.findIndex((m) => m.id === overId);

    if (oldIndex === -1 || newIndex === -1) {
      console.warn("[Reordering] Index not found", { oldIndex, newIndex });
      return;
    }

    // Calculate new order values
    const reordered = [...cellMoments];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);

    const updates = reordered.map((m, index) => ({
      momentId: m.id,
      newOrder: index,
    }));

    reorderMomentsWithHistory(updates, day, phase);
  }

  /**
   * Reorder moments within drawing board
   *
   * @param activeId - ID of moment being dragged
   * @param overId - ID of moment being dragged over
   * @param allMoments - All moments in the system
   * @param sortMode - Current sort mode
   */
  reorderInDrawingBoard(
    activeId: string,
    overId: string,
    allMoments: Record<string, Moment>,
    sortMode: "auto" | "manual"
  ): void {
    if (sortMode === "auto") {
      console.warn(
        "[Reordering] Cannot manually reorder in auto-sort mode - use sort mode conflict dialog"
      );
      return;
    }

    const activeMoment = allMoments[activeId];
    const overMoment = allMoments[overId];

    if (!activeMoment || !overMoment) {
      return;
    }

    // Get all unallocated moments, sorted by order
    const unallocatedMoments = Object.values(allMoments)
      .filter((m) => !m.day && !m.phase)
      .sort((a, b) => a.order - b.order);

    const oldIndex = unallocatedMoments.findIndex((m) => m.id === activeId);
    const newIndex = unallocatedMoments.findIndex((m) => m.id === overId);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = [...unallocatedMoments];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);

    const updates = reordered.map((m, index) => ({
      momentId: m.id,
      newOrder: index,
    }));

    reorderMomentsWithHistory(updates, null, null);
  }

  /**
   * Batch move moments to a timeline cell
   *
   * @param momentIds - IDs of moments to move
   * @param targetDay - Target day
   * @param targetPhase - Target phase
   * @param allMoments - All moments in the system
   * @param isDuplicate - Whether to duplicate instead of move
   */
  batchMoveToCell(
    momentIds: string[],
    targetDay: string,
    targetPhase: Phase,
    allMoments: Record<string, Moment>,
    isDuplicate: boolean
  ): void {
    // Check capacity
    const validation = momentAllocationService.canAllocateToCell(
      targetDay,
      targetPhase,
      allMoments
    );

    const availableSlots = 3 - momentAllocationService.getMomentsInCell(
      targetDay,
      targetPhase,
      allMoments
    ).length;

    if (momentIds.length > availableSlots) {
      console.warn(
        `[Batch Move] Cannot fit ${momentIds.length} moments in cell (${availableSlots} slots available)`
      );
      return;
    }

    startBatch();

    let currentOrder = momentAllocationService.calculateNextOrder(
      targetDay,
      targetPhase,
      allMoments
    );

    for (const momentId of momentIds) {
      if (isDuplicate) {
        duplicateMomentWithHistory(momentId, targetDay, targetPhase, currentOrder);
      } else {
        moveMomentWithHistory(momentId, targetDay, targetPhase, currentOrder);
      }
      currentOrder++;
    }

    endBatch();
  }

  /**
   * Batch unallocate moments (move to drawing board)
   *
   * @param momentIds - IDs of moments to unallocate
   */
  batchUnallocate(momentIds: string[]): void {
    startBatch();

    for (const momentId of momentIds) {
      moveMomentWithHistory(momentId, null, null, 0);
    }

    endBatch();
  }
}

// Export singleton instance
export const momentReorderingService = new MomentReorderingService();
```

**Step 2:** Refactor DnDProvider.tsx

Extract all orchestration logic to the service. Keep only:
- Drag state management (activeId)
- Collision detection
- Sensor configuration
- Thin handlers that call the service

```typescript
// src/components/DnDProvider.tsx (refactored)
// Before: 460+ lines
// After: ~150 lines

function handleSortableReorder(activeId: string, overId: string, day: string, phase: Phase) {
  momentReorderingService.reorderInCell(activeId, overId, day, phase, allMoments);
}

function handleDrawingBoardReorder(activeId: string, overId: string) {
  momentReorderingService.reorderInDrawingBoard(
    activeId,
    overId,
    allMoments,
    drawingBoardSortMode
  );
}

function handleBatchDropOnTimelineCell(
  momentIds: string[],
  dropData: DroppableData,
  isDuplicate: boolean
) {
  momentReorderingService.batchMoveToCell(
    momentIds,
    dropData.targetDay!,
    dropData.targetPhase!,
    allMoments,
    isDuplicate
  );
}

function handleBatchDropOnDrawingBoard(momentIds: string[]) {
  momentReorderingService.batchUnallocate(momentIds);
}
```

**Step 3:** Create tests
```typescript
// src/application/services/__tests__/MomentReorderingService.test.ts
// Test batch operations, reordering logic, validation
```

**Verification:**
```bash
pnpm test src/application/services/__tests__/MomentReorderingService.test.ts
pnpm exec tsc --noEmit
pnpm build
```

---

### 3.2 Command Handlers Cleanup

**Objective:** Thin out command handlers to be pure adapters.

**Files to update:** All files in `src/commands/`

#### Example Refactor

```typescript
// Before: commands/moment-commands.ts
{
  id: "moment.duplicate",
  action: () => {
    const focusedId = focusedMomentId$.get();
    if (!focusedId) return;
    const moment = moments$[focusedId].get();
    if (!moment) return;
    const newMomentId = duplicateMomentWithHistory(focusedId, null, null, 0);
    if (newMomentId) {
      focusedMomentId$.set(newMomentId);
    }
  }
}

// After: commands/moment-commands.ts
{
  id: "moment.duplicate",
  action: () => {
    const focusedId = focusedMomentId$.get();
    if (!focusedId) return;

    // Delegate to application service
    momentService.duplicateToDrawingBoard(focusedId);
  }
}
```

**Note:** This is low priority and can be done incrementally as you work on related features.

---

## Testing Strategy

### Unit Tests (Domain Layer)
- Test all domain services in isolation
- Focus on business rules and edge cases
- No dependencies on infrastructure

```bash
pnpm test src/domain/services/
```

### Integration Tests (Application Layer)
- Test orchestration logic
- Mock infrastructure dependencies
- Verify correct service coordination

```bash
pnpm test src/application/services/
```

### E2E Tests (Existing)
- Run existing Playwright tests to verify no regressions
- All drag-and-drop flows should still work

```bash
pnpm test:e2e
```

---

## Migration Checklist

### Phase 1 Complete When:
- [ ] AttitudeService created and tested
- [ ] TimeService created and tested
- [ ] `lib/moment-attitude.ts` deleted
- [ ] `lib/dates.ts` only contains utilities
- [ ] `Phase.ts` only contains types/enums
- [ ] All imports updated
- [ ] All tests passing
- [ ] Type check passing
- [ ] Build succeeds

### Phase 2 Complete When:
- [ ] MomentAllocationService created and tested
- [ ] MomentGroupingService created and tested
- [ ] `lib/drag-validation.ts` deleted
- [ ] `lib/grouping.ts` deleted
- [ ] `Moment.ts` canAllocateToPhase removed
- [ ] All imports updated
- [ ] All tests passing
- [ ] Type check passing
- [ ] Build succeeds

### Phase 3 Complete When:
- [ ] MomentReorderingService created and tested
- [ ] DnDProvider.tsx refactored (460+ → ~150 lines)
- [ ] Command handlers cleaned up
- [ ] All tests passing
- [ ] Type check passing
- [ ] Build succeeds
- [ ] E2E tests passing
- [ ] No regressions in drag-and-drop behavior

---

## Success Criteria

### Technical Metrics
- ✅ All business logic in `domain/services/` or `application/services/`
- ✅ No business logic in `lib/` (only pure utilities)
- ✅ No business logic in React components (only UI coordination)
- ✅ 100% test coverage for domain services
- ✅ DnDProvider.tsx reduced by ~70% (460+ → ~150 lines)

### Quality Metrics
- ✅ Zero regressions (all existing functionality works)
- ✅ No new bugs introduced
- ✅ Build time unchanged or improved
- ✅ Type safety maintained or improved

### Developer Experience
- ✅ Clear separation of concerns
- ✅ Easy to find business logic (check `domain/services/` first)
- ✅ Services are independently testable
- ✅ Components are easier to understand
- ✅ New features easier to add

---

## Rollback Plan

If issues arise during migration:

1. **Git is your friend:** Each phase should be a separate commit
2. **Feature flags:** Not needed (internal refactor, no user-facing changes)
3. **Rollback steps:**
   ```bash
   git revert <commit-hash>  # Revert specific phase
   pnpm test                  # Verify still works
   ```

---

## Timeline Estimate

| Phase | Duration | Complexity |
|-------|----------|------------|
| Phase 1: Foundation | 1 day | Low |
| Phase 2: Core Logic | 2 days | Medium |
| Phase 3: Orchestration | 2 days | High |
| **Total** | **5 days** | **Medium-High** |

**Notes:**
- Estimate assumes full-time work
- Add 20% buffer for unexpected issues
- Can be done incrementally (one service per day)

---

## Questions & Decisions

### Open Questions
1. Should we add dependency injection for services, or use singleton instances?
   - **Recommendation:** Start with singletons (simpler), add DI later if needed

2. Should domain services be classes or pure functions?
   - **Recommendation:** Classes for grouping related operations, easier to extend

3. Should we add service interfaces/ports?
   - **Recommendation:** Not initially. Add if we need multiple implementations.

### Architectural Decisions
- ✅ Use singleton pattern for service instances
- ✅ Services are stateless (all state in Legend State store)
- ✅ Services return values or throw errors (no side effects beyond state updates)
- ✅ Use `Record<string, T>` or `T[]` for flexibility (services handle both)

---

## Next Steps

1. Review this plan with the team
2. Choose: full refactor (5 days) or incremental (1 service per week)?
3. Start with Phase 1 (simplest, establishes pattern)
4. Create feature branch: `refactor/ddd-service-extraction`
5. Implement one service at a time
6. Merge when phase is complete and verified

---

## References

- DDD Patterns: See `.claude/skills/ddd/SKILL.md`
- Current Architecture: See `CLAUDE.md`
- Testing Strategy: See `package.json` scripts
- Domain Model: See `src/domain/entities/`

---

**Document Version:** 1.0
**Last Updated:** 2025-01-15
**Author:** Claude Code (DDD Skill)
