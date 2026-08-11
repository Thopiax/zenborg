---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:6eedabd67f11260c9c2946831cc0359d9c9d1d3b69a8d9cc413d7a3165ffc0e2
  signedAt: 2026-08-07T16:31:49.204846Z
  signature: ed25519:/XHN54ZscIakGWZbo/t0bscQ9KDXktiGe8V+G0WmSpSl5naJsxfa4pYg+3uX41LTzCKmhL04I2xslbX6f00lDQ==
$attestation:
  $type: tech.equanimi.secretariat.stamp
  signer: did:key:z6MkjB8PQaN1vuUzdtnJsxyXR2f8d3tckGHkUYZMDytQsfak
  act: attest
  docHash: sha256:6eedabd67f11260c9c2946831cc0359d9c9d1d3b69a8d9cc413d7a3165ffc0e2
  docFilename: 2026-08-07-the-place-is-a-url.md
  stampedAt: 2026-08-07T16:57:37.684183Z
  signature: ed25519:9eo1+siX9LvpHKsxwOtrvZtoUrHxFHbQEBnEkjNChZeClf1jWETRbbZ4klDnYuEOast+feUu/ovy7uF/dOzHCQ==
---

# Pitch — The place is a URL

**Bet:** One nullable URL on `Moment` is the place. One nullable string is the support an agent writes. Nothing parses either until something needs to.

**Why it matters:** A map link is already a real place — you picked it in Maps. Storing the link keeps every option open: resolve it later, or never.

---

## Boundaries

**JBTD:** When I plant a moment to meet someone somewhere, I want the link I already have to travel with it, so the event arrives knowing where it is. Baseline today: the link stays in WhatsApp.

**Out:**
- Parsing, geocoding, resolving. Deferred until an unresolved link actually blocks something.
- Reusing `refs` for this. Refs are what a moment points at; the venue is where it happens, and the ICS emitter has to tell them apart without sniffing hostnames.
- Touching `Habit.guidance` (`src/domain/entities/Habit.ts:34`) — standing, human-authored. `Moment.support` is per-instance and agent-authored.

## Elements

- **`Moment.location?: string`** (`src/domain/entities/Moment.ts:51`). A URL, validated by the existing `isParseableRef` (`:64`). Absent when empty, like `refs`.
- **`Moment.support?: string`** (`mcp-server/index.ts:1422`). Prose an agent writes through `update_moment` — the door code, who else is coming, what to read first. No new tool.
- **ICS mapping, recorded not built** (`docs/superpowers/specs/2026-08-03-kairos-reach-design.md`, D1). `LOCATION` and `URL` from `location`, `DESCRIPTION` from `support`. `GEO` waits for a resolver that does not exist yet.

## Risks

**🐇 Rabbit holes:**
- Resolving the link "while we're in there". The whole point of this shape is that we do not.
- A location that is sometimes a URL and sometimes an address. One type, one rule.

**🥩 Fat cut:** The `Place` value object and the URL parser of the prior draft. A string holds the same information until something reads it.

**🧪 Domain knowledge:**
- **Without coordinates there is no travel-time alert.** Apple geocodes a `LOCATION` string at display time; a raw URL may not geocode at all. Accept a tappable link, or resolve later.
- **The feed is a secret-URL public endpoint.** A friend's home pin and a support naming who else is coming would ride along. Settle what is emitted before it ships.

## Acceptance

1. `create_standalone_moment` with a map URL round-trips through the vault and back out of `get_moment`.
2. A non-URL is rejected; `location: ""` drops the key.
3. `update_moment({ support })` round-trips, and the habit's `guidance` is unchanged.
4. The reach spec states the `LOCATION` / `URL` / `DESCRIPTION` mapping and what the published feed emits.

---

_Supersedes the three prior drafts of this slice. Drafted by Claude (scribe)._
