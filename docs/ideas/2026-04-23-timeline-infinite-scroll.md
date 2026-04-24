# Timeline: Infinite Scroll Navigation

**Date:** 2026-04-23
**Status:** Idea
**Focus:** Plant page Timeline

## Seed

Current Timeline renders a bounded window (daysBefore/daysAfter, default 1/1, expand via "Load earlier/later" buttons). With the banded heatmap below letting users jump to any day across cycle history, the Timeline should really be **infinite-scroll** — virtualized, navigate freely past/future without explicit "load more" clicks.

## Why

- Heatmap cell-click needs to land on any day across all cycles; expand-on-demand makes long jumps expensive.
- Infinite scroll matches the "navigated through" mental model — swipe/scroll is the gesture, not a button.
- Virtualization avoids rendering all intermediate days between today and the target.

## Open questions

- Windowing lib (react-window / react-virtuoso) vs hand-rolled range.
- Snap behavior — keep day-snap? Per-phase snap?
- How to show cycle boundaries inline (bracket banding in timeline itself)?
- Interaction with "Today" return button — still needed?

## Related

- Banded heatmap spec (pending) — click-cell-jumps-timeline needs this.
- Timeline.tsx currently uses daysBefore/daysAfter state + scrollIntoView.
