---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:b8e6e8791c762292b521db3ced474f447ab503514f44b0d644930509d81ab2d9
  signedAt: 2026-08-07T17:01:01.752487Z
  signature: ed25519:XeyeYpQGOuf/8PNsP9kRCJRGWTKTDnSb4nLGF5CJAENn6QJxHNoe+qW0YkhBhL3jLx4zWVbJ9Qmb/AFVRMiXDg==
appetite: small
related:
- 2026-08-07-the-place-is-a-url.md
slice_id: B
source: conversation 2026-08-07 — "shortcut POSTs to an edge route… a clean relay that will bring a lot of positives"
status: draft
tag: pitch
type: pitch
---

# Pitch — The relay: a phone can plant into the garden

**Bet:** One edge route takes a deferred MCP call from a Shortcut and queues it. A drainer on the Mac replays it through the real `mcp-server`. First payload: a moment with a map link.

**Why it matters:** Every tool the MCP already exposes becomes reachable from a share sheet, and so does every tool added later. This is the intent-queue half of the reach decision, built small against one real use.

---

## Boundaries

**JBTD:** When I am out and something belongs in the garden, I want to send it from my phone in one gesture and find it planted when I next open the Mac. Baseline today: it goes to Things, and something must later parse what I meant.

**Out:**
- Reading garden state back to the phone. That is the snapshot half of reach — a separate bet.
- A bespoke intent schema. An intent is `{ tool, params }`: an MCP call, deferred.
- Live writes. Queued-not-live is already the accepted price (`docs/decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md`).

## Elements

- **`POST /api/intent`** (new, beside `src/app/api/trmnl/push/route.ts`). Copies its twelve lines of Bearer auth. Validates that `tool` is on a write allowlist, caps the body, `LPUSH`es to Upstash with a TTL. The route never executes anything — it only enqueues.
- **A drainer that is an MCP client** (new, `mcp-server/drain.ts`). Spawns `mcp-server` over stdio and calls tools by name. `server.tool(...)` registers closures rather than an exported map (`mcp-server/index.ts:1370`), so speaking the protocol beats refactoring it — and every zod schema validates the replay exactly as it validates Claude.
- **One Shortcut, no code.** Share sheet takes the Maps link, Ask for Input takes the name, Choose from List takes the area, Get Contents of URL posts `create_standalone_moment` with `location` set.
- **Reconcile the reach decision** (`docs/decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md`). It specifies Vercel Blob and forbids Upstash by name. Upstash is already wired and deployed in this repo. Amend the doc or reject the shortcut deliberately — do not leave both standing.

## Risks

**🐇 Rabbit holes:**
- A general job queue with retries, backoff and dead-lettering. It is one user and a handful of intents a week.
- A web UI for inspecting the queue. A count in the app is enough.
- Making the drain real-time. On app focus and a timer is the whole requirement.

**🏴 Off-sides:**
- Other intent kinds — a metric from the watch, a journal line from Siri, a habit spawned by voice. All free once the relay exists; none of them are this bet.
- Reading state back so the Shortcut can offer today's moments to choose from. Needs the snapshot.

**🥩 Fat cut:** Vercel Blob, one file per intent. Upstash is already in `package.json` and `LPOP` is atomic, which is the only property the queue needs.

**🧪 Domain knowledge:**
- **The edge returns 200 before anything is validated.** A malformed intent fails at drain, on a machine you are not looking at. Failures land in a `failed` list with their error and the app shows a non-zero count — otherwise the phone lies to you.
- **`LPOP` then dispatch is at-most-once.** A crash between the two loses the intent in flight. The alternative duplicates moments. Take the loss, record the choice.
- **The API key lives on the phone,** inside a Shortcut. Anyone holding it can enqueue write calls. Scope it to the allowlist and treat it as rotatable.

## Acceptance

1. A Shortcut run with the Mac asleep returns 200, and the moment exists after the Mac wakes and drains.
2. An intent naming a tool outside the allowlist is rejected at the edge with 400 and never enqueued.
3. An intent that fails zod validation at drain lands in the `failed` list with its error, and the app surfaces the count.
4. Draining twice applies an intent at most once.
5. The reach decision is amended to state that the queue rides Upstash, or this pitch is rebuilt on Blob.

---

_Companion to 2026-08-07-the-place-is-a-url.md, which defines the payload this first Shortcut sends. Drafted by Claude (scribe)._
