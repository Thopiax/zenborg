---
status: fixed
created: 2026-04-23
updated: 2026-04-23
---

# monday today scrolls back to yesterday

Raw capture — 2026-04-23.

- when moment is on monday (today = monday), view scrolls back to yesterday
- Questions:
  - week boundary edge case? monday-as-week-start vs today-as-anchor?
  - repro: is it only mondays or any week-start day?
- Don't fix yet.

Fix — 2026-04-23: domain `getActiveDay()` semantics preserved (morning still starts the day — correct per user mental model). Fix is at Timeline UI: scroll target now uses `isToday` (calendar today), not `isActiveDay`. Active-day border/highlight still follows morning-shift rule via `isActiveDay`.
