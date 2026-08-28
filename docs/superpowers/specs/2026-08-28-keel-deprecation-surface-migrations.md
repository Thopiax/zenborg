# Keel deprecation — surface migrations

**Date:** 2026-08-28
**Status:** in progress (Phase 0 done, Phase A starting)

zenborg absorbs both keel and kairos. One repo, one system. When done,
keel and kairos are archived; zenborg is the monorepo for the garden,
its daemon, its plugin, its extension, and its integrations.

---

## Ground truth (verified 2026-08-28)

### Log streams — all four write to `~/.kairos/keel/log/`

| Surface | Pattern | Writer today | Code today |
|---|---|---|---|
| desktop | `YYYY-MM-DD.desktop.jsonl` | tray (orphan PID, deleted source) | zenborg `src-tauri/src/observer/` (parity-validated) |
| agent | `YYYY-MM-DD.agent.jsonl` | Claude Code hooks (`keel.mjs`) | `kairos/apps/plugin/` via `~/.keel/` symlinks → keel repo |
| browser | `YYYY-MM-DD.browser.jsonl` | extension → native host | `kairos/apps/extension/` + `kairos/apps/native-host/` |
| garmin | `YYYY-MM-DD.garmin.jsonl` | `garmin_sync.py` (launchd) | `kairos/integrations/garmin/` (plist points at keel path) |

### Runtime surfaces

| Surface | Owner today | Destination |
|---|---|---|
| Claude Code hooks (14 in settings.json) | keel repo via symlinks | zenborg `plugin/` |
| Chrome extension | kairos `apps/extension/` | zenborg `extension/` (later) |
| Native messaging host | kairos `apps/native-host/` | zenborg `native-host/` (later) |
| Garmin sync | kairos `integrations/garmin/` | zenborg `integrations/garmin/` (later) |
| Desktop observer | zenborg embedded + tray orphan | kairos-daemon sidecar |
| Scheduler | zenborg embedded (off) | kairos-daemon sidecar |
| Login item | zenborg `login_item.rs` | stays (registers daemon agent) |

### Completed work

- **Phase 0:** fork converged — kairos has both orphan keel commits (journal
  trace + HUD removal). Branch `chore/port-keel-orphans` pushed.
- **Parity diff:** observer matches tray output (kind set, app names,
  hasDuration pattern). Screen Recording granted.
- **Steps 5-6 of original migration:** readers flipped, tray source deleted
  (keel commits `29fd8e3`, `7c4b492`, 2026-08-21).

---

## Phase A — plugin moves to zenborg

### A1. Move `kairos/apps/plugin/` → `zenborg/plugin/`

Copy the plugin code into zenborg as a top-level `plugin/` directory:

```
zenborg/
├── plugin/                    # the agent surface (was kairos/apps/plugin/)
│   ├── keel.mjs               # hook handler
│   ├── core.mjs               # pure logic
│   ├── store.mjs              # I/O (LOG_DIR, vault reads)
│   ├── onboard.mjs            # first-run disclosure
│   ├── native-host.mjs        # host relay runner
│   ├── watchlist_scan.py      # watchlist candidate scanner
│   ├── hooks/
│   │   ├── hooks.json         # hook declarations
│   │   ├── fences.mts         # PreToolUse fence enforcement
│   │   └── gap-practice.mts   # UserPromptSubmit gap practice
│   ├── package.json
│   └── *.test.mjs
├── mcp-server/                # MCP tools (unchanged)
└── src-tauri/                 # the app
```

**Act:** copy files, run tests from zenborg, repoint `~/.keel/` symlinks
to `zenborg/plugin/`. Later: install as a proper Claude Code plugin
(plugin.json manifest), remove the 14 hand-wired settings.json entries.

**Dependencies:** none (Phase 0 convergence done).

**Risk:** broken symlink → silent agent-log gaps. Hooks fail-open so
sessions aren't blocked. Backout: repoint symlinks back.

**Size:** small (half day).

### A2. Browser + native host repoint

Re-run `native-host-install.mjs` from kairos to refresh the launcher.
Reload extension from kairos if currently loaded from keel. Delete stale
`tech.equanimi.keel.json` manifest.

**Size:** small. Parallel with A1.

### A3. Garmin plist path edit

Edit `com.equanimitech.keel.garmin` plist: program path →
`kairos/integrations/garmin/garmin_sync.py`. Bootout + bootstrap.

**Size:** tiny. Parallel with A1.

After Phase A: **no keel-repo code executes** except the tray orphan.

---

## Phase B — kairos-daemon sidecar

A headless binary that owns the desktop writer and the scheduler.
Quitting zenborg doesn't kill it. launchd keeps it alive.

### B1. Crate extraction

```
src-tauri/
├── Cargo.toml                       # [workspace] with members
├── crates/
│   ├── observer-core/               # pure lib, NO tauri dep
│   │   └── src/{domain.rs, writer.rs, config.rs, vault.rs}
│   └── kairos-daemon/               # bin crate
│       └── src/main.rs              # sensor loop + scheduler + CLI
└── src/                             # the app (uses observer-core for status)
```

`observer-core` takes `domain.rs` and `writer.rs` byte-for-byte (parity
argument preserved — the diff must remain trivially readable against the
tray's original). `kairos-daemon` takes `sensors.rs` with Tauri deps
replaced by plain structs.

Crates: `chrono`, `uuid`, `serde`, `serde_json`, `log`/`env_logger`,
`x-win`, `user-idle`, `notify` (for watch jobs). Same versions.

### B2. Runtime contract

- **Pause:** daemon polls `config.json` each tick for `paused: bool`.
  App writes the flag.
- **Single-writer guard:** advisory `flock` on `<log_dir>/.writer.lock`.
  A second instance exits loudly.
- **Permission-needed:** `log::warn!`; app reads status to surface it.

### B3. Bundling + install

- `externalBin` in `tauri.conf.json` (beside `zenborg-mcp`).
- Bundled plist at `Contents/Library/LaunchAgents/<bundle-id>.daemon.plist`
  with `KeepAlive: true`, `RunAtLoad: true`, `ProcessType: Background`.
- `SMAppService.agent(plistName:)` in `login_item.rs` (one new selector).
- Registration follows `mcp_install.rs` marker pattern.

### B4. Discovery

- **Registered?** `SMAppService` agent status.
- **Alive?** mtime of today's desktop JSONL — the log IS the heartbeat.

### B5. Cutover (one sitting, human-gated)

1. Build + install with sidecar → register agent → approve if asked.
2. Confirm sidecar writes to `log-zenborg` (parity default).
3. `launchctl bootout` the tray orphan.
4. Set `logDirName: "log"` → kickstart the agent.
5. Confirm `writer_started` in `keel/log/`.
6. Same PR: delete embedded observer from the app.

**Size:** big (2-3 days).

---

## Phase C — scheduler into daemon

Jobs (garmin interval + classify watch) move into
`desktop.scheduler.jobs` in the daemon's config. Bootout remaining
plists in the same breath.

**Size:** small.

---

## Phase D — archive keel + absorb remaining kairos

### D1. Archive keel

Straggler sweep → delete three plists → amend substrate.md →
`gh repo archive equanimitech/keel`.

### D2. Move remaining kairos into zenborg

| kairos path | zenborg destination |
|---|---|
| `apps/extension/` | `extension/` |
| `apps/native-host/` | `native-host/` |
| `integrations/garmin/` | `integrations/garmin/` |
| `kernel/` | `kernel/` |
| `docs/` | merge into `docs/` |

### D3. Archive kairos

`gh repo archive equanimitech/kairos`.

**Size:** medium (1-2 days for D2-D3).

---

## Ordering

```
Phase A (parallel, now)     → no keel code executes
Phase B (2-3 days)          → kairos-daemon built + cut over
Phase C (small, after B)    → scheduler in daemon
Phase D1 (after A+B+C)     → keel archived
Phase D2 (after D1)         → kairos absorbed into zenborg
Phase D3 (after D2)         → kairos archived
```

## Open decisions

1. **Plugin structure:** install zenborg as a Claude Code plugin (with
   `plugin.json` manifest) or keep the settings.json hook wiring?
   Plugin-proper is cleaner but requires understanding the plugin install
   mechanism.
2. **`keel/log/` → root `logs/`:** deferred. Requires all four writers +
   readers to move in one act. Not a blocker for archival.
