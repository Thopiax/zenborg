# Derived Attention — pitch

**Date:** 2026-09-01
**Appetite:** small (1–2 sessions)
**Status:** shaped

> The garden shows what you intend but not what you attend. Sessions run dark,
> calendar events are invisible, and crafting on zenborg itself leaves no mark.
> The data already exists — keel logs every session, Google Calendar MCP is
> connected — nothing reads either one.

---

## Boundaries

**Problem.** Rafa spends significant time working on zenborg and attending
calendar commitments. Neither appears in the garden unless he manually plants
and activates moments. The system demands input it should derive.

**What this is.** Connect existing signals (keel activity log, Google Calendar
MCP, cwd→area mapping) to existing surfaces (sunrise, weather, recap, close-up)
so the garden reflects actual attention, not just declared intention.

**What this is not.** Not the calendar zoom-ladder (that's the UI — this is the
plumbing it needs). Not a time tracker. Not EventKit or CalDAV integration.
Not a new vault collection. No new writes to the vault.

**Appetite.** Small — two thin layers of read-side logic, no vault schema
changes, no Rust, no new UI components.

---

## Elements

### 1. Auto-activate on session start (plugin change)

**Where:** `plugin/keel.mjs` → `handleSessionStart` + `handleUserSubmit`

**Today:** keel reads `activeMoment.json`. If nothing is active, it fires a
one-shot `intentionNudge` asking the agent to propose a moment. The agent
proposes; the user confirms; the MCP sets it. Most sessions skip this and run
dark.

**Change:** Before the nudge, attempt a **deterministic match**:

```
today's allocated moments  →  filter by cwd→area match  →  pick the one in the current phase
```

If exactly one moment matches, **auto-set it** via the zenborg MCP
(`set_active_moment`). If multiple match, propose them as a short picker in the
nudge. If zero match, fall through to the existing infer-nudge.

The cwd→area mapping is the same seam `intentionNudge` already passes. The
match is conservative: wrong area = no auto-set, just a nudge.

**Why this works:** most sessions start in a project directory that maps to
exactly one area (zenborg→equanimi.tech, minerva→Themia). If a moment is
already planted for that area today, the match is unambiguous.

**Red line:** never auto-plant a moment that wasn't already in today's garden.
Auto-activate what's already planned, never auto-create.

### 2. Calendar overlay in sunrise (skill change)

**Where:** `plugin/skills/sunrise/SKILL.md`

**Today:** sunrise reads moments, cycle, wilting habits, sleep. It does not read
Google Calendar.

**Change:** Add one more parallel fetch to step 1:

```
mcp__claude_ai_Google_Calendar__list_events { calendarId: "primary", timeMin: today 00:00, timeMax: today 23:59 }
```

Render calendar events as a **separate lane** under the moments:

```
## Today (2026-09-01) — Season: autumn (presence)

Morning:   ☕ morning ritual   🧘 practice
Afternoon: 🔨 craft zenborg
Evening:   (empty)

Calendar:  09:00–10:00  Team standup
           14:00–15:30  Dentist
           19:00–20:00  Dinner w/ Alice
```

Calendar events are read-only context — they inform phase planning but are never
converted to moments. They surface pre-committed time so the gardener can see
what's already spoken for.

**Red line:** zenborg never writes to Google Calendar (existing constraint).
Calendar events are rendered in stone tones, not area colors — they are external
commitments, not garden intentions.

### 3. Derived attention in recap/weather (skill change)

**Where:** `plugin/skills/recap/SKILL.md`, `plugin/skills/weather/SKILL.md`

**Today:** recap reads moments and git log. Weather aggregates moments per area
and computes habit health. Neither reads the keel activity log.

**Change:** After reading moments and git, read the keel activity log for the
window and derive session durations per area:

```
session_start → session_end spans, grouped by active moment's area
```

The log already has `session_start`, `session_end`, `intention_switched` events
with timestamps. A read-side scan produces:

```
Attention (derived from sessions):
  equanimi.tech  3h 20m  (4 sessions)
  Themia         1h 45m  (2 sessions)
  unattributed   0h 30m  (1 session, no moment set)
```

Surface this as a **separate section** in recap/weather, clearly labeled as
derived (not planted). It's a mirror: "here's where your attention actually
went."

**Red line:** this is information, not score. "3h 20m" is neutral. No "you spent
too much/little time on X." No comparison to targets or budgets.

---

## Risks

| Risk | Mitigation |
|---|---|
| Auto-activate sets the wrong moment | Conservative match: cwd→area + current phase + exactly-one candidate. Any ambiguity → nudge, not auto-set. |
| Google Calendar MCP unavailable | Sunrise degrades gracefully — calendar section just says "(calendar not connected)" |
| Keel log format changes | Read-side only, fail-open. Malformed events → skip, never crash. |
| Privacy — calendar events in agent context | Calendar data stays in the skill turn, never logged to the vault. Same posture as Garmin sleep data in sunrise. |
| Derived hours feel like a time tracker | Framing: "where attention landed" not "how long you worked." No targets, no budgets, no comparison. Equanimitech principle: information as mirror, never as judge. |

---

## Pitch

Three read-side changes, zero new vault writes, zero new UI:

1. **Auto-activate** the planned moment that matches `cwd + phase` on session
   start — most sessions stop running dark.
2. **Show calendar** in sunrise — the day view gains the time already spoken for.
3. **Derive attention hours** from keel logs in recap/weather — the weekly view
   gains what actually happened, not just what was intended.

All three use existing signals (keel log, activeMoment, Google Calendar MCP) and
existing surfaces (sunrise, recap, weather, the session-start hook). The data is
already being written; this pitch only reads it.

Supersedes: `2026-05-31-connect-calendar.md` (partially — the read side only).
Feeds into: `2026-06-03-calendar-zoom-ladder.md` (the UI this plumbing enables).
