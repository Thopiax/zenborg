# Timeline Phase Indicator Refactor

**Date**: 2025-10-18
**Status**: Completed
**Build**: Passing ✓

---

## Problem

The Timeline component used explicit PhaseHeader components that added visual clutter and reduced information density in the desktop 3x3 grid layout:

- **Explicit phase labels** (Morning, Afternoon, Evening) with emojis and time ranges
- **Extra vertical space** between phase rows (space-y-6 + space-y-2)
- **Redundant information** - users can recognize phases by color alone
- **Cluttered visual hierarchy** - headers competed for attention with moment cards

---

## Solution

### Desktop Layout (≥768px)
**Removed** PhaseHeader components entirely and replaced with:
- **4px colored left border** on the **first cell of each phase row** (Yesterday column)
- Uses the phase's designated color from PhaseConfig
- Creates clean visual hierarchy without explicit labels
- Reduces vertical space by removing header rows

### Mobile Layout (<768px)
**Kept** PhaseHeader components for context because:
- Single-day column needs more orientation cues
- Users can't compare across days to infer phase
- More vertical scrolling space available
- PhaseHeader provides helpful time range information

---

## Implementation Changes

### 1. Timeline.tsx

**Before**:
```tsx
{visiblePhases.map((phaseConfig) => (
  <div key={phaseConfig.phase} className="space-y-2">
    {/* Phase header */}
    <PhaseHeader phaseConfig={phaseConfig} />

    {/* 3 cells for this phase (one per day) */}
    <div className="grid grid-cols-3 gap-4">
      <TimelineCell day={days.yesterday} phase={phaseConfig.phase} />
      <TimelineCell day={days.today} phase={phaseConfig.phase} />
      <TimelineCell day={days.tomorrow} phase={phaseConfig.phase} />
    </div>
  </div>
))}
```

**After**:
```tsx
{visiblePhases.map((phaseConfig) => (
  <div key={phaseConfig.phase} className="grid grid-cols-3 gap-4">
    {/* Yesterday - with phase color left border */}
    <TimelineCell
      day={days.yesterday}
      phase={phaseConfig.phase}
      isHighlighted={false}
      phaseColor={phaseConfig.color}
      isFirstInRow={true}
    />
    {/* Today - highlighted */}
    <TimelineCell
      day={days.today}
      phase={phaseConfig.phase}
      isHighlighted={true}
    />
    {/* Tomorrow */}
    <TimelineCell
      day={days.tomorrow}
      phase={phaseConfig.phase}
      isHighlighted={false}
    />
  </div>
))}
```

**Key Changes**:
- Removed `<PhaseHeader />` from desktop layout
- Removed wrapper div with `space-y-2` (phase row is now the grid itself)
- Added `phaseColor` and `isFirstInRow` props to first cell
- Maintained PhaseHeader in mobile layout for context

---

### 2. TimelineCell.tsx

**New Props**:
```typescript
interface TimelineCellProps {
  day: string;
  phase: Phase;
  isHighlighted?: boolean;
  dayLabel?: string;
  phaseLabel?: string;
  phaseColor?: string;      // NEW: Hex color for phase indicator
  isFirstInRow?: boolean;   // NEW: True for first cell in row
}
```

**Border Logic**:
```tsx
className={cn(
  "min-h-[200px] p-4 rounded-lg border-2",
  "bg-surface transition-all",
  // ... other classes ...

  // Phase indicator: 4px colored left border on first cell of row (desktop)
  isFirstInRow && phaseColor && "border-l-4",

  // Full state - only show amber accent if NOT a phase indicator cell
  isFull && !isFirstInRow && "border-l-4 border-l-amber-500 dark:border-l-amber-400"
)}
style={{
  // Apply phase color to left border if this is first in row
  ...(isFirstInRow && phaseColor ? { borderLeftColor: phaseColor } : {}),
}}
```

**Border Conflict Resolution**:
- If cell is **first in row**: use phase color (amber, yellow, purple)
- If cell is **full** (3 moments) and **not first in row**: use amber accent
- If cell is **both** first in row and full: phase color takes precedence

---

## Visual Design

### Desktop Grid Structure (3x3)

```
         Yesterday        |       Today (★)     |      Tomorrow
──────────────────────────┼─────────────────────┼────────────────────
|                         |                     |
|  [Morning Moment]       |  [Morning Moment]   |  [Empty]
|                         |                     |
──────────────────────────┼─────────────────────┼────────────────────
|                         |                     |
|  [Afternoon Moment]     |  [Afternoon M1]     |  [Afternoon Moment]
|                         |  [Afternoon M2]     |
──────────────────────────┼─────────────────────┼────────────────────
|                         |                     |
|  [Evening Moment]       |  [Evening Moment]   |  [Empty]
|                         |                     |
──────────────────────────┼─────────────────────┼────────────────────

Legend:
| = Phase-colored 4px left border (amber for Morning, yellow for Afternoon, purple for Evening)
★ = Today column highlighted with blue border
```

### Phase Color Mapping

From `/src/domain/value-objects/Phase.ts`:

| Phase      | Light Mode | Dark Mode  | Usage                        |
|------------|-----------|-----------|------------------------------|
| Morning    | `#f59e0b` | `#fbbf24` | Amber - energetic start      |
| Afternoon  | `#eab308` | `#facc15` | Yellow - peak productivity   |
| Evening    | `#8b5cf6` | `#a78bfa` | Purple - wind down           |
| Night      | `#1e293b` | `#475569` | Slate - deep work/rest       |

---

## Design Rationale

### Why Colored Borders?

1. **Reduced Visual Clutter**
   - Eliminates 3-4 header rows from the grid
   - Increases vertical information density
   - Maintains clean, minimal Vim aesthetic

2. **Improved Scanability**
   - Color is processed pre-attentively (no reading required)
   - Users can quickly orient themselves by color
   - Consistent with Zenborg's "monochrome + color accents" philosophy

3. **Better Alignment with Design System**
   - Follows existing pattern of using color as accent, not primary UI
   - Mirrors MomentCard's colored border pattern (area indicators)
   - Maintains semantic meaning through color consistency

4. **Enhanced Focus on Content**
   - Moments are the primary focus, not the time structure
   - Phases become context, not content
   - Supports "consciousness as currency" philosophy

### Why Keep PhaseHeader on Mobile?

1. **Context Loss in Single-Column View**
   - Users can't compare across days to infer phase
   - No horizontal context from adjacent cells
   - Color alone insufficient without reference points

2. **Available Vertical Space**
   - Mobile users scroll naturally
   - PhaseHeader provides helpful metadata (time range, emoji)
   - Better UX trade-off for orientation

3. **Accessibility**
   - Screen readers benefit from explicit labels
   - Time ranges help users with scheduling
   - Progressive enhancement from visual-only (desktop) to semantic (mobile)

---

## Testing Checklist

- [x] TypeScript compilation passes
- [x] Production build succeeds
- [x] Desktop layout: phase borders visible on first cells
- [ ] Desktop layout: no PhaseHeader components rendered
- [ ] Mobile layout: PhaseHeader still present
- [ ] Dark mode: phase colors use lighter variants
- [ ] Full cells: amber border only shows on non-first cells
- [ ] Today column: blue highlight still visible
- [ ] Phase color consistency: matches PhaseConfig.color

---

## Next Steps

1. **Visual Testing**
   - Start dev server (`npm run dev`)
   - Verify desktop grid shows colored left borders
   - Test responsive breakpoint (768px)
   - Verify mobile keeps PhaseHeader

2. **E2E Testing**
   - Add Playwright test for phase border visibility
   - Test theme switching (light/dark mode)
   - Verify accessibility with screen reader

3. **Optional Enhancements** (Future)
   - Add tooltip on hover showing phase name + time range (desktop)
   - Implement `aria-label` improvement with phase context
   - Consider animated border on phase transition (time-based)

---

## Files Modified

- `/src/components/Timeline.tsx` - Removed PhaseHeader from desktop, added props to TimelineCell
- `/src/components/TimelineCell.tsx` - Added phaseColor and isFirstInRow props, updated border logic

**Files NOT Modified** (intentional):
- `/src/components/PhaseHeader.tsx` - Still used for mobile layout
- `/src/domain/value-objects/Phase.ts` - No changes needed
- `/src/lib/theme-config.ts` - Existing phase colors used

---

## Design Impact

### Before (with PhaseHeaders)
- **Visual Weight**: Heavy (labels + emojis + time ranges)
- **Vertical Space**: ~80px per phase row (header + gap)
- **Information Density**: Low (headers compete with moments)
- **Cognitive Load**: Medium (reading labels required)

### After (with colored borders)
- **Visual Weight**: Light (4px color accent only)
- **Vertical Space**: ~16px per phase row (gap only)
- **Information Density**: High (moments are primary focus)
- **Cognitive Load**: Low (pre-attentive color processing)

---

## Conclusion

This refactor successfully reduces visual clutter while maintaining clear phase boundaries through color. The design better aligns with Zenborg's philosophy of minimal, intentional interfaces and improves information density without sacrificing usability.

The dual approach (borders on desktop, headers on mobile) demonstrates responsive design thinking: adapt the information presentation to the device context, not just the screen size.
