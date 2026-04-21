# UI Refinements Batch - Design

**Date**: 2026-02-22
**Scope**: Timeline navigation, cycle builder stability, area gallery polish

---

## 1. Timeline Navigation Buttons

**Problem**: Timeline shows only 3 days (yesterday/today/tomorrow) with no way to see earlier or later days.

**Solution**: Add expand buttons at each edge of the horizontal scroll.

- Left edge: "Earlier" button appends 3 past days per click.
- Right edge: "Later" button appends 3 future days per click.
- A "Today" pill appears when the user has expanded beyond the default range, scrolling back to the active day on click.
- No maximum cap.

**Files**: `Timeline.tsx`, uses existing `getExtendedTimelineDays(daysBefore, daysAfter)`.

**State**: `daysBefore` and `daysAfter` as `useState`, starting at 1 each.

**Styling**: Monochrome stone, small unobtrusive buttons (`font-mono text-xs`), chevron icons.

---

## 2. Cycle Builder Stack Height Fix

**Problem**: Clicking increment/decrement on a `MomentStack` changes `paddingTop` dynamically (0px, 4px, 8px based on layer count), which shifts the badge buttons vertically, forcing the user to re-aim their mouse.

**Solution**: Always reserve the maximum `paddingTop` (8px for 2 layers) regardless of actual count. The visual layers still render conditionally, but the container height stays stable.

**Files**: `MomentStack.tsx` -- change `paddingTop: showLayers ? behindLayerCount * 4 : 0` to a fixed `paddingTop: 8` (when controls are present).

---

## 3. Remove Default Area Guard

**Problem**: Areas with `isDefault: true` don't show the options dropdown (archive button), so the rightmost default area card appears to be missing its menu.

**Solution**: Remove the `!area.isDefault` condition from `PlanAreaCard.tsx:214`. All areas show the archive dropdown.

**Files**: `PlanAreaCard.tsx` -- remove conditional wrapper around `DropdownMenu`.

---

## 4. Center Area Gallery

**Problem**: Area cards align to the left of their flex container. When cards don't fill the row, the layout looks off-balance.

**Solution**: Add `justify-center` to the flex wrapper in `AreaGallery.tsx`.

**Files**: `AreaGallery.tsx:182` -- add `justify-center` to `className`.
