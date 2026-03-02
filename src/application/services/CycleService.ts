import type { Area } from "@/domain/entities/Area";
import {
  type Cycle,
  type CycleResult,
  createCycle,
  isDateInCycle,
} from "@/domain/entities/Cycle";
import {
  type CyclePlan,
  type CyclePlanResult,
  createCyclePlan,
  updateCyclePlanBudget,
} from "@/domain/entities/CyclePlan";
import {
  allocateMoment,
  createMoment,
  type Moment,
  type MomentResult,
} from "@/domain/entities/Moment";
import {
  activeCycle$,
  activeCycleId$,
  areas$,
  cyclePlans$,
  cycles$,
  habits$,
  moments$,
} from "@/infrastructure/state/store";
import {
  calculateDefaultStartDate,
  calculateTemplateDates,
  findOverlappingCycle,
  generateCycleName,
  getDayBefore,
  type TemplateDuration,
} from "@/domain/services/CycleDateService";
import { fromISODate } from "@/lib/dates";

// Re-export TemplateDuration for backward compatibility
export type { TemplateDuration };

/**
 * Application Service for Cycle Management
 *
 * Orchestrates cycle planning, activation, and budget management with
 * Legend State store integration.
 *
 * Business Rules:
 * 1. Only one cycle can be active at a time
 * 2. Cycles must not overlap (validate date ranges)
 * 3. Cycles can start on the same day previous cycle ended
 * 4. Template durations align to calendar boundaries
 * 5. Cycle plans materialize as budgeted moments
 */
export class CycleService {
  /**
   * Gets the default start date for a new cycle
   *
   * Business Rule: New cycles start on the same day the last cycle ended,
   * or tomorrow if no cycles exist
   *
   * @returns ISO date string for default start date
   */
  getDefaultStartDate(): string {
    const allCycles = Object.values(cycles$.get());
    return calculateDefaultStartDate(allCycles);
  }

  /**
   * Quick-creates a cycle from a template: calculates dates, generates name,
   * plans the cycle, and activates it in one step.
   *
   * @param template - Template duration (week, 2-week, month, quarter)
   * @returns Created and activated cycle, or error
   */
  quickCreateCycle(template: TemplateDuration): CycleResult {
    const allCycles = Object.values(cycles$.get());
    const { startDate, endDate } = calculateTemplateDates(template, allCycles);
    const name = generateCycleName(template, fromISODate(startDate));

    const result = this.planCycle(name, undefined, startDate, endDate);
    if ("error" in result) return result;

    return this.activateCycle(result.id);
  }

  /**
   * Plans a new cycle with template duration or manual dates
   *
   * @param name - Cycle name
   * @param templateDuration - Optional template (week, 2-week, month, quarter)
   * @param startDate - Optional manual start date (overrides template)
   * @param endDate - Optional manual end date (overrides template)
   * @returns Created cycle or error if validation fails
   */
  planCycle(
    name: string,
    templateDuration?: TemplateDuration,
    startDate?: string,
    endDate?: string
  ): CycleResult {
    let calculatedStartDate: string;
    let calculatedEndDate: string | null;

    const allCycles = Object.values(cycles$.get());

    // Calculate dates from template if provided and no manual override
    if (templateDuration && !startDate) {
      const dates = calculateTemplateDates(templateDuration, allCycles);
      calculatedStartDate = dates.startDate;
      calculatedEndDate = dates.endDate;
    } else if (startDate) {
      // Use manual dates
      calculatedStartDate = startDate;
      calculatedEndDate = endDate || null;
    } else {
      return { error: "Either templateDuration or startDate must be provided" };
    }

    // Validate non-overlapping with existing cycles
    const updatedCycles = Object.values(cycles$.get());
    const overlapping = findOverlappingCycle(
      updatedCycles,
      calculatedStartDate,
      calculatedEndDate
    );

    if (overlapping) {
      return {
        error: `Cycle dates overlap with existing cycle "${overlapping.name}"`,
      };
    }

    // Create cycle (not active yet — activation is done via activeCycleId$)
    const result = createCycle({
      name,
      startDate: calculatedStartDate,
      endDate: calculatedEndDate,
    });

    if ("error" in result) {
      return result;
    }

    // Add to store
    cycles$[result.id].set(result);

    return result;
  }


  /**
   * Updates a cycle's name and/or dates
   *
   * @param cycleId - ID of cycle to update
   * @param updates - Partial cycle updates (name, startDate, endDate)
   * @returns Updated cycle or error
   */
  updateCycle(
    cycleId: string,
    updates: { name?: string; startDate?: string; endDate?: string | null }
  ): CycleResult {
    const cycle = cycles$[cycleId].get();
    if (!cycle) {
      return { error: `Cycle with ID ${cycleId} not found` };
    }

    // Apply updates
    const updatedCycle: Cycle = {
      ...cycle,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.startDate !== undefined && { startDate: updates.startDate }),
      ...(updates.endDate !== undefined && { endDate: updates.endDate }),
      updatedAt: new Date().toISOString(),
    };

    // If dates changed, validate non-overlapping with other cycles
    if (updates.startDate || updates.endDate !== undefined) {
      const allCycles = Object.values(cycles$.get()).filter(
        (c) => c.id !== cycleId
      );
      const overlapping = findOverlappingCycle(
        allCycles,
        updatedCycle.startDate,
        updatedCycle.endDate
      );

      if (overlapping) {
        return {
          error: `Cycle dates overlap with existing cycle "${overlapping.name}"`,
        };
      }
    }

    // Update store
    cycles$[cycleId].set(updatedCycle);

    return updatedCycle;
  }

  /**
   * Deletes a cycle and all its associated data
   *
   * @param cycleId - ID of cycle to delete
   * @returns Success true or error
   */
  deleteCycle(cycleId: string): { success: true } | { error: string } {
    const cycle = cycles$[cycleId].get();
    if (!cycle) {
      return { error: `Cycle with ID ${cycleId} not found` };
    }

    // Delete all cycle plans for this cycle
    const allCyclePlans = Object.values(cyclePlans$.get());
    const cyclePlansToDelete = allCyclePlans.filter(
      (cp) => cp.cycleId === cycleId
    );

    for (const plan of cyclePlansToDelete) {
      cyclePlans$[plan.id].delete();
    }

    // Delete all moments for this cycle
    const allMoments = Object.values(moments$.get());
    const momentsToDelete = allMoments.filter((m) => m.cycleId === cycleId);

    for (const moment of momentsToDelete) {
      moments$[moment.id].delete();
    }

    // Delete the cycle itself
    cycles$[cycleId].delete();

    return { success: true };
  }

  /**
   * Gets a single cycle by ID
   *
   * @param cycleId - ID of cycle to retrieve
   * @returns Cycle if found, null otherwise
   */
  getCycle(cycleId: string): Cycle | null {
    return cycles$[cycleId].get() || null;
  }

  /**
   * Gets all cycles
   *
   * @returns Array of all cycles
   */
  getAllCycles(): Cycle[] {
    return Object.values(cycles$.get());
  }

  /**
   * Gets the currently active cycle (via activeCycleId$)
   *
   * @returns Active cycle or null
   */
  getActiveCycle(): Cycle | null {
    return activeCycle$.get();
  }

  /**
   * Gets the cycle that contains today's date
   *
   * Business rule: Current cycle is the one whose date range contains today
   *
   * @returns Current cycle or null if no cycle contains today
   */
  getCurrentCycle(): Cycle | null {
    const today = new Date().toISOString().split("T")[0];
    const allCycles = Object.values(cycles$.get());

    return allCycles.find(cycle => isDateInCycle(cycle, today)) || null;
  }

  /**
   * Gets a single cycle plan by ID
   *
   * @param cyclePlanId - ID of cycle plan to retrieve
   * @returns Cycle plan if found, null otherwise
   */
  getCyclePlan(cyclePlanId: string): CyclePlan | null {
    return cyclePlans$[cyclePlanId].get() || null;
  }

  /**
   * Gets all cycle plans
   *
   * @returns Array of all cycle plans
   */
  getAllCyclePlans(): CyclePlan[] {
    return Object.values(cyclePlans$.get());
  }

  /**
   * Gets all cycle plans for a specific cycle
   *
   * @param cycleId - ID of cycle to get plans for
   * @returns Array of cycle plans for the specified cycle
   */
  getCyclePlansForCycle(cycleId: string): CyclePlan[] {
    const allPlans = Object.values(cyclePlans$.get());
    return allPlans.filter((plan) => plan.cycleId === cycleId);
  }

  /**
   * Gets all current and future cycles (excludes past cycles)
   * Sorted chronologically from oldest to newest
   *
   * Domain rule: A cycle is "past" if its end date is before today.
   * Ongoing cycles (no end date) are always included.
   *
   * @returns Array of cycles sorted by start date (ascending)
   */
  getCurrentAndFutureCycles(): Cycle[] {
    const allCycles = Object.values(cycles$.get());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allCycles
      .filter((cycle) => {
        // Include cycles with no end date (ongoing)
        if (!cycle.endDate) return true;

        // Include cycles where end date is today or in the future
        const endDate = new Date(cycle.endDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= today;
      })
      .sort((a, b) => {
        // Sort chronologically: oldest first
        return (
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
      });
  }

  /**
   * Gets budgeted moments for a specific cycle (unallocated deck moments)
   *
   * @param cycleId - ID of cycle
   * @returns Array of budgeted moments for this cycle, sorted by creation time
   */
  getCycleDeckMoments(cycleId: string): Moment[] {
    const allMoments = Object.values(moments$.get());

    return allMoments
      .filter(
        (m) =>
          m.cycleId === cycleId &&
          m.cyclePlanId !== null &&
          m.day === null &&
          m.phase === null
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }

  /**
   * Budgets a habit to a cycle (or updates existing budget count)
   *
   * @param cycleId - ID of cycle to budget to
   * @param habitId - ID of habit to budget
   * @param count - Number of moments to budget
   * @returns Created or updated cycle plan or error
   */
  budgetHabitToCycle(
    cycleId: string,
    habitId: string,
    count: number
  ): CyclePlanResult {
    // Validate cycle exists
    const cycle = cycles$[cycleId].get();
    if (!cycle) {
      return { error: `Cycle with ID ${cycleId} not found` };
    }

    // Find existing cycle plan or create new
    const existingPlan = this.findCyclePlan(cycleId, habitId);

    let plan: CyclePlan;

    if (existingPlan) {
      // Update existing plan
      const result = updateCyclePlanBudget(existingPlan, {
        budgetedCount: count,
      });
      if ("error" in result) {
        return result;
      }
      plan = result;
      cyclePlans$[plan.id].set(plan);
    } else {
      // Create new plan
      const result = createCyclePlan({
        cycleId,
        habitId,
        budgetedCount: count,
      });
      if ("error" in result) {
        return result;
      }
      plan = result;
      cyclePlans$[plan.id].set(plan);
    }

    // Materialize moments
    this.materializeCyclePlanMoments(plan.id);

    return plan;
  }

  /**
   * Materializes moments for a cycle plan incrementally.
   * Adds or removes only the delta, preserving allocated moments.
   *
   * @param cyclePlanId - ID of cycle plan to materialize
   */
  private materializeCyclePlanMoments(cyclePlanId: string): void {
    const plan = cyclePlans$[cyclePlanId].get();
    if (!plan) {
      console.error(`Cycle plan ${cyclePlanId} not found`);
      return;
    }

    const habit = habits$[plan.habitId].get();
    if (!habit) {
      console.error(`Habit ${plan.habitId} not found`);
      return;
    }

    // Get existing moments for this plan
    const allMoments = Object.values(moments$.get());
    const planMoments = allMoments.filter((m) => m.cyclePlanId === cyclePlanId);

    // Separate into allocated (on timeline) and unallocated (in deck)
    const allocated = planMoments.filter(
      (m) => m.day !== null && m.phase !== null
    );
    const unallocated = planMoments.filter(
      (m) => m.day === null || m.phase === null
    );

    const currentCount = planMoments.length;
    const targetCount = plan.budgetedCount;

    if (targetCount > currentCount) {
      // INCREMENT: Create only the delta
      const toCreate = targetCount - currentCount;
      for (let i = 0; i < toCreate; i++) {
        const result = createMoment({
          name: habit.name,
          areaId: habit.areaId,
          emoji: habit.emoji,
          habitId: plan.habitId,
          cycleId: plan.cycleId,
          cyclePlanId: plan.id,
          phase: null,
          tags: habit.tags || [],
        });

        if ("error" in result) {
          console.error(`Failed to create budgeted moment: ${result.error}`);
          continue;
        }

        moments$[result.id].set(result);
      }
    } else if (targetCount < currentCount) {
      // DECREMENT: Remove unallocated moments only; allocated moments survive
      const toRemove = currentCount - targetCount;
      const removable = Math.min(toRemove, unallocated.length);

      for (let i = 0; i < removable; i++) {
        moments$[unallocated[i].id].delete();
      }
    }
    // targetCount === currentCount: no-op
  }

  /**
   * Finds a cycle plan by cycle and habit IDs
   *
   * @param cycleId - Cycle ID
   * @param habitId - Habit ID
   * @returns Cycle plan or undefined
   */
  private findCyclePlan(
    cycleId: string,
    habitId: string
  ): CyclePlan | undefined {
    const allPlans = Object.values(cyclePlans$.get());
    return allPlans.find(
      (plan) => plan.cycleId === cycleId && plan.habitId === habitId
    );
  }

  /**
   * Activates a cycle (starts it)
   * Deactivates the current active cycle and materializes all cycle plans
   *
   * @param cycleId - ID of cycle to activate
   * @returns Activated cycle or error
   */
  activateCycle(cycleId: string): CycleResult {
    const cycle = cycles$[cycleId].get();
    if (!cycle) {
      return { error: `Cycle with ID ${cycleId} not found` };
    }

    // Set the active cycle ID (replaces any previously active cycle)
    activeCycleId$.set(cycleId);

    // Materialize all cycle plans for this cycle
    const allPlans = Object.values(cyclePlans$.get());
    const cyclePlansForCycle = allPlans.filter((plan) => plan.cycleId === cycleId);

    for (const plan of cyclePlansForCycle) {
      this.materializeCyclePlanMoments(plan.id);
    }

    return cycle;
  }

  /**
   * Allocates a budgeted moment from the deck to a timeline slot
   *
   * @param momentId - ID of moment to allocate
   * @param day - ISO date string
   * @param phase - Phase to allocate to
   * @param order - Order within phase (0-2)
   * @returns Updated moment or error
   */
  allocateMomentFromDeck(
    momentId: string,
    day: string,
    phase: string,
    order: number
  ): MomentResult {
    const moment = moments$[momentId].get();
    if (!moment) {
      return { error: `Moment with ID ${momentId} not found` };
    }

    // Validate moment is in deck (unallocated but budgeted)
    if (moment.cyclePlanId === null) {
      return { error: "Moment is not budgeted (not from a cycle plan)" };
    }

    if (moment.day !== null || moment.phase !== null) {
      return { error: "Moment is already allocated" };
    }

    // Use domain function to allocate
    const allocated = allocateMoment(moment, {
      day,
      phase: phase as any,
      order,
    });

    // Update store
    moments$[momentId].set(allocated);

    return allocated;
  }

  /**
   * Spawns a spontaneous moment from a habit (ad-hoc, not from budget)
   *
   * @param habitId - ID of habit to spawn from
   * @param day - ISO date string
   * @param phase - Phase to allocate to
   * @param order - Order within phase (0-2)
   * @returns Created moment or error
   */
  spawnSpontaneousFromHabit(
    habitId: string,
    day: string,
    phase: string,
    order: number
  ): MomentResult {
    const habit = habits$[habitId].get();
    if (!habit) {
      return { error: `Habit with ID ${habitId} not found` };
    }

    const activeCycle = activeCycle$.get();

    // Create spontaneous moment (cyclePlanId = null)
    const result = createMoment({
      name: habit.name,
      areaId: habit.areaId,
      emoji: habit.emoji,
      habitId: habit.id,
      cycleId: activeCycle?.id || null,
      cyclePlanId: null, // Spontaneous
      phase: null,
      tags: habit.tags || [],
    });

    if ("error" in result) {
      return result;
    }

    // Allocate immediately (spawns directly to timeline)
    const allocated = allocateMoment(result, {
      day,
      phase: phase as any,
      order,
    });

    // Add to store
    moments$[allocated.id].set(allocated);

    return allocated;
  }

  /**
   * Creates a standalone moment (not from habit, ad-hoc)
   *
   * @param name - Moment name
   * @param areaId - Area ID
   * @param day - Optional ISO date string (null = unallocated)
   * @param phase - Optional phase (null = unallocated)
   * @param order - Order within phase (0-2)
   * @returns Created moment or error
   */
  createStandaloneMoment(
    name: string,
    areaId: string,
    day: string | null,
    phase: string | null,
    order: number
  ): MomentResult {
    const activeCycle = activeCycle$.get();

    // Create standalone moment (habitId = null, cyclePlanId = null)
    const result = createMoment({
      name,
      areaId,
      habitId: null, // Standalone
      cycleId: activeCycle?.id || null,
      cyclePlanId: null, // Spontaneous
      phase: null,
      tags: [],
    });

    if ("error" in result) {
      return result;
    }

    let finalMoment = result;

    // Allocate if day/phase provided
    if (day && phase) {
      finalMoment = allocateMoment(result, { day, phase: phase as any, order });
    }

    // Add to store
    moments$[finalMoment.id].set(finalMoment);

    return finalMoment;
  }

  /**
   * Gets areas with their grouped deck moments for the active cycle
   *
   * Returns areas that have budgeted moments in the cycle deck,
   * grouped by area and then by habit. Only includes areas with
   * at least one deck moment.
   *
   * @param deckMomentsByAreaAndHabit - Grouped moments from store selector
   * @returns Array of areas with their habit-grouped moments, sorted by area order
   */
  getAreasWithDeckMoments(
    deckMomentsByAreaAndHabit: Record<string, Record<string, Moment[]>>
  ): Array<{ area: Area; habits: Record<string, Moment[]> }> {
    const allAreas = areas$.get();
    const areasMap: Record<string, Area> = allAreas;

    return Object.keys(deckMomentsByAreaAndHabit)
      .map((areaId) => ({
        area: areasMap[areaId],
        habits: deckMomentsByAreaAndHabit[areaId],
      }))
      .filter(({ area }) => Boolean(area))
      .sort((a, b) => a.area.order - b.area.order);
  }
}
