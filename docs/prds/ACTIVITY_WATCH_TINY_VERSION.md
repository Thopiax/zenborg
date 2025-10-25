# ActivityWatch Tiny Integration - Manual Labeling MVP

**Purpose**: Test core ActivityWatch integration with manual area labeling before building AI classification
**Timeline**: 2-4 hours to build + test
**Goal**: Prove ActivityWatch data collection works, validate API integration

---

## The Simplest Thing That Could Work

Instead of AI classification, **manually label activities** using ActivityWatch's built-in category system:

1. User downloads & runs ActivityWatch themselves
2. Zenborg syncs Areas → ActivityWatch categories/labels
3. User manually labels activities in ActivityWatch UI (or via script)
4. Zenborg fetches labeled data to show alignment

**No AI. No classification. Just basic CRUD operations on localhost.**

---

## How ActivityWatch Labeling Works

ActivityWatch has a built-in **event classification system**:

```json
{
  "id": 123,
  "timestamp": "2025-10-25T10:30:00Z",
  "duration": 300,
  "data": {
    "app": "Google Chrome",
    "title": "Linear - Product Roadmap",
    "url": "https://linear.app/...",
    "$category": ["Work", "Product"]  // ← User-defined labels
  }
}
```

**Categories can be**:
- Set manually (user clicks in AW UI)
- Set via regex rules (AW's category watcher)
- Set via API calls (our script)

---

## Tiny Script Architecture

```
┌─────────────────────────────────────────┐
│         Zenborg Areas                   │
│  - Product Work                         │
│  - Data Work                            │
│  - UX Work                              │
│  - Strategy Work                        │
└─────────┬───────────────────────────────┘
          │
          │ POST /api/aw/sync-categories
          ▼
┌─────────────────────────────────────────┐
│    ActivityWatch REST API               │
│    http://localhost:5600                │
│                                         │
│  /api/0/buckets/                        │
│  /api/0/events/                         │
│  /api/0/query/                          │
└─────────┬───────────────────────────────┘
          │
          │ GET events with $category
          ▼
┌─────────────────────────────────────────┐
│    Zenborg UI - Alignment View          │
│  "You spent 2h on Product Work"         │
│  "Last 15min: Linear (Product)"         │
└─────────────────────────────────────────┘
```

---

## Implementation

### 1. ActivityWatch Client (TypeScript)

```typescript
// src/infrastructure/activitywatch/aw-client.ts

const AW_BASE_URL = 'http://localhost:5600'

interface AWEvent {
  id: number
  timestamp: string
  duration: number
  data: {
    app: string
    title: string
    url?: string
    $category?: string[]  // ActivityWatch categories
  }
}

interface AWBucket {
  id: string
  name: string
  type: string
  hostname: string
}

export class ActivityWatchClient {

  // Check if AW is running
  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${AW_BASE_URL}/api/0/info`)
      return response.ok
    } catch {
      return false
    }
  }

  // Get all buckets (watchers)
  async getBuckets(): Promise<AWBucket[]> {
    const response = await fetch(`${AW_BASE_URL}/api/0/buckets/`)
    if (!response.ok) throw new Error('Failed to fetch buckets')
    return response.json()
  }

  // Get events from a bucket (last N minutes)
  async getEvents(
    bucketId: string,
    startTime: Date,
    endTime: Date
  ): Promise<AWEvent[]> {
    const params = new URLSearchParams({
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      limit: '100'
    })

    const response = await fetch(
      `${AW_BASE_URL}/api/0/buckets/${bucketId}/events?${params}`
    )

    if (!response.ok) throw new Error('Failed to fetch events')
    return response.json()
  }

  // Get aggregated activity for last N minutes
  async getRecentActivity(minutes: number = 15): Promise<AWEvent[]> {
    const buckets = await this.getBuckets()

    // Find window watcher bucket (aw-watcher-window_*)
    const windowBucket = buckets.find(b =>
      b.id.startsWith('aw-watcher-window')
    )

    if (!windowBucket) throw new Error('No window watcher found')

    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000)

    return this.getEvents(windowBucket.id, startTime, endTime)
  }

  // Use AW's query API for advanced aggregation
  async queryActivity(query: string): Promise<any> {
    const response = await fetch(`${AW_BASE_URL}/api/0/query/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeperiods: [`${new Date().toISOString()}/PT1H`], // last hour
        query: query
      })
    })

    if (!response.ok) throw new Error('Query failed')
    return response.json()
  }

  // Get time spent per category (last N hours)
  async getTimeByCategory(hours: number = 1): Promise<Record<string, number>> {
    // AW query language to aggregate by category
    const query = `
      events = query_bucket(find_bucket("aw-watcher-window"));
      events = filter_keyvals(events, "$category", []);
      events = categorize(events, [[["Work"], {"regex": "Linear|Notion|Figma"}]]);
      duration_by_category = sum_durations_by_key(events, "$category");
      RETURN = duration_by_category;
    `

    const result = await this.queryActivity(query)
    return result[0] // First timeperiod result
  }
}
```

### 2. Sync Zenborg Areas → AW Categories

```typescript
// src/application/use-cases/sync-areas-to-aw.ts

import { ActivityWatchClient } from '@/infrastructure/activitywatch/aw-client'
import { Area } from '@/domain/entities/area'

export async function syncAreasToAW(areas: Area[]): Promise<void> {
  const awClient = new ActivityWatchClient()

  // Check if AW is running
  const isRunning = await awClient.isRunning()
  if (!isRunning) {
    console.warn('ActivityWatch not running, skipping sync')
    return
  }

  // For tiny version: just log categories
  // User will manually set them in AW UI or via regex rules
  console.log('Zenborg Areas → ActivityWatch Categories:')
  areas.forEach(area => {
    console.log(`  - ${area.name}: ${area.themeKeywords?.join(', ')}`)
  })

  // Future: Auto-create categorization rules via AW API
  // (AW doesn't have a public API for this yet, needs manual config)
}
```

### 3. Fetch & Display Alignment

```typescript
// src/application/use-cases/get-alignment-status.ts

import { ActivityWatchClient } from '@/infrastructure/activitywatch/aw-client'
import { Moment } from '@/domain/entities/moment'

export interface AlignmentStatus {
  moment: Moment
  lastActivity: {
    app: string
    title: string
    duration: number
    category?: string[]
  }[]
  aligned: boolean // true if category matches moment.area.name
  totalTime: number // seconds in last 15 min
}

export async function getAlignmentStatus(
  currentMoment: Moment | null
): Promise<AlignmentStatus | null> {
  if (!currentMoment) return null

  const awClient = new ActivityWatchClient()

  // Get last 15 minutes of activity
  const events = await awClient.getRecentActivity(15)

  // Group by app/title
  const activitySummary = events.reduce((acc, event) => {
    const key = `${event.data.app} - ${event.data.title}`
    if (!acc[key]) {
      acc[key] = {
        app: event.data.app,
        title: event.data.title,
        duration: 0,
        category: event.data.$category
      }
    }
    acc[key].duration += event.duration
    return acc
  }, {} as Record<string, any>)

  const lastActivity = Object.values(activitySummary)
    .sort((a, b) => b.duration - a.duration)

  // Check if aligned: does any activity's category match moment's area?
  const aligned = lastActivity.some(activity =>
    activity.category?.includes(currentMoment.area.name)
  )

  const totalTime = lastActivity.reduce((sum, a) => sum + a.duration, 0)

  return {
    moment: currentMoment,
    lastActivity,
    aligned,
    totalTime
  }
}
```

### 4. Simple UI Component

```tsx
// src/components/ActivityWatchStatus.tsx

'use client'

import { useEffect, useState } from 'react'
import { getAlignmentStatus, AlignmentStatus } from '@/application/use-cases/get-alignment-status'
import { useMomentStore } from '@/infrastructure/state/moment-store'

export function ActivityWatchStatus() {
  const [status, setStatus] = useState<AlignmentStatus | null>(null)
  const currentMoment = useMomentStore(state => state.getCurrentMoment())

  useEffect(() => {
    // Poll every 5 minutes
    const interval = setInterval(async () => {
      if (currentMoment) {
        const newStatus = await getAlignmentStatus(currentMoment)
        setStatus(newStatus)
      }
    }, 5 * 60 * 1000)

    // Initial fetch
    if (currentMoment) {
      getAlignmentStatus(currentMoment).then(setStatus)
    }

    return () => clearInterval(interval)
  }, [currentMoment])

  if (!status) return null

  return (
    <div className="fixed top-4 right-4 p-4 bg-stone-100 border border-stone-200 rounded-lg">
      <div className="text-sm font-mono">
        <div className="mb-2">
          Current: <strong>{status.moment.name}</strong> ({status.moment.area.name})
        </div>

        <div className="mb-2">
          Status: {status.aligned ? (
            <span className="text-green-600">🧭 ↑ Aligned</span>
          ) : (
            <span className="text-amber-600">🧭 ↙ Drifting</span>
          )}
        </div>

        <div className="text-xs text-stone-600">
          Last 15 min:
          <ul className="mt-1 space-y-1">
            {status.lastActivity.slice(0, 3).map((activity, i) => (
              <li key={i}>
                {activity.app} ({Math.floor(activity.duration / 60)}m)
                {activity.category && (
                  <span className="ml-2 text-stone-400">
                    [{activity.category.join(', ')}]
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
```

---

## User Setup (Manual)

### 1. Install ActivityWatch

```bash
# macOS
brew install --cask activitywatch

# Linux
wget https://github.com/ActivityWatch/activitywatch/releases/latest/download/activitywatch-linux-x86_64.zip
unzip activitywatch-linux-x86_64.zip
./activitywatch/aw-qt

# Windows
# Download from https://activitywatch.net/downloads/
```

### 2. Configure Categories (Manual)

Open ActivityWatch UI (http://localhost:5600):

**Settings → Categories → Add Rules**:

```
Product Work:
  - regex: "Linear|Notion|Jira|Asana|PRD"
  - regex: "#product"

Data Work:
  - regex: "Jupyter|Python|SQL|Postgres|dbt"
  - regex: "\.ipynb|\.py|\.sql"

UX Work:
  - regex: "Figma|Framer|Sketch|Design"
  - regex: "\.tsx|\.css|Tailwind"

Strategy Work:
  - regex: "Docs|Notes|Obsidian|Research"
  - regex: "Strategy|Planning|Reflection"
```

### 3. Test Zenborg Integration

```bash
# In Zenborg project
npm install

# Add AW client component to layout
# (see implementation above)

# Start Zenborg
npm run dev

# Open browser, allocate a moment
# Wait 5 minutes, see status update
```

---

## Testing Script (Standalone)

For quick testing without full Zenborg integration:

```typescript
// scripts/test-aw-integration.ts

import { ActivityWatchClient } from '../src/infrastructure/activitywatch/aw-client'

async function main() {
  const client = new ActivityWatchClient()

  console.log('🧭 Testing ActivityWatch Integration\n')

  // 1. Check if running
  const isRunning = await client.isRunning()
  console.log(`✓ ActivityWatch running: ${isRunning}`)

  if (!isRunning) {
    console.log('❌ Please start ActivityWatch first')
    process.exit(1)
  }

  // 2. Get buckets
  const buckets = await client.getBuckets()
  console.log(`✓ Found ${buckets.length} buckets:`)
  buckets.forEach(b => console.log(`  - ${b.id} (${b.type})`))

  // 3. Get last 15 min activity
  console.log('\n📊 Last 15 minutes of activity:')
  const events = await client.getRecentActivity(15)

  const summary = events.reduce((acc, event) => {
    const key = event.data.app
    if (!acc[key]) acc[key] = 0
    acc[key] += event.duration
    return acc
  }, {} as Record<string, number>)

  Object.entries(summary)
    .sort(([, a], [, b]) => b - a)
    .forEach(([app, duration]) => {
      const minutes = Math.floor(duration / 60)
      console.log(`  - ${app}: ${minutes}m ${Math.floor(duration % 60)}s`)
    })

  // 4. Check for categorized events
  console.log('\n🏷️  Categorized events:')
  const categorized = events.filter(e => e.data.$category && e.data.$category.length > 0)

  if (categorized.length === 0) {
    console.log('  ⚠️  No categorized events found')
    console.log('  Set up categories in AW UI: http://localhost:5600')
  } else {
    categorized.forEach(e => {
      console.log(`  - ${e.data.app}: [${e.data.$category?.join(', ')}]`)
    })
  }
}

main().catch(console.error)
```

Run it:

```bash
npx tsx scripts/test-aw-integration.ts
```

---

## Alignment Logic (No AI)

**Simple rule**: Activity is "aligned" if:
- Activity's `$category` matches current moment's `area.name`

**Example**:

```typescript
// User is working on moment "Product Spec" (area: "Product Work")
// Last 15 min activity:

[
  { app: "Linear", category: ["Product Work"], duration: 600 },
  { app: "Slack", category: ["Communication"], duration: 180 },
  { app: "Chrome - Twitter", category: null, duration: 120 }
]

// Alignment calculation:
const productTime = 600  // Linear
const otherTime = 300    // Slack + Twitter

aligned = productTime > otherTime  // true
```

**Compass state**:
- `🧭 ↑ Aligned` if > 50% of time in matching category
- `🧭 ↙ Drifting` if < 50% of time in matching category
- `🧭 ○ Untracked` if no categorized events

---

## Advantages of Tiny Version

✅ **Zero AI complexity**: No models, no training, no classification
✅ **Uses existing AW features**: Categories already built-in
✅ **Fast to build**: 2-4 hours total (vs. weeks for AI version)
✅ **Tests core integration**: Validates AW API works, data flows correctly
✅ **User can manually tune**: Regex rules are transparent and editable

---

## Limitations (To Address Later)

❌ **Manual category setup**: User must configure regex rules in AW
❌ **No semantic understanding**: "Slack #product-team" won't auto-match "Product Work"
❌ **Requires user discipline**: If categories not set, shows no alignment
❌ **No learning**: Rules are static, don't improve over time

**Solution**: Once this works, add Transformer.js on top for semantic classification

---

## Next Steps

1. **Build client** (`aw-client.ts`) - 1 hour
2. **Test with script** (`test-aw-integration.ts`) - 30 min
3. **Add UI component** (`ActivityWatchStatus.tsx`) - 1 hour
4. **Manual testing** (configure categories, use Zenborg) - 1 hour
5. **Decide**: Does basic integration work? → Add AI layer

**Total**: 2-4 hours to validate core hypothesis

---

## Future: AI Layer on Top

Once manual labeling works:

```typescript
// Hybrid approach: Use categories as hints, AI for unlabeled

async function classifyActivity(
  activity: AWEvent,
  moment: Moment
): Promise<AlignmentType> {

  // 1. If already categorized by user, trust it
  if (activity.data.$category?.includes(moment.area.name)) {
    return 'aligned'
  }

  // 2. If no category, ask Transformer.js
  const classifier = await pipeline('zero-shot-classification', 'facebook/bart-large-mnli')
  const result = await classifier(
    `${activity.data.app}: ${activity.data.title}`,
    [`${moment.area.name}`, 'unrelated work', 'distraction']
  )

  return result.labels[0] === moment.area.name ? 'aligned' : 'drifting'
}
```

**Best of both worlds**:
- User rules = fast, transparent, trustworthy
- AI classification = fills gaps, handles edge cases

---

**Status**: Ready to implement
**Owner**: Thopiax
**Timeline**: 2-4 hours

---

*"Start with the simplest thing that could work. If manual labeling proves the integration, add AI later."*
