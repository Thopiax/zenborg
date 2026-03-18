# Active vs Future Cycle Visual Distinction

## Problem

When navigating between cycles via arrow navigation in CycleDeck, the active cycle and future cycles look identical. The only distinction is the subtitle text ("5 days left" vs "starts in 3 days"). The active cycle should feel "live" and prominent; future cycles should recede.

## Approach

Subtle warmth for active, cool-down for future. Uses weight and opacity rather than new visual elements or colors outside the stone palette. The distinction is felt more than seen, aligned with "calm tech."

## Header Treatment

### Active cycle (the one being lived)

- Name: `text-stone-900 dark:text-stone-100` / `font-semibold`
- Subtitle: `text-stone-600 dark:text-stone-400`
- Top border: `border-t-2 border-stone-300 dark:border-stone-600`

### Future cycle (navigated to via arrows)

- Name: `text-stone-400 dark:text-stone-500` / `font-medium`
- Subtitle: `text-stone-400 dark:text-stone-500`
- Top border: `border-t border-stone-200 dark:border-stone-700` (1px, lighter)

Arrow nav buttons and action buttons remain unchanged.

## Content Area Treatment

### Active cycle

- Full opacity, full interaction
- Drag & drop works normally
- Edit mode works normally

### Future cycle

- Entire content area: `opacity-60`
- Drag & drop disabled (cannot allocate from future deck to today's timeline)
- Edit mode still works (can budget habits for upcoming cycles)
- Subtle label at top of content: `"Planned"` in `text-stone-400 text-xs font-mono`

## Files to Modify

- `src/components/CycleDeck.tsx` — header styling conditional on `isEffectiveCycleActive`, content area opacity and drag disable, "Planned" label
- `src/components/CycleTabs.tsx` — if used, apply same active/muted distinction

## Non-Goals

- No new colors outside stone palette
- No status badges or icons
- No layout changes between active and future
