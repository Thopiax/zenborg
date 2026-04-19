import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createMoment } from '@/domain/entities/Moment'
import { createArea } from '@/domain/entities/Area'
import { createCycle } from '@/domain/entities/Cycle'
import { Phase } from '@/domain/value-objects/Phase'
import { createHabit } from '@/domain/entities/Habit'
import {
  moments$,
  areas$,
  activeCycleId$,
  cycles$,
  habits$,
  phaseConfigs$,
  unallocatedMoments$,
  allocatedMoments$,
  activeCycle$,
  visiblePhases$,
  momentsByDay$,
  momentsByDayAndPhase$,
  deckMomentsByAreaAndHabit$,
} from '../state/store'

describe('Store', () => {
  beforeEach(() => {
    // Clear store before each test
    moments$.set({})
    areas$.set({})
    cycles$.set({})
    activeCycleId$.set(null)
    habits$.set({})
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
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment({ name: 'Morning Run', areaId: area.id })
      if ('error' in moment) throw new Error(moment.error)

      moments$[moment.id].set(moment)

      expect(moments$[moment.id].get()).toEqual(moment)
    })

    it('should update a moment name', () => {
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment({ name: 'Morning Run', areaId: area.id })
      if ('error' in moment) throw new Error(moment.error)

      moments$[moment.id].set(moment)

      // Update the name using fine-grained reactivity
      moments$[moment.id].name.set('Evening Walk')

      expect(moments$[moment.id].name.get()).toBe('Evening Walk')
    })

    it('should delete a moment from the store', () => {
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment({ name: 'Morning Run', areaId: area.id })
      if ('error' in moment) throw new Error(moment.error)

      moments$[moment.id].set(moment)

      // Delete using Legend State's delete()
      moments$[moment.id].delete()

      expect(moments$[moment.id].get()).toBeUndefined()
      expect(Object.keys(moments$.get())).toHaveLength(0)
    })

    it('should access moment by ID directly', () => {
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment({ name: 'Morning Run', areaId: area.id })
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
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment({ name: 'Morning Run', areaId: area.id })
      const moment2 = createMoment({ name: 'Deep Work', areaId: area.id })
      if ('error' in moment1 || 'error' in moment2) throw new Error('Moment creation failed')

      moments$[moment1.id].set(moment1)
      moments$[moment2.id].set(moment2)

      const unallocated = unallocatedMoments$.get()
      expect(unallocated).toHaveLength(2)
    })

    it('should exclude allocated moments', () => {
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment({ name: 'Morning Run', areaId: area.id })
      const moment2 = createMoment({ name: 'Deep Work', areaId: area.id })
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
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment = createMoment({ name: 'Morning Run', areaId: area.id })
      if ('error' in moment) throw new Error(moment.error)

      moments$[moment.id].set(moment)

      expect(allocatedMoments$.get()).toEqual([])
    })

    it('should return only allocated moments', () => {
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment({ name: 'Morning Run', areaId: area.id })
      const moment2 = createMoment({ name: 'Deep Work', areaId: area.id })
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
      const cycle1 = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      const cycle2 = createCycle({ name: 'Q2 2025', startDate: '2025-04-01' })
      if ('error' in cycle1 || 'error' in cycle2) throw new Error('Cycle creation failed')

      cycles$[cycle1.id].set(cycle1)
      cycles$[cycle2.id].set(cycle2)
      activeCycleId$.set(cycle2.id)

      const active = activeCycle$.get()
      expect(active).toBeDefined()
      expect(active?.id).toBe(cycle2.id)
      expect(active?.name).toBe('Q2 2025')
    })

    it('should return null when no cycle contains today and none is pinned', () => {
      // Past cycle only — does not contain today, derivation skips it.
      const cycle = createCycle({
        name: 'Old cycle',
        startDate: '2020-01-01',
        endDate: '2020-12-31',
      })
      if ('error' in cycle) throw new Error(cycle.error)

      cycles$[cycle.id].set(cycle)
      // activeCycleId$ is already null from beforeEach

      const active = activeCycle$.get()
      expect(active == null).toBe(true)
    })
  })

  describe('Computed Observables - Moments by Day', () => {
    it('should group allocated moments by day', () => {
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment({ name: 'Morning Run', areaId: area.id })
      const moment2 = createMoment({ name: 'Deep Work', areaId: area.id })
      const moment3 = createMoment({ name: 'Evening Walk', areaId: area.id })
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

  describe('deckMomentsByAreaAndHabit$ ordering', () => {
    it('should order habits within area by habit.order', () => {
      // Create area
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)
      areas$[area.id].set(area)

      // Create cycle and set it as active
      const cycle = createCycle({ name: 'Test Cycle', startDate: '2025-01-01', endDate: null })
      if ('error' in cycle) throw new Error(cycle.error)
      cycles$[cycle.id].set(cycle)
      activeCycleId$.set(cycle.id)

      // Create two habits with different orders
      const habitA = createHabit({ name: 'Habit A', areaId: area.id, order: 2 })
      const habitB = createHabit({ name: 'Habit B', areaId: area.id, order: 0 })
      if ('error' in habitA || 'error' in habitB) throw new Error('Habit creation failed')
      habits$[habitA.id].set(habitA)
      habits$[habitB.id].set(habitB)

      // Create deck moments (unallocated, with cyclePlanId set)
      const m1 = createMoment({ name: 'Moment A', areaId: area.id, habitId: habitA.id, cycleId: cycle.id, cyclePlanId: 'plan-a' })
      const m2 = createMoment({ name: 'Moment B', areaId: area.id, habitId: habitB.id, cycleId: cycle.id, cyclePlanId: 'plan-b' })
      if ('error' in m1 || 'error' in m2) throw new Error('Moment creation failed')
      moments$[m1.id].set(m1)
      moments$[m2.id].set(m2)

      const result = deckMomentsByAreaAndHabit$.get()
      const habitIds = Object.keys(result[area.id] || {})

      // habit-b (order 0) should come before habit-a (order 2)
      expect(habitIds[0]).toBe(habitB.id)
      expect(habitIds[1]).toBe(habitA.id)
    })
  })

  describe('Computed Observables - Moments by Day and Phase', () => {
    it('should group allocated moments by day and phase', () => {
      const area = createArea({
        name: 'Wellness',
        color: '#10b981',
        emoji: '🟢',
        order: 0,
      })
      if ('error' in area) throw new Error(area.error)

      areas$[area.id].set(area)

      const moment1 = createMoment({ name: 'Morning Run', areaId: area.id })
      const moment2 = createMoment({ name: 'Deep Work', areaId: area.id })
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
