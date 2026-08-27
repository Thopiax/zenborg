# Zenborg Garden Skills Plugin

**Date:** 2026-08-27
**Status:** shaped
**Appetite:** 2 weeks
**Companions:** `2026-07-02-goals-as-derived-state-skill-pyramid.md`, `2026-05-31-cycle-planning-mode.md`

## Problem

Zenborg has 62 MCP tools that speak in UUIDs and exact keys. Real usage is: tell Claude what happened or what's planned in natural language. Claude falls back to Google Calendar because it's one tool call there, versus 5+ tool calls to stitch IDs in Zenborg. People, places, and habits go untagged. The CycleDeck panel (drag-and-drop budget cards) is dead weight.

The board updates that matter -- "I ran at the park with Ana, then had lunch with Pedro" -- need entity resolution, habit matching, and batch planting in one pass.

## Solution

A Claude Code plugin with five garden-ritual skills and fuzzy entity resolution. The MCP stays as atomic CRUD; the skills are the agent-facing interface.

### Skills

| Skill | Metaphor | Grain | What it does |
|---|---|---|---|
| **tend** | tending | moment | Batch capture/update/move moments with entity resolution |
| **sunrise** | day opens | day | Survey the plots, plan what to plant today |
| **sunset** | day closes | day | What grew, what carries over, tomorrow's seed |
| **weather** | the broader pattern | week | Review + plan (one skill, two halves) |
| **season** | the whole garden | season | Cycle review + plan (attitudes, intentions) |

### Entity resolution (inside tend and all skills)

When the user says "coffee with Ana at the park":

1. **Habit matching** -- fuzzy search against habit names + aliases. "coffee" matches "Coffee" habit. Propose match, or offer to create.
2. **People matching** -- fuzzy search against people registry (name + key). "Ana" matches existing person. Propose tagging, or offer "add Ana as a person?"
3. **Place matching** -- fuzzy search against places registry (name + key + parent). "park" matches "Retiro Park". Propose tagging, or offer to create.

Fuzzy matching is pure string ops (exact > prefix > substring > Levenshtein distance <= 2). At ~200 entities per collection, full scan is sub-millisecond. Logic lives in a shared TS module the MCP server imports, exposed as `search_habits`, `search_people`, `search_places` tools.

### Tend in detail

Batch input: "I ran this morning, had coffee with Ana, then worked on Themia all afternoon" produces:

```
Resolved:
  1. Running       MORNING today  (habit: Running)
  2. Coffee        MORNING today  (habit: Coffee, person: Ana)
  3. Themia work   AFTERNOON today (area: Themia)

Unresolved:
  (none)

Plant all? [Y/n]
```

When entities are unresolved:
```
  "lunch with Pedro at the new cafe"

Resolved:
  1. Lunch  AFTERNOON today  (person: Pedro)

Proposals:
  - "the new cafe" not found in places. Add as a place? [name suggestion: "New Cafe"]
  - No habit matched for "lunch". Create a habit, or plant as standalone?
```

Defaults: day = today, phase = current (derived from time of day via phaseConfigs).

### Trigger aliases

| Skill | Triggers |
|---|---|
| tend | "I did X", "tomorrow I have X", "plant this", "add a moment", natural-language board updates, "/tend" |
| sunrise | "good morning", "bom dia", "what's on today", "open the day", "morning", "/sunrise" |
| sunset | "good night", "boa noite", "I'm done for the day", "calling it", "wrapping up", "/sunset" |
| weather | "review the week", "plan the week", "how was my week", "Monday planning", "/weather" |
| season | "plan the cycle", "review the cycle", "new season", "how's the garden", "/season" |

## Plugin structure

```
zenborg/
  .claude/
    skills/
      tend/skill.md
      sunrise/skill.md
      sunset/skill.md
      weather/skill.md
      season/skill.md
    plugin.json          (NEW -- makes zenborg a Claude Code plugin)
```

The plugin bundles the MCP server (already a Tauri sidecar) and the skills. Skills call the existing MCP tools; fuzzy resolution is added as new MCP tools (`search_habits`, `search_people`, `search_places`).

## Boundaries

### Must-have
- `tend` skill with batch capture, fuzzy entity resolution, and proposals
- Fuzzy search MCP tools for habits, people, places
- `sunrise` and `sunset` day bookends
- Trigger aliases on all skills

### Should-have
- `weather` (weekly) and `season` (cycle) skills
- Habit auto-detection from moment name (if no habit specified, suggest one)

### Off-sides
- CycleDeck removal (separate cleanup, not blocking)
- MCP tool consolidation (the 62 tools stay; skills are the new agent interface)
- In-app quick-capture UI (separate pitch; this is the agent layer)
- Google Calendar sync changes
- Goal derivation from attitudes (the 2026-07-02 vision; depends on this but not this cycle)

## Rabbit holes

- **Over-engineering fuzzy matching.** Levenshtein + prefix + substring is enough. No embeddings, no ML. The entity count is tiny.
- **Trying to parse arbitrary natural language.** The skill prompt tells Claude how to decompose; Claude does the NLP, the MCP does the resolution. Don't build a parser.
- **Merging skills into one mega-skill.** Five skills at five grains. Resist the urge to make `tend` do everything.

## No-gos

- No scoring, streaks, or completion tracking in any skill
- No push notifications or nagging
- No Google Calendar writes (Zenborg is the source of truth for moments)
- No automatic planting without user confirmation
