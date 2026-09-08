---
name: oracle-wizard
description: >-
  Create a new oracle integration for zenborg — walk through defining an external
  system's protocol (CLI commands or MCP tools), add it to oracles.json, and wire
  up capability routes. Use when the user says "/oracle-wizard", "add an oracle",
  "add an integration", "integrate X with zenborg", "connect X to the garden",
  or wants to extend zenborg with a new external system.
user-invocable: true
allowed-tools: [Bash, Read, Write]
---

# Oracle wizard

Add a new external system to `~/.zenborg/oracles.json` in one conversation.

## Capability protocols

Each capability a CLI oracle provides is a protocol object with commands:

| Capability | Fields | Content shape |
|------------|--------|---------------|
| `journal` | `check`, `read` (optional), `write` | markdown |
| `body` | usually MCP — no CLI protocol needed | — |
| `tasks` | `check`, `write` | plain text |
| `messaging` | usually MCP — no CLI protocol needed | — |

Custom capabilities are allowed — the user defines the protocol shape.

`$CONTENT` in commands is a placeholder replaced by the calling skill at
runtime with the actual markdown/text payload.

## Workflow

### 1. Name

Ask what external system to integrate. Use a short lowercase name (e.g.
`obsidian`, `logseq`, `dayone`).

### 2. Capabilities

Ask what the oracle provides. Show the table above. Multiple capabilities
are fine.

### 3. Interface type

For each capability, ask: CLI-based or MCP-based?

- **MCP:** the oracle entry stays `{}` — MCP tools self-describe. Note the
  tool prefix (e.g. `mcp__obsidian__*`) for the user's reference, but it
  doesn't go in the config.
- **CLI:** ask for the commands:
  - `check` — how to verify the tool is available (e.g. `which obsidian-cli`)
  - `read` — how to read current state (optional, not all integrations read)
  - `write` — how to write/append content. Use `$CONTENT` as the placeholder.

### 4. Validate

Run each `check` command to verify the tool is actually available. If it
fails, warn — don't block. The user may be setting up the config before
installing the tool.

### 5. Read current config

```bash
cat ~/.zenborg/oracles.json
```

If the oracle name already exists, ask before overwriting.

### 6. Write

Add the new oracle to `oracles.json` under `oracles.<name>`.

### 7. Route

If the new oracle provides a capability that already has a `routes` entry
(e.g. `journal`), ask where in the preference chain to insert it:
- Before all existing oracles (new primary)
- After all existing oracles (new fallback)
- At a specific position

If no route exists for the capability and >1 oracle provides it, create one.

### 8. Confirm

Show the final `oracles.json` diff and confirm what was added.

## Rules

- Don't modify skill files — the wizard only writes `oracles.json`.
- Skills read the protocol from the config at runtime; no skill edits needed
  for a new oracle to work.
- Preserve unknown fields in `oracles.json` — other tools may have added keys.
