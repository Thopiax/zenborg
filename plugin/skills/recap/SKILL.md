---
name: recap
description: Read back what actually happened over a window — today, the last N days, since a date — by reconciling the plan (zenborg moments) against the trace (git across the workspace, the keel activity log, and the Garmin body log of sleep and workouts). Answers "what did we do", not "what should we do next". Use when Rafa says "/recap", "review what we've done today", "what did we do in the last 3 days", "review the moments left for today", "what happened this week", "catch me up on where we are", or opens a session mid-stream needing his own bearings. Distinct from close-up (which recaps in order to land the work and release the intention) and week-review (Friday's full ritual) — recap is the plain read, callable any time, ending in nothing but the picture.
user-invocable: true
allowed-tools: [Read, Bash, Skill]
---

# Recap

Give Rafa back his own days. He has been heads-down across three or four repos
and does not hold the shape of it — you reconstruct the shape from evidence and
hand it over.

**Read-only.** No commits, no zenborg writes, no journal appends, no stamps.
Recap ends when the picture lands. If it surfaces work, that is `/idea` or the
next session's problem.

---

## 1. Resolve the window

- *"today"* → the current **waking day** (04:00 roll — before 04:00, "today" is
  still yesterday's day). *"last 3 days"* → today and the two before it.
  *"this week"* → Monday to now.
- Anchor on the real date, and get the real clock: `date '+%F %H:%M'`. A recap
  at 18:30 that treats the afternoon as still open reads the day wrong.
- **Every timestamp you print must be local.** keel logs epoch ms; jq's `strftime`
  renders **UTC**, which in CEST puts every event two hours early and silently
  reassigns work from afternoon to morning. Use **`strflocaltime`** in jq, `date -r`
  in shell. Verify once at the top of any recap — render the first event both ways
  and confirm they differ by the expected offset before quoting a single time.

## 2. The plan — zenborg moments

```
mcp__zenborg__list_moments   filter: { day: "<YYYY-MM-DD>" }   # once per day in window
mcp__zenborg__get_active_moment
mcp__zenborg__list_areas                                       # resolve areaId → name
```

Moments carry `phase`, `emoji`, `tags`, and sometimes `refs` (Linear URLs — those
are the promised work, itemized). This is what he *said* he'd do.

## 3. The trace — git across the workspace

One sweep, all repos, worktrees deduped. Worktrees share history with their
parent and will double every commit if you don't filter them out:

```bash
for d in ~/Developer/*/*/.git; do
  r=$(dirname "$d"); case "$r" in *-wt-*|*-worktree-*) continue;; esac
  n=$(git -C "$r" log --since="<YYYY-MM-DD 00:00>" --all \
        --pretty=format:'%ad %s' --date=format:'%m-%d %H:%M' 2>/dev/null | sort -u | sort -r)
  [ -n "$n" ] && { echo "### $(basename $r)  ($(echo "$n" | wc -l | tr -d ' '))"; echo "$n" | head -25; echo; }
done
```

Sibling checkouts of one project (`zenborg`, `zenborg-schedule`, `zenborg-garmin-backing`)
also duplicate — add them to the `case` filter, or dedupe by identical subject lines.
`--all` catches branches never merged; without it a day spent on a feature branch
looks empty.

## 4. The attention — the keel log

`~/.keel/log/<YYYY-MM-DD>.{desktop,browser,agent}.jsonl` (Garmin is beat 5).

**Open the agent log — it is the only source that attributes work to a project.**
Every event carries `payload.cwd`, so session wall-clock and Rafa's own prompts
split by repo. The desktop log has app names without directories; iTerm2's hours
are unattributable there and attributable here.

```bash
jq -r '"\(.ts) \(.payload.cwd // "?")"' <day>.agent.jsonl | sort -n |
awk '{if(p!=""){d=($1-pt)/60000; if(d>0&&d<5) a[p]+=d} p=$2; pt=$1}
     END{for(k in a) printf "%6.1f min  %s\n", a[k], k}' | sort -rn | head
jq -r 'select(.kind=="prompt") | .payload.cwd' <day>.agent.jsonl | sort | uniq -c | sort -rn
```

- **`prompt` events are Rafa; `tool_dispatched` is Claude.** Count prompts to see
  where *he* was, elapsed spans to see where the work sat. Never present tool
  counts as his effort.
- **Roll worktree and subdirectory cwds up to their repo** before totalling, or one
  project fragments into fifteen rows.
- **Coverage is partial and must be checked, not assumed.** Compare the agent log's
  first event against the desktop log's — if it starts hours later, the morning is
  simply unrecorded. And a repo with commits but no cwd in the log was worked
  somewhere this instrument doesn't reach. Say so; do not read the gap as idleness.
- **`cwd` is where the session sat, not where the work landed.** Subagents inherit
  the parent's cwd, so a keel session that dispatches agents across seven other
  repos logs every event as keel. When commits appear in a repo the log never
  names, look for `subagent_stop` in that window — the work was done from
  somewhere else. Reconcile against git before crediting a project with zero.

**Slack, for Themia.** Internal comms live there, so Themia work often shows up as
Slack dwell in the desktop log rather than as a domain. It arrives in micro-visits —
twenty switches totalling two minutes — so count switches as *presence*, not
duration.

**Never trust `durationMs`.** The first `app_switched` after a restart carries the
whole gap — a 17-hour "session" in Finder. Derive dwell from consecutive
timestamps and cap the gap instead:

```bash
jq -r 'select(.kind=="app_switched") | "\(.ts) \(.payload.app_name)"' <file> |
awk '{if(p!=""){d=($1-pt)/60000; if(d>0 && d<30) a[p]+=d} p=$2; pt=$1}
     END{for(k in a) printf "%6.0f min  %s\n", a[k], k}' | sort -rn | head
```

The rest of `packages/domain/docs/read-side-pitfalls.md` applies: `tool_dispatched`
is Claude's action not Rafa's, and **zero is not the same as missing**.

## 5. The body — the Garmin log

`~/.keel/log/<YYYY-MM-DD>.garmin.jsonl`. **Read this before judging any Fitness
moment.** It is the only writer that sees Rafa rather than his machines, so it is
the one place a moment with no screen-trace can still have run.

Two kinds, and only two — don't reach for body battery or stress; the poller
doesn't emit them:

```bash
cd ~/.keel/log
jq -r 'select(.kind=="workout_completed") | "\(.ts/1000|strflocaltime("%m-%d %H:%M"))  \(.payload.activityType)  moving \(.payload.movingDurationS/60|floor)min  elapsed \(.durationMs/60000|floor)min  \(.payload.calories)cal  hr \(.payload.avgHrBpm)/\(.payload.maxHrBpm)"' <days>.garmin.jsonl
jq -r 'select(.kind=="sleep_recorded") | "\(.payload.calendarDate)  score \(.payload.sleepScore)  deep \(.payload.deepS/60|floor)m rem \(.payload.remS/60|floor)m  rhr \(.payload.avgHrBpm)"' <days>.garmin.jsonl
```

Reading them:

- **`movingDurationS` against elapsed `durationMs` is the session's shape.** 7 min
  moving inside 68 min elapsed is not a short workout — it is sets spread across
  an afternoon between other things. Say that, don't average it away.
- **`sleep_recorded` is keyed by `calendarDate` = the morning he woke**, so it
  describes the night *before* that day's work. Don't attribute it to the evening.
- **~20 min sync lag.** A workout in the last half-hour may not be there yet — that
  absence is latency, not rest.
- **History starts 2026-06-26.** Earlier windows return nothing; that is missing,
  never zero.

**Covariate, not tide.** Report the body beside the day, never as its cause. "Slept
7.6h, scored 85; one strength session at 13:30" — not "the short night explains the
afternoon." He is the one who gets to draw that line, if he draws it at all.

## 6. Ask what nothing recorded

**Do this before concluding anything didn't happen** — and only after beats 3–5 have
come up empty for that moment. No log holds a phone call, a walk, a book, a
conversation, thinking in the shower. A moment with no trace is *unevidenced*,
never *unrun*.

Name the still-untraced moments and ask plainly: *"Nothing anywhere for the staging
release — did that happen off-screen?"* Fold his answer in as fact. He knows his
day; you only have its shadow.

## 7. Hand it back

Coarse first (`semantic-zoom`), zoom on request.

- **Movements, not commits.** Group the trace into 3–5 spans of real work with
  times, and name what each one *was*. "13:51–17:54 — keel, the intention
  rewiring" beats fifteen commit subjects. For a multi-day window, find the arc
  that crosses days and lead with it.
- **Plan against trace.** Which moments ran, which didn't, and — for a moment
  carrying `refs` — which of its items actually landed. A moment can be 1-of-8 done.
- **Time on a project is a sum across surfaces, never one number.** For Themia that
  is Slack, the agent log's `cwd`, its own domains (themia.pro, linear.app,
  posthog, and the admin tools — documenso, docaposte), and the commit window.
  Quote a range with its floor and ceiling named; a single figure from git alone
  will be wrong and will read as authoritative.
- **Attention in one line.** Two or three apps and their minutes. No more.
- **The body in one line**, beside the day and never explaining it — the night he
  woke from, and any session with its real shape.
- **Where the log lied**, if it did — one line. He is building the instrument;
  its failures are signal.
- **No guilt, no pep talk.** "The staging release was planned and never opened"
  is the whole sentence. He decides what that means.

## Rules

- **Read-only.** Recap never writes. Landing the work is `close-up`.
- **Evidence or silence.** Every claim traces to a commit, an event, a moment, or
  something Rafa just told you. Never narrate a plausible day.
- **Absence is a question, not a verdict.** Check the body log, then ask. Beats 5–6.
- **The body is a covariate.** Never the explanation for a day's output.
- **Dedupe before counting.** Worktrees and sibling checkouts inflate everything.
- **Synthesize, don't transcribe.** A commit list is the raw material, not the answer.

## Composition

- `close-up` is the write to this skill's read: recap shows the window, close-up
  lands it (Linear or journal) and releases the intention. Call recap from there
  rather than re-deriving the day.
- `week-review` (Friday) and `sign-on` (morning) do the same read at their own
  cadence; recap is the version with no ritual attached.
- Renders through `semantic-zoom`. Spillover → `/idea` · `/pain` · `/question`.
