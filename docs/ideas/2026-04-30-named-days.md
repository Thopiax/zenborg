# Named days

Raw capture — 2026-04-30.

- We should be able to give names for days.
- Adjacent angles:
  - Days are nodes in the timeline; today they're just a date string. A name turns a day into a chapter beat ("travel day", "deep work", "rest").
  - Could surface inline on the day-row label in the Timeline, in the heatmap bracket area when zoomed, in the harvest recap.
  - Cycles already get names + intentions. This is the same idea one zoom level down.
- Questions:
  - Schema: `Day` entity with `{ date, name, intention? }`, or just a `dayName` field on something existing? Days aren't currently entities — they're derived from dates that have moments allocated.
  - Optional: leave most days unnamed; name only the ones that warrant it. Don't surface empty labels.
  - Should the name auto-suggest from dominant area / first moment / cycle name?
  - Edit affordance: where does the user name a day — in the Timeline (top of the day-row), via command palette (`:name today travel day`), or both?
- Don't shape yet.
