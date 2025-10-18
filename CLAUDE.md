# Zenborg - Intention Compass

> *An attention orchestration system for budgeting moments toward personal flourishing.*

## What This Is

Zenborg is a **local-first web application** for conscious attention allocation. Not a task manager. Not a habit tracker. Not a calendar.

**Core Philosophy**:
- **Orchestration, not elimination**: Accept distractions, budget for them
- **Consciousness as currency**: Allocate attention, not time
- **Presence over outcomes**: No "done" buttons, no completion tracking
- **Vim-inspired efficiency**: Modal interaction for power users

**The Question**: "Where will I place my consciousness today?"

---

## Domain Model (PostgreSQL-Ready)

### Entities

**Moment** - A named intention (1-3 words max)
```typescript
interface Moment {
  id: string              // UUID
  name: string            // "Morning Run", "Deep Work"
  areaId: string          // FK to Area
  phase: Phase | null     // morning/afternoon/evening/night
  day: string | null      // ISO date, null when unallocated
  order: number           // 0-2 (max 3 per phase)
  createdAt: string
  updatedAt: string
}
```

**Area** - Life domain with color (user-extensible)
```typescript
interface Area {
  id: string
  name: string            // "Wellness", "Craft", "Social"
  color: string           // hex color
  emoji: string           // 🟢, 🔵, 🟠
  isDefault: boolean
  order: number
  createdAt: string
  updatedAt: string
}

// 5 default areas: Wellness, Craft, Social, Joyful, Introspective
```

**Cycle** - Time container (e.g., "Barcelona Summer")
```typescript
interface Cycle {
  id: string
  name: string
  startDate: string       // ISO date
  endDate: string | null  // null for ongoing
  isActive: boolean       // only one active at a time
  createdAt: string
  updatedAt: string
}
```

**PhaseConfig** - User-configurable phase settings
```typescript
interface PhaseConfig {
  id: string
  phase: Phase            // morning/afternoon/evening/night
  label: string           // "Morning", "Afternoon"
  emoji: string           // ☕, ☀️, 🌙, 🌃
  color: string           // hex color
  startHour: number       // 0-23
  endHour: number         // 0-23 (wraps for night: 22-6)
  isVisible: boolean      // can hide Night phase
  order: number
  createdAt: string
  updatedAt: string
}
```

### Constraints
- **Max 3 moments per (day, phase)** combination
- **Only 1 active cycle** at a time
- **Areas cannot be deleted** if they have moments (FK constraint)
- **Moment names**: 1-3 words enforced in app

---

## Tech Stack

**Core**:
- Next.js 15 (App Router, TypeScript, Turbopack)
- Tailwind CSS 4 (monochromatic design + color accents)
- Shadcn/ui (Radix primitives, no heavy modals)

**State & Data**:
- `@legendapp/state` - Reactive local-first state management
- `@legendapp/state/persist` - IndexedDB persistence
- `@legendapp/state/sync-supabase` - Future cloud sync (Phase 2)

**Interactions**:
- `@dnd-kit/core` + `@dnd-kit/sortable` - Drag & drop (optional for mouse users)
- Custom Vim mode state machine - Modal keyboard interactions
- `date-fns` - Lightweight date handling

**Testing**:
- Vitest - Unit tests
- Playwright - E2E tests
- @testing-library/react - Component tests

**Future (Phase 2)**:
- Supabase - PostgreSQL database + auth + real-time sync

---

## Architecture

**Hexagonal (Ports & Adapters)** with DDD principles:

```
src/
├── domain/              # Pure TypeScript, no frameworks
│   ├── entities/        # Moment, Area, Cycle (business logic)
│   ├── value-objects/   # Phase, PhaseConfig
│   └── repositories/    # Interfaces (ports)
├── infrastructure/      # Framework-specific implementations
│   ├── persistence/     # IndexedDB + future Supabase adapters
│   └── state/           # Legend State store + Vim mode machine
├── application/         # Use cases (orchestration)
│   ├── use-cases/       # CreateMoment, AllocateMoment, etc.
│   └── services/        # TimeService (phase detection)
└── presentation/        # React components + hooks
    ├── components/      # UI components (Vim-aware)
    ├── hooks/           # useVimMode, useVimNavigation, etc.
    └── app/             # Next.js pages
```

**Key Principles**:
- **Domain logic isolated** from UI/infrastructure
- **Local-first**: IndexedDB primary, Supabase secondary (eventual consistency)
- **PostgreSQL-ready schema**: All entities designed for relational DB migration
- **SOLID**: Single responsibility, dependency inversion, open/closed

---

## Vim Modal System

### Modes

**Normal Mode** (default):
- Navigate with `hjkl`, `gg`, `G`, `w`, `b`
- Quick actions: `dd` (delete), `yy` (yank/duplicate), `x` (quick delete)
- Switch modes: `i` (Insert), `:` (Command)

**Insert Mode**:
- Create/edit moments
- `Tab` to cycle areas
- `Enter` to save, `Esc` to cancel

**Command Mode**:
- Allocate moments: `:ty1` (Today Morning), `:wy3` (Tomorrow Evening)
- Quick allocation: type `t1` in Normal mode
- Commands: `:area` (manage areas), `:settings` (phase config), `:d` (unallocate)

### Key Bindings Reference

| Normal Mode | Action                             |
| ----------- | ---------------------------------- |
| `hjkl`      | Navigate grid (left/down/up/right) |
| `gg` / `G`  | First / Last moment                |
| `w` / `b`   | Next / Previous moment             |
| `i`         | Insert mode (create or edit)       |
| `dd`        | Delete moment                      |
| `yy`        | Yank (duplicate)                   |
| `p`         | Put (paste yanked moment)          |
| `x`         | Quick delete (unallocated only)    |
| `:`         | Command mode                       |
| `Ctrl+/`    | Toggle compass view                |

| Command Mode | Action                                  |
| ------------ | --------------------------------------- |
| `:ty1`       | Allocate to Today, phase 1 (Morning)    |
| `:wy3`       | Allocate to Tomorrow, phase 3 (Evening) |
| `:d`         | Unallocate (return to drawing board)    |
| `:area`      | Open area management                    |
| `:settings`  | Open phase settings                     |

**Day shortcuts**: `y` (yesterday), `t` (today), `w` (tomorrow/will do)
**Phase shortcuts**: `1` (morning), `2` (afternoon), `3` (evening), `4` (night)

---

## UI Structure

### Desktop Layout (≥768px)
```
┌─────────────────────────────────────────────────────────┐
│  Zenborg                                    [Vim: NORMAL]│
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Timeline (3 days × 3-4 phases grid)                     │
│                                                           │
│       Yesterday  │    Today ★    │   Tomorrow            │
│  ☕ [slot]      │   [slot]      │   [slot]              │
│  ☀️ [slot]      │   [slot]      │   [slot]              │
│  🌙 [slot]      │   [slot]      │   [slot]              │
│                                                           │
├─────────────────────────────────────────────────────────┤
│  Drawing Board                                           │
│  [unallocated moments...]                                │
└─────────────────────────────────────────────────────────┘
```

### Mobile Layout (<768px)
```
┌───────────────────┐
│ ← Today →         │ (swipe or buttons)
├───────────────────┤
│ ☕ Morning        │
│  [moment 1]       │
│  [moment 2]       │
├───────────────────┤
│ ☀️ Afternoon      │
│  [moment 1]       │
├───────────────────┤
│ 🌙 Evening        │
│  [moment 1]       │
│  [moment 2]       │
├───────────────────┤
│ Drawing Board     │
│ [unallocated...]  │
└───────────────────┘
```

**Mobile differences**:
- **Single-day column** (not 3-day grid)
- Drawing board **below** timeline (not sidebar)
- Swipe left/right to navigate days
- Still supports Vim shortcuts if keyboard connected

---

## Design System

### Visual Principles
- **Monochromatic base**: Off-white (#fafaf9), light gray (#f5f5f4)
- **Phase colors as accents**: Morning (amber), Afternoon (yellow), Evening (purple), Night (dark slate)
- **Area colors on moments**: Border or small pill
- **Flat design**: No modals, inline editing only
- **Vim aesthetic**: Monospace fonts for command line, mode indicator

### Inspiration
- **Vim**: Modal interaction, command line at bottom
- **Things 3**: Flat hierarchy, inline editing, keyboard-first
- **Linear**: Clean spacing, subtle borders, fast shortcuts
- **Vercel Dashboard**: Monochrome with color accents, no clutter
- **Claude UI**: Generous whitespace, simple interactions

### Typography
- **Moment names**: 20-24px, bold, monospace or Inter
- **Command line**: 14px, monospace (Fira Code, JetBrains Mono)
- **Labels**: 14px, medium weight

### Colors (Tailwind)
```css
/* Base */
bg-stone-50, text-stone-900, border-stone-200

/* Phase colors */
morning: #f59e0b (amber)
afternoon: #eab308 (yellow)
evening: #8b5cf6 (purple)
night: #1e293b (dark slate)

/* Area colors */
Wellness: #10b981 (green)
Craft: #3b82f6 (blue)
Social: #f97316 (orange)
Joyful: #eab308 (yellow)
Introspective: #6b7280 (gray)
```

---

## Critical User Flows

### 1. Create & Allocate Moment (Vim Flow)
```vim
i                    # Enter Insert mode
Morning Run          # Type moment name (1-3 words)
Tab Tab              # Cycle to Wellness area
Enter                # Save → returns to Normal mode

j j                  # Navigate down to new moment
t 1                  # Quick allocate: Today Morning
Enter                # Confirm → moment allocated
```

### 2. Duplicate Across Days
```vim
h k k                # Navigate to moment
y y                  # Yank (duplicate)
l l k                # Navigate to Tomorrow Morning
p                    # Put → duplicate appears
```

### 3. View Current Moment (Compass)
```vim
Ctrl+/               # Toggle compass view
                     # Shows full-screen current moment
                     # Auto-detects phase based on time
Esc                  # Return to timeline
```

### 4. Manage Areas
```vim
: area               # Open area management
Enter
i                    # Create new area
Focus                # Type name
Tab                  # Pick color from palette
Tab                  # Pick emoji
Enter                # Save
Esc                  # Back to timeline
```

---

## Data Persistence Strategy

### MVP (Phase 1): IndexedDB Only
- All data stored locally in browser
- Auto-save on every change (500ms debounce)
- Schema matches PostgreSQL structure (UUIDs, FKs, timestamps)
- No backend, no auth, no sync

### Phase 2: Supabase Sync
- Enable `@legendapp/state/sync-supabase` plugin
- Real-time bidirectional sync (local ↔ cloud)
- Conflict resolution: last-write-wins
- Offline-first: app works without connection

### Schema Design Philosophy
- **Already PostgreSQL-compatible**: All entities use proper relational design
- **UUIDs for all IDs**: Enables distributed creation (no auto-increment)
- **Foreign keys enforced**: area_id REFERENCES areas(id)
- **Timestamps on everything**: created_at, updated_at for audit trail
- **Indexes for performance**: Composite indexes on (day, phase), area_id, etc.

---

## Non-Goals (What This Is NOT)

**MVP explicitly excludes**:
- ❌ Task management (no subtasks, no dependencies)
- ❌ Time tracking (no duration, no timers)
- ❌ Habit tracking (no streaks, no completion percentages)
- ❌ Metrics/analytics (no dashboards, no charts)
- ❌ Notifications/reminders (calm tech, not nagging tech)
- ❌ Collaboration (single-user only)
- ❌ Attachments/URLs (3 words is the interface)
- ❌ Calendar sync (Phase 3+ only)
- ❌ Mobile native apps (PWA is sufficient)

**Design Constraints**:
- No modals (flat UI, inline editing)
- No outcomes (orchestration, not task completion)
- No quantification (presence, not performance)
- Boring by design (mindful tech is intentionally calm)

---

## Development Workflow

### Setup
```bash
# Create Next.js app
npx create-next-app@latest zenborg --typescript --tailwind --app --src-dir

# Install dependencies
npm install @legendapp/state date-fns
npm install @dnd-kit/core @dnd-kit/sortable
npm install -D vitest @testing-library/react @playwright/test

# Run dev server
npm run dev
```

### Testing
```bash
# Unit tests (domain logic)
npm run test

# E2E tests (Vim flows)
npx playwright install  # First time only
npm run test:e2e
```

### Build
```bash
# Production build
npm run build

# Start production server
npm run start
```

---

## Implementation Phases

### Phase 1: Domain Foundation (Sprint 1)
- PostgreSQL schema files (migrations)
- TypeScript entities matching schema
- Validation logic (3-word names, max-3-per-phase)
- Unit tests for domain rules

### Phase 2: State & Persistence (Sprint 1)
- Legend State store setup
- IndexedDB persistence
- Seed default areas + phase settings
- Auto-save (500ms debounce)

### Phase 3: Vim Mode System (Sprint 2)
- Modal state machine (Normal/Insert/Command)
- Mode indicator + command line UI
- Command parsing (`:ty1`, `:area`, etc.)

### Phase 4: Vim Navigation (Sprint 2)
- `hjkl` grid navigation
- `gg`, `G`, `w`, `b` motions
- Focus management
- Visual focus indicator

### Phase 5: UI Components (Sprint 3)
- Responsive timeline (grid desktop, single-day mobile)
- Inline editable moment cards
- Drawing board (below timeline on mobile)
- Phase headers (colored)
- Compass view (full-screen modal)

### Phase 6: Moment CRUD (Sprint 3)
- Create (`i` → inline form)
- Edit (`i` on focused moment)
- Delete (`dd`, `x`)
- Duplicate (`yy` → `p`)
- Area selection (Tab cycling)

### Phase 7: Allocation (Sprint 4)
- Command mode allocation (`:ty1`, etc.)
- Quick allocation (`t1` in Normal mode)
- Unallocation (`:d`, `dd` on allocated)
- Drag & drop (optional, for mouse users)
- Max-3-per-cell enforcement

### Phase 8: Compass View (Sprint 4)
- Time-based phase detection
- Full-screen current moment display
- `Ctrl+/` toggle
- Empty state handling

### Phase 9: Area Management (Sprint 5)
- `:area` command → CRUD interface
- Inline create/edit/delete
- Reordering (Ctrl+↑↓ or drag)
- Color/emoji pickers

### Phase 10: Phase Settings (Sprint 5)
- `:settings` command → config interface
- Time boundary sliders
- Visibility toggles (show/hide Night)
- Persist to IndexedDB

### Phase 11: Mobile Optimizations (Sprint 6)
- Single-day view (swipe navigation)
- Drawing board below timeline
- Touch interactions (tap, swipe, long-press)
- Optional: Vim shortcuts with bluetooth keyboard

### Phase 12: Polish & Testing (Sprint 6)
- Accessibility audit (WCAG 2.1 AA)
- Visual refinement (spacing, colors, focus states)
- Performance (60fps, <16ms input lag)
- E2E tests (Vim flows + drag flows)

### Phase 13 (Optional): Supabase Migration (Sprint 7+)
- Supabase project setup
- Run PostgreSQL migrations
- Configure auth (email/Google)
- Enable Legend State sync plugin
- Test offline → online sync

---

## Success Metrics (Qualitative)

**Primary Question**: "Did I consciously allocate my attention today?"

**User Testing Goals**:
- Does Vim mode feel efficient or frustrating?
- Is the learning curve acceptable for power users?
- Does single-day mobile view feel focused?
- Is inline editing better than modals?
- Does the 3-word constraint feel liberating?

**Technical Health**:
- No data loss on refresh/crash
- Vim shortcuts respond instantly (<16ms)
- Drag & drop smooth (60fps desktop)
- Touch interactions smooth (mobile)
- Loads in <1 second

---

## Project Philosophy (From Attend System)

This project is the digital evolution of a physical whiteboard system using magnets. Key insights:

**Orchestration, Not Elimination**:
> "It is not about eliminating distractions from my life. Accept them, make some room for them to avoid them growing too much."

**Consciousness as Currency**:
> "I'm not budgeting hours; I'm allocating attention. The difference changes everything."

**No Metrics, Only Presence**:
> "The system measures through presence, not performance. Did I consciously allocate my attention today? That's the only metric that matters."

**Physical Constraints → Digital Liberation**:
> "Three items maximum per phase. This isn't limitation; it's liberation."

**Mindful Tech is Boring**:
> "Mindful tech comes at a cost: it's boring. It's not meant to be exciting, intriguing. It's meant to hide the digital tech behind a wall - away from our attention."

---

## Common Questions

**Q: Why Vim keybindings?**
A: Power users can navigate and allocate moments without touching the mouse. Efficiency enables presence.

**Q: Why 3 words maximum for moments?**
A: Forces clarity. If you can't name it in 3 words, the intention isn't clear enough.

**Q: Why no "done" button or completion tracking?**
A: This isn't task management. It's about committing to the time, not achieving outcomes.

**Q: Why no infinite timeline scrolling?**
A: Presence requires bounded context. Yesterday (reflection), Today (presence), Tomorrow (intention). That's enough.

**Q: Why PostgreSQL if it's local-first?**
A: The schema is designed for eventual cloud sync (Phase 2). Local IndexedDB structure matches PostgreSQL for seamless migration.

**Q: Can I use this without learning Vim shortcuts?**
A: Yes. Drag & drop, inline forms, and click interactions work. Vim mode is for power users who want maximum efficiency.

**Q: Why "Zenborg"?**
A: Zen (mindfulness, presence) + Cyborg (technology augmenting human capability). A mindful cyborg approach to attention management.

---

## Related Concepts

**Attention Orchestration System (Attend)**: The physical whiteboard + magnets prototype that inspired Zenborg

**Mindful Technology**: Technology designed to reduce attention strain, using peripheral interfaces ("feelers") and ambient outputs ("indicators")

**Calm Technology**: Systems that inform without demanding focal attention (Mark Weiser)

**Shape Up**: Basecamp's product development methodology (appetite-based, fixed time/variable scope)

**Habylon**: Future system for habit-building through ambient interaction

**Perceive**: Knowledge graph system where moments become nodes in a network of intention and action

---

## License

Open source (to be determined - likely MIT or Apache 2.0)

---

## Contact / Maintainer

This is a personal project for conscious attention management. Built with the philosophy that **structure should guide our organic growth** and that **technology should enhance rather than extract human attention**.

*"Where will I place my consciousness today?"*