---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:8859ae55ee12b834261dcae4278482bf5af7d58e7209acb4604057f246400a51
  signedAt: 2026-08-07T15:55:20.410381Z
  signature: ed25519:qjjul/2hGN74mCeuhoKwOTfYCjB8VEPz3aiwf20LRf0s5aD7HoI+RWvgxUlapVj4MaD9aPh66JiFoTVZOLEyBg==
appetite: medium
hard_dependency: the reach `.ics` feed (D1) is unbuilt — this pitch lays the data, the feed delivers it
slice_id: A'
source: conversation 2026-08-07 — "I would like real locations… the idea is for claude to build guidance into each of these events"
status: draft
supersedes:
- 2026-08-07-a-moment-knows-where-it-is.md
tag: pitch
type: pitch
---

# Pitch — Real places, and a support written into the event

**Bet:** Resolve a moment's location to a real place once, at authoring, and give the moment a `support` field an agent writes contextual guidance into. Both ride out on the `.ics` event.

**Why it matters:** A free-text address is a string Claude can only guess at. A resolved place has coordinates, so the event carries a travel-time alert — and gives an agent something concrete to write guidance against. This is the data layer generative supports stand on.

---

## Boundaries

**JBTD:** When I plant a moment to meet someone somewhere, I want the event to arrive knowing where that is and what I need to know before I get there, so I stop assembling it from a WhatsApp thread on the way. Baseline today: the moment carries a name and a time. Nothing else.

**Out:**
- Generating support automatically. An agent writes it when asked. No scheduler, no pipeline, no LLM in the feed path.
- Map rendering inside zenborg. The calendar and Maps already render.
- Touching `Habit.guidance` (`src/domain/entities/Habit.ts:34`). That is standing, human-authored practice guidance. `Moment.support` is per-instance and agent-authored. Two concepts, two fields.

## Elements

- **`Moment.location?: Place`** (`src/domain/entities/Moment.ts:51`). `{ label, address?, lat?, lon? }` — resolved once and stored. A place the geocoder can't find saves with `label` alone; the absence of `lat` *is* the unresolved state, so there is no status enum to keep in sync.
- **A keyless resolver, ~15 lines** (new, `src/lib/geocode.ts`). Nominatim over plain `fetch`: no API key, no billing, no SDK, and ODbL results you are permitted to store. Google Places wants a key and forbids storing coordinates; Apple MapKit exists only in the Tauri process, so agent-created moments could never resolve.
- **Suggestions in the moment form** (`src/components/MomentFormDialog.tsx`). Type, pick from a short list, store the pick. The same resolver runs in `mcp-server` so a moment planted by Claude resolves the same way.
- **`Moment.support?: string`** (`mcp-server/index.ts:1422`). Free prose an agent writes via `update_moment` — the code to the door, who else is coming, what to read first. No new tool.
- **ICS mapping, recorded not built** (`docs/superpowers/specs/2026-08-03-kairos-reach-design.md`, D1). `LOCATION:<address ?? label>`, `GEO:<lat>;<lon>`, `DESCRIPTION:<support>`. `GEO` is what earns the travel-time alert. `URL:<refs[0]>` stays as-is.

## Risks

**🐇 Rabbit holes:**
- An address-validation state machine. Resolved or not is one nullable coordinate pair.
- Re-resolving on read, on render, or on a schedule, to keep places "fresh". Places do not move.
- A place autocomplete component with debounce tuning and keyboard nav. A datalist and a 300ms timer.

**🏴 Off-sides:**
- `Habit.location` inheriting at allocation the way `startTime` does. Right for the studio and the gym; wait until re-typing annoys.
- Reading a person's address off their `kind: "person"` habit via `personIds`. Where you meet varies more than where they live.

**🥩 Fat cut:** A union type over address-or-URL. The split already exists and is free: an address is a `location`, a Meet link is a `ref` (`src/domain/entities/Moment.ts:51`).

**🧪 Domain knowledge:**
- **Resolution is an outbound query.** Every address you geocode is one HTTPS call to a third party — in tension with local-first. The mitigation is the design: resolve once at authoring, store the result, never phone home again. Nothing re-queries on open, render, or sync. Confirm that trade is acceptable before building.
- **The payoff is downstream of an unbuilt feed.** No VEVENT code exists. `support` and `GEO` do nothing visible until the feed ships — this pitch is worth betting on only if that one follows.
- **The feed is a secret-URL public endpoint** and the reach snapshot lands in Vercel Blob (`docs/decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md`). Friends' home addresses and a support naming who else is coming would both ride along. Settle what is emitted before the feed ships.

## Acceptance

1. Typing a real street address in the moment form offers at least one suggestion; picking it writes `label`, `address`, `lat`, `lon` into `moments.json`.
2. An address the geocoder cannot find still saves — `label` only, no coordinates, no error state.
3. A moment planted through `create_standalone_moment` with an address resolves the same way as one planted in the form.
4. `update_moment({ support })` round-trips, and the moment's habit `guidance` is unchanged.
5. Opening the app, rendering a day, and syncing issue zero geocoding requests. Only authoring does.
6. The reach spec states, in one line, the `LOCATION` / `GEO` / `DESCRIPTION` mapping and what is emitted in the published feed.

---

_Supersedes: 2026-08-07-a-moment-knows-where-it-is.md. Drafted by Claude (scribe)._
