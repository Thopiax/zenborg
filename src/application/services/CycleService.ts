import {
  activateCycle,
  type Cycle,
  type CycleResult,
  createCycle,
  deactivateCycle,
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
  cyclePlans$,
  cycles$,
  habits$,
  moments$,
} from "@/infrastructure/state/store";

/**
 * Template durations for cycle creation
 */
export type TemplateDuration = "week" | "2-week" | "month" | "quarter";

/**
 * Application Service for Cycle Management
 *
 * Orchestrates cycle planning, activation, and budget management with
 * Legend State store integration.
 *
 * Business Rules:
 * 1. Only one cycle can be active at a time
 * 2. Cycles must not overlap (validate date ranges)
 * 3. Template durations calculate contiguous dates from last cycle
 * 4. Cycle plans materialize as budgeted moments
 */
export class CycleService {
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

    // Calculate dates from template if provided and no manual override
    if (templateDuration && !startDate) {
      const dates = this.calculateTemplateDates(templateDuration);
      calculatedStartDate = dates.startDate;
      calculatedEndDate = dates.endDate;
    } else if (startDate) {
      // Use manual dates
      calculatedStartDate = startDate;
      calculatedEndDate = endDate || null;
    } else {
      return { error: "Either templateDuration or startDate must be provided" };
    }

    // Auto-close any ongoing cycles (set end date to day before new cycle starts)
    const allCycles = Object.values(cycles$.get());
    const ongoingCycles = allCycles.filter((c) => c.endDate === null);

    if (ongoingCycles.length > 0) {
      const dayBeforeStart = new Date(calculatedStartDate);
      dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
      const closeDate = dayBeforeStart.toISOString().split("T")[0];

      for (const ongoingCycle of ongoingCycles) {
        const updatedCycle: Cycle = {
          ...ongoingCycle,
          endDate: closeDate,
          updatedAt: new Date().toISOString(),
        };
        cycles$[ongoingCycle.id].set(updatedCycle);
      }
    }

    // Validate non-overlapping with existing cycles (after closing ongoing ones)
    const updatedCycles = Object.values(cycles$.get());
    const overlapping = this.findOverlappingCycle(
      updatedCycles,
      calculatedStartDate,
      calculatedEndDate
    );

    if (overlapping) {
      return {
        error: `Cycle dates overlap with existing cycle "${overlapping.name}"`,
      };
    }

    // Create cycle (not active yet)
    const result = createCycle(
      name,
      calculatedStartDate,
      calculatedEndDate,
      false
    );

    if ("error" in result) {
      return result;
    }

    // Add to store
    cycles$[result.id].set(result);

    return result;
  }

  /**
   * Calculates start and end dates based on template duration
   * Dates are contiguous from the last cycle's end date, or today if no cycles exist
   *
   * @param template - Template duration
   * @returns Calculated start and end dates
   */
  private calculateTemplateDates(template: TemplateDuration): {
    startDate: string;
    endDate: string;
  } {
    const allCycles = Object.values(cycles$.get());

    // Find the last cycle's end date
    let baseDate: Date;
    if (allCycles.length > 0) {
      // Sort by end date (or start date if ongoing)
      const sorted = allCycles.sort((a, b) => {
        const aDate = a.endDate || a.startDate;
        const bDate = b.endDate || b.startDate;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      const lastCycle = sorted[0];
      if (lastCycle.endDate) {
        // Start from day after last cycle ended
        baseDate = new Date(lastCycle.endDate);
        baseDate.setDate(baseDate.getDate() + 1);
      } else {
        // Last cycle is ongoing, start today
        baseDate = new Date();
      }
    } else {
      // No cycles yet, start today
      baseDate = new Date();
    }

    // Align to calendar boundaries
    const startDate = this.alignToCalendar(baseDate, template);
    const endDate = this.calculateEndDate(startDate, template);

    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };
  }

  /**
   * Aligns a date to calendar boundaries based on template
   *
   * @param date - Base date
   * @param template - Template duration
   * @returns Aligned date
   */
  private alignToCalendar(date: Date, template: TemplateDuration): Date {
    const aligned = new Date(date);

    switch (template) {
      case "week":
      case "2-week": {
        // Align to Monday
        const dayOfWeek = aligned.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        aligned.setDate(aligned.getDate() + daysToMonday);
        break;
      }

      case "month":
        // Align to 1st of month
        aligned.setDate(1);
        break;

      case "quarter": {
        // Align to 1st of quarter month (Jan, Apr, Jul, Oct)
        const month = aligned.getMonth();
        const quarterStartMonth = Math.floor(month / 3) * 3;
        aligned.setMonth(quarterStartMonth);
        aligned.setDate(1);
        break;
      }
    }

    return aligned;
  }

  /**
   * Calculates end date based on start date and template
   *
   * @param startDate - Start date
   * @param template - Template duration
   * @returns End date
   */
  private calculateEndDate(startDate: Date, template: TemplateDuration): Date {
    const endDate = new Date(startDate);

    switch (template) {
      case "week":
        // 7 days
        endDate.setDate(endDate.getDate() + 6);
        break;

      case "2-week":
        // 14 days
        endDate.setDate(endDate.getDate() + 13);
        break;

      case "month":
        // Last day of month
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0); // Last day of previous month
        break;

      case "quarter":
        // Last day of quarter (3 months)
        endDate.setMonth(endDate.getMonth() + 3);
        endDate.setDate(0); // Last day of previous month
        break;
    }

    return endDate;
  }

  /**
   * Finds a cycle that overlaps with the given date range
   *
   * @param cycles - All cycles to check
   * @param startDate - Start date to check
   * @param endDate - End date to check (null = ongoing)
   * @returns Overlapping cycle or null
   */
  private findOverlappingCycle(
    cycles: Cycle[],
    startDate: string,
    endDate: string | null
  ): Cycle | null {
    for (const cycle of cycles) {
      // Check if ranges overlap
      const cycleStart = new Date(cycle.startDate);
      const cycleEnd = cycle.endDate ? new Date(cycle.endDate) : null;
      const newStart = new Date(startDate);
      const newEnd = endDate ? new Date(endDate) : null;

      // If either cycle is ongoing (null end date), check start dates
      if (!cycleEnd || !newEnd) {
        // Ongoing cycles: check if start dates are different
        if (cycleStart.getTime() === newStart.getTime()) {
          return cycle;
        }
        continue;
      }

      // Both have end dates: check for overlap
      // Overlap if: newStart <= cycleEnd AND newEnd >= cycleStart
      if (newStart <= cycleEnd && newEnd >= cycleStart) {
        return cycle;
      }
    }

    return null;
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
      const overlapping = this.findOverlappingCycle(
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
   * Gets the currently active cycle
   *
   * @returns Active cycle or null
   */
  getActiveCycle(): Cycle | null {
    return activeCycle$.get();
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
   * Materializes moments for a cycle plan
   * Deletes existing budgeted moments for this plan and creates N new ones
   *
   * @param cyclePlanId - ID of cycle plan to materialize
   */
  private materializeCyclePlanMoments(cyclePlanId: string): void {
    const plan = cyclePlans$[cyclePlanId].get();
    if (!plan) {
      console.error(`Cycle plan ${cyclePlanId} not found`);
      return;
    }

    // Get habit to inherit properties
    const habit = habits$[plan.habitId].get();
    if (!habit) {
      console.error(`Habit ${plan.habitId} not found`);
      return;
    }

    // Delete existing moments for this plan
    const allMoments = Object.values(moments$.get());
    for (const moment of allMoments) {
      if (moment.cyclePlanId === cyclePlanId) {
        moments$[moment.id].delete();
      }
    }

    // Create N new moments (budgeted, unallocated)
    for (let i = 0; i < plan.budgetedCount; i++) {
      const result = createMoment({
        name: habit.name, // Inherit from habit
        areaId: habit.areaId, // Inherit from habit
        habitId: plan.habitId,
        cycleId: plan.cycleId,
        cyclePlanId: plan.id,
        phase: null, // Unallocated
        tags: habit.tags || [],
      });

      if ("error" in result) {
        console.error(`Failed to create budgeted moment: ${result.error}`);
        continue;
      }

      moments$[result.id].set(result);
    }
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

    // Deactivate current active cycle
    const currentActive = activeCycle$.get();
    if (currentActive && currentActive.id !== cycleId) {
      const deactivated = deactivateCycle(currentActive);
      cycles$[currentActive.id].set(deactivated);
    }

    // Activate new cycle
    const activated = activateCycle(cycle);
    cycles$[cycleId].set(activated);

    // Materialize all cycle plans for this cycle
    const allPlans = Object.values(cyclePlans$.get());
    const cyclePlans = allPlans.filter((plan) => plan.cycleId === cycleId);

    for (const plan of cyclePlans) {
      this.materializeCyclePlanMoments(plan.id);
    }

    return activated;
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
}
