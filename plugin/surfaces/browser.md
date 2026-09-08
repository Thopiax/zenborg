# Browser

What the gardener does in the browser — sites visited, focus patterns, fence enforcement.

## Sources

| Source | Type | Probe method |
|--------|------|-------------|
| zenborg browser gate | app internal | `mcp__zenborg__get_fence`, `mcp__zenborg__get_boundaries` |
| zenborg browser transform | app internal | `mcp__zenborg__set_browser_transform` (write — probe reads fence state only) |
| screen time (macOS) | CLI | `defaults read` or third-party tool (not yet wired as oracle) |

## Key fields

### Browser gate (`get_fence`, `get_boundaries`)

- `fenceId` — which fence is active
- `blockedDomains` — what's blocked right now
- `allowedDomains` — what's permitted
- `activeRule` — which intervention rule triggered the fence
- `boundaries` — the full set of configured fences with activation conditions

### Screen time (future — no oracle wired yet)

- App name, domain, foreground duration per session
- Category (social, productivity, entertainment)
- Daily totals by category

## Noise (skip on probe)

- Internal IPC details between the browser extension and Tauri
- Extension version metadata

## Gotchas

- Browser data is zenborg-internal, not an oracle — probe reads it via MCP tools
- No duration tracking yet — fences show what's blocked, not time spent
- Screen time API is macOS-specific and requires permissions; may never be an oracle
