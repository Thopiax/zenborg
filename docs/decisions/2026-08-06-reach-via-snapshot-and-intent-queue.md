# Reach zenborg by snapshot and intent queue, not a server replica

**Date:** 2026-08-06
**Context:** `zenborg` — server reach. Supersedes D3 and D4 of
`docs/superpowers/specs/2026-08-03-kairos-reach-design.md`.

## Decision

Phone Claude reaches the garden through a hosted MCP backed by a **laptop-pushed
snapshot plus an append-only intent queue**, not a server-side replica of the vault.
The laptop stays the sole writer of every collection.

The server holds exactly two things: `snapshot.json` — the vault as the laptop last
knew it — and an `intents/` prefix holding one file per requested change,
`<ts>-<uuid>.json`. One file per intent, never an append to a shared file, so there
is no read-modify-write race and no lock. On wake the desktop app drains the queue,
replays each intent through the existing `mcp-server` handlers, writes the vault,
pushes a fresh snapshot, and deletes what it drained. MCP read tools return the
snapshot plus the pending intents.

Storage is Vercel Blob on the existing project. **No Postgres and no Redis** — no
Neon, no Upstash, no Supabase. There is no reconciliation module, because there is
nothing to reconcile.

## Rationale

D3 gave the server its own write authority. That bought exactly one thing: phone
edits visible on other surfaces — the `.ics` feed, a second device — while the
laptop is closed. What it cost was structural:

- **Two writers.** It knowingly broke substrate rule 3, which `kernel/substrate.md`
  calls *"not a small relaxation of this rule; it is a different and much more
  expensive design."*
- **A merge.** Two writers need last-write-wins per entity; LWW-per-path needs the
  record split (`<collection>/<id>.json`) as a hard prerequisite; that needs surgery
  on `read_collection`/`write_collection`, the `notify` watcher's granularity, and
  `SelfWriteTracker`'s echo suppression — the delicate one.
- **A database**, to hold the replica the merge operates on.

One writer deletes all three. Roughly two days against the seven costed for P1+P2.

**A CRDT is rejected explicitly.** One person, two devices, entities that already
carry `updatedAt`. Automerge or Yjs would install a merge engine to resolve
conflicts this design no longer generates.

**The price is accepted:** phone writes are queued, not live. The calendar feed will
not move, and a second device will not see the change, until the Mac wakes. That is
survivable because the phone client is an LLM reading text — it can hold "3 pending,
not yet applied" and reason about it, where a UI would need consistent state.

## Consequences

- **The record split stops being a prerequisite of sync.** `kernel/substrate.md`
  states that it is; the claim is true only of LWW-per-path and must be corrected.
  The split remains a legitimate future improvement, not a blocker.
- **Substrate rule 3 survives intact.** Keeping it was part of why this was chosen.
- **D1 (calendar read-only), D2 (shared domain package) and D5 (API-key auth)
  stand.** Only D3 and D4 fall.
- **P1 collapses** — no Neon schema, no reconciliation module, no property tests over
  concurrent edit sequences. P2 shrinks to re-pointing `mcp-server`'s vault module at
  Blob, plus the drain loop in the Tauri app.
- **Revert to the full replica if** the calendar needs to reflect phone edits while
  the laptop is closed for days. That is the single trigger, and a replica is
  strictly additive to a snapshot — nothing here forecloses it.
- **Still untested,** inherited from the spec's own risk section: whether editing via
  Claude on a phone is a good enough write path at all. Two weeks of real use decides
  that, not this document.
