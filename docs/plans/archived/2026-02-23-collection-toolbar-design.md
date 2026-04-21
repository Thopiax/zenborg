# Collection Toolbar System

> Reusable sort, filter, and group system for moment/habit containers.

## Problem

The DrawingBoard is deprecated in favor of cycle-based containers (CycleDeck, CycleDeckBuilder). These containers need a shared, configurable system to sort, filter, and group items. The current `DrawingBoardToolbar` is hardcoded to one container and only supports grouping.

## Solution

A **Legend State store factory + toolbar component** pattern. Each container declares its capabilities via a config object. A factory produces a reactive store. A generic toolbar reads the store's config to render controls and writes state on interaction. A pure processing pipeline applies filter/sort/group to items.

No React context needed. Legend State observables are globally accessible and reactive.

## Architecture

```
createCollectionStore(config)  -->  Observable<CollectionStore<T>>
         |                                    |
         | config: what's available            | state: what's selected
         | (sort/filter/group options)         | (sortBy, filters, groupBy)
         v                                    v
  CollectionToolbar                    processCollection()
  (reads config, writes state)         (pure fn: items + state -> groups)
```

## Core Types

### CollectionConfig

```typescript
type EntityType = "moment" | "habit" | "area";

interface CollectionConfig<T> {
  id: string;
  entityType: EntityType;
  sortOptions?: SortOption<T>[];
  filterOptions?: FilterOption[];
  groupOptions?: GroupOption<T>[];
  defaultSort?: string;
  defaultGroupBy?: string;
}
```

### Sort, Filter, Group Options

```typescript
interface SortOption<T> {
  key: string;
  label: string;
  compareFn: (a: T, b: T, ctx: SortContext) => number;
  directions?: ("asc" | "desc")[];
}

interface FilterOption {
  key: string;
  label: string;
  type: "enum" | "multi-select";
  values: () => FilterValue[];
}

interface FilterValue {
  key: string;
  label: string;
  emoji?: string;
  color?: string;
}

interface GroupOption<T> {
  key: string;
  label: string;
  groupFn: (items: T[], ctx: GroupContext) => MomentGroup[];
}
```

### Contexts

```typescript
interface SortContext {
  habits: Record<string, Habit>;
  areas: Record<string, Area>;
}

interface GroupContext {
  habits: Record<string, Habit>;
  areas: Record<string, Area>;
  phaseConfigs: Record<string, PhaseConfig>;
}
```

## Store Factory

```typescript
function createCollectionStore<T>(config: CollectionConfig<T>) {
  return observable({
    config,
    sortBy: config.defaultSort ?? null,
    sortDirection: "asc" as "asc" | "desc",
    filters: {} as Record<string, string[]>,
    groupBy: config.defaultGroupBy ?? null,
  });
}
```

## Filter Semantics

- **AND across categories**: attitude=BUILDING + phase=MORNING = items matching both
- **OR within category**: tags=[focus, health] = items with either tag

## Processing Pipeline

Pure function: `processCollection(items, state, config, ctx)`

Pipeline order: **Filter -> Sort -> Group**.

## Predefined Options

Reuse existing functions from `src/lib/grouping.ts`.

| Type | Key | Description |
|------|-----|-------------|
| Sort | `stackCount` | By moment count per habit |
| Sort | `attitude` | By attitude enum order (Beginning -> Being) |
| Sort | `phase` | By phase config order |
| Filter | `attitude` | Enum chips for each Attitude |
| Filter | `phase` | Enum chips for each visible Phase |
| Filter | `tags` | Multi-select from unified tags |
| Group | `area` | Wraps `groupByArea` |
| Group | `attitude` | Wraps `groupByAttitude` |
| Group | `phase` | Wraps `groupByPhase` |
| Group | `tag` | Wraps `groupByTag` |

## Container Stores

Module-level instances in `src/infrastructure/state/collections.ts`:

```typescript
export const cycleDeckCollection$ = createCollectionStore<Moment>({
  id: "cycle-deck",
  entityType: "moment",
  sortOptions: [stackCountSort, attitudeSort, phaseSort],
  filterOptions: [attitudeFilter, phaseFilter, tagsFilter],
  groupOptions: [areaGroup, attitudeGroup, phaseGroup],
  defaultGroupBy: "area",
});

export const cycleDeckBuilderCollection$ = createCollectionStore<Moment>({
  id: "cycle-deck-builder",
  entityType: "moment",
  sortOptions: [stackCountSort, attitudeSort, phaseSort],
  filterOptions: [attitudeFilter, phaseFilter, tagsFilter],
  groupOptions: [areaGroup, attitudeGroup, phaseGroup, tagGroup],
  defaultGroupBy: "area",
});
```

## Toolbar Component

`CollectionToolbar` takes `collection$` as prop. Renders three sections based on config:

- **Sort**: Segmented chips (one active) + direction toggle
- **Filter**: Chip rows per filter option, multi-select for tags
- **Group**: Segmented chips (one active or "none")

Monochrome stone design.

## Consumer Integration

```typescript
function CycleDeckBuilder({ cycleId }) {
  const state = use$(cycleDeckBuilderCollection$);
  const deckMoments = use$(deckMoments$);

  const { groups } = processCollection(
    deckMoments, state, state.config,
    { habits: habits$.peek(), areas: areas$.peek(), phaseConfigs: phaseConfigs$.peek() },
  );

  return (
    <>
      <CollectionToolbar collection$={cycleDeckBuilderCollection$} />
      {groups.map(group => <Column key={group.groupId} group={group} />)}
    </>
  );
}
```

## File Structure

```
src/lib/collection/
  types.ts        -- Core type definitions
  store.ts        -- createCollectionStore factory
  process.ts      -- processCollection pure pipeline
  options.ts      -- Predefined sort/filter/group options
  index.ts        -- Barrel export

src/infrastructure/state/
  collections.ts  -- Container store instances

src/components/
  CollectionToolbar.tsx  -- Generic toolbar component
```
