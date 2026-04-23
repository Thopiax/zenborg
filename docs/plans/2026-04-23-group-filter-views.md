# Group / Filter / Views — Idea

**Date:** 2026-04-23
**Status:** Idea (pre-spec)
**Context:** Emerges from plant-page iteration. Current plant view is area-grouped only; attitude-ordering is incoming via `2026-04-21-plant-page-improvements.md`. Generalizing that direction.

## The idea

Let the user group / subgroup / filter habits (and eventually moments) by any property, and save the configuration as a **view**.

### Groupable / filterable properties

- area
- attitude
- rhythm (has / none, cadence)
- phase affinity
- tags
- health state (healthy / drifting / wilting) — once health lands
- last allocated (recent / stale / never)
- wilting status
- archived vs active

### Shape

- **Primary group** (columns): e.g. area, attitude, phase
- **Subgroup** (within column): e.g. attitude inside area, tag inside area
- **Filters** (global): exclude or include by any property
- **Sort**: within group, pick order axis
- **Saved views**: "by attitude", "wilting only", "needs planting" — user-named, selectable from a view switcher

## Why this matters

- Plant page today is fixed: group=area, sort=manual. Locks user into one lens.
- Different cycles / moods want different lenses (e.g. rebuilding a wilted garden needs health-grouped view; planning a season needs attitude-grouped view).
- Aligns w/ "Modification Rights" principle — user shapes the tool.

## Related open ideas (same neighborhood)

- Individual habit reordering — currently appears broken on plant page; fix before/alongside this lands. Manual order only makes sense within a **group**, so reorder is scoped per-view anyway.
- Search within area (from plant plan doc).
- Recommended moments for cycle planning based on attitude + time-since-allocation → could be a view ("plan candidates").

## Principles check

- Information, never score — groups/filters show neutral facts, no ranking.
- Bounded Experiences — views are user-chosen bounded lenses, not algorithmic feeds.
- Strategic Friction — switching view is a deliberate act; no auto-switching.
- Peripheral Presence — saved views persist; system doesn't suggest or reorder on its own.

## Not in scope for first pass

- No smart/auto-generated views (violates principles).
- No cross-entity joins (habits ↔ moments ↔ cycles in one grid).
- No sharing views between devices/users (pre-sync concern).

## Open questions

- Does this replace the plant page, or become a mode of it (`/plant?view=attitude`)?
- Where does the view switcher live — pane header, command palette, both?
- Do moments get the same treatment on `/cultivate`, or is this plant-only?
- How do manual drag-reorder semantics compose w/ grouping? (Reorder within group? Across groups?)
