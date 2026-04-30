# Areas as orchestration layer

Pitch — 2026-04-29. Source: docs/ideas/2026-04-29-areas-as-roundtable-orchestration.md

## Problem

The `/roundtable` skill currently maintains its own project manifest at `~/.claude/roundtable/projects.json` — a flat list of repo paths that is disconnected from Zenborg's area model. When a new project is started or renamed, two systems must be updated manually. More friction: there is no principled way to know which domain names, agent configurations, or principles documents belong to which life area. Context-switching between Themia, equanimitech, and personal work requires the engineer to carry that mapping in their head.

At the habit level the mismatch is sharper: habits like "zenborg dev" or "leggia sprint" are already bounded contexts — each owns exactly one repo, a specific set of MCP scopes, and a principles file. Nothing in Zenborg today captures that, so the roundtable skill cannot ask Zenborg "which repos belong to the current moment's area?" and get a useful answer. The mapping lives in documentation, in memory, or in ad-hoc shell scripts.

## Appetite

Big batch — 1 to 2 weeks.

Rationale: the schema change touches Area and possibly Habit (two entities with existing persistence, migration concerns, and test coverage), introduces a new MCP tool surface, and requires coordinating with the roundtable skill's consumption side. A small batch would force premature cuts that leave the two systems still out of sync.

## Solution

### Principles fit check (do this first)

The core risk flagged in the idea is whether adding `repoPaths`, `domainNames`, `agentIds`, `mcpScopes`, and `principlesPath` turns Zenborg into an IDE control plane and violates the pyramid.

Verdict: the fields are permitted under the principles, with one hard constraint. The data is purely descriptive and user-authored — it is the user declaring "this area governs these repos", not the system deciding it. No algorithmic curation. No auto-placement. No notifications. The context activation event (moment becomes "current" → agents load) is the one mechanism that needs care: if Zenborg *pushes* activation unsolicited it violates Peripheral Presence (Principle 4). The safe shape is: the harness *polls* or *watches* a file Zenborg writes; Zenborg does not call out. The user remains in control of whether the harness is running at all (Holistic Control, Principle 2).

The "inverse direction" (agent activity feeds wilting-habit detection) is out of scope for this pitch — it risks Downstream Allocation (Principle 9) and needs its own appetite conversation.

### Schema shape

Add an optional `context` block to the existing `Area` entity:

```typescript
interface AreaContext {
  repoPaths?: string[]       // absolute paths, user-authored
  domainNames?: string[]     // e.g. ["themia.pro", "leggia.app"]
  agentIds?: string[]        // CC agent slugs to activate
  mcpScopes?: string[]       // MCP server names to activate
  principlesPath?: string    // absolute path to a principles doc
}

interface Area {
  // ... existing fields unchanged ...
  context?: AreaContext      // optional; absent = no dev-tooling metadata
}
```

Add an optional field to `Habit`:

```typescript
interface Habit {
  // ... existing fields unchanged ...
  repoPath?: string          // overrides area.context.repoPaths when habit owns exactly one repo
}
```

Both fields are optional. An area without `context` behaves identically to today. A habit without `repoPath` inherits the area's `repoPaths`. This keeps the core intention-cultivation model untouched and the dev-tooling metadata strictly additive.

The `context` block lives in the vault JSON (`areas.json`) as a plain object. No new collection, no migration ceremony beyond adding optional keys.

### MCP tool surface

Expose two new read-only tools from the zenborg MCP server:

- `get_area_context(areaId)` — returns the `context` block for one area, or null if absent.
- `list_areas_with_context()` — returns all areas that have a non-empty `context` block, each with their full context. This replaces `~/.claude/roundtable/projects.json` as the manifest source for the roundtable skill.

No write tools in this pitch — context is edited via the existing area form or directly in the vault JSON. That preserves Modification Rights (Principle 3) and avoids building a secondary CRUD surface.

### Roundtable consumption

The roundtable skill replaces its `projects.json` read with a call to `list_areas_with_context()`. It then walks `repoPath/docs/{ideas,pain}` per entry as today. If a habit has `repoPath` set, the skill can include it as an additional scan target keyed under the area.

The pitch written back to `docs/pitches/` in the source repo is unchanged behavior.

### Context activation (the harness side — out of Zenborg scope)

Zenborg's responsibility is limited to writing a small `~/.zenborg/active-context.json` file whenever the timeline focus changes (current day/phase scroll position or keyboard navigation lands on a moment). The file contains the moment id, area id, and the resolved context block. The CC harness watches this file. Zenborg does not call out, does not spawn processes, does not know whether the harness is running. This satisfies Peripheral Presence: the harness visits Zenborg's signal; Zenborg does not visit the harness.

Format:

```json
{
  "momentId": "...",
  "areaId": "...",
  "context": { "repoPaths": [...], "agentIds": [...], ... },
  "updatedAt": "2026-04-29T..."
}
```

### UI

No new UI in Zenborg itself this batch. The `context` fields are power-user metadata. Edit them directly in the vault JSON or, optionally, add a collapsed "dev context" accordion to the area edit sheet in a follow-on pitch. Keeping UI out of this batch is the single biggest scope protector.

## Rabbit holes

- Building a UI for editing `context` fields inside Zenborg — do it in a follow-on once the schema and MCP tools are stable.
- The "inverse direction" (agent commits feed wilting detection) — separate pitch, needs principles review of its own. The idea file flags this; leave it flagged.
- Many-to-many area↔habit↔repo normalization — `Habit.repoPath` is a single optional string. Do not model a join table this batch; one repo per habit is the real use case.
- Auto-activation logic living inside Zenborg — the harness owns activation. Zenborg writes a file. Full stop.
- Global scope (`~/.claude/ideas`) not owned by any area — keep it outside the area system. A pseudo-area would pollute the intention-cultivation model with infrastructure concerns.
- Syncing `context` to Supabase in Phase 2 — `context` is developer-local metadata; it should probably stay vault-only even in Phase 2. Flag this before enabling sync.

## No-gos

- No completion tracking, no agent activity scores fed back into moment or habit state.
- No UI in this batch for editing context fields.
- No new collection or migration scripts — optional fields on existing entities only.
- No Zenborg-initiated outbound calls to agents, MCPs, or external services.
- No changes to the three-moments-per-phase constraint or any core intention-cultivation behavior.
- No `context` fields on Moment — area and habit are the right granularity; moment is ephemeral.
