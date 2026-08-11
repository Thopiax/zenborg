# Kairos Reach — Design

**Date:** 2026-08-03
**Status:** ⚠️ SUPERSEDED same day — do not build from this. Rewrite pending.
**Problem owner:** Rafa

> ## Why this is superseded
>
> Written at 18:00, invalidated by 19:45. Kept for the rejected-options record, which
> is still sound. Three reversals:
>
> **1. Calendar is display AND source — never a write target.** D1 correctly rejected
> writing *to* the calendar (reactivity, imported alerts, constraint erosion). It
> wrongly discarded reading *from* it. Ingesting existing events as `tentative`
> moments is a different mechanism with none of those costs — and it is the actual
> fix for non-use.
>
> **2. The real cause of abandonment is authoring cost, not reach.** The tool demands
> input it should derive. Life already emits traces — calendar events, Things tasks,
> Garmin activities, location. The garden should fill itself and ask to be curated.
> `Moment.status: tentative | accepted` moves from "out of scope" to the centre.
>
> **3. Ingestion goes where each source actually lives — mostly local.** Calendar via
> **EventKit in a Swift sidecar** (the repo already bundles sidecars), which removes
> OAuth, Google verification, the 100-user cap, watch channels, and token storage.
> Things is local-only. But **HealthKit does not exist on macOS** — health/Garmin
> must be server-side, via Strava webhooks rather than Garmin's partner-gated API.
> Ingestion therefore needs the Mac online periodically; closing that gap is the
> iOS app's real purpose.
>
> **Also decided after this was written:** folder substrate over Postgres-as-truth,
> with local files canonical and the server holding a mirror; **Supabase-backed
> server store for sync — git/GitHub explicitly rejected** (`files` +
> `file_versions` for history, LWW per path, Supabase over Neon for Auth + RLS);
> one Next.js backend serving `/api/sync`, `/api/mcp`, `/api/ics`; retrofit the
> existing repo rather than rebuild; rename zenborg → kairos in place; buy-once
> native apps rather than subscription; nomad-first positioning; TRMNL deleted; the
> 3-per-phase cap deleted.
>
> **Superseded again on 2026-08-06 — D3 and D4 specifically.** The server holds no
> replica and does no writing. A laptop-pushed snapshot plus an append-only intent
> queue replaces it: the laptop stays the sole writer, so there is no LWW merge, no
> reconciliation module, and no database — no Neon, no Upstash, no Supabase. Storage
> is Vercel Blob. The price is that phone writes are queued rather than live. See
> [`docs/decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md`](../../decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md).
> **Do not build P1 as costed below.**
>
> **Still valid below:** the D1 reasoning against calendar-as-write-surface, D2
> (shared domain package) and D5 (API-key auth), the rejected-options record for
> Google Calendar / CalDAV / Elixir, and the feed-URL secret handling.

---

## Problem

Zenborg's state lives in a local JSON vault (`~/.zenborg`) reachable only from the
Tauri desktop app. Every other tool in the system — keel, secretariat, penceive —
is reachable from any device. Zenborg is not.

The consequence is not theoretical. The garden has been unplanted since 2026-07-22
and no cycle is running. The `2026-07-02` capture names the cause directly: *"couldn't
trim the Sail with no laptop."*

**Reach is the blocker.** Not features, not sync fidelity, not mobile UI. Being able
to see and change moments without opening a specific laptop.

---

## Decisions

Each decision records what was rejected and why, so a later reader can tell which
constraints are load-bearing and which were preference.

### D1 — Calendar is a display surface, not an input surface

Moments publish as a read-only `.ics` feed. Writes happen through the app or MCP.

Rejected: **Google Calendar two-way.** Costs OAuth verification (4wk–6mo), a
**non-resettable 100-user lifetime cap** on the GCP project, watch-channel lifecycle
with renewal cron, `410 GONE` resync recovery, and echo suppression. Buys exactly
one thing: native drag-to-edit.

Rejected: **self-hosted CalDAV.** No mature CalDAV *server* library exists for
Node/TS — `ts-caldav`, `tsdav`, `dav` are all clients. Server-side means IT Hit
(commercial), a niche Koa server, or leaving the stack for SabreDAV/Radicale. And
it does *not* deliver freshness: iOS CalDAV push requires Apple's non-standard push
extensions and an APNs relationship; without them it falls back to ~15-minute fetch —
the same as a well-configured ICS subscription.

Three further reasons, from the equanimitech pass:

- **Strategic Friction** (→ Non-reactivity, ES-16). Drag-to-reschedule makes the
  *reactive* path frictionless — "don't feel like running, drag it to evening."
  That couples wanting to hedonic tone, which the discipline exists to decouple.
  Correct polarity: seeing commitments is frictionless, changing them requires
  articulation.
- **Holistic Production** (Franklin, Layer 2). Articulating a moment in 1–3 words
  *is* the skill the product teaches. Dragging a box requires no judgment and
  builds nothing.
- **Peripheral Presence.** Google Calendar and Apple Calendar both apply **default
  alerts** to synced events. Two-way sync imports a notification surface into a
  product whose red lines forbid notifications. A read-only feed cannot notify —
  the property is structural, not configured.

**Load-bearing condition:** this is only principled if the write path is genuinely
good. If MCP-on-phone is clunky, "read-only" is a missing feature wearing a
manifesto. The MCP server is therefore a primary deliverable, not a later phase.

### D2 — Shared TypeScript domain package

`packages/domain` holds entities, value objects, and domain services as pure TS.
Server, desktop, and mobile all import it.

Rejected: **Elixir/Phoenix server.** Genuine merits — `hermes_mcp` (v0.14.1, client
and server, Phoenix integration, production use at CloudWalk), and the `ICalendar`
package registering as a Phoenix format encoder, which is the cleanest ICS story in
any ecosystem. But Elixir cannot run inside a React Native app. Choosing it means
either duplicating the domain in two languages or giving up client-side offline
validation. The BEAM's real strengths — supervision, Channels, distribution,
soft-realtime — are unnecessary at one user with a 15-minute delay budget.

This confirms the direction already captured on 2026-07-02: *"extract domain + store
into a shared workspace package,"* monorepo shaped like enurgy.

**What would reverse this:** deciding clients should be thin (no offline editing,
server is the brain). Then Phoenix + LiveView + Channels becomes the better tool and
domain-sharing stops mattering.

### D3 — Server and laptop each hold a full replica; reconcile on wake

The laptop is not the sole writer. The server accepts and reflects writes on its own.

This is required by the motivating scenario. If the vault is sole truth, phone writes
queue and nothing reflects until the Mac opens — the Marseille failure, unfixed.

Local-First Ownership is preserved in the **git sense**: a complete local copy exists
and you can walk away at any time. The principle's test is *"would you lose anything
if the servers shut down"* — you would not.

Reconciliation is per-entity last-write-wins on `updatedAt`. This is cheap (~100 LOC)
*because* D1 eliminated the two-writer problem — there is no third party mutating
state behind our back.

### D4 — Vercel, Next.js, Neon, Upstash

Stay on the existing Vercel project. Neon Postgres for the replica. Upstash Redis
(already provisioned) for the write queue, sync locks, and rate limiting.

Rejected: **Supabase.** Chosen earlier to serve Google OAuth and multi-tenant auth;
both disappeared with D1. Rejected: **Railway/Fly.** Correct hosts for a persistent
Elixir process, unnecessary once D2 removed the persistent process.

### D5 — Multi-tenant schema, API-key auth, no login screen yet

Every table carries `user_id` from day one. Authentication is a per-user API key —
the pattern the TRMNL relay already uses. No auth provider yet.

Rationale: the only clients are machines (desktop app, MCP, calendar subscription).
API keys are real auth for machine clients. A login screen is needed when a *human*
web UI exists, which it does not — the desktop app is the UI. Adding Clerk later to
a schema that already carries `user_id` is ordinary work.

**Revisit when:** a hosted web UI or self-serve signup is wanted.

---

## Architecture

```
INPUT                                              DISPLAY
┌────────────────────────┐                   ┌──────────────────────────┐
│ Claude on phone        │                   │ iOS / macOS Calendar     │
│   → remote MCP         │──┐                │ subscribed .ics          │
│ Zenborg desktop (Tauri)│  │                │ read-only, every device  │
│ Zenborg mobile (later) │  │                └────────────▲─────────────┘
└────────────────────────┘  │                             │
                            ▼                             │
                  ┌───────────────────────────────────────┴──────┐
                  │  SERVER  (Next.js on Vercel)                  │
                  │    /api/mcp        streamable HTTP            │
                  │    /api/ics/[key]  RFC 5545 feed              │
                  │    /api/sync       push / pull replica        │
                  │                                               │
                  │  Neon Postgres — replica (multi-tenant)       │
                  │  Upstash Redis — queue, locks, rate limits    │
                  └───────────────────────┬───────────────────────┘
                                          │  LWW on updatedAt
                                          ▼
                  ┌──────────────────────────────────────────────┐
                  │  LAPTOP  — Tauri app                          │
                  │  ~/.zenborg vault (full replica)              │
                  └──────────────────────────────────────────────┘

                  packages/domain (pure TS) ──▶ imported by all three
```

### Monorepo shape

```
packages/
  domain/          entities, value-objects, domain services — pure TS, no framework
  ics/             Moment[] → RFC 5545 serializer
apps/
  server/          Next.js — MCP, ICS, sync
  desktop/         Tauri (current src/, thinned)
  mobile/          Expo (later)
```

---

## Components

**`packages/domain`** — extracted from today's `src/domain` essentially as-is. Nine
entities (Area, Cycle, CyclePlan, DayNote, Habit, HistoryEntry, Meta, MetricLog,
Moment), pure TS, no framework coupling. Test coverage is good and travels with the
move: five entities (Area, Cycle, CyclePlan, Habit, Moment), the Phase and Rhythm
value objects, and four domain services (Attitude, CycleDate, HabitHealth,
TrmnlFormatter). Untested entities are the passive records — DayNote, HistoryEntry,
Meta, MetricLog — worth filling before the server depends on them, but not blockers.
This is a move, not a rewrite.

**`packages/ics`** — pure function `Moment[] → string`. Phase bands map to times via
`PhaseConfig`; area becomes `CATEGORIES`. Emits **no** `VALARM` components under any
circumstance — that is the structural guarantee behind D1's Peripheral Presence
argument, and it needs a test asserting the absence.

> `STATUS:TENTATIVE` / `STATUS:CONFIRMED` is the natural home for the
> tentative-vs-accepted distinction from the Kairos mapping, but `Moment` has **no
> such field today**. Adding it is a domain change, deliberately out of scope here.
> The serializer emits `STATUS:CONFIRMED` for all moments until that field exists.

**`apps/server/api/ics/[key]`** — looks up the user by feed key, renders their
moments, returns `text/calendar`. Cached; regenerated on sync push.

**`apps/server/api/mcp`** — the existing `mcp-server/` tools, re-pointed from the
local vault to the Postgres replica. Tool surface stays identical so Claude Code and
phone Claude see the same API.

**`apps/server/api/sync`** — push (client sends changed entities since `t`) and pull
(server returns changed entities since `t`). Per-entity LWW on `updatedAt`.

**Reconciliation** — single module, exhaustively tested. Not a place to be clever.

---

## Data flow

**Write from phone (laptop closed).** Claude → MCP → validate against
`packages/domain` → write to Postgres → invalidate ICS cache. Visible in calendar
within one refresh interval. Laptop pulls and reconciles when it next wakes.

**Write from desktop.** App → vault (immediate, offline-capable) → background push
to `/api/sync` → server merges → ICS cache invalidated.

**Read anywhere.** Calendar subscription pulls the feed. Add the subscription in
**macOS Calendar with "Add to: iCloud"** so iCloud fetches server-side and pushes to
all devices — far fresher than iOS fetching alone, and it works with the Mac closed.

**Conflict.** Same moment edited on both sides while disconnected: LWW on
`updatedAt`, last writer wins, no prompt. Acceptable at single-user scale; revisit
only if it ever actually bites.

---

## Sub-projects

| # | Scope | Delivers | Size |
|---|---|---|---|
| **P0** | Extract `packages/domain` + `packages/ics`; widen the TRMNL push payload from *today's current phase* to the full moment set; add `/api/ics/[key]` reading the same Redis key; key rotation endpoint | Moments visible on phone + calendar | ~2 days |
| **P1** | Neon schema, `/api/sync`, reconciliation module, desktop push/pull | Server holds a real replica | ~3 days |
| **P2** | Re-point `mcp-server` at the replica, deploy as `/api/mcp`, per-user keys | Phone Claude can CRUD — closes the Marseille scenario | ~3 days |
| **P3** | Expo app against the same domain package and sync API | Native mobile | later, separate spec |

P0 ships standalone and is a strict subset of P1's work — no throwaway code.

> **P0 gotcha:** the relay currently stores its payload with a **24-hour TTL**
> (`redis.set(..., { ex: 86400 })`). Left as-is, the feed silently empties after a
> day with the laptop closed — precisely the trip scenario this design exists to fix.
> P0 must raise or remove that TTL. P1 makes it moot by moving state to Postgres.

---

## Testing

- `packages/domain` — existing tests move with it, unchanged.
- `packages/ics` — golden-file tests against real vault fixtures; an explicit
  assertion that **no `VALARM` is ever emitted**; validation against an RFC 5545
  parser.
- Reconciliation — property tests over concurrent edit sequences; LWW convergence
  must hold regardless of arrival order.
- Sync — round-trip integration test: desktop write → push → pull → identical state.

---

## Risks

**The write path is not good enough.** D1's whole justification collapses if editing
via Claude is slower or more annoying than dragging an event. Mitigation: P2 is a
primary deliverable, and the honest test is whether Rafa actually uses it for two
weeks. If he does not, revisit CalDAV with eyes open.

**ICS refresh latency.** Accepted at 15 minutes. Mitigated by the iCloud subscription
path and by writes confirming instantly through Claude, so the feed is never the
thing you wait on to know what you did.

**Feed URL is a bearer secret in a URL.** Standard for calendar subscriptions, but
URLs leak into logs, backups, and screen shares. Keys must be long, random, per-user,
and revocable. Rotation endpoint required in P0, not deferred.

**Two sources of truth.** D3 accepts this deliberately. The reconciliation module is
the single place it can go wrong, which is why it gets property tests rather than
example tests.

---

## Open questions

Deferred deliberately; none block P0.

1. **Area → calendar mapping.** One `.ics` feed per area (toggleable in the calendar
   UI, but noisy) versus a single feed using `CATEGORIES` and per-event colour. The
   vault currently contains duplicate areas that want cleaning first either way.
   Resolve in P1.
2. **Does the Tauri app survive?** Client of the sync API, or retired in favour of
   web + mobile. Resolve in P3.
3. **Habits, cycles, and plans in the feed.** Cycles as all-day spans is captured as
   a want (`2026-06-23`). Out of scope until moments work.
