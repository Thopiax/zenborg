---
name: oracle-probe
description: >-
  Probe an oracle to see what it returns, capture a sample trace, and store it
  so future sessions can learn the output shape without re-probing. Use when
  the user says "/oracle-probe", "probe garmin", "what does hey return",
  "show me the garmin output", "trace the oracle", "sample the oracle",
  or when a skill needs to understand an unfamiliar oracle's output shape.
  Also use before building or debugging any skill that calls an oracle.
user-invocable: true
allowed-tools: [Bash, Read, Write, AskUserQuestion]
---

# Oracle probe

Run an oracle's commands or MCP tools, capture the output, and write a sample
trace to `~/.zenborg/oracles/traces/<oracle>/<capability>.sample.md` so any
future session can read the shape without re-probing.

## When to invoke

- "/oracle-probe", "/oracle-probe garmin", "/oracle-probe hey journal"
- "probe garmin", "what does hey return", "show me the garmin sleep output"
- "trace the oracle", "sample the oracle"
- Before building a skill that calls an oracle you haven't probed yet

## Workflow

### 1. Parse the argument

The user may pass:
- Nothing → list oracles from `~/.zenborg/oracles.json` and ask which to probe
- Oracle name → list that oracle's capabilities and ask which to probe
- Oracle + capability → probe that specific capability

### 2. Read the oracle config

```bash
cat ~/.zenborg/oracles.json
```

Identify the oracle's interface type:
- **CLI oracle** — has protocol objects with `check`, `read`, `write` commands
- **MCP oracle** — entry is `{}`, tools are `mcp__<oracle>__*`

### 3. Resolve what to probe

#### CLI oracles

For each command in the capability protocol (`read`, `inbox`, `search`, etc.),
run the `check` command first to verify availability. Then run the `read` or
primary query command with sensible defaults:
- Replace `$LIMIT` with `3` (just enough to see the shape)
- Replace `$QUERY` with a broad recent query
- Replace `$DATE_RANGE` with the last 7 days
- Replace `$BOX` with `imbox` (HEY's inbox)
- Do NOT run `write` commands — probe is read-only

#### MCP oracles

For MCP-based oracles, the tools self-describe. The probe needs to:
1. Identify the oracle's tool prefix: `mcp__<name>__`
2. Pick 2-3 representative read-only tools (list, get, summary-type calls)
3. Call them with today's date or minimal parameters
4. Capture the output shape

Known MCP oracle probes (extend as oracles are added):

| Oracle | Representative tools |
|--------|---------------------|
| garmin | `get_sleep_summary`, `get_body_battery`, `get_stats`, `get_heart_rates`, `get_training_readiness` |
| linear | `list_issues`, `list_projects`, `get_workspace` |
| slack | `slack_list_user_channels`, `slack_read_channel` |
| things | `get_today`, `get_inbox`, `get_areas` |

Use today's date for date-scoped tools. For list tools, use minimal limits.

### 4. Capture the trace

For each probed command/tool, record:

```markdown
## <command or tool name>

**Invoked:** `<exact command or tool call with params>`
**When:** <ISO timestamp>

### Output

\`\`\`json
<raw output, truncated to ~200 lines if massive>
\`\`\`

### Shape

- <field>: <type> — <what it means>
- ...
```

### 5. Write the sample file

```
~/.zenborg/oracles/traces/<oracle>/<capability>.sample.md
```

Structure:

```markdown
# <Oracle> — <capability> trace

Probed: <ISO date>
Oracle type: CLI | MCP

<per-command sections from step 4>

## Summary

Key fields a skill would need:
- ...

Gotchas:
- ...
```

Create the directory tree if it doesn't exist. Overwrite if a prior sample
exists (the point is freshness).

### 6. Report

Show the user:
- What was probed
- The output shape (the "Shape" section, not the raw dump)
- Where the trace was saved
- Any surprises (empty fields, unexpected formats, errors)

## Rules

- **Read-only.** Never call write/compose/reply/delete commands.
- **Minimal parameters.** Use the smallest query that reveals the shape.
- **Truncate large output.** Cap raw output at ~200 lines per command. The
  shape matters, not the volume.
- **Don't probe what's down.** If `check` fails, note it and move on.
- **One oracle at a time.** Probing all oracles is `/oracle-probe all` — run
  them sequentially, one trace file per capability.
- Traces live outside the git repo (`~/.zenborg/`), not in the codebase.
