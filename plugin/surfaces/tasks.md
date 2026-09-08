# Tasks

The gardener's tracked work — issues, todos, projects.

## Sources

| Source | Type | Probe tools |
|--------|------|-------------|
| linear | MCP | `mcp__claude_ai_Linear__list_issues`, `mcp__claude_ai_Linear__list_projects`, `mcp__claude_ai_Linear__get_workspace` |
| things | MCP | `mcp__things-mcp__get_today`, `mcp__things-mcp__get_inbox`, `mcp__things-mcp__get_areas` |

## Key fields

### Linear

- `list_issues` — id, title, state (name + type), priority, assignee, dueDate, project
- `list_projects` — id, name, state, lead, targetDate
- `get_workspace` — name, teams, labels — the org-level context

### Things

- `get_today` — title, notes, tags, project, dueDate, checklistItems
- `get_inbox` — uncategorized captures waiting for processing
- `get_areas` — area name, active projects count

## Noise (skip on probe)

- Linear: full issue descriptions, comment threads, attachment URLs
- Things: internal UUIDs, creation timestamps, completion dates for done items

## Gotchas

- Linear is for Themia work; Things is for personal captures and equanimitech ideas
- Linear issues have team-scoped states — "In Progress" in one team ≠ another
- Things `get_today` includes both scheduled-for-today and deadline-today items
- zenborg issues go to GitHub Issues (`gh issue create`), not Linear or Things
