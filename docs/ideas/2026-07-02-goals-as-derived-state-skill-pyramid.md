# Goals as derived state — the skill pyramid, live integrations, and attitude ↔ reality

**Date:** 2026-07-02
**Status:** captured (design vision — Rafa + Claude). Not built.
**Companions:** `2026-05-31-connect-prompts-to-habits.md` (integration), `2026-07-02-expo-mobile-client-and-device-sync.md` (reach).

The through-line of a long session: fixed per-habit frequencies are the wrong primitive. Goals should be **derived**, shaped by a skill's level and flexed by real recovery — not stored numbers you hand-edit and feel guilty against.

## The problem

A rhythm (`gym ×3`) is a **stored target**. It goes stale the moment life moves (travel, illness, a new season), it generates all-or-nothing guilt, and it must be edited in ~47 places. That's **structured, not structuring** — last month's grid imposed on this week.

## The shift: derive goals, don't store them

```
goal  =  f( attitude-policy ,  readiness )
             ▲ skill pyramid     ▲ integration
         (what SHAPE)           (how MUCH, this week)
```

- **Attitude** (the skill pyramid) decides the goal's *shape*.
- **Readiness** (the Garmin integration) flexes the *intensity* within that shape.
- You configure **6 attitude policies, not 47 habit numbers.** Change a habit's attitude → its goal recomputes. Edit a policy once → the whole garden re-derives.

Same architecture as the rest of the stack: **intention is the source of truth; goals are a derived view** — cf. zenborg's *"information, never score"* and Torneio's *derive-by-query*. Goals stop being stored state.

## The skill pyramid = zenborg attitudes

The attitude ladder already *is* Rafa's skill pyramid. Each level implies a different goal shape:

| Attitude | Goal shape |
|---|---|
| BEGINNING / RETURNING | a *tiny* floor — just show up, don't quantify |
| **KEEPING** | a **minimum standard** (maintenance floor) — hold, don't slip |
| BUILDING / PUSHING | a **stretch target** — a ceiling to climb toward |
| BEING | **no goal** — internalized (fade-by-design) |

"Minimum standards" (floors) are the **KEEPING row** — not the whole model. The earlier "4 elements, each a weekly floor" idea is the KEEPING case of this general model.

## The live integration (see `connect-prompts-to-habits`)

A habit or area declares a read-seam to the system that owns its *actuals* (`Fitness → Garmin`). Those actuals feed **both** the readiness dial (how much this week) **and** the mismatch check below.

## Attitude ↔ reality mismatch — the self-correction

Compare the declared attitude against the integration's actuals. A mismatch means the **self-label is stale**:

- **Drift-down** — PUSHING but dormant 3 weeks → *"still PUSHING, or has this become RETURNING?"*
- **Graduated-up** — BEGINNING but consistent and strong → *"this looks internalized — promote it?"* (fade-by-design, celebrated)

Resolution is **always to re-attune the attitude** (or consciously recommit) — never a score.

### Why this is philosophy-aligned (the load-bearing point)

The red line is grading **performance against a target**. A mismatch check does *not* grade performance — it checks whether the **intention (attitude) still fits reality** and invites a relabel. The judgment is on the **accuracy of the self-model**, never the **adequacy of the effort**. Surfaced as a whisper/noticing (a permitted ambient pattern) in `week-review`'s garden beat, resolved by moving the attitude. That is fade-by-design + downstream allocation + strategic friction. Aligned.

It is also the mechanism that **prevents the staleness that motivated this whole redesign**: budgets went "way off" because attitudes drifted from reality with nothing to flag the gap. The mismatch whisper keeps the pyramid honest.

## The requirement Rafa named: dynamic + easily configurable

- **Configurable:** 6 policy knobs govern the whole garden, not 47 hand-typed numbers. The policy map is user-editable (holistic control).
- **Dynamic on two axes, automatically:** (1) attitude transitions re-derive the goal shape; (2) readiness flexes intensity week to week.

## Rituals that consume it — one altitude each

Detection is **ambient** (computed continuously; the garden holds the signal per *peripheral presence*). The rituals are the *attention windows* that act on it, each at its own cadence:

| Piece | Ritual | Altitude |
|---|---|---|
| Configure attitudes + the goal-policy map (the 6 knobs) | `cycle-planning` | seasonal |
| Plant against derived goals — clear each floor, push where readiness allows | `week-planning` | weekly-forward |
| Surface attitude↔reality mismatches as noticings; re-attune or defer | `week-review` | weekly-back |
| Enact today's block, no goal noise | `sign-on` | daily |

- **Configuration lives in `cycle-planning`, never the weekly rituals.** Promoting an attitude (BEGINNING→BUILDING) or tuning a policy is a season decision — cycle-planning already sets attitudes per habit; it also becomes where the goal-policy map is tuned. The weekly rituals only *enact* and *mirror*.
- **Small re-attunements in `week-review`; structural skill-level shifts defer to `cycle-planning`.**
- **Never in `sign-on`.** A daily mismatch nag would violate the pyramid (peripheral presence, strategic friction).

## Where it lands

This is a **zenborg feature**, not a garden config the user hand-sets. It needs a place to compute derived goals and the Sail reachable off-device — so it ties to the Expo mobile client + device-sync work (`2026-07-02-expo-mobile-client-and-device-sync.md`). Build at the desk; don't hand-wipe the garden in the meantime.

## Deliberately not done

- No manual rhythm-wipe. Rhythms aren't *replaced* by floors — they're *removed as a concept*; goals are derived, so there's nothing to store. Hand-configuring today would build the wrong layer.
- No goal scoring, no completion %, no streak. The mismatch whisper is the only feedback, and it moves the attitude, not a number.
