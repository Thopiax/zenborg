import { describe, it, expect } from 'vitest'
import {
  createCycle,
  updateCycle,
  completeCycle,
  isDateInCycle,
  isCycleError
} from '../entities/Cycle'

describe('Cycle', () => {
  describe('createCycle', () => {
    it('should create a valid cycle', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })

      expect(isCycleError(result)).toBe(false)
      if (!isCycleError(result)) {
        expect(result.id).toBeDefined()
        expect(result.name).toBe('Q1 2025')
        expect(result.startDate).toBe('2025-01-01')
        expect(result.endDate).toBeNull()
        expect(result.createdAt).toBeDefined()
        expect(result.updatedAt).toBeDefined()
      }
    })

    it('should create cycle with end date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01', endDate: '2025-03-31' })

      expect(isCycleError(result)).toBe(false)
      if (!isCycleError(result)) {
        expect(result.startDate).toBe('2025-01-01')
        expect(result.endDate).toBe('2025-03-31')
      }
    })

    it('should reject empty name', () => {
      const result = createCycle({ name: '', startDate: '2025-01-01' })

      expect(isCycleError(result)).toBe(true)
      if (isCycleError(result)) {
        expect(result.error).toBe('Cycle name cannot be empty')
      }
    })

    it('should reject whitespace-only name', () => {
      const result = createCycle({ name: '   ', startDate: '2025-01-01' })

      expect(isCycleError(result)).toBe(true)
      if (isCycleError(result)) {
        expect(result.error).toBe('Cycle name cannot be empty')
      }
    })

    it('should reject empty start date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '' })

      expect(isCycleError(result)).toBe(true)
      if (isCycleError(result)) {
        expect(result.error).toBe('Cycle must have a start date')
      }
    })

    it('should reject invalid start date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: 'invalid-date' })

      expect(isCycleError(result)).toBe(true)
      if (isCycleError(result)) {
        expect(result.error).toContain('valid ISO date')
      }
    })

    it('should reject invalid end date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01', endDate: 'invalid-date' })

      expect(isCycleError(result)).toBe(true)
      if (isCycleError(result)) {
        expect(result.error).toContain('valid ISO date')
      }
    })

    it('should reject end date before start date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-03-31', endDate: '2025-01-01' })

      expect(isCycleError(result)).toBe(true)
      if (isCycleError(result)) {
        expect(result.error).toBe('End date must be after start date')
      }
    })

    it('should reject end date equal to start date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01', endDate: '2025-01-01' })

      expect(isCycleError(result)).toBe(true)
      if (isCycleError(result)) {
        expect(result.error).toBe('End date must be after start date')
      }
    })

    it('should trim name', () => {
      const result = createCycle({ name: '  Q1 2025  ', startDate: '2025-01-01' })

      expect(isCycleError(result)).toBe(false)
      if (!isCycleError(result)) {
        expect(result.name).toBe('Q1 2025')
      }
    })
  })

  describe('updateCycle', () => {
    it('should update cycle name', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const updated = updateCycle(result, { name: 'First Quarter' })

        expect(isCycleError(updated)).toBe(false)
        if (!isCycleError(updated)) {
          expect(updated.name).toBe('First Quarter')
          expect(updated.startDate).toBe(result.startDate)
          expect(updated.endDate).toBe(result.endDate)
          expect(updated.updatedAt).toBeDefined()
        }
      }
    })

    it('should update start date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const updated = updateCycle(result, { startDate: '2025-01-15' })

        expect(isCycleError(updated)).toBe(false)
        if (!isCycleError(updated)) {
          expect(updated.startDate).toBe('2025-01-15')
        }
      }
    })

    it('should update end date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const updated = updateCycle(result, { endDate: '2025-03-31' })

        expect(isCycleError(updated)).toBe(false)
        if (!isCycleError(updated)) {
          expect(updated.endDate).toBe('2025-03-31')
        }
      }
    })

    it('should update multiple fields at once', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const updated = updateCycle(result, {
          name: 'First Quarter',
          endDate: '2025-03-31',
        })

        expect(isCycleError(updated)).toBe(false)
        if (!isCycleError(updated)) {
          expect(updated.name).toBe('First Quarter')
          expect(updated.endDate).toBe('2025-03-31')
        }
      }
    })

    it('should reject empty name update', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const updated = updateCycle(result, { name: '' })

        expect(isCycleError(updated)).toBe(true)
        if (isCycleError(updated)) {
          expect(updated.error).toBe('Cycle name cannot be empty')
        }
      }
    })

    it('should reject invalid start date update', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const updated = updateCycle(result, { startDate: 'invalid' })

        expect(isCycleError(updated)).toBe(true)
        if (isCycleError(updated)) {
          expect(updated.error).toContain('valid ISO date')
        }
      }
    })

    it('should reject invalid end date update', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const updated = updateCycle(result, { endDate: 'invalid' })

        expect(isCycleError(updated)).toBe(true)
        if (isCycleError(updated)) {
          expect(updated.error).toContain('valid ISO date')
        }
      }
    })

    it('should reject end date before start date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const updated = updateCycle(result, { endDate: '2024-12-31' })

        expect(isCycleError(updated)).toBe(true)
        if (isCycleError(updated)) {
          expect(updated.error).toBe('End date must be after start date')
        }
      }
    })

    it('should allow clearing end date', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01', endDate: '2025-03-31' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const updated = updateCycle(result, { endDate: null })

        expect(isCycleError(updated)).toBe(false)
        if (!isCycleError(updated)) {
          expect(updated.endDate).toBeNull()
        }
      }
    })
  })

  describe('completeCycle', () => {
    it('should complete a cycle by setting end date to today', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        const completed = completeCycle(result)
        const today = new Date().toISOString().split('T')[0]

        expect(completed.endDate).toBe(today)
        expect(completed.updatedAt).toBeDefined()
      }
    })
  })

  describe('isDateInCycle', () => {
    it('should detect date within bounded cycle', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01', endDate: '2025-03-31' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        expect(isDateInCycle(result, '2025-01-01')).toBe(true)
        expect(isDateInCycle(result, '2025-02-15')).toBe(true)
        expect(isDateInCycle(result, '2025-03-31')).toBe(true)
      }
    })

    it('should detect date outside bounded cycle', () => {
      const result = createCycle({ name: 'Q1 2025', startDate: '2025-01-01', endDate: '2025-03-31' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        expect(isDateInCycle(result, '2024-12-31')).toBe(false)
        expect(isDateInCycle(result, '2025-04-01')).toBe(false)
      }
    })

    it('should detect date within ongoing cycle', () => {
      const result = createCycle({ name: 'Ongoing', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        expect(isDateInCycle(result, '2025-01-01')).toBe(true)
        expect(isDateInCycle(result, '2025-12-31')).toBe(true)
        expect(isDateInCycle(result, '2030-01-01')).toBe(true)
      }
    })

    it('should detect date before ongoing cycle', () => {
      const result = createCycle({ name: 'Ongoing', startDate: '2025-01-01' })
      expect(isCycleError(result)).toBe(false)

      if (!isCycleError(result)) {
        expect(isDateInCycle(result, '2024-12-31')).toBe(false)
      }
    })
  })
})
