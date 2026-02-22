# Behavioral Analysis: Feedback Loops for Zenborg

> Date: 2026-02-22
> Status: Research / Design exploration
> BCT Framework: Michie et al. BCTTv1 (124 techniques, 16 groupings)
> PDP Framework: Fogg's Persuasive Design Principles (30 principles, 5 categories)

## Context

Zenborg handles **intention-setting** well (allocating moments to phases/days) but has no mechanisms to bridge those intentions into everyday practice. Once the app is closed, intentions become invisible.

**The core behavioral problem:** an open intention-action loop.

```
PLAN (morning)  →  PRACTICE (throughout day)  →  REFLECT (evening)
     ↑                                                ↓
     └──────────────── FEEDBACK LOOP ────────────────┘
                    (currently broken)
```

Zenborg only covers PLAN. PRACTICE and REFLECT are unsupported. Without cues at the point of action and structured reflection, planning becomes a ritual disconnected from living.

---

## Identified BCTs (What psychological mechanisms to target)

### 1. Prompts/Cues (Grouping: Associations, 7.1)
**Definition:** Introduce environmental or social stimulus to prompt the behavior.
**Why it matters:** Zenborg's intentions exist only inside the app. No external cue reminds you "I intended Deep Work this afternoon." The moment you leave the app, the plan is forgotten.
**Mechanism of Action:** Behavioral Cueing - environmental triggers that activate planned behavior without requiring conscious recall.
**Gap:** Zero external cues today. Calendar events and phase notifications would close this.

### 2. Self-monitoring of Behavior (Grouping: Feedback & Monitoring, 2.3)
**Definition:** Establish a method for the person to monitor and record their behavior.
**Why it matters:** Not completion tracking (that violates Zenborg's philosophy). Rather: "Am I aware of where my attention IS right now vs. where I INTENDED it to be?" Awareness, not measurement.
**Mechanism of Action:** Feedback Processes - comparing current state against an internal standard (the plan).
**Gap:** No current-phase awareness. No "you're in Afternoon, here's what you intended."

### 3. Review Behavior Goals (Grouping: Goals & Planning, 1.5)
**Definition:** Review previously set goals and modify if needed.
**Why it matters:** The /harvest page is a placeholder. Without structured reflection, there's no learning loop - you can't adjust future planning based on past attention patterns.
**Mechanism of Action:** Behavioral Regulation - the skill of managing and adjusting one's own behavior over time.
**Gap:** /harvest is empty. No evening review, no cycle reflection.

### 4. Action Planning (Grouping: Goals & Planning, 1.4)
**Definition:** Prompt detailed planning of when, where, and how the behavior will be performed.
**Why it matters:** Zenborg supports WHAT (moment name) and WHEN (phase), but not the ritual of daily planning itself. A morning prompt could anchor the planning habit.
**Mechanism of Action:** Intention + Behavioral Cueing - forming implementation intentions ("when phase X starts, I will do Y").
**Gap:** No support for making the planning ritual itself habitual.

### 5. Habit Formation (Grouping: Repetition & Substitution, 8.3)
**Definition:** Prompt rehearsal and repetition of behavior in the same context repeatedly.
**Mechanism of Action:** Behavioral Cueing + Reinforcement - consistent context (same time, same trigger) builds automaticity.
**Why it matters:** The daily planning ritual in Zenborg should itself become automatic. Consistent morning cue + low-friction entry = habit.

---

## Identified PDPs (How to implement in interaction design)

### 1. Reminders (Category: Dialogue)
**Implementation:** Calendar events as contextual reminders at phase boundaries. Not push notifications demanding attention - passive calendar blocks that appear in the tool you already live in.
**Implements BCTs:** Prompts/cues (7.1), Action planning (1.4)
**Calm tech alignment:** HIGH - calendar is already part of daily routine; adding blocks is additive, not intrusive.

### 2. Self-monitoring (Category: Primary Task)
**Implementation:** Phase-aware "current state" display. When you open Zenborg or glance at a widget, you see: "You're in Afternoon. Intended: Deep Work, Team Sync." Not tracking whether you did it - just surfacing what you intended.
**Implements BCTs:** Self-monitoring of behavior (2.3), Prompts/cues (7.1)
**Calm tech alignment:** HIGH - information is available when sought, not pushed.

### 3. Tunneling (Category: Primary Task)
**Implementation:** Guide through the full loop: Morning planning flow -> Daily practice awareness -> Evening reflection. Each step naturally leads to the next. The /harvest page closes the loop by prompting "Where did your attention actually land?"
**Implements BCTs:** Review behavior goals (1.5), Action planning (1.4)
**Calm tech alignment:** MEDIUM - the tunnel exists but is user-initiated, not forced.

### 4. Reduction (Category: Primary Task)
**Implementation:** Make checking "what's next" as frictionless as possible. Desktop widget (Tauri), PWA badge, or lock screen widget showing current phase + moments. Reduce the cost of awareness to near zero.
**Implements BCTs:** Prompts/cues (7.1), Self-monitoring (2.3)
**Calm tech alignment:** HIGH - peripheral awareness, not focal attention.

### 5. Suggestion (Category: Dialogue)
**Implementation:** Contextual, timely suggestions - not generic. "Morning has 3 moments, Afternoon is empty. Want to balance?" or "Your cycle has 4 unplaced Running moments." Offered at natural decision points, not interrupting.
**Implements BCTs:** Prompts/cues (7.1), Feedback on behavior (2.2)
**Calm tech alignment:** MEDIUM - suggestions must feel like gentle offers, not nagging.

---

## Mechanism of Action Summary

Three MoAs work together to close the feedback loop:

1. **Behavioral Cueing** - External triggers (calendar events, phase transitions, widgets) that activate planned behavior without requiring you to remember and open the app. This is the primary missing mechanism.

2. **Feedback Processes** - Comparing "what I intended" with "where I am now." Not outcome tracking - attention awareness. The /harvest reflection page and current-phase display serve this.

3. **Behavioral Regulation** - The meta-skill of adjusting future plans based on reflection. Cycle reviews and evening reflections build this capacity over time. Without it, planning never improves.

---

## Concrete Feedback Loop Options (Ranked by Calm Tech Alignment)

### Option A: Calendar Sync (Highest alignment)
**What:** One-way export of allocated moments to external calendar (Google Calendar, Apple Calendar, ICS).
**How it works:** Moments with day+phase become calendar events using PhaseConfig time windows. "Deep Work" appears as a 2-hour block in your Afternoon.
**BCTs activated:** Prompts/cues, Action planning
**PDPs activated:** Reminders, Real-world feel, Reduction
**Why it works:** Bridges Zenborg to the tool you already check throughout the day. Intentions become visible without opening Zenborg. Zero additional notification load.
**Tension with philosophy:** Low. Calendar blocks are passive. They don't nag, track, or measure. They simply make intentions visible.

### Option B: Harvest/Reflection Page (High alignment)
**What:** Build the /harvest page as a structured evening/weekly reflection.
**How it works:** Evening view shows today's allocated moments and asks "Where did your attention land?" Weekly view shows cycle budget progress. No completion checkboxes - just awareness prompts.
**BCTs activated:** Review behavior goals, Self-monitoring of behavior
**PDPs activated:** Self-monitoring, Tunneling
**Why it works:** Closes the REFLECT part of the loop. Learning requires looking back. The physical whiteboard system had this naturally (you SAW the magnets at end of day).
**Tension with philosophy:** Low. Reflection is user-initiated, not pushed. It's consciousness, not measurement.

### Option C: Phase-Aware Current State (Medium-high alignment)
**What:** Show current phase + intended moments prominently. Desktop widget (Tauri), PWA ambient display, or enhanced app header.
**How it works:** Glanceable display: "Afternoon | Deep Work, Team Sync, Read Paper" with phase emoji and area colors.
**BCTs activated:** Prompts/cues, Self-monitoring of behavior
**PDPs activated:** Self-monitoring, Reduction
**Why it works:** Answers "what should I be doing?" without cognitive effort. Peripheral awareness, not focal attention.
**Tension with philosophy:** Low-medium. It's information-on-demand, but a persistent widget could become attention-demanding.

### Option D: Morning Planning Notification (Medium alignment)
**What:** Single daily notification: "Where will you place your consciousness today?" Only fires if today has no allocated moments.
**How it works:** OS notification (Tauri) or PWA push notification. Tapping opens Zenborg to today's empty timeline.
**BCTs activated:** Prompts/cues, Goal setting (behavior), Habit formation
**PDPs activated:** Reminders, Suggestion
**Why it works:** Anchors the planning ritual itself. Makes daily allocation habitual.
**Tension with philosophy:** Medium. It's a notification - the thing calm tech avoids. But it's a single daily cue that supports consciousness, not consumption. The key: it's only sent when you HAVEN'T planned yet.

### Option E: Phase Transition Notifications (Lower alignment)
**What:** Brief notification when a new phase begins, listing what you intended for it.
**How it works:** "Afternoon: Deep Work, Team Sync" appears as OS notification at phase start time.
**BCTs activated:** Prompts/cues, Self-monitoring of behavior
**PDPs activated:** Reminders
**Why it works:** Delivers intention exactly when it's actionable.
**Tension with philosophy:** Medium-high. Multiple daily notifications risk becoming noise. Must be deeply optional and minimal.

---

## Considerations

### What the physical whiteboard had that Zenborg lacks
The original Attend system (magnets on whiteboard) had natural feedback loops: you **saw** your intentions every time you walked past the board. The board was in your physical environment - an ambient cue requiring zero effort. Zenborg, as a digital app, lacks this ambient presence. The calendar sync and widget options attempt to recreate this peripheral visibility.

### The "boring by design" tension
Zenborg's philosophy says mindful tech is boring. But boring != invisible. The physical whiteboard was boring AND visible. The challenge is making Zenborg visible without making it demanding. Calendar sync and widgets are the closest digital equivalent to "a whiteboard you walk past."

---

## Design Direction (from discussion)

- **Both gaps are equally painful** - the full PLAN -> PRACTICE -> REFLECT loop needs closing
- **Calendar use is moderate** - sync would help but isn't the sole solution
- **Notifications: opt-in intervention infrastructure** - not blanket notifications, but configurable behavioral interventions the user consciously enables. Think of it like prescribing specific cues to yourself rather than the app deciding what to push.

## Refined Recommendation

### Priority 1: Intervention Infrastructure (foundation)
Build a generic opt-in intervention system that other features plug into. An "intervention" is a behavioral cue the user consciously subscribes to. Examples:
- "Morning planning prompt" (fires once if today is unplanned)
- "Phase transition reminder" (fires at phase boundaries with intended moments)
- "Evening reflection nudge" (fires once in evening phase)

Each intervention has: trigger condition, delivery channel (OS notification, in-app, calendar event), enabled/disabled toggle, and a quiet "why this helps" explanation grounded in BCT reasoning.

This reframes notifications from "the app bothering you" to "I chose to install this behavioral cue for myself." Agency and consciousness over automation.

### Priority 2: Calendar Sync (PRACTICE bridge)
One-way export: Zenborg moments -> calendar events. Phase time windows become event times. Creates ambient visibility in a tool the user already sometimes checks.

### Priority 3: Harvest Page (REFLECT bridge)
Structured reflection - not metrics. Evening: "Where did your attention land?" Weekly: cycle budget awareness. The reflection itself is a moment of consciousness.

### Implementation Sequence
1. **Intervention infrastructure** (domain model + settings UI + Tauri notification channel)
2. **Calendar sync** (ICS export + optional CalDAV push)
3. **Harvest page** (reflection views + evening prompt intervention)
4. **Phase-aware current state** (widget/header enhancement)
