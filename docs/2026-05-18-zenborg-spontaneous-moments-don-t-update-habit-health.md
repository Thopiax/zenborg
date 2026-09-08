---
migrated_from: equanimi.tech/project/zenborg/dev/20260518T132841Z-7rk6in.md
---

# Zenborg: spontaneous moments don't update habit health

Surfaced during 2026-05-18 weekly review.

## Problem

When a Zenborg moment is created via the spontaneous / standalone path, `habitId` is null. The health tracker doesn't credit the linked habit even when the moment's name exactly matches a habit. The act happened; the habit's `daysSinceLast` keeps climbing.

## Evidence (week of May 12–18)

* Kim habit flagged wilting at 11d silent. 4 Kim moments allocated this week (Thu + Sat ×3). All spontaneous, all `habitId: null`.

* secretariat habit: May 17 ×3 + May 18 morning all spontaneous. Habit credit only goes to the ones spawned via `spawn_spontaneous_from_habit`.

* publishing habit on May 14: same pattern.

## Why now

The wilting indicator is becoming the primary read on habit health (post-tiny-daysSinceLast UI work today). If health is wrong because of how moments were logged, the indicator misleads. Cascades into the proposed wilting lane in cycle planning + review.

## Seed solution

Auto-link by name match: if a moment's name exactly matches an existing habit's name within the same area, set `habitId` automatically on create. Optional secondary: surface unlinked-but-named-like-habit moments during weekly review for retroactive linking.

## Shape later

Roundtable decides: is "spontaneous, unlinked" a meaningful state to preserve, or is it always a bug? Currently it feels like a leak — users don't choose to detach, the UI just doesn't link by default.

## No-gos

* No auto-creation of habits from moment names (different problem, more dangerous).

* Don't retro-link historical data automatically — keep that user-driven.

## Open questions

* Should aliases match too? (e.g. "a-nickname" → Fox habit)

* Same-name across areas: ambiguous, probably skip auto-link.

* Does the rhythm-anchored ghost-allocate idea make this moot, or compound it?

