import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createMoment } from '@/domain/entities/Moment'
import { createArea } from '@/domain/entities/Area'
import { createCycle } from '@/domain/entities/Cycle'
import { Phase } from '@/domain/value-objects/Phase'
import {
  moments$,
  areas$,
  cycles$,
  phaseConfigs$,
  unallocatedMoments$,
  allocatedMoments$,
  activeCycle$,
  visiblePhases$,
  momentsByDay$,
  momentsByDayAndPhase$,
} from '../state/store'

describe('Store', () => {
  beforeEach(() => {
    // Clear store before each test
    moments$.set({})
    areas$.set({})
    cycles$.set({})
    phaseConfigs$.set({})
  })

  describe('Core Observables', () => {
    it('should create moments observable as empty object', () => {
      expect(moments$.get()).toEqual({})
    })

    it('should create areas observable as empty object', () => {
      expect(areas$.get()).toEqual({})
    })

    it('should create cycles observable as empty object', () => {
      expect(cycles$.get()).toEqual({})
    })

    it('should create phaseConfigs observable as empty object', () => {
      expect(phaseConfigs$.get()).toEqual({})
    })
  })

  describe('Moment Operations', () => {
    it('should add a moment to the store', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment('Morning Run', area.id)
      if ('error' in moment) throw new Error(moment.error)

      moments$[moment.id].set(moment)

      expect(moments$[moment.id].get()).toEqual(moment)
    })

    it('should update a moment name', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment('Morning Run', area.id)
      if ('error' in moment) throw new Error(moment.error)

      moments$[moment.id].set(moment)

      // Update the name using fine-grained reactivity
      moments$[moment.id].name.set('Evening Walk')

      expect(moments$[moment.id].name.get()).toBe('Evening Walk')
    })

    it('should delete a moment from the store', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment('Morning Run', area.id)
      if ('error' in moment) throw new Error(moment.error)

      moments$[moment.id].set(moment)

      // Delete using Legend State's delete()
      moments$[moment.id].delete()

      expect(moments$[moment.id].get()).toBeUndefined()
      expect(Object.keys(moments$.get())).toHaveLength(0)
    })

    it('should access moment by ID directly', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment('Morning Run', area.id)
      if ('error' in moment) throw new Error(moment.error)

      const momentId = moment.id

      moments$[momentId].set(moment)

      // Direct access by ID
      const retrieved = moments$[momentId].get()
      expect(retrieved).toEqual(moment)
    })
  })

  describe('Computed Observables - Unallocated Moments', () => {
    it('should return empty array when no moments exist', () => {
      expect(unallocatedMoments$.get()).toEqual([])
    })

    it('should return all moments when none are allocated', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment('Morning Run', area.id)
      const moment2 = createMoment('Deep Work', area.id)
      if ('error' in moment1 || 'error' in moment2) throw new Error('Moment creation failed')

      moments$[moment1.id].set(moment1)
      moments$[moment2.id].set(moment2)

      const unallocated = unallocatedMoments$.get()
      expect(unallocated).toHaveLength(2)
    })

    it('should exclude allocated moments', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment('Morning Run', area.id)
      const moment2 = createMoment('Deep Work', area.id)
      if ('error' in moment1 || 'error' in moment2) throw new Error('Moment creation failed')

      moments$[moment1.id].set(moment1)
      moments$[moment2.id].set(moment2)

      // Allocate moment1
      moments$[moment1.id].day.set('2025-01-15')
      moments$[moment1.id].phase.set(Phase.MORNING)

      const unallocated = unallocatedMoments$.get()
      expect(unallocated).toHaveLength(1)
      expect(unallocated[0].id).toBe(moment2.id)
    })
  })

  describe('Computed Observables - Allocated Moments', () => {
    it('should return empty array when no moments are allocated', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment('Morning Run', area.id)
      if ('error' in moment) throw new Error(moment.error)

      moments$[moment.id].set(moment)

      expect(allocatedMoments$.get()).toEqual([])
    })

    it('should return only allocated moments', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment('Morning Run', area.id)
      const moment2 = createMoment('Deep Work', area.id)
      if ('error' in moment1 || 'error' in moment2) throw new Error('Moment creation failed')

      moments$[moment1.id].set(moment1)
      moments$[moment2.id].set(moment2)

      // Allocate moment1
      moments$[moment1.id].day.set('2025-01-15')
      moments$[moment1.id].phase.set(Phase.MORNING)

      const allocated = allocatedMoments$.get()
      expect(allocated).toHaveLength(1)
      expect(allocated[0].id).toBe(moment1.id)
    })
  })

  describe('Computed Observables - Active Cycle', () => {
    it('should return null or undefined when no cycles exist', () => {
      const active = activeCycle$.get()
      // Computed observable may return undefined before evaluation
      expect(active == null).toBe(true)
    })

    it('should return the active cycle', () => {
      const cycle1 = createCycle('Q1 2025', '2025-01-01', null, false)
      const cycle2 = createCycle('Q2 2025', '2025-04-01', null, true)
      if ('error' in cycle1 || 'error' in cycle2) throw new Error('Cycle creation failed')

      cycles$[cycle1.id].set(cycle1)
      cycles$[cycle2.id].set(cycle2)

      const active = activeCycle$.get()
      expect(active).toBeDefined()
      expect(active?.id).toBe(cycle2.id)
      expect(active?.name).toBe('Q2 2025')
    })

    it('should return null when no cycle is active', () => {
      const cycle = createCycle('Q1 2025', '2025-01-01', null, false)
      if ('error' in cycle) throw new Error(cycle.error)

      cycles$[cycle.id].set(cycle)

      const active = activeCycle$.get()
      expect(active == null).toBe(true)
    })
  })

  describe('Computed Observables - Moments by Day', () => {
    it('should group allocated moments by day', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment('Morning Run', area.id)
      const moment2 = createMoment('Deep Work', area.id)
      const moment3 = createMoment('Evening Walk', area.id)
      if ('error' in moment1 || 'error' in moment2 || 'error' in moment3) {
        throw new Error('Moment creation failed')
      }

      moments$[moment1.id].set(moment1)
      moments$[moment2.id].set(moment2)
      moments$[moment3.id].set(moment3)

      // Allocate to different days
      moments$[moment1.id].day.set('2025-01-15')
      moments$[moment1.id].phase.set(Phase.MORNING)

      moments$[moment2.id].day.set('2025-01-15')
      moments$[moment2.id].phase.set(Phase.AFTERNOON)

      moments$[moment3.id].day.set('2025-01-16')
      moments$[moment3.id].phase.set(Phase.EVENING)

      const byDay = momentsByDay$.get()

      expect(Object.keys(byDay)).toHaveLength(2)
      expect(byDay['2025-01-15']).toHaveLength(2)
      expect(byDay['2025-01-16']).toHaveLength(1)
    })
  })

  describe('Computed Observables - Moments by Day and Phase', () => {
    it('should group allocated moments by day and phase', () => {
      const area = createArea('Wellness', '#10b981', '🟢', 0)
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment('Morning Run', area.id)
      const moment2 = createMoment('Deep Work', area.id)
      if ('error' in moment1 || 'error' in moment2) throw new Error('Moment creation failed')

      moments$[moment1.id].set(moment1)
      moments$[moment2.id].set(moment2)

      // Allocate to same day, different phases
      moments$[moment1.id].day.set('2025-01-15')
      moments$[moment1.id].phase.set(Phase.MORNING)

      moments$[moment2.id].day.set('2025-01-15')
      moments$[moment2.id].phase.set(Phase.AFTERNOON)

      const byDayAndPhase = momentsByDayAndPhase$.get()

      expect(byDayAndPhase['2025-01-15'][Phase.MORNING]).toHaveLength(1)
      expect(byDayAndPhase['2025-01-15'][Phase.AFTERNOON]).toHaveLength(1)
      expect(byDayAndPhase['2025-01-15'][Phase.MORNING][0].id).toBe(moment1.id)
    })
  })
})
