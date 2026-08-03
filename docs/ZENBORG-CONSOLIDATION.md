# Zenborg Consolidation: One Garden, Multiple Surfaces

> **Status**: Ideation — capturing decisions from April 16, 2026 session
> **Context**: Rafa explored a "guardrails MCP" idea and discovered it's not a new product — it's a new surface for Zenborg, under the equanimitech umbrella.
>
> **Stale in one respect** (noted 2026-08-03): this snapshot assumes Zenborg is the Next.js web app and the Tauri desktop is archived. Since then Zenborg *became* the Tauri app, and the MCP surface shipped. The domain consolidation and Tide concept still stand; the repo-restructure section describes a path not taken as written.

---

## The Insight

equanimitech is the intellectual framework (the thesis, the principles, equanimi.tech).
Zenborg is the product. It's the garden where equanimitech principles become tangible.

A garden needs both cultivation *and* protection. You don't just plant — you also pull weeds, build fences, and respect the seasons.

## Product Architecture

### Two modes, one garden

**Gardening** (current Zenborg): plant moments, tend habits, cultivate areas, harvest reflections. This is the offensive posture — where you place your consciousness.

**Protecting** (current equanimi browser + new MCP): weeding (shields against compulsive patterns), fencing (tides / time boundaries), composting (drift signals — noticing when you wander and gently returning). This is the defensive posture — what you defend against.

**Tides** bridge both modes: recurring time-based rhythms that activate protection *and* suggest cultivation. "No work after 10pm" is a tide. "Morning is for wellness moments" is a tide. They're structurally close to Zenborg's Cycle + Phase, but with enforcement.

### Three surfaces

1. **Web app** (`apps/web`) — Zenborg's existing Next.js app. The hub. Planning, reflection, the garden view.
2. **Browser extension** (`apps/browser`) — shields for compulsive browsing (YouTube Shorts, chess.com, etc.). Currently lives in equanimi repo, would move here.
3. **MCP server** (`apps/mcp`) — conversational interface for declaring intentions and tides. Connects to Claude (or any MCP client). The gardener's voice.

The equanimi desktop app (Tauri) is archived. The MCP replaces its intention-setting role. If a desktop presence is ever needed, a thin menubar companion is enough.

### Surfaces not affected

- **Penceive** (Thoughts) — PKM / handwritten notes with AI. Stays separate.
- **Stillwatch / Fôlego** — ESP32 breathwork hardware. Stays separate.

## Domain Consolidation

### Zenborg's existing domain (cultivation)

```
Area          → life domain (Wellness, Craft, Social...)
Habit         → recurring moment template
Moment        → named intention, 1-3 words, allocated to phase + day
Cycle         → time container ("Barcelona Summer")
Phase         → time of day (morning, afternoon, evening)
Attitude      → relationship mode (pushing, pulling, maintaining)
```

### Equanimi's domain to absorb (protection)

```
Shield                    → intervention against compulsive patterns
InterventionDefinition    → what the intervention is + BCT metadata
DriftSignal               → detection of wandering from intention
DriftAction               → what user did in response (dismissed, returned, etc.)
Budget                    → time/attention constraints
SessionContext            → bounded working period with intent
TriggerCondition          → when to intervene (immediate, delayed, threshold, budget-based)
BehavioralMechanism       → cue-removal, access-block, friction, environment
```

### New domain concept: Tide

```
Tide → recurring time-based boundary
  - name: string ("Wind-down", "Deep work morning")
  - schedule: RecurringSchedule (days of week + time window)
  - activates: Shield[] (which protections turn on)
  - suggests: Moment[] | Habit[] (what cultivation fits this window)
  - enforcement: "soft" | "firm" (soft = reminder, firm = blocks)
```

A Tide is where gardening meets protecting. It's the season of the garden.

### Merged domain structure

```
packages/domain/src/
├── cultivation/
│   ├── area.ts
│   ├── habit.ts
│   ├── moment.ts
│   ├── cycle.ts
│   └── phase.ts
├── protection/
│   ├── shield.ts
│   ├── intervention.ts
│   ├── drift.ts
│   ├── budget.ts
│   └── trigger.ts
├── rhythm/
│   └── tide.ts
├── science/
│   ├── bct.ts          (BCT references)
│   └── pdp.ts          (Persuasive Design Principles)
└── shared/
    ├── session.ts
    └── value-objects.ts
```

## MCP Guardrails: The Gardener's Voice

### What it is

A human-facing MCP server that any AI assistant (Claude, etc.) can connect to. It knows your garden — your current moments, active tides, and protection rules — and uses that context to keep you on track during AI sessions.

### Core interactions

**Declare intention**: "I'm working on the Convivial AI essay today." → MCP stores this as the active session intent. The AI assistant can reference it and flag drift.

**Set a tide**: "No work after 10pm on weekdays." → MCP stores a recurring boundary. After 10pm, the AI gently refuses work requests or at minimum surfaces the boundary.

**Parking lot**: When you throw out a stray idea mid-session ("oh, I should also look into X"), the MCP captures it in a review queue instead of letting you chase it. The AI says: "Noted for later. Back to the essay?"

**Surface current garden state**: The AI can ask the MCP "what's Rafa working on today?" and get back active moments, current cycle, and applicable tides.

### Design principle

Mostly human-facing guardrails. The MCP doesn't prevent you from doing anything — it surfaces your own declared intentions and boundaries at the moment of drift. Strategic Friction, not a cage. A compass, not a cage — which is already Zenborg's philosophy.

### Enforcement model

**Soft** (default): the AI mentions your intention/tide when it detects drift. "You mentioned you're working on the essay — want to note this for later?"

**Firm** (opt-in per tide): the AI actively resists. "It's 11pm and your wind-down tide is active. I'd rather help you with this tomorrow. Want to save it?"

The user can always override. Equanimity, not control.

## Repo Restructure

### Current state

```
equanimitech/
├── zenborg/              ← Next.js app, 159 source files, deployed
├── equanimi/             ← pnpm workspace monorepo
│   ├── apps/browser/     ← WXT extension, 39 files, functional
│   ├── apps/desktop/     ← Tauri app, 71 files, unused
│   └── packages/domain/  ← shared types, 8 files, clean
├── penceive/             ← PKM app, stays separate
├── stillwatch/           ← hardware, stays separate
└── convivial-network/    ← ?
```

### Target state

```
equanimitech/
├── zenborg/                     ← pnpm workspace monorepo (upgraded)
│   ├── apps/
│   │   ├── web/                 ← current Next.js app (moved from root)
│   │   ├── browser/             ← WXT extension (from equanimi)
│   │   └── mcp/                 ← new MCP server
│   ├── packages/
│   │   └── domain/              ← merged domain model
│   ├── pnpm-workspace.yaml
│   └── package.json
├── equanimi/                     ← archived (donor repo)
├── penceive/                     ← stays separate
├── stillwatch/                   ← stays separate
└── convivial-network/            ← TBD
```

### Migration steps (when ready)

1. **Spike first**: build a minimal MCP server in `zenborg/mcp-spike/` (no monorepo yet). Declare intent, store it, retrieve it. See if you actually use it for two weeks.
2. **If yes**: scaffold pnpm workspace in Zenborg. Move Next.js app to `apps/web`. Extract `packages/domain` from `src/domain/`.
3. **Port browser extension**: copy equanimi's `apps/browser` into Zenborg's `apps/browser`. Rewire imports to `@zenborg/domain`.
4. **Merge domain types**: absorb equanimi's protection types (intervention, drift, budget, shield) into Zenborg's domain alongside existing cultivation types.
5. **Add Tide concept** to the merged domain.
6. **Build MCP surface** properly in `apps/mcp`.
7. **Archive equanimi repo**.

## Key Decisions Made

- **Zenborg is the product name** (not equanimi — that's the framework/thesis)
- **equanimitech is the umbrella** (the intellectual framework, equanimi.tech)
- **One product, two modes**: gardening (cultivation) + protecting (defense)
- **MCP is a surface**, not a separate product — a third app in Zenborg's monorepo
- **Tides** are the new bridging concept between cultivation and protection
- **Desktop app is archived** — MCP replaces its intention-setting role
- **Gardening metaphor** extends naturally to protection: weeding, fencing, composting, seasons
- **Penceive and Stillwatch** remain separate products

## Open Questions

1. **Does Zenborg need renaming?** The name works but doesn't signal the protection mode. Or does it not need to — "make your garden flourish" implies defending it too?
2. **Tides vs Cycles**: are Tides just Cycles with enforcement? Or are they fundamentally different (Cycles = named periods, Tides = recurring schedules)?
3. **Where does the gardening metaphor break?** "Weeding" for shields is poetic but might confuse users. Test the language.
4. **Cross-surface communication**: how does the browser extension know about active moments / tides from the web app? Shared local storage? API? This was already identified as a rabbit hole in the equanimi unification pitch.
5. **What's the smallest MCP spike that validates the idea?** Suggested: intent declaration + parking lot, nothing else.
6. **Economic viability**: how does a protection-mode garden compete with engagement-driven products? (Flagged in equanimitech primer as the hardest open question.)
