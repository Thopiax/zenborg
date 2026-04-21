# Area Board Builder — Design

> Replace AreaGallery card grid with horizontal scrolling columns on the /plant tab.

## Problem

The /plant tab has a split-pane layout: AreaGallery (left) + CyclePane (right). We want to simplify by removing the cycle pane and switching from a card grid to a column-based board — matching the CycleDeckBuilder pattern already used elsewhere.

## Design

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  [🏃 Wellness (3)]  [🎨 Craft (5)]  [🤝 Social (2)]  [+ New Area]  │
│   ━━━━(green)━━━━    ━━━━(blue)━━━━   ━━━(orange)━━━               │
│  ┌──────────────┐   ┌──────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ Morning Run  │   │ Deep Work    │  │ Family Time │  │  Click  │ │
│  │ Meditation   │   │ Side Project │  │ Friends     │  │  to     │ │
│  │ Stretching   │   │ Read         │  └─────────────┘  │  create │ │
│  └──────────────┘   │ Write        │  [+ Add habit]    └─────────┘ │
│  [+ Add habit]      └──────────────┘                                │
│                     [+ Add habit]                                    │
└──────────────────────────────────────────────────────────────────────┘
                            ← horizontal scroll →
```

Full-width, no split panes. Horizontal scroll with snap points.

### Component Hierarchy

```
PlantPage                          # Page — owns DndContext, all drag handlers
└── AreaBoardBuilder               # Horizontal scroll container
    ├── AreaBoardColumn[]          # One per Area (sortable for reorder)
    │   ├── AreaColumnHeader       # Emoji picker + name + burger menu
    │   ├── PlanHabitsList         # Sortable DraggableHabitItems (reused)
    │   └── AddHabitButton         # Footer
    └── EmptyAreaColumn            # Trailing "+" column for area creation
```

### AreaColumnHeader

Compact header consolidating all area controls:

- **Left**: Emoji button (opens picker popover) + area name (click to edit inline)
- **Right**: Habit count + burger menu (MoreVertical)

Burger menu dropdown:
1. Color picker (inline swatch row)
2. Edit name (triggers inline editing)
3. Archive area

### Column Dimensions

Uses existing `columnWidth.scrollableClassName` (`w-full md:w-[22.5rem] md:flex-shrink-0`).
3px colored divider under header. `min-h-[300px]` content area.

### Drag & Drop

Three cases (same handlers as today minus cycle-deck):

1. **Habit reorder within area** — `arrayMove` on habits sorted by order
2. **Habit move to different area** — update `habit.areaId`
3. **Area reorder** — `arrayMove` on areas via SortableContext

Each column is both a `useSortable` (for area reorder) and wraps a `SortableContext` (for habit reorder within). Each column also has `useDroppable` with `targetType: "area"` for cross-area drops.

### Layer Boundaries

| Layer | Changes |
|-------|---------|
| Domain | None |
| Application | None |
| Infrastructure/State | None |
| Presenter | New components, simplified PlantPage |

### Files

| Action | File |
|--------|------|
| Create | `src/components/AreaBoardBuilder.tsx` |
| Create | `src/components/AreaBoardColumn.tsx` |
| Create | `src/components/AreaColumnHeader.tsx` |
| Create | `src/components/EmptyAreaColumn.tsx` |
| Modify | `src/app/plant/page.tsx` — remove PanelGroup, CyclePane, PaneHeader |
| Reuse | `DraggableHabitItem`, `PlanHabitsList`, `HabitFormDialog` |
| Deprecate | `AreaGallery`, `PlanAreaCard` (no longer imported from /plant) |

## Non-Goals

- No changes to domain entities or application services
- No changes to habit form dialog pattern
- PlanAreaCard and AreaGallery are not deleted (may be used elsewhere), just no longer imported from /plant
