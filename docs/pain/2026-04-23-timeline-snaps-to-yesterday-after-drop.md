---
status: fixed
created: 2026-04-23
updated: 2026-04-23
---

# timeline snaps to yesterday after drop on today morning

Raw capture — 2026-04-23.

- drag a deck moment onto Today → Morning phase
- on drop, timeline scrolls back to Yesterday instead of staying on Today
- Hypothesis: dnd-kit auto-scroll nudges horizontal scrollLeft during drag, then `snap-x snap-mandatory` on Timeline container re-snaps to the now-nearest snap point (Yesterday) when drop reflows content
- Questions:
  - disable horizontal autoscroll on DnDProvider's DndContext?
  - change snap-mandatory → snap-proximity?
- Don't fix yet.

Fix — 2026-04-23: disable horizontal auto-scroll on the DndContext. `src/components/DnDProvider.tsx` → `autoScroll={{ threshold: { x: 0, y: 0.2 } }}`. Root cause: dnd-kit's default auto-scroll was nudging the Timeline's scrollLeft during drag, then snap-mandatory re-snapped to the now-nearest snap point (Yesterday) on drop. With horizontal auto-scroll disabled, scrollLeft stays put, so mandatory snap still aligns to Today. Kept snap-mandatory — switching to proximity broke initial mount scroll.
