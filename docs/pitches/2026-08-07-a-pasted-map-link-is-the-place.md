---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:aea06648a02740a7956a9ea6c0268eed1f6fbb46c15e9bd18d2496e696170fb0
  signedAt: 2026-08-07T16:26:53.827772Z
  signature: ed25519:+VdHYb7RMUSmTKtMK5XkNMhK8tsjKAjy4cBcRm6fe+jvMWiujm14tg9/p77WkGApA2trUkV6mgRYI02M5dA1Cw==
$attestation:
  $type: tech.equanimi.secretariat.stamp
  signer: did:key:z6MkjB8PQaN1vuUzdtnJsxyXR2f8d3tckGHkUYZMDytQsfak
  act: attest
  docHash: sha256:aea06648a02740a7956a9ea6c0268eed1f6fbb46c15e9bd18d2496e696170fb0
  docFilename: 2026-08-07-a-pasted-map-link-is-the-place.md
  stampedAt: 2026-08-07T16:27:38.441146Z
  signature: ed25519:4UWqcJTNrjg25nSUQTy1H/DMLO7JYc0AdvUtluUAEL8TSHjlaC8DNQ/sA9WmMUMVb/W1qv6NMdveqNkPbzQmBA==
---

# Pitch — A pasted map link is the place

**Bet:** Take a pasted Google or Apple Maps link as a moment's location, parse the name and coordinates straight out of the URL, and let an agent write a `support` into the moment. Both ride out on the `.ics` event.

**Why it matters:** You already disambiguated the place when you picked it in Maps. Reading the link back is a regex — no geocoder, no API key, and no network call. The event gets a travel-time alert and something worth reading before you arrive.

---

## Boundaries

**JBTD:** When I plant a moment to meet someone somewhere, I want to paste the link I already have in the share sheet and have the event arrive knowing where that is and what I need before I get there. Baseline today: the moment carries a name and a time. The link stays in WhatsApp.

**Out:**
- A geocoding service. The human resolved the place in Maps; a resolver would re-guess what is already decided.
- Map rendering inside zenborg. Maps and the calendar already render.
- Touching `Habit.guidance` (`src/domain/entities/Habit.ts:34`) — standing, human-authored practice guidance. `Moment.support` is per-instance and agent-authored. Two concepts, two fields.

## Elements

- **`Moment.location?: Place`** (`src/domain/entities/Moment.ts:51`). `{ label, url?, lat?, lon? }`, stored as parsed. A link that yields no coordinates keeps `label` and `url`; the absence of `lat` *is* the degraded state, so there is no status enum to maintain.
- **`parsePlaceUrl()`, ~10 lines and no network** (new, `src/lib/places.ts`). Regex `@<lat>,<lon>` and the `/place/<Name>/` segment out of a Google URL; `?ll=` and `?q=` out of an Apple one. Unrecognised URL returns `{ url }` and nothing else — a link you can still tap.
- **Paste a link in the moment form** (`src/components/MomentFormDialog.tsx`), one field. The same parser runs in `mcp-server` (`index.ts:1422`), so a moment Claude plants reads a link the same way.
- **`Moment.support?: string`, out on the event** (`docs/superpowers/specs/2026-08-03-kairos-reach-design.md`, D1). Prose an agent writes via `update_moment` — the door code, who else is coming, what to read first. Maps to `DESCRIPTION`; the place maps to `LOCATION:<label>`, `GEO:<lat>;<lon>`, `URL:<url>`. `GEO` is what earns the travel-time alert.

## Risks

**🐇 Rabbit holes:**
- Adding a geocoder for addresses typed without a link. Paste a link, or accept a label with no coordinates.
- Expanding `maps.app.goo.gl` short links by following redirects. One network call to recover coordinates the long link gives free.
- Validating that a URL really points at a place. If it parses it parses; if not, it is still a tappable link.

**🏴 Off-sides:**
- `Habit.location` inheriting at allocation the way `startTime` does. Right for the studio and the gym; wait until re-typing annoys.
- Reading a person's address off their `kind: "person"` habit via `personIds`. Where you meet varies more than where they live.

**🥩 Fat cut:** The Nominatim resolver of the prior draft, and the outbound query it required. The link already holds what it would have gone to fetch.

**🧪 Domain knowledge:**
- **The URL format is undocumented.** `@lat,lon` in Google's path has been stable for years but is not a contract. Verify against a link actually shared from the phone before building — and note that iOS share sheets emit short links, which carry no coordinates until expanded.
- **The payoff is downstream of an unbuilt feed.** No VEVENT code exists. `GEO` and `DESCRIPTION` do nothing visible until the feed ships; bet on this only if that one follows.
- **The feed is a secret-URL public endpoint** and the reach snapshot lands in Vercel Blob (`docs/decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md`). A friend's home pin and a support naming who else is coming would both ride along. Settle what is emitted before the feed ships.

## Acceptance

1. A link shared from Maps on the phone, pasted into the moment form, stores `label` and coordinates in `moments.json` — or, when it is a short link, `label` and `url` with no coordinates and no error.
2. A URL the parser does not recognise still saves, as `url` alone, and remains tappable.
3. A moment planted through `create_standalone_moment` with a link parses identically to one pasted in the form.
4. Authoring, rendering a day, opening the app, and syncing issue zero network requests between them.
5. `update_moment({ support })` round-trips, and the moment's habit `guidance` is unchanged.
6. The reach spec states, in one line, the `LOCATION` / `GEO` / `DESCRIPTION` / `URL` mapping and what is emitted in the published feed.

---

_Supersedes: 2026-08-07-a-moment-knows-where-it-is.md, 2026-08-07-real-places-and-a-support-written-into-the-event.md. Drafted by Claude (scribe)._
