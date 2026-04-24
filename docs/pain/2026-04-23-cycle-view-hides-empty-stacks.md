---
status: fixed
created: 2026-04-23
updated: 2026-04-23
---

# cycle view hides empty card stacks

Raw capture — 2026-04-23.

- in cycle view, if card stack is 0 (no ghosts left), the area column is hidden outside edit mode
- should show even when fully allocated — surfaces "all placed" state + keeps layout stable
- Questions:
  - show only areas with budgetedCount > 0? or any area with a plan?
  - what should an empty (all-allocated) column look like?
- Don't fix yet.

Fix — 2026-04-23: `VirtualDeckStack` (`src/components/VirtualDeckStack.tsx`) was rendering the top card when count=0 but hiding the counter badge (only shown if count>0 or edit handlers present). So count=0 stacks looked identical to count=1. Now: badge always shows (so "x0" reads as fully allocated), and count=0 stacks fade to 50% opacity to mark the drained state visually.
