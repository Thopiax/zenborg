---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:a2e7353d99da6babc9ab87e45ea7d4e1439205d0f7b0b2ecc98a495cabac3ffc
  signedAt: 2026-08-14T16:35:45.828254Z
  signature: ed25519:OsduLYFrnCXXneVWou7hDn/AZFHT0CoXLK2BxzMbGODnjxuFDQGsNExjbcycMxS/8iSKFLu4Upogq/c35/HoAg==
appetite: big
hard_dependency: kernel/entities.md stamped before slice 6 (places resolve to registry keys). Slices 1–5 are unblocked.
source: the Observatory pilot — 14 commits, 2fd43d8…6271a98, 2026-08-14
status: draft
tag: pitch
type: pitch
---

# Pitch — Harvest: the season reads back

**Bet:** Harvest renders one closed season — its intention, a reflection derived from traces you already left, the moments you planted, the photographs you took — and never grades it.

**Why it matters:** Zenborg has asked *where will I place my consciousness today?* across 252 seasons and never once shown what came of it. Intention with no read-back is an open loop.

---

## Boundaries

**JBTD:** When a season closes, I want to see what it actually held, so the next allocation answers to what happened rather than to what I meant. Baseline today: `src/app/harvest/page.tsx` says "Coming soon", and `Cycle.reflection` (`src/domain/entities/Cycle.ts:13`) has carried the comment *"Populated in harvest when the cycle closes"* since the beginning while staying null. The surface was never the blocker — the material was. A script wrote 229 of the 252 last week, so it exists now.

**Out:**

- **Scores.** No ranking of seasons, no percentage against a budget, no "best". Counting allocations is information; a bar against a target is a verdict (`docs/principles.md` Red Lines; `kernel/entities.md`, "No scoring").
- **The globe.** WebGL, CDN assets, city coordinates. The pilot's best demo and harvest's worst fit.
- **A "best photos" picker.** Curation stays legible and pinnable, or allocation moves upstream to the system.
- **Cloud inference.** No cloud inference ever touches a private pond (`kernel/entities.md`, privacy tiers). A contract, not a preference.

## Elements

Six slices. Each is one Linear issue, each mergeable alone.

1. **The season reads back** (`src/app/harvest/page.tsx:1`). The route renders one cycle from the store: name, intention, the L0/L1 reflection parsed from the existing blank-line convention, the moments planted in its window. No new dependency — moments always exist, so this ships whole with no journals, no model, no photo permission.
2. **Provenance, and editing as the expected act** (`src/domain/entities/Cycle.ts:13`). One new nullable field, `reflectionSource`. A machine-drafted reflection must not look like one you wrote. Inline editing stamps `"human"`; a re-run refuses to overwrite it (`scripts/summarize-cycles.mjs:144`). The only stored shape this bet adds — and it costs both vault implementations.
3. **Navigate the seasons** (`src/infrastructure/state/bandedHeatmapViewModel.ts:251`). Harvest's index is the banded heatmap, already built and tested. Not a new timeline.
4. **Reflections, opt-in** (`scripts/summarize-cycles.mjs:1`). Detect ollama; absent, harvest is still whole. Writes `Cycle.reflection` and nothing else, so wake can take the extraction over later without touching the surface.
5. **Photographs of the season** (`scripts/globe.mjs:193`). The Apple library read-only, thumbnails served, screenshots excluded, highlights a gitignored sidecar. Never a write to the user's library.
6. **Places, derived not stored** (`scripts/photo-places.mjs:22`). A season's places = the place tags of its moments ∪ photo GPS, resolved to registry keys. No cycle-level place field; prefer derived over stored.

## Risks

**🐇 Rabbit holes:**

- Splitting cycles at photo boundaries. The pilot surfaced 10 sub-trip conflicts; resolving them is a separate question about what a cycle *is*.
- Rebuilding extraction as a wake blueprint now. `by_cycle_window` indexing does not exist in penceive-core. Slice 4's boundary is what makes waiting cheap.
- Apple's `Photos.sqlite` is a private schema that moves across macOS releases, and the pilot shells out to `sqlite3`.

**🏴 Off-sides:** Sharing a season as a page. "On this day." A notification when a cycle closes. Each is the engagement loop this surface exists to not be.

**🥩 Fat cut:** The globe's journey playback — play, scrub, time-proportional arcs. It is autoplay on a timeline, the exact shape Bounded Experiences forbids (`docs/principles.md`, §6).

**🧪 Domain knowledge:**

- `~/.wake/blueprints/cycle.yaml` pins `qwen3.6:35b`; the benchmark says `qwen3:4b` at 6.7s/cycle is indistinguishable. Amend the blueprint or record why not.
- **Fade-by-Design does not apply to an archive, and claiming it would be washing.** The reflection *practice* can fade; the record accrues. Where Fade cannot carry the load, Sovereignty must — hence acceptance 6.
- The 3-moments-per-phase cap is recorded as removed and still enforced in four places (`CLAUDE.md`, Known drift). Harvest reads historical windows and will meet it.

## Acceptance

1. Harvest renders a season with no journals, no ollama and no photo permission — the moments planted, never an error state.
2. A machine-drafted reflection is visually distinguishable from a human-written one. Editing stamps `reflectionSource: "human"`; re-running the summarizer leaves it alone.
3. No surface in harvest ranks, scores, compares, or shows a percentage against a target.
4. Harvest loads with the network off. No external asset fetch.
5. `pnpm test` green, including the collections-sync parity test with `reflectionSource` added.
6. With zenborg uninstalled the record is still readable: reflections are plain text in `cycles.json`, photographs untouched in the user's own library.

---

_Drafted by Claude (scribe)._
