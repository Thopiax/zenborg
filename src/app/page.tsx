'use client'

import { useEffect, useState } from 'react'
import { areas$, cycles$, phaseConfigs$, moments$ } from '@/infrastructure/state/store'
import { createMoment } from '@/domain/entities/Moment'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [areaCount, setAreaCount] = useState(0)
  const [cycleCount, setCycleCount] = useState(0)
  const [phaseCount, setPhaseCount] = useState(0)
  const [momentCount, setMomentCount] = useState(0)

  useEffect(() => {
    setMounted(true)

    // Subscribe to store changes
    const unsubAreas = areas$.onChange(() => {
      setAreaCount(Object.keys(areas$.get()).length)
    })

    const unsubCycles = cycles$.onChange(() => {
      setCycleCount(Object.keys(cycles$.get()).length)
    })

    const unsubPhases = phaseConfigs$.onChange(() => {
      setPhaseCount(Object.keys(phaseConfigs$.get()).length)
    })

    const unsubMoments = moments$.onChange(() => {
      setMomentCount(Object.keys(moments$.get()).length)
    })

    // Initial values
    setAreaCount(Object.keys(areas$.get()).length)
    setCycleCount(Object.keys(cycles$.get()).length)
    setPhaseCount(Object.keys(phaseConfigs$.get()).length)
    setMomentCount(Object.keys(moments$.get()).length)

    return () => {
      unsubAreas()
      unsubCycles()
      unsubPhases()
      unsubMoments()
    }
  }, [])

  const handleAddTestMoment = () => {
    const areaValues = Object.values(areas$.get())
    if (areaValues.length === 0) {
      alert('No areas available. Initialize the store first.')
      return
    }

    const firstArea = areaValues[0]
    const moment = createMoment('Test Moment', firstArea.id)

    if ('error' in moment) {
      alert(`Error: ${moment.error}`)
      return
    }

    moments$[moment.id].set(moment)
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">Zenborg - Intention Compass</h1>
      <p className="mb-6 text-gray-600">Phase 2: State Management & IndexedDB Persistence</p>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Store Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded">
            <div className="text-2xl font-bold text-green-700">{areaCount}</div>
            <div className="text-sm text-green-600">Areas</div>
          </div>
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-2xl font-bold text-blue-700">{cycleCount}</div>
            <div className="text-sm text-blue-600">Cycles</div>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <div className="text-2xl font-bold text-purple-700">{phaseCount}</div>
            <div className="text-sm text-purple-600">Phase Configs</div>
          </div>
          <div className="bg-orange-50 p-4 rounded">
            <div className="text-2xl font-bold text-orange-700">{momentCount}</div>
            <div className="text-sm text-orange-600">Moments</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Test Actions</h2>
        <button
          onClick={handleAddTestMoment}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-2"
        >
          Add Test Moment
        </button>
        <button
          onClick={() => window.location.reload()}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          Reload Page (Test Persistence)
        </button>
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2">🧪 Testing Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Open DevTools → Application → IndexedDB → zenborg</li>
          <li>You should see 4 tables: areas, cycles, phaseConfigs, moments</li>
          <li>Verify 5 areas, 1 cycle, 4 phase configs are loaded on first run</li>
          <li>Click "Add Test Moment" to create a new moment</li>
          <li>Click "Reload Page" - the moment should persist</li>
          <li>Check IndexedDB to see the stored data</li>
        </ol>
      </div>
    </div>
  )
}
