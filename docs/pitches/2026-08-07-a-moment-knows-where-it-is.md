---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:f464b12d6ba30c3fa9dd49b06b6f802e5d677f9c78668d0e46cd0d6723e988d7
  signedAt: 2026-08-07T15:52:08.448609Z
  signature: ed25519:E4a/haBglhynbg2nrlH4Bem80stirKUVYrAlwCyUATfjcgLQVyyvt24ZMJkpDs/aOfwCS+6hq7ugTKpi7iVaCw==
appetite: small
slice_id: A
source: conversation 2026-08-07 — "provide either an address or an url for moments"
status: draft
tag: pitch
type: pitch
---

# Pitch — A moment knows where it is

**Bet:** Give `Moment` one optional free-text `location`, write it through MCP and the moment form, and map it to `LOCATION` in the reach `.ics` feed.

**Why it matters:** A moment that knows *where* is the first moment a support can be generated for. The garden knows what you intend and when. It has never known where.

---

## Boundaries

**JBTD:** When I plant a moment to meet someone, I want the moment to carry where it happens, so the calendar gives me a map and a travel-time alert instead of a bare title. Baseline today: the address lives in Things, in a WhatsApp thread, or in my head. The moment carries nothing.

**Out:**
- Geocoding, map rendering, travel-time computation. The calendar client already does all three.
- Address-vs-URL as a typed union. `LOCATION` is free text and Apple and Google infer the kind.
- A second field for URLs. `Moment.refs` already ships them (`src/domain/entities/Moment.ts:51`).

## Elements

- **`Moment.location?: string`** (`src/domain/entities/Moment.ts:51`). One free-text line — `12 rue de la Roquette` or a Meet link. Trimmed, capped at 256 chars, absent when empty. Sits beside `refs`, which stays URLs-only.
- **MCP write path** (`mcp-server/index.ts:1382`, `:1422`, `:1706`). One optional `location` on the three moment writers, delete-on-empty like `refs` (`:1469`). Phone Claude can then answer "where am I meeting Yanik".
- **One input in the moment form** (`src/components/MomentFormDialog.tsx`). Under the clock-time row. `refs` earned no UI because agents author them; a location you type while planning.
- **ICS mapping, recorded not built** (`docs/superpowers/specs/2026-08-03-kairos-reach-design.md`, D1). `LOCATION:<location>`, `URL:<refs[0]>`. One line in the spec — the feed is a separate bet.

## Risks

**🐇 Rabbit holes:**
- Validating that an address is real. Not our job — the calendar geocodes it or it doesn't.
- A place picker with autocomplete. That is a Google Places dependency bolted onto a text field.

**🏴 Off-sides:**
- `Habit.location`, inheriting at allocation the way `startTime` does. Right for the gym and the studio. Wait until re-typing annoys.
- Reading a person's address off their `kind: "person"` habit via `personIds`. Where you meet varies more than where they live.

**🥩 Fat cut:** Two fields, `address` and `url`. `refs` already holds the URL half, and one `LOCATION` line is all the wire format accepts.

**🧪 Domain knowledge:**
- The `.ics` feed is unbuilt. D1 stands, no VEVENT code exists. Until it ships, `location` pays off only through MCP.
- That feed is a secret-URL public endpoint, and the reach snapshot lands in Vercel Blob (`docs/decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md`). Friends' home addresses would ride along. Settle whether `location` is emitted before the feed ships.

## Acceptance

1. A moment created with `location: "12 rue X"` round-trips through the vault and back out of `get_moment`.
2. Passing `location: ""` to `update_moment` drops the key, matching `refs` behaviour.
3. The moment form saves a location and re-renders it on an existing moment.
4. `refs` still rejects a non-URL. `location` accepts one.
5. The reach spec states, in one line, the `LOCATION` / `URL` mapping and whether `location` is emitted in the published feed.

---

_Drafted by Claude (scribe)._
