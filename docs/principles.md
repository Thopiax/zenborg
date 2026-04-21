# Zenborg Principles

> *Structure should guide organic growth. Technology should enhance rather than extract human attention.*

Zenborg inherits its design discipline from **equanimi.tech** — a framework for building technology that cultivates equanimity rather than engagement. Every design decision traces back to the three-layer pyramid below. When two reasonable approaches disagree, we pick the one that strengthens the layer closest to the foundation.

This document is the canonical reference. If a feature seems aligned with an equanimitech principle but forbidden by a literal reading of older project notes, trust the pyramid.

---

## The Pyramid

```
           ╱╲
          ╱    ╲
         ╱ EQUA- ╲         3 — Equanimity (outcome)
        ╱  NIMITY  ╲
       ╱─────────────╲
      ╱   AWARENESS    ╲   2 — Awareness (practice)
     ╱───────────────────╲
    ╱    SOVEREIGNTY      ╲ 1 — Sovereignty (foundation)
   ╱───────────────────────╲
```

Each layer depends on the one beneath it. You cannot cultivate equanimity on extractive infrastructure. You cannot direct attention skillfully on a platform that demands it.

---

## Layer 1 — Sovereignty (Foundation)

*You can't build equanimous technology on extractive infrastructure.*

### 1. Local-First Ownership

The user owns their data and computation. Not "we store it securely for you" — the user possesses it.

**In Zenborg:** IndexedDB is the primary store. The vault lives at `~/.zenborg` in JSON collections. Future Supabase sync is optional, not required. If our servers vanished tomorrow, nothing breaks.

**Design test:** Does this work offline? Would the user lose anything if our servers shut down tomorrow?

### 2. Holistic Control

The user controls how the tool is used — what features are active, what data flows where. No dark patterns, no forced updates, no locked features.

**In Zenborg:** Phases, areas, attitudes, cycles — all user-configurable. No feature is hidden behind an account tier. Night phase can be hidden. Defaults exist but can be overridden.

**Design test:** Can the user explain what this tool does and why? Can they disable any feature without breaking the whole?

### 3. Modification Rights

Open source by default. The user can fork, freeze, or adapt.

**In Zenborg:** MIT license. The vault format is plain JSON — readable, editable, forkable. A technically capable user can modify; a non-technical user can freeze at any version.

**Design test:** Can a technically capable user change how this works? Can a non-technical user freeze the current version?

---

## Layer 2 — Awareness (Practice)

*You can't cultivate equanimity without directing attention skillfully.*

### 4. Peripheral Presence

Technology should inform without demanding focal attention. Default mode is ambient. The tool moves to center only when genuinely needed, then returns to the periphery.

**In Zenborg:** Area dormancy indicators, attitude whispers, rhythm signals — all ambient. You visit them; they don't visit you. No push notifications, no badges, no red dots, no modal alerts. Boring by design.

**Design test:** Can the user safely ignore this for hours? Does it use the periphery (light, position, color shift) before demanding focal attention?

### 5. Attentional Granularity

Content depth tracks attentional depth. Start with the big picture. As focus sharpens, reveal finer detail. Gross → subtle, never the reverse.

**In Zenborg:** Moments are 1–3 words, not paragraphs. Phases (morning/afternoon/evening/night) are coarser than clock times. The timeline shows three days — yesterday, today, tomorrow — not a month. You zoom in as attention settles; the system never dumps a dashboard.

**Design test:** Does the interface start with the big picture and let the user go deeper? Is the resolution matched to how the user actually thinks about this dimension?

### 6. Bounded Experiences

Digital interactions should have natural endpoints. No infinite scroll. No autoplay. No bottomless feed.

**In Zenborg:** Three moments per phase, three days on the timeline. The drawing board is finite. Cycles have start and end dates. When you finish placing today's intentions, you're done — there is no next screen.

**Design test:** Does this interaction have a natural end? If the user stops, is that a feature or a failure?

---

## Layer 3 — Equanimity (Outcome)

*The design outcome no one else is targeting.*

### 7. Strategic Friction

Make the compulsive path harder. Make the intentional path easier. Not all friction is good — bureaucratic friction is hostile. Strategic friction is compassionate: it slows automatic reactivity without blocking deliberate action.

**In Zenborg:** The three-items-per-phase constraint is strategic friction. Adding a fourth requires deliberate removal of another. Attitude-driven whispers are strategic friction for neglected practices — not a nag, but a visible pause point when you tend the garden.

**Design test:** Is the compulsive path frictionless? (If yes, it fails.) Is the intentional path frictionless? (If no, it fails.)

### 8. Fade-by-Design

Success means the user needs the tool less over time — not through neglect, through internalization. Training wheels, not crutches.

**In Zenborg:** Attitude + rhythm awareness builds the user's own capacity to tend their garden. Eventually the tool is a mirror reflecting patterns the user already knows, not a prompt telling them what to do. A graduated user is a success, not a churn metric.

**Design test:** If a user stopped using this after 6 months because they'd internalized the skill, would we celebrate or panic?

### 9. Downstream Allocation

The user fills the slots. The system doesn't. No algorithmic curation that prioritizes platform objectives over user intentions.

**In Zenborg:** This is the purest expression of Zenborg's thesis. No feed, no recommendations, no auto-placement. The system surfaces context (whispers, dormancy indicators) but the allocation decision always belongs to the person. "Where will I place my consciousness today?" — the question is the user's to answer.

**Design test:** Who decided what the user is looking at right now — the user or the system?

---

## Zenborg-Specific Expressions

These are not additional principles. They are how the pyramid speaks in Zenborg's voice.

- **Orchestration, not elimination.** Accept what wants attention. Budget for it. (Downstream Allocation)
- **Consciousness as currency.** Allocate attention, not time. (Attentional Granularity + Downstream Allocation)
- **Presence over outcomes.** No "done" button, no streak, no completion score. (Fade-by-Design + Bounded Experiences)
- **Information, never score.** Counts and history are fine; rankings and targets are not. (Downstream Allocation)
- **Ambient signals, never interruption.** Passive surfaces you visit. (Peripheral Presence)
- **Pattern-aware, not performance-graded.** Rhythm awareness is a mirror, not a test. (Fade-by-Design)
- **Boring by design.** The tool disappears when it's working. (Peripheral Presence)
- **Three items per phase is liberation.** Constraint as feature. (Bounded Experiences + Strategic Friction)

---

## Red Lines (What Zenborg Will Never Do)

- No completion checkboxes, no "done" animations, no finish rewards
- No streak counts, streak shame, or longest-streak leaderboards
- No completion percentages or progress bars against targets
- No push notifications, email reminders, badges, or red dots
- No modal alerts (modals are a UI anti-pattern here regardless)
- No algorithmic curation of what the user sees
- No performance ranking, comparative scoring, or leaderboards
- No dark patterns, forced updates, or account-gated features
- No advertising, no engagement-based revenue

These are not negotiable. They violate one or more layers of the pyramid.

---

## Permitted (That May Look Similar at First Glance)

The pyramid allows many patterns that superficially resemble the red lines. Don't confuse them.

- **Counting allocations is fine.** "3rd time" is information, not a score. (Downstream Allocation)
- **History and pattern awareness is fine.** "2 days ago" is neutral feedback, not nagging. (Peripheral Presence)
- **Passive surfaces like a whispers lane are fine.** The user visits them; they don't visit the user. (Peripheral Presence + Strategic Friction)
- **Cadence awareness is fine.** Rhythm ("weekly × 3") drives whispers but is not displayed as a completion score. (Fade-by-Design)
- **Attitude-driven feedback is fine.** Each attitude interprets rhythm differently; feedback is neutral information. (Downstream Allocation)
- **Constraints that prevent action are fine.** Three-per-phase blocks a fourth; that's strategic friction, not paternalism. (Strategic Friction)
- **Visual indicators on cards are fine** (attitude chip, area color). They're ambient, not demanding. (Peripheral Presence)

When in doubt: does this surface *invite* attention without *demanding* it? If yes, it's permitted.

---

## Non-Goals (MVP Scope — Different Register)

These are things we haven't built yet, but they don't violate the pyramid. They're scope decisions, not philosophical ones. A future Zenborg could include them without breaking the principles.

- Calendar sync (Phase 3+)
- Multi-user collaboration
- Mobile native apps (PWA sufficient for now)
- Attachments, URLs, long-form notes (3 words is the interface on purpose, but this is a design bet, not a dogma)
- Real-time cloud sync (Phase 2, optional)

Keep these separate from the red lines above.

---

## Lineage

- **Ivan Illich (1973)** — *Tools for Conviviality.* Tools have two watersheds; beyond the second they produce the opposite of their intended effect.
- **Ursula Franklin (1989)** — *The Real World of Technology.* Holistic vs. prescriptive technologies.
- **Mark Weiser (1991) / Amber Case (2015)** — Calm technology. Information at the periphery.
- **S.N. Goenka / Vipassana** — Equanimity (upekkhā) as the gap between stimulus and response.
- **Tristan Harris / James Williams (2018)** — Adversarial design and attention capture.
- **equanimi.tech (2026)** — The design discipline that fuses the above into a usable framework.

For the full intellectual foundation, see the equanimitech primer.
