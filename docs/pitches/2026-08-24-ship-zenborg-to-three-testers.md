---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:d9ac57dbd6056f0f8676be087347a381da6849e9e857e91b7b5d65b6ab2e7a3d
  signedAt: 2026-08-24T16:04:13.482308Z
  signature: ed25519:T48WFSMFGZOHBxSdMPEHVzVyEXgHawD653As1Mzi3QzgrguXlYn7W2/k+9l3khSaxbRvHejP/JQ3BXphaAyPAQ==
appetite: big
hard_dependency: Apple Developer Agreement re-acceptance (before notarized builds)
source: equanimitech studio map deep dive 2026-08-24
status: draft
tag: pitch
type: pitch
---

# Pitch -- Ship zenborg to three testers

**Bet:** Make zenborg installable and usable by three hand-picked testers in one week, so we learn what breaks when it leaves our machine.

**Why it matters:** Nothing in the equanimitech studio is usable by a second person. Until someone else runs the app, every design decision is untested opinion. Three testers who care about attention give us the friction map that becomes the roadmap.

---

## Boundaries

**JBTD:** As someone who cares about where their attention goes, I want to try zenborg on my Mac so I can plant a week of intentions and see if the garden metaphor clicks. Baseline today: I can't -- the repo is private, the updater points at a dead URL, the .dmg hits Gatekeeper, and first launch is an empty screen with no guidance.

**Out:**
- Windows or Linux builds (macOS only, aarch64 only)
- MCP server setup for testers (document it, don't require it)
- Mobile anything
- keel browser extension (ship the garden, not the observer)
- New features -- this is about shipping what exists

## Elements

- **Make the repo accessible.** Change `equanimitech/zenborg` visibility to public, or add three collaborators if public feels premature. The repo must be visible for the release download URL to resolve. `github.com/equanimitech/zenborg` settings.

- **Fix the updater endpoint.** `src-tauri/tauri.conf.json:28` points at `github.com/equanimitech/zenborg` (Rafa's personal account). Change to `github.com/equanimitech/zenborg`. Without this, the updater silently fails for everyone.

- **Re-accept the Apple Developer Agreement and restore notarization.** `.github/workflows/release.yml:86-105` -- the three `APPLE_*` env vars are commented out. Without notarization, a fresh download on someone else's Mac hits the Gatekeeper "unidentified developer" wall. Testers can bypass with right-click > Open, but that's a poor first impression. The agreement needs an SMS 2FA code; target after Sep 8 per the note.

- **Cut a fresh release.** Tag and push. The CI workflow (`release.yml`) builds aarch64, signs with Developer ID (cert valid to 2027-02-01), creates a GitHub release with `.dmg` and updater JSON. v0.18.0 or whatever is next.

- **Write a 10-minute onboarding guide.** A `GETTING_STARTED.md` that covers: download the .dmg, first launch, create your first area (one plot), create one habit (one perennial), allocate one moment for today, the `:ty1` command syntax. Link it from the release notes. No more than 2 pages. Include one screenshot of what a planted day looks like.

- **Seed a starter garden.** On first launch with an empty vault, pre-populate one area ("Try zenborg"), one habit ("Morning intention"), and one moment allocated to today/morning. The user sees a planted garden immediately, not a blank screen. `src/infrastructure/vault/` -- check for empty vault on boot, write seed data. Both vault implementations need this (`fs.rs` and `vault.ts`).

## Risks

**Rabbit holes:**
- Designing a full onboarding wizard with multiple screens. Don't. A seeded garden + a markdown guide is the MVP.
- Fixing every rough edge before shipping. The testers ARE the rough-edge audit. Ship first, fix second.

**Off-sides:**
- Testers will want keel integration (browser extension, attention tracking). That's a separate pitch. The garden ships alone first.
- Testers will ask about mobile. The answer is "not yet" and that's fine for the first test.

**Domain knowledge:**
- The Gatekeeper bypass (right-click > Open) works on unnotarized but Developer ID-signed builds. Verify this is true for the aarch64 .dmg from CI. If the cert has expired or the signing identity changed, the bypass won't work either.
- The MCP server ships as a sidecar binary (`bundle.externalBin: ["binaries/zenborg-mcp"]`). Testers who use Claude Code can connect it, but it is not required for the core experience.

## Acceptance

1. A non-Rafa Mac user can download the .dmg from the GitHub release page without needing repo access.
2. The app launches without Gatekeeper blocking (either notarized or bypassed with right-click > Open, documented).
3. First launch shows a seeded garden with at least one area, one habit, and one moment -- not a blank screen.
4. A tester can follow GETTING_STARTED.md and have a planted day within 10 minutes.
5. The updater resolves from `equanimitech/zenborg` and notifies the tester of the next release.
6. Three testers are using the app and providing feedback within one week of the release.

---

_Drafted by Claude (scribe)._