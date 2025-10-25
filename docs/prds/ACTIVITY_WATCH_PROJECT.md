# ActivityWatch Integration - Semantic Attention Guardrails

**Status**: Draft
**Target**: MVP Extension (Phase 1)
**Philosophy**: Reduce the distance from intent to action through ambient awareness

---

## Vision

**The Problem**: We allocate consciousness to "Product Spec" but spend 90 minutes on Twitter. The gap between intention and action is invisible until reflection time - by then, the day is spent.

**The Solution**: Integrate ActivityWatch as a bundled extension to provide **semantic attention guardrails** - AI-powered ambient feedback that gently closes the gap between stated intention and observed activity.

**Core Principle**:
> "Technology as a mirror for consciousness, not a taskmaster."

This is not time tracking. This is **attention alignment detection** using AI to understand the semantic relationship between what you committed to doing and what you're actually doing.

---

## What This Is

A **passive ambient awareness system** that:
1. Observes computer activity via ActivityWatch
2. Classifies alignment with current moment using local LLM
3. Provides **peripheral feedback** (ambient compass indicator)

**Not**: Performance tracking, productivity metrics, nagging notifications, guilt-inducing dashboards, or granular time summaries.

**Is**: A gentle, intelligent mirror that helps you notice drift in the moment, not hours later.

---

## User Experience

### The Ambient Indicator (Passive, Real-time)

A small compass indicator in the corner of Zenborg:

```
Current: "Product Spec" ☕ Morning

[Compass widget - collapsed state]
🧭 ↑  (aligned)

[Compass widget - drift detected]
🧭 ↙  (drifting)
```

**Behavior**:
- Updates every 5-10 minutes
- Lives in peripheral vision (top-right corner, can collapse/hide)
- No modal takeovers, no sounds, no badges
- Clicking shows brief summary: "Currently aligned with product work theme"
- Can be dismissed entirely (respects user agency)

**States**:
- **Aligned** (↑): Activity matches moment's semantic theme
- **Neutral** (↔): Ambiguous (email, Slack, quick searches)
- **Drifting** (↙): Clear misalignment detected
- **Untracked** (○): No digital activity (reading, meetings, thinking)

---

## Technical Architecture

### High-Level Flow

```
┌──────────────────────────────────────────────────┐
│           Zenborg Core (Phase 1)                 │
│  - Moments with Area associations                │
│  - Areas define semantic themes                  │
│  - Current moment awareness                      │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│      ActivityWatch Extension Bundle              │
│  - aw-watcher-window (desktop apps)              │
│  - aw-watcher-web (browser tabs/URLs)            │
│  - aw-watcher-afk (idle detection)               │
│  - Local SQLite database                         │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│         Activity Collector Service               │
│  - Polls AW database every 5-10 min              │
│  - Aggregates recent events (last 15 min)        │
│  - Filters: apps, window titles, URLs, duration  │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│       Semantic Classifier (Local LLM)            │
│  - Ollama/llama.cpp (3B-7B param model)          │
│  - Input: current moment + observed activity     │
│  - Output: alignment classification + confidence │
│  - Understands work themes semantically          │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│          Ambient Feedback Layer                  │
│  - Compass indicator (real-time UI)              │
│  - Alignment history (stored in IndexedDB)       │
└──────────────────────────────────────────────────┘
```

### Data Model Extensions

**Area** (extended from Zenborg core):
```typescript
interface Area {
  // ... existing fields ...
  themeKeywords?: string[]  // ["linear", "notion", "spec", "roadmap"]
  themeDescription?: string // "Product work: writing specs, prioritizing..."
}
```

**Default Area Themes** (for user "Thopiax"):
```typescript
const DEFAULT_THEMES = {
  "Product": {
    keywords: ["linear", "notion", "spec", "roadmap", "jira", "prd"],
    description: "Writing specs, scopes, prioritizing features"
  },
  "Data": {
    keywords: ["jupyter", "python", "sql", "postgres", "dbt", "pandas"],
    description: "Exploring data, writing models, running batches, experiments"
  },
  "UX": {
    keywords: ["figma", "framer", "prototype", "design", "css", "component"],
    description: "Prototyping, fine-tuning interfaces"
  },
  "Strategy": {
    keywords: ["docs", "notes", "research", "reading", "writing"],
    description: "Slow, deliberate thinking and planning"
  }
}
```

**AlignmentEvent** (new entity):
```typescript
interface AlignmentEvent {
  id: string                    // UUID
  momentId: string              // FK to Moment
  timestamp: string             // ISO timestamp
  classification: AlignmentType // "aligned" | "neutral" | "drifting"
  confidence: number            // 0.0-1.0
  observedActivities: ActivitySummary[]
  themeDetected: string | null  // "product", "data", etc.
  createdAt: string
}

interface ActivitySummary {
  app: string
  windowTitle: string
  url?: string
  duration: number              // seconds
}

type AlignmentType = "aligned" | "neutral" | "drifting" | "untracked"
```

### LLM Classification Service

**Local Model Options** (ranked by preference):
1. **Ollama** with Llama 3.2 3B (fastest, good balance)
2. **llama.cpp** with Phi-3 Mini (smallest, edge devices)
3. **Fallback**: Claude API (privacy implications, requires API key)

**Classification Prompt Template**:
```typescript
const CLASSIFICATION_PROMPT = `You are an attention alignment classifier for a mindful productivity system.

CURRENT INTENTION:
- Moment: "${moment.name}"
- Area: ${moment.area.name}
- Theme: ${moment.area.themeDescription}
- Phase: ${phase} (${phaseEmoji})

OBSERVED ACTIVITY (last 15 min):
${activitySummary}

TASK: Classify alignment as:
- ALIGNED: Activity clearly matches the stated intention and theme
- NEUTRAL: Ambiguous or transitional (email, Slack, quick searches, switching contexts)
- DRIFTING: Clear misalignment with stated intention
- UNTRACKED: No significant digital activity detected

GUIDELINES:
- Consider semantic meaning, not just keywords
  (e.g., "Slack #product-team" is aligned with product work)
- Short diversions (<2 min) are NEUTRAL, not drifting
- Respect nuance: research on Twitter for a product spec is aligned
- If no clear activity, classify as UNTRACKED (not a failure)

OUTPUT (JSON only, no explanation):
{
  "classification": "aligned" | "neutral" | "drifting" | "untracked",
  "confidence": 0.0-1.0,
  "themeDetected": "product" | "data" | "ux" | "strategy" | null,
  "briefReason": "Short explanation (max 10 words)"
}`;
```

**Response Parsing**:
```typescript
interface ClassificationResult {
  classification: AlignmentType
  confidence: number
  themeDetected: string | null
  briefReason: string
}

// Store in IndexedDB as AlignmentEvent
```

---

## Implementation Phases

### Phase 1a: ActivityWatch Bundling (Week 1)
**Goal**: Ship Zenborg with AW pre-configured, zero user setup

**Tasks**:
1. Bundle AW binaries for macOS/Linux/Windows
2. Auto-start AW server on Zenborg launch (background process)
3. Install default watchers (window, web, afk)
4. Health check: verify AW is running, show status in settings
5. Graceful fallback: if AW fails, hide extension UI (no crash)

**Acceptance**:
- User installs Zenborg → AW runs automatically
- No manual AW installation required
- Settings page shows "ActivityWatch: Running ✓"

---

### Phase 1b: Activity Collection (Week 1)
**Goal**: Poll AW database and aggregate recent activity

**Tasks**:
1. AW SQLite database reader (or REST API client)
2. Service: poll every 5-10 min for last 15 min of events
3. Aggregate by app/window/URL with durations
4. Filter noise (< 10 sec interactions, system processes)
5. Store raw events temporarily (in-memory, not persisted)

**Acceptance**:
- Console logs show aggregated activity every 5 min
- Events correctly grouped by app/window
- Idle time excluded from aggregation

---

### Phase 1c: Local LLM Integration (Week 2)
**Goal**: Classify alignment using Ollama locally

**Tasks**:
1. Detect Ollama installation (or prompt user to install)
2. Auto-pull lightweight model (Llama 3.2 3B)
3. Build classification prompt from current moment + activity
4. Call Ollama API (http://localhost:11434)
5. Parse JSON response → AlignmentEvent
6. Store classifications in IndexedDB (not raw activity)

**Acceptance**:
- Classification runs locally, no external API calls
- Response time < 2 seconds
- Confidence scores calibrated (>0.7 for aligned/drifting)
- Errors gracefully handled (show "untracked" if LLM fails)

---

### Phase 1d: Ambient Compass Indicator (Week 2)
**Goal**: Show real-time alignment in peripheral vision

**UI Component**:
```tsx
<AlignmentCompass
  classification="aligned"
  confidence={0.85}
  canCollapse={true}
  position="top-right"
/>
```

**States**:
- **Aligned**: 🧭 ↑ (green tint)
- **Neutral**: 🧭 ↔ (gray)
- **Drifting**: 🧭 ↙ (amber, not red - no guilt)
- **Untracked**: 🧭 ○ (faded)

**Interactions**:
- Click → expand brief reason ("Aligned with product work theme")
- Double-click → hide for 1 hour (respects user agency)
- Settings toggle: disable entirely

**Design**:
- Monochrome base (stone-200 border)
- Subtle color accent (area color, low opacity)
- Small: 48px × 48px collapsed, 200px × 80px expanded
- No animations (calm tech)

**Acceptance**:
- Updates within 10 seconds of classification
- No performance impact (< 1% CPU)
- Can be dismissed/hidden
- Accessible (ARIA labels, keyboard nav)

---

### Phase 1e: Settings & Privacy (Week 2-3)
**Goal**: User control over data collection and feedback

**Settings Panel** (`:settings` command):
```
┌─────────────────────────────────────────────────┐
│ ActivityWatch Integration                       │
├─────────────────────────────────────────────────┤
│ ☑ Enable attention guardrails                   │
│ ☑ Show ambient compass indicator                │
│                                                  │
│ Classification interval: [5 min] [10 min] [15]  │
│ LLM Backend: [Ollama (local)] [Claude API]      │
│                                                  │
│ Privacy:                                         │
│ ☑ Process data locally only                     │
│ ☐ Allow cloud LLM fallback (requires API key)   │
│                                                  │
│ Data Retention:                                  │
│ Keep alignment history: [7 days] [30] [Forever] │
│ [Clear all ActivityWatch data]                  │
│                                                  │
│ Status:                                          │
│ ActivityWatch: Running ✓                        │
│ Ollama: Connected ✓ (Llama 3.2 3B)              │
│ Last classification: 2 minutes ago              │
└─────────────────────────────────────────────────┘
```

**Privacy Guarantees**:
- Raw AW events never leave the machine (unless user opts into cloud LLM)
- Only classification results stored (not window titles/URLs)
- User can clear all data anytime
- AW can be disabled entirely (extension becomes dormant)

**Acceptance**:
- All toggles functional
- Data deletion works (verified in IndexedDB)
- Ollama connection status accurate
- Works without internet (local-only mode)

---

## User Flows

### Flow 1: First-Time Setup (Zero Config)
```
1. User installs Zenborg
2. ActivityWatch auto-starts in background
3. Ollama detected (or prompt: "Install Ollama for local AI? [Yes] [Skip]")
4. If Ollama installed → auto-pull Llama 3.2 3B (progress indicator)
5. Settings show: "ActivityWatch: Running ✓, Ollama: Ready ✓"
6. Compass indicator appears (faded, no moment allocated yet)
```

**Fallback**: If Ollama not installed, extension stays dormant (no crash, no nag).

---

### Flow 2: Morning Routine with Ambient Feedback
```
1. User allocates "Product Spec" to Today Morning (:t1)
2. Morning starts (6am), phase active
3. User opens Linear, starts writing spec
4. After 5 min → AW collects events, LLM classifies
5. Compass shows: 🧭 ↑ (aligned)
6. User switches to Twitter for 20 min
7. After 10 min → LLM reclassifies
8. Compass shifts: 🧭 ↙ (drifting)
9. User notices (peripheral vision), self-corrects
10. Back to Linear → compass returns to 🧭 ↑
```

**Key**: No interruption, no modal. Just ambient awareness.

---

### Flow 3: Disable Extension (User Agency)
```
1. User types :settings
2. Unchecks "Enable attention guardrails"
3. ActivityWatch stops collecting data
4. Compass indicator disappears
5. Zenborg continues working normally (core features unaffected)
```

**Key**: Extension is opt-out, not forced.

---

## Technical Constraints

### Performance
- **Classification latency**: < 2 seconds (local LLM)
- **UI update latency**: < 500ms (compass indicator)
- **CPU overhead**: < 5% average (AW watchers + LLM)
- **Memory**: < 200MB (AW + Ollama model loaded)
- **Battery impact**: Negligible (10-min polling, not continuous)

### Privacy
- **Default**: All data processed locally (AW SQLite + Ollama)
- **No telemetry**: Classification results stay on device
- **Optional cloud**: User must explicitly enable + provide API key
- **Data retention**: Default 7 days, user-configurable
- **GDPR compliance**: Full data export/deletion support

### Compatibility
- **Platforms**: macOS, Linux, Windows (AW supports all three)
- **Browsers**: Chrome, Firefox, Safari (aw-watcher-web)
- **Editors**: VS Code, Cursor, Vim/Neovim (window title detection)
- **Ollama**: Requires 4GB RAM minimum (for 3B model)

---

## Success Metrics

**Qualitative** (user interviews):
- "Did the compass help you notice drift before it became hours?"
- "Was setup truly zero-config, or did you struggle?"
- "Do you trust that data stays local?"
- "Does the ambient feedback feel helpful or distracting?"

**Quantitative** (optional telemetry, opt-in):
- % of moments with aligned classification (target: >60%)
- Average time-to-notice drift (compass shown → user action)
- Extension disable rate (failure if >20% disable within 1 week)

**Technical Health**:
- AW uptime (target: >99%)
- LLM classification success rate (target: >95%)
- UI responsiveness (compass updates <500ms)
- Zero data loss on Zenborg restart

---

## Non-Goals (MVP)

**Explicitly excluded from Phase 1**:
- ❌ Cloud sync of ActivityWatch data
- ❌ Mobile app integration (AW is desktop-only)
- ❌ Productivity metrics / dashboards / charts
- ❌ Gamification (streaks, scores, achievements)
- ❌ Social features (compare with others)
- ❌ AI suggestions ("you should work on X next")
- ❌ Calendar integration (infer intentions from events)
- ❌ Pomodoro timers or time-boxing
- ❌ Automatic moment creation based on observed activity
- ❌ Notifications/reminders/alerts (calm tech only)
- ❌ Browser extension (watch via aw-watcher-web is sufficient)

**Future Phases** (not MVP):
- Phase 2: Longer-term reflection patterns (weekly/monthly, not immediate)
- Phase 3: Custom theme taxonomy (beyond Area keywords)
- Phase 4: Multi-device correlation (phone + desktop)
- Phase 5: Shared themes for teams (opt-in collaboration)

---

## Open Questions

**Technical**:
1. Should we bundle Ollama or just detect/prompt for install?
   - **Recommendation**: Detect + prompt (Ollama is 500MB+, too large to bundle)

2. Polling interval: 5 min, 10 min, or user-configurable?
   - **Recommendation**: Default 10 min, configurable down to 5 min

3. How to handle rapid context switching (10+ app switches in 5 min)?
   - **Recommendation**: Classify as NEUTRAL (transitional state)

4. Should we show compass when no moment allocated?
   - **Recommendation**: Show as UNTRACKED (○), remind user to allocate

**UX**:
1. Should compass show confidence score, or just direction?
   - **Recommendation**: Hide confidence (too metric-y), just show state

2. What if user has multiple monitors? Where to show compass?
   - **Recommendation**: Let user drag/position, persist preference

3. Should alignment history be queryable/viewable?
   - **Recommendation**: Future phase - keep MVP focused on real-time awareness only

**Privacy**:
1. Should we offer data export (JSON dump of AlignmentEvents)?
   - **Recommendation**: Yes, via `:export-data` command

2. How to handle sensitive window titles (e.g., "Therapy Notes - Google Docs")?
   - **Recommendation**: Hash or redact in stored data, only use for real-time classification

---

## Philosophy Alignment Check

**Does this maintain Zenborg's core principles?**

✅ **Orchestration, not elimination**: Accepts drift, helps you notice and reallocate
✅ **Consciousness as currency**: Mirrors where attention actually goes vs. where you said it would
✅ **Presence over outcomes**: No "productivity score", just alignment awareness
✅ **Vim-inspired efficiency**: Minimal UI, peripheral vision, no interruptions
✅ **Calm technology**: Ambient indicators, not notifications; reflection, not real-time guilt
✅ **Local-first**: IndexedDB + local LLM, cloud is opt-in only
✅ **Privacy-first**: Raw activity never persisted, only classifications

**Potential Tensions**:
⚠️ **"No time tracking"** → We're tracking, but not exposing raw time (only alignment)
⚠️ **"No metrics"** → Classifications are a form of metric, but qualitative (aligned/drifting)
⚠️ **"Mindful tech is boring"** → AI classification could feel "smart" vs. boring

**Resolution**:
- Frame as **awareness tool**, not performance tracker
- Never show percentages, scores, or comparisons
- Make compass dismissible/disableable (user agency)
- Keep UI monochrome and calm (no red alerts, no urgency)

---

## Next Steps

**Immediate**:
1. ✅ PRD approval (this document)
2. Create technical spike: bundle AW binaries for Next.js app
3. Test Ollama integration (API calls, model selection)
4. Design compass component (Figma mockup)
5. Set up Vitest tests for classification service

**Week 1 Deliverables**:
- AW auto-start on Zenborg launch
- Activity collection service (polling AW database)
- Console logging of aggregated events

**Week 2 Deliverables**:
- Ollama integration (local LLM classification)
- Compass indicator UI component
- Real-time classification display

**Week 2-3 Deliverables**:
- Settings panel (privacy controls)
- Data retention & deletion
- E2E test: full flow from moment allocation → drift detection → self-correction

---

## Appendix: User's Default Themes

**For "Thopiax" (MVP hardcoded)**:

```typescript
export const THOPIAX_THEMES = {
  "Product Work": {
    keywords: ["linear", "notion", "jira", "asana", "roadmap", "spec", "prd", "priorit"],
    description: "Writing specs, scopes, prioritizing features, planning roadmaps",
    exampleActivities: [
      "Linear - Product Roadmap Q2",
      "Notion - PRD: New Onboarding Flow",
      "Slack - #product-team"
    ]
  },
  "Data Work": {
    keywords: ["jupyter", "python", "sql", "postgres", "dbt", "pandas", "numpy", "colab"],
    description: "Exploring data, writing models, running batches, tweaking experiments",
    exampleActivities: [
      "Jupyter Notebook - user_retention_analysis.ipynb",
      "pgAdmin - Query: weekly_active_users",
      "Terminal - python run_experiment.py"
    ]
  },
  "UX Work": {
    keywords: ["figma", "framer", "sketch", "prototype", "design", "component", "css", "tailwind"],
    description: "Prototyping interfaces, fine-tuning designs, iterating on components",
    exampleActivities: [
      "Figma - Zenborg Compass Redesign",
      "VS Code - MomentCard.tsx",
      "Chrome - Tailwind CSS Docs"
    ]
  },
  "Strategy Work": {
    keywords: ["docs", "notion", "notes", "obsidian", "research", "reading", "writing", "plan"],
    description: "Slow, deliberate thinking, strategic planning, deep reading",
    exampleActivities: [
      "Google Docs - Q3 Strategy Draft",
      "Notion - Weekly Reflection",
      "Safari - Reading: Shape Up (Basecamp)"
    ]
  }
}
```

**Usage in Classification**:
- When moment.area matches theme name, use corresponding keywords/description
- LLM considers semantic overlap (e.g., "Slack #product-team" → Product Work)
- Themes evolve with user (future: custom theme editor)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-25
**Author**: Thopiax (with Claude)
**Status**: Ready for implementation

---

*"Reduce the distance from intent to action. Technology as a mirror, not a master."*
