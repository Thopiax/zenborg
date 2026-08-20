---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:c1289b7a2bc6ee2b3965b6a9961ae0f76a9fe6c851f15cdda77bf7d282b3ca80
  signedAt: 2026-08-20T22:52:15.860410Z
  signature: ed25519:bHjMWNId2fwtl/HXhsmHMcGHYerNE0jwM0w55ZG8fwbBQADp8cOk77oZ2irPxBvMaWiKfBsfE2iYI1M/3HKUDg==
type: note
---
# Evidence check on graded drift, and the premise it does not support

**Date:** 2026-08-20
**Status:** reference. Extends `keel/docs/references/attention-research-basis.md` (2026-06-01)
rather than replacing it — that file remains the base synthesis; this one records what a
targeted check found after the decision to grade drift by distance was stamped.
**Prompted by:** `kairos/docs/decisions/2026-08-20-grade-drift-by-distance-from-the-intention-in-three-classes.md`

## What was checked

Whether grading drift into near / far / away — same plot, different plot, different kind
of activity — is supported by the literature, and whether the ladder built on it
(confirm → 10s → 30s + name the reason) is.

## Supported

**Integration with declared intention is the strongest ground.** The base synthesis makes
"integrate with the user's wider context" principle 6 and puts "ignoring the user's
broader context" in the Fails column. Grading against a declared intention is that
principle made quantitative, which is a better justification than any of the others below.

**Calibration protects adoption.** Punitive feedback draws 6–10% adoption in the base
synthesis. A boolean that charges the same for opening Linear as for an hour of weeds is
miscalibrated in exactly the way that number describes.

**The intensity/retention tension is real and graded response is the standard answer to
it.** Reviews of digital self-control tools find lockouts outperform passive notification
while generating resistance: "the high-friction nature of such interventions generates
user resistance, highlighting a broader tension in DSCT design between intervention
intensity and long-term retention" (TOCHI meta-analysis; Biedermann 2021).

**An independent restatement of the key-in-the-room rule.** "Blocking that is negotiable
only works if it is not too easy to overcome" (dual-systems review) is the same finding as
the garden-absorbs-keel spec's "walls hold when the key is not in the room", reached from
a different literature. Convergence worth noting, because that rule now carries a lot.

## Not supported — and the correction matters

**"Near drift is less serious" has no cognitive-cost basis, and the interruption
literature points the other way.** Gillie & Broadbent found that similarity between an
interruption and the primary task *increases* disruptiveness through working-memory
interference, and that recovery is harder after an interruption overlapping in information
with the primary task — the interruption-similarity effect.

Graded purely by cognitive cost, Themia-data → Themia-billing would deserve **more**
friction than Themia → YouTube. That is the inverse of the ladder.

**Why the ladder survives it anyway.** That literature studies exogenous interruption, not
voluntary drift, so it does not refute the tiers. What it forecloses is one justification
for them. The tiers do not measure cognitive cost; they measure how far a departure went
from what was committed to, which is volitional — BCT 1.9 Commitment, mechanism of action
`values`. The stamped decision already grounds them there ("a boundary that reads as
fair"), and that grounding is the load-bearing one.

**So the rule for future readers:** distance grades *commitment fit*, never *cognitive
cost*. Anyone who later reads the tiers as a claim about how expensive a switch is will be
reasoning from something this check found to be false.

## The tension the check exposed, which is not resolved

**The dwells contradict principle 1.** The base synthesis makes "detect and respect natural
breakpoints — intervene at boundaries, not mid-task" the first design principle, and its
binding map is explicit that "higher friction rungs engage at the next switch/idle/commit,
not the clock tick". It also prices a meaningful interrupt at ~23 minutes to refocus
(Mark 2008).

A drift event is itself a switch, so *gating on drift* is breakpoint-aligned by
construction. But the 10-second and 30-second dwells fire mid-action, and a dwell is an
interrupt. That is the least-aligned part of what was built, and it is the dwells
specifically — not the grading, and not the gate.

Three ways out, unchosen:
1. Drop the dwells; keep confirm and the intention prompt.
2. Keep dwells only for `away`, where the departure is large enough to be worth an
   interrupt.
3. Defer the higher rungs to the next breakpoint, which is what the binding map already
   prescribes and nothing implements.

**And the personalisation warning names this principal specifically.** Mark 2018: blocking
helped low-Conscientiousness users, but users with *higher perceived work control* got
**increased workload** from blocking. Someone who sets his own schedule and runs his own
company is the case that warning is about. It is the single most person-specific finding in
the evidence base and it points at the author of the fences.

## Sources

- Gillie & Broadbent, *What makes interruptions disruptive? A study of length, similarity,
  and complexity*, Psychological Research — https://link.springer.com/article/10.1007/BF00309260
- *What Makes Interruptions Disruptive?*, CHI 2015 — https://dl.acm.org/doi/10.1145/2702123.2702156
- Trafton & Monk, *Task Interruptions* (review) — https://www.interruptions.net/literature/Trafton-Reviews_HFE-3.pdf
- Biedermann et al. 2021, *Digital self-control interventions for distracting media
  multitasking — a systematic review* — https://onlinelibrary.wiley.com/doi/full/10.1111/jcal.12581
- *Achieving Digital Wellbeing Through Digital Self-control Tools*, ACM TOCHI — https://dl.acm.org/doi/10.1145/3571810
- *Applying Dual Systems Theory to a Review of Digital Self-Control Tools* — https://arxiv.org/pdf/1902.00157
- Base synthesis: `keel/docs/references/attention-research-basis.md` (Mark 2008, Mark 2018,
  Leroy 2009, Iqbal & Bailey 2008)
