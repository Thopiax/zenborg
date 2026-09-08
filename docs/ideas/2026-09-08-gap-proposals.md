# Gap Proposals

> Supersedes [2026-09-01-gap-practice-guidance](2026-09-01-gap-practice-guidance.md).
> Full pitch artifact: https://claude.ai/code/artifact/7d0b640c-f164-499f-8583-c98df5823a2e

**Appetite:** Big (phased over a cycle)

The garden knows what's dry and the gardener has told it what fits in the cracks.
The missing piece is the whisper — a daemon awareness layer that notices gaps, reads
context, and proposes what's thirsty.

## Core elements

- **Four gap types:** periodic (clock-driven micro-breaks like 20-20-20), micro (idle
  after a moment ends), transition (phase boundary with nothing planted), declared
  (user-initiated "I have time")
- **Thirst-based priority:** no explicit ranking — composite of wilting health, attitude
  (as SR ease factor), cycle plan deficit, recency, body battery
- **Oracle-routed toolshed:** Garmin schedules breathwork for now, lull-n-learn serves
  due cards/lessons, external links open apps (En Voiture Simone, etc.), timer overlay
  counts the seconds
- **Calendar pre-scheduling:** at sunrise, read calendar gaps, place thirstiest habits
  as tentative events the gardener can accept or dismiss
- **Context-aware moment opening:** daemon reads frontmost app, whispers "admin?" after
  10 min of unnamed activity — the inverse of gap proposals (names what you're doing,
  not what you could be doing)
- **Delivery:** macOS silent notifications via tauri-plugin-notification (wired, dormant).
  No badge, no sound, no action buttons. Timer overlay is the one in-app surface.

## Ship order (14 steps, each useful alone)

1. Thirst scoring function
2. Timer overlay
3. Transition gap detection in daemon
4. Silent notification delivery
5. `link` field on habits
6. Oracle routing
7. Garmin breathwork scheduling
8. lull-n-learn lesson proposals
9. Body battery integration
10. Calendar pre-scheduling
11. Context-aware moment opening
12. Periodic gap detection
13. Declared gap via MCP
14. Micro-gap detection (off by default)
