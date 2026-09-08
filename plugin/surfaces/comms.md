# Comms

The gardener's communication channels — email and messaging.

## Sources

| Source | Type | Probe tools |
|--------|------|-------------|
| hey | CLI | `hey box view imbox --markdown --limit 3`, `hey screener list --markdown` |
| gmail | MCP | `mcp__claude_ai_Gmail__search_threads`, `mcp__claude_ai_Gmail__list_labels` |
| slack | MCP | `mcp__claude_ai_Slack__slack_list_user_channels`, `mcp__claude_ai_Slack__slack_read_channel` |

## Key fields

### HEY email

- `box view imbox` — subject, sender, date, snippet per thread
- `screener list` — pending senders awaiting approve/deny
- Thread ID — needed for `hey thread read` and `hey reply`

### Gmail

- `search_threads` — threadId, subject, snippet, from, date, labelIds
- `list_labels` — id, name, type (system vs user) — needed to interpret labelIds
- `get_thread` — full thread with messages; probe with one thread only

### Slack

- `slack_list_user_channels` — channel id, name, is_member, num_members
- `slack_read_channel` — messages with user, text, timestamp, reactions
- `slack_search_public` — cross-channel search results

## Noise (skip on probe)

- Full email bodies — capture subject + snippet + sender only
- Slack message edit history, bot metadata
- Gmail internal label IDs for system labels (INBOX, SENT, etc.) — map to names

## Gotchas

- Route preference is `["hey", "gmail"]` — hey is primary email
- HEY uses "imbox" not "inbox" — the typo is intentional (HEY's term)
- Slack MCP tools use `slack_` prefix on all method names
- Gmail thread IDs and message IDs are different things — threads for listing, messages for replying
- HEY screener is unique to HEY — no gmail equivalent (gmail uses filters/spam instead)
