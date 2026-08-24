# Connect prompts to habits (custom assistant instructions per moment)

**Date:** 2026-05-31
**Status:** captured (Things, Anytime → zenborg project)
**Source:** Things3, triaged 2026-05-31

> can we connect prompts to habits (so that every moment we have custom assistant instructions)

Attach a prompt / assistant-instruction template to each habit, so when a moment of that habit is active, the assistant runs with habit-specific context. Ties into the "capture quick commands that alter sessions" idea — habits become the unit that shapes the agent's behavior during their moments.

---

## Update 2026-07-02 — this generalizes into a live integration

The prompt-per-habit idea widens. The unit isn't just *instructions* — it's an **integration**: a habit (or its area) declares a read-seam to the MCP that owns its *actuals*. During that habit's rituals the assistant reads live from the bound system instead of from stored state.

- **Boat mapping.** zenborg is the **Sail** (`torchbearer/docs/2026-05-31-the-boat.md`) — it sets intention only; it does not store the passage. An integration lets a plot read its actuals live from the system that owns them (Garmin owns the body, calendar owns commitments) without copying them into the Sail.
- **First instance shipped (read-only).** `Fitness → Garmin`. Integrations are native: an area or habit declares its **sources** (systems it reads actuals from, e.g. Garmin) and **surfaces** (systems it writes to, e.g. Garmin workouts). No tag convention needed. Wired into `week-review` (planned-vs-actual reconciliation + a load note into lessons) and `week-planning` (readiness / TSB / sleep → the capacity read). Activity→habit matching is conversational (propose-from-stats: easy HR → recovery run, distance → long run, intervals → speed), never hardcoded.
- **Discipline: convention, not engine.** One binding declared on data, read by the rituals — no registry, no schema field, no per-habit generative UI yet. Those earn themselves at ~binding #3. Mirrors Torneio's `origin`: plant the primitive cheaply, enrich later, no rewrite.
- **Depends on reach.** The integration only pays off when the Sail is reachable off-device — see `2026-07-02-expo-mobile-client-and-device-sync.md`. Distribution is upstream.

### Integration targets (thresholds the ritual flags against)

An integration can carry **targets** — the intention side of a metric the bound system measures. The ritual reconciles actual vs. target.

Shape: a threshold on a field the bound system already exposes (e.g. a sleep-duration floor against Garmin's `get_sleep_summary` → `deep_sleep_seconds`). `week-review` flags the nights under target and reports the week's hit-rate.

The target *values* are personal and live in secretariat, not here — this doc only fixes the mechanism.
