# Areas, Attitudes, and Habits: Emergent Structure Design

**Date:** 2025-01-26
**Status:** Approved
**Philosophy:** Attentive Tech + Garden Metaphor

---

## Problem

Current Zenborg treats all Areas equally and provides no way to track recurring patterns. Users create "Morning Run" repeatedly without structure. We need a way to:

1. Express different relationships to life domains (attitudes)
2. Create habits from recurring moment patterns (emergent structure)
3. Group areas semantically (tags for meta-organization)
4. Preserve simplicity in the core allocation flow

This design introduces **attitudes** (relationship modes), **habits** (recurring templates), and **tags** (emergent grouping) without compromising the simple moment creation flow.

---

## Core Principles

### 1. Emergence Over Enforcement
Orphaned moments remain valid. Habits emerge when users recognize patterns, not when the system prescribes them. Structure grows organically from use.

### 2. Two-Phase Modal Separation
**Planning Phase:** Structure habits, set attitudes, organize life domains.
**Committing Phase:** Allocate moments, water plants, presence over planning.

Separation keeps complexity out of daily allocation. Users plan their garden once, then tend it daily.

### 3. Attentive Tech Alignment
- **Downstream allocation:** User decides what needs attention
- **Anti-measurement:** Attitudes describe relationships, not performance
- **Infrastructure:** Planning phase is boring setup, committing phase is calm presence
- **Convivial:** Users create habits/tags/attitudes on their terms

### 4. Garden Metaphor (Language, Not Decoration)
- Areas = Plants (life domains that need watering)
- Moments = Water (limited attention allocated consciously)
- Habits = Seeds (templates for repeated watering)
- Attitudes = Relationship to tending (beginning, building, pushing, being)

Metaphor lives in copy and mental models, not in literal plant illustrations.

---

## Entity Model

### Area (Modified)
Life domains requiring regular attention. Attitudes define default relationship to domain.

```typescript
interface Area {
  id: string
  name: string
  attitude: Attitude | null      // NEW: Default relationship mode
  tags: string[]                 // NEW: Meta-grouping ["wellness", "physical"]
  color: string                  // UNCHANGED: Only Areas have colors
  emoji: string
  isDefault: boolean
  isArchived: boolean
  order: number
  createdAt: string
  updatedAt: string
}
```

**Examples:**
- `Fitness` with `attitude: BUILDING` and `tags: ["wellness", "physical"]`
- `Mindfulness` with `attitude: KEEPING` and `tags: ["wellness", "mental"]`

### Habit (New Entity)
Recurring moment templates. Users create habits from patterns or proactively in Planning phase.

```typescript
interface Habit {
  id: string
  name: string                   // "Running", "Meditation" (1-3 words)
  areaId: string                 // FK to Area (required parent)
  attitude: Attitude | null      // Override Area's attitude
  tags: string[]                 // Attributes ["cardio", "outdoor", "morning"]
  emoji: string | null           // Optional override of Area emoji
  createdAt: string
  updatedAt: string
}
```

**Examples:**
- `Running` under `Fitness` with `attitude: BUILDING`, `tags: ["cardio", "outdoor"]`, `emoji: "🏃"`
- `Meditation` under `Mindfulness` with `attitude: KEEPING`, `tags: ["daily", "morning"]`, `emoji: "🧘"`

### Moment (Modified)
Allocation units. Can be orphaned (simple) or linked to habit (structured).

```typescript
interface Moment {
  id: string
  name: string                   // "Morning Run" (1-3 words)
  areaId: string                 // Direct area link (simple creation)
  habitId: string | null         // NEW: Optional link to Habit
  phase: Phase | null
  day: string | null
  order: number
  horizon: Horizon | null
  tags: string[] | null          // Instance-specific context
  createdAt: string
  updatedAt: string

  // REMOVED: attitude field
  // Attitude now resolved from: habit?.attitude ?? area?.attitude ?? null
}
```

**Key change:** Removed `attitude` from Moment. Attitude belongs to habit/area (pattern level), not moment instances.

---

## Attitudes (Fogg Behavior Grid Inspired)

Attitudes describe your relationship to a practice over time. They determine feedback appropriateness, not performance metrics.

### Five Core Attitudes

**BEGINNING (◇)** - First plantings
- New or unfamiliar behavior
- Feedback: Simple count ("Watered 3 times")
- BCT: 2.3 (Self-monitoring)

**KEEPING (◌)** - Seasonal watering
- Sporadic but intentional engagement
- Feedback: Recency awareness ("Last watered 5 days ago")
- BCT: 2.3 + 7.1 (Self-monitoring + Prompts/cues)

**BUILDING (△)** - Regular tending
- Consistent cultivation, developing capacity
- Feedback: Pattern recognition ("Watered M/W/F this week")
- BCT: 8.3 (Habit formation)

**PUSHING (↑)** - Intensive care
- Focused progression toward specific goals
- Feedback: Custom metrics ("50kg → 60kg")
- BCT: 2.4 + 15.1 (Outcome monitoring + Verbal persuasion)

**BEING (◉)** - Perennial
- Integrated, automatic, part of identity
- Graduates to Crystallized Routines (off timeline)
- BCT: 13.5 (Identity-associated behavior)

**UNDEFINED (null)** - Pure presence
- No attitude set, no feedback provided
- Allocation = realization, no measurement needed

### What Attitudes Control

1. **Feedback Type (If User Views It):**
   - Attitudes determine what the system shows when user explicitly checks
   - BEGINNING: count, KEEPING: recency, BUILDING: patterns, PUSHING: metrics, BEING: crystallized status

2. **Visual Tone (Subtle):**
   - Border weight/style reflects attitude (light for BEGINNING, solid for BUILDING)
   - No color changes (colors belong to Areas only)

3. **UI Language:**
   - "Exploring Running" (BEGINNING)
   - "Cultivating Meditation" (BUILDING)
   - "50kg" (PUSHING with custom metric)

### What Attitudes DON'T Control

❌ Automatic health warnings ("You haven't watered this in 7 days!")
❌ Progress bars or percentages
❌ Charts, graphs, or dashboards
❌ Notifications or reminders
❌ Prescriptive recommendations

**The gardener knows if a plant wilts.** The interface makes allocation visible, not measured.

---

## Tag System

Tags provide emergent organization without enforced taxonomy. Three contexts, one flat structure.

### Tag Levels

**Area Tags:** Meta-grouping for Planning phase
Example: `Fitness #wellness #physical`, `Mindfulness #wellness #mental`

**Habit Tags:** Attributes for filtering
Example: `Running #cardio #outdoor #morning`, `Meditation #mindfulness #daily`

**Moment Tags:** Instance-specific context (rare)
Example: "Morning Run" on rainy day: `#rainy #short`

### Tag Rules

- Lowercase, alphanumeric + hyphens
- 1-20 characters
- Auto-normalized: "Morning Run" → "morning-run"
- No enforced namespace (no `#key:value` patterns)

### Tag Usage

**Adding:** Click tag field, type, Enter. Auto-suggest from existing tags.
**Filtering:** Click tag chip anywhere or `Cmd+K` → "Filter by tag..."
**Discovery:** Optional tag cloud view shows all tags by frequency.

Users create their own vocabulary. The system reflects emergent patterns.

---

## Planning Phase (Structure)

Modal phase for organizing life domains, habits, and attitudes. Keyboard-first (Linear-style), not Vim modal.

### UI Layout

```
┌─────────────────────────────────────────────────┐
│ PLANNING                      Cmd+P: Committing │
├─────────────────────────────────────────────────┤
│                                                  │
│ ◇ BEGINNING (First encounters)                  │
│   Running 🏃 #cardio #outdoor                   │
│   Writing ✍️ #creative                          │
│                                                  │
│ △ BUILDING (Regular practice)                   │
│   Meditation 🧘 #mindfulness                    │
│   Guitar 🎸 #creative                           │
│                                                  │
│ ↑ PUSHING (Focused progression)                 │
│   Strength Training 💪 #gym [50kg → 60kg]       │
│                                                  │
│ ◉ BEING (Crystallized)                          │
│   Morning Routine ☕                             │
│                                                  │
│ [Pure Presence]                                  │
│   Reading 📚                                     │
│   Walking 🚶                                     │
└─────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

```
Cmd+K        Command palette (create habit, switch phase, etc.)
Cmd+P        Toggle Planning ↔ Committing
N            New habit in current section
E            Edit focused habit
/            Search/filter habits
↑↓           Navigate between habits
Enter        Quick edit inline
Backspace    Archive habit
```

### Constraints

- **Max 5-7 habits per attitude section** (soft limit, shows warning)
- Habits without attitude appear in "Pure Presence" section
- Color inherited from Area (border accent only)

---

## Committing Phase (Allocation)

Daily allocation interface. Current timeline preserved, habits appear as "decks" in drawing board.

### UI Layout

```
┌─────────────────────────────────────────────────┐
│ COMMITTING                        Cmd+P: Planning│
├─────────────────────────────────────────────────┤
│  Timeline (3 days × 3 phases)                    │
│       Yesterday  │    Today ★    │   Tomorrow    │
│  ☕ [slot]      │   [Running🏃] │   [slot]      │
│  ☀️ [slot]      │   [slot]      │   [Meditation🧘]│
│  🌙 [Guitar🎸]  │   [slot]      │   [slot]      │
├─────────────────────────────────────────────────┤
│  Drawing Board                                   │
│  🏃 Running × 3 cards                            │
│  🧘 Meditation × 5 cards                         │
│  📚 Reading × 2 cards                            │
│  [+ orphaned moments...]                         │
└─────────────────────────────────────────────────┘
```

### Habit Decks

**Deck Concept:**
- Visual stack showing available cards ("× 3 cards")
- Max cards per deck: 5-10 (configurable, default 5)
- Click deck → creates new moment instance from habit
- Drag card from deck → allocates to timeline slot

**Deck Display:**
- Emoji + habit name + card count
- Grouped in drawing board above orphaned moments
- Compact, scrollable list

### Creation Flows

**Orphaned Moment (Simple):**
```
N → "Morning Run" → Tab to Area → Enter
Result: Orphaned moment (no habitId)
```

**From Habit Deck (Structured):**
```
Click "Running 🏃 × 3" deck → New moment created
Or: Cmd+N → Select habit → Card created
```

**Emergent Habit Creation:**
After creating "Morning Run" 5+ times, system offers (non-intrusively):
"Create habit from pattern? Morning Run appears 5 times in Wellness"

### Keyboard Shortcuts

```
Cmd+K        Command palette (create moment, allocate, etc.)
Cmd+P        Toggle Planning ↔ Committing
N            New orphaned moment (simple flow)
Cmd+N        New moment from habit (shows habit picker)
↑↓←→         Navigate timeline grid
Ctrl+/       Compass view (current moment)
Cmd+H        Toggle attitude indicators (hide/show)
```

---

## Mobile Experience (Landscape)

All mobile UX designed for landscape. Portrait not supported.

### Planning Phase

```
┌─────────────────────────────────────────────┐
│ PLANNING                      [→ Committing]│
├─────────────────────────────────────────────┤
│ ◇ BEGINNING              △ BUILDING         │
│   Running 🏃               Meditation 🧘     │
│   Writing ✍️               Guitar 🎸        │
│                                              │
│ ↑ PUSHING                ◉ BEING            │
│   Strength 💪              Morning ☕        │
└─────────────────────────────────────────────┘
```

**Two-column layout** for attitudes (landscape width)
**Touch targets:** Min 44px for fingers
**Gestures:** Swipe left/right on habit → Quick actions (edit, archive)

### Committing Phase

```
┌─────────────────────────────────────────────┐
│ ← Today →                     [→ Planning]  │
├─────────────────────────────────────────────┤
│ ☕ Morning      │  Drawing Board            │
│  [Running 🏃]   │  🏃 Running × 3           │
│  [slot]         │  🧘 Meditation × 5        │
│                 │                           │
│ ☀️ Afternoon    │                           │
│  [Meditation🧘] │                           │
│  [slot]         │                           │
│                 │                           │
│ 🌙 Evening      │                           │
│  [Guitar 🎸]    │                           │
└─────────────────────────────────────────────┘
```

**Split screen:** Timeline left (60%), Drawing Board right (40%)
**Drag & drop:** Touch-enabled (long press to initiate)
**Bluetooth keyboard:** Full shortcuts supported

---

## Data Schema (IndexedDB + PostgreSQL-Ready)

Schema designed for local-first IndexedDB with future Supabase migration.

### SQL Schema

```sql
-- MODIFIED TABLE
CREATE TABLE areas (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  attitude TEXT,  -- NULL | 'BEGINNING' | 'KEEPING' | 'BUILDING' | 'PUSHING' | 'BEING'
  tags TEXT[],
  color TEXT NOT NULL,
  emoji TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- NEW TABLE
CREATE TABLE habits (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  attitude TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  emoji TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- MODIFIED TABLE
CREATE TABLE moments (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  phase TEXT,
  day DATE,
  "order" INTEGER NOT NULL DEFAULT 0,
  horizon TEXT,
  tags TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_moments_habit_id ON moments(habit_id);
CREATE INDEX idx_moments_day_phase ON moments(day, phase);
CREATE INDEX idx_habits_area_id ON habits(area_id);
CREATE INDEX idx_habits_attitude ON habits(attitude);
```

### Migration Strategy

**Phase 1:** Additive changes (non-breaking)
- Add `areas.attitude` (nullable)
- Add `areas.tags` (default empty array)
- Create `habits` table
- Add `moments.habit_id` (nullable)

**Phase 2:** Data migration (optional, user-driven)
- Existing moments remain untouched (orphaned)
- Users create habits organically in Planning phase
- Link moments to habits when pattern emerges

**No data loss.** All existing moments remain valid.

---

## Crystallization (BEING → Graduated)

When habit reaches BEING attitude, user can promote it to Crystallized Routines.

### Flow

```
Planning Phase:
  1. Select habit with BEING attitude
  2. Cmd+K → "Crystallize habit"
  3. Confirmation: "Move [habit] to Crystallized Routines?"
  4. Habit becomes CrystallizedRoutine
```

### What Happens

- Habit moves to separate "Crystallized" section (collapsed by default)
- Past moments remain linked (`migratedFrom` field in CrystallizedRoutine)
- No new moments created from this habit
- Reversible: User can "de-crystallize" if practice regresses

### Crystallized Section UI

```
[Planning Phase - Bottom of page]

◉ CRYSTALLIZED (Automatic practices)
  ☕ Morning Routine
  🦷 Dental care
  💊 Vitamins

[Click to expand for reference, no active management]
```

**Philosophy:** These practices graduated from conscious allocation. They happen automatically. Removing them honors that they no longer need attention budgeting.

---

## Implementation Phases

### Phase 1: Domain & Schema (Sprint 1)
- Add `attitude` and `tags` to Area entity
- Create Habit entity
- Add `habitId` to Moment entity (nullable)
- Remove `attitude` from Moment entity
- Attitude resolution logic: `habit?.attitude ?? area?.attitude ?? null`
- Unit tests for attitude inheritance

### Phase 2: Planning Phase UI (Sprint 2)
- Attitude-grouped habit list view
- Habit CRUD (create, edit, archive)
- Keyboard shortcuts (Cmd+K, N, E, etc.)
- Attitude selection UI
- Tag management UI
- Phase toggle (Cmd+P)

### Phase 3: Habit Decks (Sprint 3)
- Drawing board deck visualization
- Deck card count display
- Click deck → create moment from habit
- Drag card from deck → allocate to timeline
- Max cards per deck constraint

### Phase 4: Emergent Pattern Detection (Sprint 4)
- Detect repeated moment names (5+ occurrences)
- Non-intrusive suggestion UI
- "Create habit from pattern" flow
- Retroactive linking of past moments to new habit

### Phase 5: Crystallization (Sprint 5)
- BEING attitude → Crystallize command
- CrystallizedRoutine creation
- Crystallized section UI (collapsed)
- De-crystallize flow (reverse)

### Phase 6: Mobile Landscape (Sprint 6)
- Two-column Planning layout
- Split-screen Committing layout
- Touch targets (44px min)
- Swipe gestures for quick actions
- Bluetooth keyboard support

### Phase 7: Polish & Testing (Sprint 7)
- Accessibility audit (WCAG 2.1 AA)
- Visual refinement (stone tones, area colors)
- E2E tests (Planning flows, deck creation, crystallization)
- Performance (60fps, <16ms input lag)

---

## Design Decisions

### Why Remove Attitude from Moment?
Attitude describes relationship to a *practice* (recurring pattern), not a *single instance*. Orphaned moments have no practice yet, so no attitude. Structured moments inherit from habit/area.

### Why Optional Habit Link?
Preserves simple creation flow. Users start organic, structure emerges. No "you must create a habit first" friction.

### Why Colors Only on Areas?
Visual hierarchy. Color = life domain identity (Wellness green, Craft blue). Habits inherit area color. Emojis provide specificity (Running 🏃, Meditation 🧘) without color chaos.

### Why Two-Phase Separation?
Planning = structure (boring, infrequent). Committing = presence (calm, daily). Mixing them adds cognitive load during allocation. Separation honors different mental modes.

### Why Keyboard-First, Not Vim?
Linear-style keyboard shortcuts (`Cmd+K`, `N`, `E`) are more accessible than Vim modal (`hjkl`, `dd`, `yy`). Zenborg targets conscious attention allocation, not power-user code editing.

### Why Max 5-7 Habits Per Attitude?
Scarcity forces clarity. If you have 15 BUILDING habits, reconsider attitude assignment. Soft limit (warning, not block) guides without enforcing.

### Why Emergent Pattern Detection?
System observes user behavior and offers structure when appropriate. Non-intrusive suggestion respects sovereignty. User decides if pattern warrants habit.

### Why Crystallized Routines?
BEING attitude means practice is automatic. Keeping it on active timeline adds noise. Graduating honors mastery and reduces clutter.

---

## Attentive Tech Alignment

### Downstream Allocation
**Habits don't pre-fill timeline.** User creates moment cards from decks consciously. No automation, no algorithmic suggestions. Sovereignty preserved.

### Anti-Measurement (With Nuance)
**Attitudes provide feedback when user chooses to view it.** No always-visible metrics, no notifications, no progress bars. Observation tool, not optimization dashboard.

### Infrastructure Over Experience
**Planning phase is boring setup.** No gamification, no animations, no delight patterns. Reliable, stable, unsexy infrastructure. Experience lives in committing phase (presence).

### Convivial Constraints
- **Accessible:** Habits are intuitive (template → instance)
- **Adaptable:** Tags are user-defined, attitudes optional
- **Decentralized:** Local-first IndexedDB, flat tags
- **Human-scale:** Simple hierarchy (Area → Habit → Moment)
- **Holistic:** User controls attitude, system reflects not prescribes

---

## Garden Metaphor Integration

**Language Usage (Not Visual Decoration):**

- **Planning Phase:** "First plantings" (BEGINNING), "Regular tending" (BUILDING), "Intensive care" (PUSHING)
- **Committing Phase:** "Watering cans ready" (drawing board), "Which plant needs you now?" (compass)
- **Empty States:** "No water allocated yet" (timeline cell), "Your water for this phase is allocated" (max 3 constraint)
- **Feedback:** "Watered 3 times" (BEGINNING), "Last watered 5 days ago" (KEEPING)

**Visual Restraint:**
- No literal plant illustrations
- No water droplet icons
- No soil textures or garden bed graphics
- No growth animations

**Metaphor lives in copy, not decoration.** Interface remains minimalist: stone tones, area color accents, large whitespace.

---

## Success Criteria

### Qualitative Metrics
- Users create habits from patterns without friction
- Planning phase feels like calm reflection, not task management
- Committing phase remains focused on presence, not optimization
- Attitudes clarify relationships without creating performance anxiety
- Tags emerge naturally without taxonomical overhead

### Technical Health
- No data loss on IndexedDB operations
- Phase toggle responds instantly (<16ms)
- Habit deck interactions smooth (60fps)
- Schema migration preserves all existing moments
- Attitude resolution logic correct (inheritance chain)

### User Feedback Questions
- Does two-phase separation reduce daily cognitive load?
- Are attitudes helpful for reflection without being prescriptive?
- Do habit decks simplify moment creation or add complexity?
- Is emergent pattern detection subtle enough to feel optional?
- Does crystallization honor mastery without creating pressure?

---

## Non-Goals (Explicit Exclusions)

❌ **Automatic habit suggestions** (system decides what you should do)
❌ **Habit streaks or completion tracking** (gamification)
❌ **Health dashboards with charts** (extractive measurement)
❌ **Notifications when habits lapse** (interruption)
❌ **Prescriptive attitude progression** (system tells you to advance from BUILDING → PUSHING)
❌ **Enforced tag taxonomy** (`#key:value` patterns)
❌ **Habit dependencies or hierarchies** (Area → Category → Habit → Sub-habit)
❌ **Shared habit templates library** (convivial = user-created)

---

## Open Questions

1. **Should habits show last watered info in Committing phase?**
   Tension: Helpful context vs. extractive tracking. Lean toward hiding by default, show on hover or toggle.

2. **Should attitude transitions be celebrated?**
   KEEPING → BUILDING feels like progress. But celebration = gamification. Consider subtle visual acknowledgment without confetti.

3. **Should tags support auto-complete from all tags or just user's tags?**
   All tags = network effects, serendipitous connections. User's tags = privacy, no behavioral data leakage. Lean toward user-only.

4. **Should Crystallized section be a separate view or collapsed accordion?**
   Separate view = cleaner, but adds navigation. Collapsed accordion = always accessible. Lean toward accordion for peripheral awareness.

5. **Should mobile support portrait mode eventually?**
   Landscape-first per CLAUDE.md. Portrait adds complexity. Revisit post-launch based on user feedback.

---

## Conclusion

This design introduces **attitudes**, **habits**, and **tags** to Zenborg while preserving the core simplicity of conscious attention allocation.

**Attitudes** describe relationships to practices without prescribing behavior.
**Habits** provide structure when patterns emerge, not upfront taxonomy.
**Tags** enable organization without enforced hierarchy.

**Two-phase separation** (Planning vs. Committing) keeps complexity out of daily allocation. Users structure their garden once, then tend it daily with presence.

**Attentive tech principles** ensure the system remains infrastructure (not experience), downstream allocation (not extraction), and convivial (user sovereignty).

**Garden metaphor** lives in language, guiding design decisions without decorative literalism.

The result: emergent structure that guides organic growth, respecting that **attention is consciousness, not currency to extract**.

---

*"Where will I place my consciousness today?"*
