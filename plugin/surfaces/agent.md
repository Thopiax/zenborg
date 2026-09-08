# Agent

What the gardener's AI agents did — Claude Code sessions, commits, repos touched.

## Sources

| Source | Type | Probe method |
|--------|------|-------------|
| git | CLI | `git log --since=<date> --format='%H %aI %s' -- <repo>` across workspace |
| keel activity log | file | `~/.keel/activity.log` — timestamped session events |
| claude sessions | file | `~/.claude/projects/` session dirs — transcript metadata |

## Key fields

### Git log

- `commitHash`, `authorDate` (ISO), `subject` — per commit
- `repo` — derived from which `.git` dir the log came from
- `branch` — `git branch --show-current` at time of probe
- `filesChanged` — `git diff --stat` summary

### Keel activity log

- `timestamp` (epoch ms) — when the event happened
- `event` — session start/stop, command invoked, tool used
- `sessionId` — groups events into sessions
- `duration` — derived from first to last event per session

### Claude sessions

- Session directory name — contains project path hash
- Transcript files — too large to probe; extract metadata only (file count, last modified)

## Noise (skip on probe)

- Full commit diffs — capture stats only (`--stat`)
- Full transcripts — capture session count and recency only
- Keel raw tool-call output — capture event types and counts

## Gotchas

- Git log across `~/Developer/*/*/.git` must filter out `.claude/worktrees/` to avoid double-counting
- Keel activity log uses epoch ms timestamps — convert to local time with `strflocaltime`
- These are NOT oracles — they're local filesystem reads; the probe handles them differently
- Worktree commits share the parent repo's history; dedup by commit hash
