---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:7ddaf68c8e1e10edf2399b36030bc6707856d316866b790c6136638be108d4d6
  signedAt: 2026-08-07T17:06:20.065026Z
  signature: ed25519:Fvd8dQRk1YtDTNaA4ZQuluY9No4WueZ/yVIPokccCQLpt17MEtH0V6ocLimMcadyIE3QFNAM2WJloX0eUUQtCQ==
$attestation:
  $type: tech.equanimi.secretariat.stamp
  signer: did:key:z6MkjB8PQaN1vuUzdtnJsxyXR2f8d3tckGHkUYZMDytQsfak
  act: attest
  docHash: sha256:7ddaf68c8e1e10edf2399b36030bc6707856d316866b790c6136638be108d4d6
  docFilename: 2026-08-07-the-mirror-a-phone-can-see-the-garden.md
  stampedAt: 2026-08-07T17:06:53.483103Z
  signature: ed25519:d4sL+8DgGjPNDIEr0DKVZCIrsJhB0US67C2PQ56S4d4hHYTVx/HPXSeoYNhSHsT0FhnL+euz6q/sacFwF8V0BQ==
---

# Pitch — The mirror: a phone can see the garden

**Bet:** A second formatter on the pipeline that already feeds the eink display, plus a standalone Expo app that renders it in portrait. The phone shows today's four phases and which moment is live. It writes nothing.

**Why it matters:** The Sail is the only part of the boat unreachable without the laptop. This is the snapshot half of reach — and it costs one formatter, because the push already ships.

---

## Boundaries

**JBTD:** When I am away from the Mac and want to know what I set out to do today, I want to open my phone and see the day. Baseline today: I cannot. The vault is local JSON. On the Marseille trip (2026-06-30 → 07-02) the calendar and Garmin were reachable and the Sail was not.

**Out:**
- Writes. The relay (slice B) owns planting, through a Shortcut, with no app code.
- The week. Today is the whole app.
- The deck, and therefore drag. Drax is the planning surface's dependency, not this one's.
- Everything on the red lines list (`docs/principles.md:134`). The phone gets less permission to demand attention than the desktop, not more.

## Elements

- **`formatDayForPhone`** — sibling of `formatTodayForTrmnl` (`src/domain/services/TrmnlFormatter.ts:39`). Same inputs; returns all four phases instead of the current one, plus the active-moment id, emoji and area colour. TRMNL's payload is untouched.
- **A second key on the same push** (`src/app/api/trmnl/push/route.ts:24`). The observer already debounces 5s and caps ten pushes an hour (`src/infrastructure/integrations/trmnl-sync.ts:26`); it writes both payloads or neither.
- **`POST /api/day`.** Copies the token read at `src/app/api/trmnl/markup/route.ts:91`, returns JSON where markup returns eink HTML.
- **`zenborg-phone`, a standalone Expo app.** Obytes starter, its own repo. No workspace surgery on zenborg and no shared package: v0 shares a payload shape, and that is thirty lines of types.
- **The portrait day screen.** Four phase sections stacked, the active moment marked, MMKV holding the last payload so it renders with no signal. Tokens ported from `globals.css` as a JS object.

## Risks

**🐇 Rabbit holes:**
- Extracting `@zenborg/domain` and converting the repo to a monorepo. The 2026-07-02 idea assumes it; a view-shaped payload removes the need.
- Porting the design system wholesale. Four sections need the type scale, the stone palette and area colour. Nothing else.
- Real-time. The push already fires on change; the phone fetches on focus and on pull.

**🏴 Off-sides:**
- Feeding the snapshot back into the Shortcut so it can offer today's moments to choose from. The relay names this as its own off-side; this bet unlocks it and does not build it.
- The week pager, the deck, Drax planning. Each wants the write path first.

**🥩 Fat cut:** A portrait web view on the deployed Next app. Cheaper, but it is not there in a tunnel, and it cannot grow into the planning surface.

**🧪 Domain knowledge:**
- `docs/principles.md:172` lists native mobile apps as a non-goal — "PWA sufficient for now". A scope decision, not a red line. Amend it or reject this deliberately.
- The eink payload carries `{name, area_name}` only. Adding ids and the pointer to it would change what the display renders. Two formatters, one pipeline.
- Ten pushes an hour is a shared cap. A heavy planning session on the Mac can starve the phone's freshness before you leave the house.
- The reach decision names Blob and forbids Upstash; TRMNL already rides Upstash and the relay pitch already flags the contradiction. This inherits that reconciliation rather than adding a second one.

## Acceptance

1. Mac asleep, phone in airplane mode: opening the app shows the last known day — four phases, moments under each.
2. A moment moved on the Mac appears on the phone after one pull-to-refresh.
3. The active moment is marked, and matches what keel prints at the top of a Claude session.
4. The TRMNL display renders exactly as before.
5. The app requests no notification permission and offers no control that writes, completes, or scores.
6. The non-goal line on native apps is amended, or this pitch is rejected on the record.

---

_Companion to 2026-08-07-the-relay-a-phone-can-plant-into-the-garden.md (slice B), which owns the write half. Shapes docs/ideas/2026-07-02-expo-mobile-client-and-device-sync.md, which said "don't shape yet". Drafted by Claude (scribe)._
