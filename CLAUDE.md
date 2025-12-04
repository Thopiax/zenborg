# Zenborg - Intention Compass

> *An attention orchestration system for budgeting moments toward personal flourishing.*

## What This Is

Zenborg is a **local-first web application** for conscious attention allocation. Not a task manager. Not a habit tracker. Not a calendar.

**Core Philosophy**:
- **Orchestration, not elimination**: Accept distractions, budget for them
- **Consciousness as currency**: Allocate attention, not time
- **Presence over outcomes**: No "done" buttons, no completion tracking

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
│   └── state/           # Legend State store
├── application/         # Use cases (orchestration)
│   ├── use-cases/       # CreateMoment, AllocateMoment, etc.
│   └── services/        # TimeService (phase detection)
└── presentation/        # React components + hooks
    ├── components/      # UI components (Vim-aware)
    ├── hooks/           # Custom React hooks
    └── app/             # Next.js pages
```

**Key Principles**:
- **Domain logic isolated** from UI/infrastructure
- **Local-first**: IndexedDB primary, Supabase secondary (eventual consistency)
- **PostgreSQL-ready schema**: All entities designed for relational DB migration
- **SOLID**: Single responsibility, dependency inversion, open/closed

---

## Form Handling Architecture

**Standardized pattern for entity forms (Habits, Moments):**

### Layer Separation

```
┌─────────────────────────────────────────────────┐
│ Presenters (Form Dialogs)                      │
│ - Read UI state from uiStore                    │
│ - Call onSave/onDelete callbacks for persistence│
│ - Minimal local state (popovers, focus)         │
├─────────────────────────────────────────────────┤
│ Infrastructure/State                             │
│ - uiStore: Ephemeral form state (NOT persisted) │
│ - store: Domain entities (persisted)            │
├─────────────────────────────────────────────────┤
│ Application/Services                             │
│ - HabitService, MomentService, AreaService      │
│ - Orchestrate domain operations                 │
├─────────────────────────────────────────────────┤
│ Domain/Entities                                  │
│ - Habit, Moment, Area (pure business logic)     │
└─────────────────────────────────────────────────┘
```

### Pattern Components

**1. UI Store State (`infrastructure/state/ui-store.ts`)**:
- Form field values (name, areaId, emoji, etc.)
- Dialog open/close state
- Mode (create/edit)
- Editing entity ID (for edit mode)
- Convenience defaults (lastUsedAreaId)

**2. Helper Functions**:
- `openHabitFormCreate()` / `openMomentFormCreate()` - Initialize form for create mode
- `openHabitFormEdit()` / `openMomentFormEdit()` - Initialize form for edit mode
- `closeHabitForm()` / `closeMomentForm()` - Close form and reset state

**3. Form Dialog Component**:
- Props: Only `onSave` and `onDelete` callbacks
- Reads all form state from `habitFormState$` or `momentFormState$`
- Updates store directly (e.g., `habitFormState$.name.set(value)`)
- Local state ONLY for UI (popover open states, validation errors)

**4. Parent Component**:
- Calls helper functions to open forms
- Provides persistence callbacks that call application services
- No form state management (delegated to uiStore)

### Example Usage

```typescript
// 1. UI Store (infrastructure/state/ui-store.ts)
export interface HabitFormState {
  open: boolean;
  mode: "create" | "edit";
  name: string;
  areaId: string;
  emoji: string | null;
  attitude: Attitude | null;
  phase: Phase | null;
  tags: string[];
  editingHabitId: string | null;
}

export const habitFormState$ = observable<HabitFormState>({...});

export function openHabitFormCreate(params?: { areaId?: string }) {
  habitFormState$.set({
    open: true,
    mode: "create",
    name: "",
    areaId: params?.areaId || lastUsedAreaId$.peek() || "",
    // ... rest of fields
  });
}

// 2. Form Dialog (components/HabitFormDialog.tsx)
interface HabitFormDialogProps {
  onSave: (props: CreateHabitProps | UpdateHabitProps) => void;
  onDelete?: () => void;
}

export function HabitFormDialog({ onSave, onDelete }: HabitFormDialogProps) {
  // Read from store
  const formState = use$(habitFormState$);
  const { open, mode, name, areaId, emoji } = formState;

  // Update store directly
  const handleSave = () => {
    onSave({ name, areaId, emoji, ... });
    closeHabitForm();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeHabitForm()}>
      <input
        value={name}
        onChange={(e) => habitFormState$.name.set(e.target.value)}
      />
    </Dialog>
  );
}

// 3. Parent Component (components/AreaGallery.tsx)
function AreaGallery() {
  const handleSaveHabit = (props: CreateHabitProps | UpdateHabitProps) => {
    const formState = habitFormState$.peek();

    if (formState.mode === "edit") {
      habitService.update(formState.editingHabitId, props);
    } else {
      habitService.create(props);
    }
  };

  return (
    <>
      <button onClick={() => openHabitFormCreate({ areaId: area.id })}>
        New Habit
      </button>
      <HabitFormDialog onSave={handleSaveHabit} onDelete={handleDeleteHabit} />
    </>
  );
}
```

### Benefits

| Principle | How It Helps |
|-----------|-------------|
| **Separation of Concerns** | UI state (uiStore) separated from domain state (store) |
| **Single Source of Truth** | Form state lives in one place, not duplicated in props |
| **Type Safety** | Store provides typed state, prevents prop drilling |
| **Testability** | Can test form logic by manipulating store directly |
| **Reusability** | Helper functions make opening forms trivial |
| **Clear Boundaries** | Callbacks define persistence boundary (Presenter → Application) |
| **Convenience** | Preserve defaults (lastUsedAreaId) across sessions |

### Area Forms (Exception)

**Areas use inline editing (not dialogs)** per design constraint "No modals, flat UI":
- Simple properties (name, emoji, color)
- Contextual to specific card
- Local state in card component (EmptyAreaCard, PlanAreaCard)
- No need for dialog or global state

---

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
│  Zenborg                                                │
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

---

## Design System

### Visual Principles
- **Monochromatic base**: Off-white (#fafaf9), light gray (#f5f5f4)
- **Phase colors as accents**: Morning (amber), Afternoon (yellow), Evening (purple), Night (dark slate)
- **Area colors on moments**: Border or small pill
- **Flat design**: No modals, inline editing only

### Inspiration
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

# E2E tests 
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

## Success Metrics (Qualitative)

**Primary Question**: "Did I consciously allocate my attention today?"

**User Testing Goals**:
- Is the learning curve acceptable for power users?
- Does single-day mobile view feel focused?
- Is inline editing better than modals?
- Does the 3-word constraint feel liberating?

**Technical Health**:
- No data loss on refresh/crash
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

MIT License - See [LICENSE](LICENSE) file for details

---

## Contact / Maintainer

This is a personal project for conscious attention management. Built with the philosophy that **structure should guide our organic growth** and that **technology should enhance rather than extract human attention**.

*"Where will I place my consciousness today?"*

# IMPORTANT DEV INSTRUCTIONS

- do not run the dev OR build the app, I'm running it myself
- IMPORTANT: only use `stone` tones (monochrome) unless attributed to an area
- all mobile UX should be designed for landscape exprience. Portrait mode won't be considered.