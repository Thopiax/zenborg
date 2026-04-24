# Plant Page Improvements — Idea

**Date:** 2026-04-21
**Status:** Idea (pre-spec)
**Context:** Follows on from attitude-rhythm-health landing. Once habits carry attitude + rhythm + derived health, the `/plant` area view can surface that context meaningfully.

## What to explore

- **Order habits per attitude** within an area — e.g. BEING at top (crystallized), then BUILDING / PUSHING (active practice), then KEEPING (relational), then BEGINNING (exploration), then Unstated. Makes the area's shape legible at a glance.
- **Per-attitude information display** on each habit chip:
  - KEEPING — days since last allocation
  - BUILDING / PUSHING — current-period pace ("2 of 3 this week")
  - BEGINNING — total allocation count ("4th time")
  - BEING — no count, maybe a subtle mark
  - Reuses existing `attitude-feedback.ts` functions; no new copy needed.
- **Search / sort / filter** within an area card:
  - Search by name (and eventually aliases, when that lands)
  - Sort by: attitude, last allocation, wilting-first, alphabetical
  - Filter: attitude, wilting-only, has-rhythm, no-rhythm

## Principles check

- Information, never score — all of the above display neutral facts, no grades/percentages.
- Peripheral Presence — display is ambient; user visits the view, surface doesn't push.
- Bounded Experiences — no infinite scroll or feed; area is a bounded plot.

## Not in scope for first pass

- No per-habit notifications when status changes.
- No cross-area global view; stays area-scoped.
- No visual reordering via drag — ordering is derived from attitude, not manual (for the attitude-ordered mode).

## Related

- `docs/plans/2026-04-21-attitude-rhythm-health-design.md` — the design this builds on.
- Alias feature (separate, unspec'd) — required before search-by-alias can work.
