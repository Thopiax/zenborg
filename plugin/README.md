# keel agent — Claude Code surface

**Keep your attention from fragmenting, yours and your agent's, locally.**

keel is a single Node script wired into Claude Code's hook system. It makes your attention visible (where your focus goes, privately, on your own device), holds a session to one declared focus, and gates coding once you've signed off for the day. No daemon, no build, **fail-open**: if a hook errors, Claude keeps working.

## The goal: one drift, three timescales

Fragmentation is the enemy. It's the same drift (attention pulled off its line) showing up at three scales. keel is one keel against all three:

| Scale | What fragments | keel's answer |
|---|---|---|
| **Within a session** | your focus splinters across tools and tabs mid-task | a **session intention** holds the thread; a **granularity dial** holds response depth |
| **Across sessions** | continuity is lost, every session restarts cold | a **local activity log** is the connective tissue, your own baseline over time |
| **While AI works** | *two* things drift, not one | the **wind-down gate** keeps the *agent* on-thread (no 1am new-subsystem sprawl); the log keeps *you* honest about where you went while it generated |

The third row is the one nobody else sits in. Calm-tech tools watch the human; agent tools watch the model; keel sits on the seam, in the hook layer, watching both.

## What it does (observe-first)

keel accumulates attention signal now; steering comes later, built on your own baselines (a separate P5 module, gated behind ~21 days of personal data). v0 is mostly **see**, a little **steer**.

- **Activity log** (`keel log`, plus `SessionStart` / `UserPromptSubmit` hooks) writes every session event to `~/.keel/log/` as plain JSONL. Domains and timings, never prompts or content.
- **Intention** (`keel intention`) is the **active moment** — the one you set in zenborg, read from `$KAIROS_HOME/activeMoment.json`. It surfaces in the statusline HUD and holds the conversation to that thread. keel only reads it; when nothing is active the agent proposes one from today's board and sets it in zenborg once you agree. It retires itself at the 04:00 roll.
- **Granularity dial** (`keel granularity <level>`) sets how deep responses go this session. Floor is `tldr`. Levels: `sentence` (L1, claim only), `tldr` (L2, claim + mechanism), `page` (L3, worked example), `report` (L5, citations + edge cases).
- **Wind-down gate** (`PreToolUse` hook) denies Edit/Write/Bash once you've signed off, parked, or passed a backstop hour. **Breakpoint-armed** (engages at a turn boundary, never mid-edit), escapable only by a scarce **skip credit**. Conversation and journal/ritual writes (`allowPaths`) stay open, so closing the day is never blocked.

The gate is the surprise that made keel worth shipping: built to stop *you* coding past midnight, it ends up disciplining the *model*. Under the gate Claude declines to start new subsystems at 1am, decomposes instead, and tells you to bank it for morning. "It's late, wrap up" turns out to be an alignment primitive, a governor on bias-to-action exactly when judgment is worst, for the human and the agent both.

## Skills

The plugin ships the rituals that drive the vault, so they work in **any** session
rather than only inside the zenborg checkout.

**The garden** — operate on the vault through the zenborg MCP server:

| Skill | Scale | What it does |
|---|---|---|
| `sunrise` | day | Open the day: today's board, wilting habits, whispers |
| `sunset` | day | Close the day: what grew, unrecorded moments, seed tomorrow |
| `tend` | ad hoc | Batch-capture moments from natural language |
| `season` | cycle | Plan or review a cycle |
| `weather` | week | The weekly review |
| `weekly-moments-review` | week | Read back the week's moments |
| `onboarding` | once | First run |

**The session** — bracket a stretch of work:

| Skill | What it does |
|---|---|
| `close-up` | Close out a session: land the progress, release the intention, name the carry-over |
| `recap` | Read back a window without writing anything |

`close-up` is the write; `recap` is its read-only sibling. The session's *start* needs
no skill — the `SessionStart` hook already records it.

Skills and the tools they call now ship from one place and version together, which is
the point: a commit renaming an MCP tool updates its skill in the same diff.

## Privacy posture (load-bearing)

Everything stays on your machine. Events write to `~/.keel/log/`. Payloads carry domains and timings, never full URLs, prompts, or content. Nothing leaves the device.

## Onboarding

```bash
keel onboard                 # the disclosure, the preflight, and what is still open
keel onboard --disclosure    # re-read the disclosure at any time
```

Three parts, in the order a peer meets them.

**The disclosure**, shown once on the first run and re-readable on demand. What
is recorded, what is not, where it is written, and what inference does: the app
runs the model in-process, this plugin asks a model server on localhost, and a
hosted provider exists only behind a build feature that is off by default, so the
binary carries no path to one. Verified rather than asserted:
`nm target/debug/wake | grep -i anthropic` returns nothing on a default build.

**The preflight**, which names every grant *before* anything is asked, and marks
each one `ok`, `MISSING`, or `not measurable here`. The third status is the point.
Screen Recording is checked with the preflight variant that never prompts, and it
is reported against the process that ran the check, because macOS grants it per
application and rounding that up to "the app has it" would recreate exactly the
silent failure the check exists to catch. Login Items and Allow in Incognito are
named, with where to find them, and never guessed at.

**Two questions, and then it stops.** Not a taste call: every `RuleSpec` requires
`serves: DistalRef`, and a `DistalRef` is `{ cycleId, areaId }`. So the two
questions are the plots you want to be able to name, and what this season is for.
Nothing else is asked. The watchlist comes from `keel watchlist scan` once there
is history to scan; a fence is declared in a sentence when you want one.

Onboarding **writes nothing**. Areas and cycles have exactly one writer and it is
zenborg (`kernel/substrate.md`, rule 3), so the answers land there (the garden, or
the agent through zenborg's MCP) and onboarding reads the result back. Run it
again afterwards and it prints the `serves` a rule can now carry.

## Install (one time)

```bash
# from the repo root:
mkdir -p ~/.keel
ln -sf "$(pwd)/apps/plugin/keel.mjs"  ~/.keel/keel.mjs
ln -sf "$(pwd)/apps/plugin/core.mjs"  ~/.keel/core.mjs    # keel.mjs imports these
ln -sf "$(pwd)/apps/plugin/store.mjs" ~/.keel/store.mjs
cp -n apps/plugin/config.sample.json  ~/.keel/config.json
node ~/.keel/keel.mjs status
```

Merge into `~/.claude/settings.json` (create if absent):

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write|MultiEdit|NotebookEdit|Bash",
        "hooks": [ { "type": "command", "command": "node $HOME/.keel/keel.mjs hook pre-tool", "timeout": 30 } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node $HOME/.keel/keel.mjs hook user-submit", "timeout": 20 } ] }
    ],
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node $HOME/.keel/keel.mjs hook session-start", "timeout": 20 } ] }
    ]
  }
}
```

> The three `.mjs` files import each other, so symlink all three into `~/.keel` (the install does this). Alternatively, point the hook `command` at the repo path directly and skip the symlinks.

## Make it yours

Edit the `claude-code` target in `~/.keel/config.json`:
- **`driver`** — `windDown` / `hardStop` / `reset` (local `HH:MM`, the night wraps midnight), plus `backstop`, the late hour an un-signed-off night locks anyway (set `""` for pure sovereign, no clock lockdown).
- **`rules`** — what blocks: `tools`, `engagesAt` (the friction threshold), `arming` (`breakpoint` | `immediate`), `maxGraceMin`, and `allowPaths` (write targets exempt even under lockdown, default `~/journals`, `~/.keel`).
- **`skipBudget`** — `perMonth` + `cap` (credits carry over, capped).
- **`voice`** — **your words** for the nudges and the lockdown line. This is the point: keel says what *you'd* say.

## Use

- After you **sign off** (or `park`), or past the **backstop**, coding tools are denied until `reset`. Conversation still works, and so do journal/ritual writes.
- **Override** a night you judge worth it: `node ~/.keel/keel.mjs skip` (spends a credit). At 0 credits it holds until reset.
- `keel onboard`: the disclosure, the preflight, and the two questions.
- `keel status` — current friction, phase, credits. `keel intention` — show the active moment (set it in zenborg). `keel granularity` — see or set the session depth dial.
- **Remove the gate:** delete the `hooks` block from `~/.claude/settings.json`.

## Advanced: blocklist drogue

A sibling commitment device (`keel vice <on|off|skip|status>`) blocks vice sites via an `/etc/hosts` lock, raised alongside the coding gate on `signoff`. It needs a one-time root install (a small LaunchDaemon that reconciles `/etc/hosts` to keel's desired state, so a manual `off` mid-window self-heals). Optional and off by default. See `vice-install.sh`.

## Body state (garmin)

Body state is a separate writer and no longer lives here: see
`integrations/garmin/`. It polls Garmin Connect on its own launchd schedule and
appends to the same `~/.keel/log/`. It was moved out of this package on
2026-08-18 because this directory is a published Claude Code plugin, so
everything in it ships to every installer, and a Garmin poller is not part of
what they installed.

The same argument moved the native-messaging host out on 2026-08-21. It lives at
`apps/native-host/` now: `native-host.mjs`, its installer and its tests. It reads
the vault and relays to the browser extension, which makes it neither a Claude
Code surface nor extension code, and `keel native-host` is no longer a command
here; the launcher execs `apps/native-host/native-host.mjs` directly.

## Dev

```bash
cd apps/plugin
node --test      # unit tests (pure core)
pnpm typecheck   # JSDoc + // @ts-check (no build)
```

Pure domain lives in `core.mjs`, which mirrors rather than imports the extension's `apps/extension/modules/domain`, because this surface deploys standalone with no TypeScript imports; I/O in `store.mjs`; hook orchestration in `keel.mjs`.

## Not in v0 (later)

The P5 steering module (interventions on personal baselines, including the AI-wait-gap intervention that fills the third row of the table above), breakpoint-arming on desktop-OS signals (app switch/idle), the Tauri daemon, the focus MCP, and the shared `Friction` core (v0 inlines a linear ramp).
