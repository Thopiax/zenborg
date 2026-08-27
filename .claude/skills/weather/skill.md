---
name: weather
description: >-
  Review and plan the week in Zenborg: look back at where attention landed and
  look ahead at what to plant. This skill should be used when the user says
  "review the week", "plan the week", "how was my week", "Monday planning",
  "weekly review", "what did I do this week", or invokes "/weather".
  Supersedes the weekly-moments-review skill with a unified review+plan ritual.
  Do NOT trigger for moment capture (use tend), day rituals (use sunrise/sunset),
  or cycle-level review (use season).
---

# Weather

The broader pattern. One skill, two halves: look back at the week that was, then look ahead at the week to come.

## When to invoke

Trigger phrases:
- "/weather", "review the week", "plan the week"
- "how was my week", "what did I do this week"
- "Monday planning", "weekly review"
- "where did my attention go this week"

Do NOT trigger for:
- Single-day operations (tend, sunrise, sunset)
- Cycle-level review or planning (season)
- A specific moment to capture (tend)

## Workflow

### Review half (look back)

#### 1. Determine the window

Default: the most recent 7 days ending today (inclusive). If the user names a different window, honor it.

#### 2. Fetch moments day-by-day

Call `mcp__zenborg__list_moments` with `{ "allocation": "allocated", "day": "YYYY-MM-DD" }` for each day in the window. Fire all 7 calls in parallel.

In parallel, also fetch:
- `mcp__zenborg__list_areas` to map areaId to name/emoji
- `mcp__zenborg__list_habits` to map habitId to name/attitude/rhythm
- `mcp__zenborg__list_wilting_habits` for the current wilting set

#### 3. Render the per-day breakdown

For each day:
```
## Monday 2026-08-25 (4)
  Morning:   Running, Coffee
  Afternoon: Themia work, Meeting
  Evening:   (empty)
```

Group by phase. Show moment names with emoji. Empty days render as `(0)`.

#### 4. Tally by area

Count moments per area across the window. Render a sorted table:
```
| Area      | Count |
|-----------|-------|
| Themia    | 8     |
| Fitness   | 5     |
| Social    | 3     |
```

#### 5. Surface patterns

Pull 3-5 neutral observations:
- Areas with zero moments (silence is data)
- Spikes or drops vs. typical baseline
- Habits allocated unusually often or not at all
- Tag clusters worth noting

One line per observation. No value judgments.

#### 6. Surface wilting habits

From `list_wilting_habits`, show the top 5-8 sorted by overdue ratio (not raw days). For each: emoji + name + days silent + rhythm + attitude.

### Plan half (look ahead)

#### 7. Transition to planning

If the user wants to plan:
- "Ready to look ahead?"
- "Want to plant the coming week?"

#### 8. Show the coming week's state

For the next 7 days, check what is already planted:
- Call `mcp__zenborg__list_moments` for each future day

Show what is already on the board and where the gaps are.

#### 9. Propose from wilting habits

Suggest wilting habits as candidates for the coming week. Present them as options, not prescriptions:
- "Running has been quiet for 8 days. Plant it somewhere this week?"
- "Reading rhythm is weekly x3, last seen 5 days ago."

#### 10. Plant on direction

If the user names moments to plant, hand off to the tend workflow. Use the specified days and phases.

## Rules

- Do NOT compute completion rates, streaks, or scores.
- Do NOT moralize. "Family had 1 moment" is data; "you neglected family" is not.
- Do NOT call `list_moments` without a `day` filter. The global list exceeds context budget.
- Silence is data. Zero-moment days are rendered, not hidden.
- Review and plan are distinct. Do not force planning after review. Offer it.
- The gardener decides what to tend. Surface context; never prescribe.

## Edge cases

- **Window spans a cycle boundary:** still render per-day. Route to season for cycle-level review.
- **No moments in the window:** render the empty structure, ask if the user wants to look further back.
- **User asks for multi-week window:** walk one week at a time, render each, then a roll-up tally.
