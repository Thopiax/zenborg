import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { initializeStore, clearStore } from '../state/initialize'
import { areas$, cycles$, phaseConfigs$ } from '../state/store'

describe('Initialize Store', () => {
  beforeEach(() => {
    // Clear store before each test
    clearStore()
  })

  describe('initializeStore', () => {
    it('should create default areas on first run', async () => {
      await initializeStore()

      const areas = areas$.get()
      const areaValues = Object.values(areas)

      expect(areaValues).toHaveLength(6)

      const names = areaValues.map((a) => a.name)
      expect(names).toContain('Wellness')
      expect(names).toContain('Craft')
      expect(names).toContain('Social')
      expect(names).toContain('Joyful')
      expect(names).toContain('Introspective')
      expect(names).toContain('Chore')
    })

    it('should create default phase configurations on first run', async () => {
      await initializeStore()

      const phases = phaseConfigs$.get()
      const phaseValues = Object.values(phases)

      expect(phaseValues).toHaveLength(4)

      const labels = phaseValues.map((p) => p.label)
      expect(labels).toContain('Morning')
      expect(labels).toContain('Afternoon')
      expect(labels).toContain('Evening')
      expect(labels).toContain('Night')
    })

    it('should create first cycle on first run', async () => {
      await initializeStore()

      const cyclesObj = cycles$.get()
      const cycleValues = Object.values(cyclesObj)

      expect(cycleValues).toHaveLength(1)

      const firstCycle = cycleValues[0]
      expect(firstCycle.name).toBe('First Cycle')
      expect(firstCycle.isActive).toBe(true)
      expect(firstCycle.endDate).toBeNull()

      // Verify start date is today
      const today = new Date().toISOString().split('T')[0]
      expect(firstCycle.startDate).toBe(today)
    })

    it('should not overwrite existing data on subsequent runs', async () => {
      // First run
      await initializeStore()

      const originalAreas = areas$.get()
      const originalCycles = cycles$.get()
      const originalPhases = phaseConfigs$.get()

      // Second run (simulating app restart)
      await initializeStore()

      // Data should be identical
      expect(areas$.get()).toEqual(originalAreas)
      expect(cycles$.get()).toEqual(originalCycles)
      expect(phaseConfigs$.get()).toEqual(originalPhases)
    })

    it('should skip initialization if data already exists', async () => {
      // First run
      await initializeStore()

      const areasCount = Object.keys(areas$.get()).length
      const cyclesCount = Object.keys(cycles$.get()).length
      const phasesCount = Object.keys(phaseConfigs$.get()).length

      // Second run
      await initializeStore()

      // Counts should remain the same (no duplicates)
      expect(Object.keys(areas$.get())).toHaveLength(areasCount)
      expect(Object.keys(cycles$.get())).toHaveLength(cyclesCount)
      expect(Object.keys(phaseConfigs$.get())).toHaveLength(phasesCount)
    })

    it('should handle partial initialization (areas exist, but not cycles)', async () => {
      // Manually create areas first
      await initializeStore()

      // Clear only cycles
      cycles$.set({})

      // Initialize again
      await initializeStore()

      // Should have recreated the cycle
      const cycleValues = Object.values(cycles$.get())
      expect(cycleValues).toHaveLength(1)
    })
  })

  describe('clearStore', () => {
    it('should clear all data from the store', async () => {
      // Initialize first
      await initializeStore()

      // Verify data exists
      expect(Object.keys(areas$.get()).length).toBeGreaterThan(0)
      expect(Object.keys(cycles$.get()).length).toBeGreaterThan(0)
      expect(Object.keys(phaseConfigs$.get()).length).toBeGreaterThan(0)

      // Clear
      clearStore()

      // Verify all cleared
      expect(Object.keys(areas$.get())).toHaveLength(0)
      expect(Object.keys(cycles$.get())).toHaveLength(0)
      expect(Object.keys(phaseConfigs$.get())).toHaveLength(0)
    })
  })

  describe('Default Data Validation', () => {
    it('should create areas with valid properties', async () => {
      await initializeStore()

      const areaValues = Object.values(areas$.get())

      for (const area of areaValues) {
        // Check required fields
        expect(area.id).toBeDefined()
        expect(area.name).toBeDefined()
        expect(area.color).toMatch(/^#[0-9a-f]{6}$/)
        expect(area.emoji).toBeDefined()
        expect(area.order).toBeGreaterThanOrEqual(0)
        expect(area.createdAt).toBeDefined()
        expect(area.updatedAt).toBeDefined()

        // Default areas should be marked as default
        expect(area.isDefault).toBe(true)
      }
    })

    it('should create phase configs with valid time boundaries', async () => {
      await initializeStore()

      const phaseValues = Object.values(phaseConfigs$.get())

      for (const phase of phaseValues) {
        // Check required fields
        expect(phase.id).toBeDefined()
        expect(phase.phase).toBeDefined()
        expect(phase.label).toBeDefined()
        expect(phase.emoji).toBeDefined()
        expect(phase.color).toMatch(/^#[0-9a-f]{6}$/)
        expect(phase.startHour).toBeGreaterThanOrEqual(0)
        expect(phase.startHour).toBeLessThanOrEqual(23)
        expect(phase.endHour).toBeGreaterThanOrEqual(0)
        expect(phase.endHour).toBeLessThanOrEqual(23)
        expect(phase.order).toBeGreaterThanOrEqual(0)
        expect(phase.createdAt).toBeDefined()
        expect(phase.updatedAt).toBeDefined()
      }
    })

    it('should create Night phase as hidden by default', async () => {
      await initializeStore()

      const phaseValues = Object.values(phaseConfigs$.get())
      const nightPhase = phaseValues.find((p) => p.label === 'Night')

      expect(nightPhase).toBeDefined()
      expect(nightPhase?.isVisible).toBe(false)
    })

    it('should create other phases as visible by default', async () => {
      await initializeStore()

      const phaseValues = Object.values(phaseConfigs$.get())
      const visiblePhases = phaseValues.filter(
        (p) => p.label !== 'Night' && p.isVisible
      )

      expect(visiblePhases).toHaveLength(3) // Morning, Afternoon, Evening
    })
  })
})
