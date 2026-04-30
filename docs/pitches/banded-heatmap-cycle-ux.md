# Banded Heatmap Cycle UX

**Shape Up Pitch — Big Batch (1–2 weeks)**
**Date:** 2026-04-29
**Spec reference:** `~/Downloads/Banded heatmap spec.html` (2026-04-23)

---

## Problem

The current cycle UX inside the `CycleDeck` does two things poorly.

**Navigation** is handled by `CycleStrip` — a horizontal row of 192px cards showing past/active/future cycles. It answers "which cycle am I in?" with text, not with structure. The active cycle is visually louder (dark fill) but past/future cycles are homogeneous cards; there is no continuous temporal shape that makes the chapter arc legible at a glance. Scrolling back to a past cycle requires knowing roughly where it sits.

**Creation** is handled by `CycleCalendarDialog` — a modal calendar that takes over the screen. You pick a start date, an end date, type a name, and submit. This is a form masquerading as an intent. The cycle's temporal position — when it sits relative to other cycles, whether it overlaps, how many days it spans — is only partially visible in the modal. You create it, then check whether it landed right. The non-overlap rule is enforced reactively (error message), not proactively (gesture resists at the seam).

Together these surfaces require two separate mental models: a card-row metaphor for navigation and a calendar-picker metaphor for creation. Neither communicates the cycle as a **chapter in a continuous timeline**.

The deeper issue: there is no surface in Zenborg where the question "how has my attention been tended across this arc?" is answerable with one look. The `CycleStrip` has no tending data. The `Timeline` shows three days. There is a gap between the micro (three-day window) and the macro (cycle arc). The banded heatmap closes that gap.

---

## Appetite

**Big batch — 1 week hard, 2 weeks with polish and accessibility.**

The spec is complete and implementation-ready. The data contract is a pure derivation from the existing store shape (no schema migration). The render logic (dominant area per cell, tense opacity, band states) is self-contained. The create-by-gesture replaces one existing component (`CycleCalendarDialog`) and one existing sub-component (`CycleStrip`). No existing domain entities change.

If at the midpoint the create-gesture proves too risky to land cleanly within appetite, it is the one item that can be deferred: the strip can fall back to a "press + in gap-space" keyboard-accessible affordance, deferring pointer drag to a follow-on patch.

---

## Solution sketch

### Surface to replace

The `BandedHeatmap` component slots in as a **direct replacement for `CycleStrip`** inside `CycleDeck`. It sits above the deck header (name/edit/collapse controls) and the budget columns. `CycleCalendarDialog` is retired; cycle creation moves entirely into the heatmap's create-by-gesture.

The rest of `CycleDeck` — the `CycleDeckColumn` habit budget cards, the edit mode, the collapse toggle, the "end cycle" popover — is untouched.

```
Before                          After
────────────────────────────    ────────────────────────────
CycleDeck                       CycleDeck
  CycleStrip (card row)     →     BandedHeatmap (160px strip)
  CycleDeck header              CycleDeck header
  CycleDeckColumn × N           CycleDeckColumn × N
  CycleCalendarDialog (modal) → (retired; gesture-in-heatmap)
```

The banded heatmap is `160px` fixed height. It does not grow. The CycleDeck itself remains collapsible.

### Component tree

```
src/components/
  BandedHeatmap.tsx           # Root: scroll container + fixed gutter
  BandedHeatmapBand.tsx       # Single cycle band (active/past/future rendering)
  BandedHeatmapGrid.tsx       # Phase-row × day-column grid
  BandedHeatmapCell.tsx       # Single 14×14 cell, area color + tense opacity
  BandedHeatmapNeedle.tsx     # Vermillion now-needle (position: absolute, z:3)
  BandedHeatmapAxis.tsx       # Month ticks + now tick below grid
  BandedHeatmapBracket.tsx    # Cycle name label above band
  BandedHeatmapCreateDraft.tsx # Draft band overlay during press-drag gesture
  BandedHeatmapCreatePopup.tsx # Name popup on gesture release
```

`BandedHeatmap` accepts a single prop shape:

```typescript
interface BandedHeatmapProps {
  cycles: Cycle[];
  moments: Moment[];
  areas: Area[];
  phaseConfigs: PhaseConfig[];
  today: string;
  focusDate?: string;
  onCycleSelect: (cycleId: string) => void;
  onCycleCreate: (props: CreateCycleProps) => void;
}
```

No Legend State observables are accessed inside `BandedHeatmap` directly — all data is passed in. The parent (`CycleDeck`) owns the reactive subscriptions. This keeps the heatmap pure and testable.

### Derived view model

A `deriveBandedHeatmapViewModel(cycles, moments, areas, phaseConfigs, today)` pure function produces:

```typescript
interface HeatmapViewModel {
  days: HeatmapDay[];
  bands: HeatmapBand[];
  rows: Phase[];
  todayIndex: number;
}

interface HeatmapDay {
  date: string;
  cycleId: string | null;
  tense: 'past' | 'active' | 'future';
  cells: Record<Phase, HeatmapCell>;
}

interface HeatmapCell {
  areaId: string | null;
  state: 'planted' | 'fallow' | 'unplanted';
  tense: 'past' | 'active' | 'future';
}
```

Cell state derivation (per spec §11):

1. Find moments where `moment.day === day.date && moment.phase === phase`.
2. None and `date <= today` → fallow. None and `date > today` → unplanted.
3. ≥1 → group by areaId, pick area with most moments (tie-break: most recently added). That `areaId` is the cell color.
4. Apply tense opacity: past 0.55, active 1.0, future 0.70.

The `Phase.NIGHT` row is included only if `phaseConfigs` has a config with `isVisible: true` for `NIGHT`.

### Scroll mechanics

On mount, `useEffect` sets `scrollLeft = (todayIndex * STRIDE) - container.clientWidth / 2 + CELL / 2`. Double-rAF pattern. The "return to now" chip appears in header-right when `today` column is out of viewport (`IntersectionObserver` on the needle).

### Create-by-gesture

`BandedHeatmapCreateDraft` handles the pointer lifecycle:

- `pointerdown` on a gap-space column → record `dragStart = date`
- `pointermove` → extend `dragEnd = date`; validate range against existing cycles; set draft state `valid | invalid`
- `pointerup` in valid state → open `BandedHeatmapCreatePopup` anchored to draft midpoint
- `pointerup` in invalid state → discard silently
- Pressing inside an existing cycle column: cursor `not-allowed`, no drag begins

Popup: auto-focused name input (no auto-capitalize, per project memory), read-only date line, optional intention input, `Cmd+Enter` / "plant cycle" to commit, `Esc` / click-outside cancels.

### Interaction with `cycleDeckSelectedCycleId$`

Bracket/cell clicks call `onCycleSelect(cycleId)` which sets `cycleDeckSelectedCycleId$` in ui-store. The `CycleDeck` header and budget columns already respond — no changes downstream.

### Mobile (landscape) resolution

CLAUDE.md declares landscape-only. The spec's §10 breakpoints map:

| Viewport | Behavior |
|---|---|
| ≥ 900px | Full spec — 14px cells, 48px gutter |
| 600–899px | Same cell size; gutter shrinks to 36px |
| < 600px | Wrong surface — fall back |

Landscape phones (iPhone 14: 844px; iPhone SE: 568px) fall in 600–899px for most, into `< 600px` only for SE. CLAUDE.md says portrait already shows `LandscapePrompt`. The portrait-transpose spec is irrelevant given the constraint. At `< 600px` render a collapsed stub ("cycles — tap to expand"). Safety net, not a design target.

### Stone-tones and the vermillion `--now` accent

CLAUDE.md: "only use stone tones unless attributed to an area."

The `--now` vermillion (`oklch(0.55 0.14 25)`, ~`#c55a2f`) is a **temporal marker**, not an area attribution. Same role as the calendar's "today" ring. Principles permit "history and neutral feedback" (Peripheral Presence). The needle is a single, still, non-animated element.

Verdict: vermillion `--now` permitted as temporal accent. Constraints:
- Used **only** for needle frame and axis tick.
- Never blend with area colors.
- No animation.

Area palette: map spec's illustrative `oklch` values to actual `area.color` hex from store. Render `backgroundColor: area.color` with CSS `opacity` for tense — no new color tokens needed.

---

## Data contract diff

| Spec field | Zenborg shape | Delta |
|---|---|---|
| `cycles[].id` | `Cycle.id` | none |
| `cycles[].name` | `Cycle.name` | none |
| `cycles[].start` | `Cycle.startDate` | rename at call site |
| `cycles[].end` | `Cycle.endDate` | rename; null = ongoing |
| `cycles[].areaMix` | not stored — derive | compute in view model |
| `moments[].cycleId` | `Moment.cycleId` | none |
| `moments[].date` | `Moment.day` | rename at call site |
| `moments[].phase` | `Moment.phase` (Phase enum) | map enum to string |
| `moments[].areaId` | `Moment.areaId` | none |
| `today` | `TimeService.getToday()` | inject from parent |
| `focusDate` | optional, defaults to today | from `cycleDeckSelectedCycleId$` |

**No migration. No schema change.** `CycleService.createCycle` already enforces non-overlap (`findOverlappingCycle`) — gesture's visual feedback is pre-validation; service enforces it definitively.

Draft state derived, not stored: a transient ui-store flag (`recentlyCreatedCycleIds: Set<string>`) clears on session load.

---

## Build sequence

**Phase 1 — Data layer (Day 1)**
- `deriveBandedHeatmapViewModel` pure function in `src/infrastructure/state/bandedHeatmapViewModel.ts`
- Unit tests: dominant-area selection, fallow vs unplanted, tense derivation, gap-day handling, NIGHT phase visibility
- Verify `CycleService.createCycle` enforces non-overlap

**Phase 2 — Static render (Days 2–3)**
- Create the 9 components above
- Render with mock data from spec specimen (70-day dataset)
- Verify cell colors use `area.color` from store
- Verify stone-tones on all chrome
- Verify `--now` vermillion appears only on needle and axis tick

**Phase 3 — Scroll mechanics (Day 4)**
- Scroll container with fixed left gutter
- Mount-time centering on today (double-rAF)
- "Return to now" chip via `IntersectionObserver`
- Horizontal-only scroll; vertical passes through
- Bounds clamp to `[firstCycleStart, lastCycleEnd]`

**Phase 4 — Band behavior + cycle selection (Day 5)**
- Band states (active fill, past/future hairline only)
- Bracket click → scroll + `cycleDeckSelectedCycleId$` update
- Cell hover → header metadata swap
- Cell click → `onCycleSelect` + minimal scroll
- Keyboard nav (`←`/`→` pan by day, `Shift+arrow` by week, `Home` → today, `n` enters create mode)

**Phase 5 — Create-by-gesture (Days 6–7)**
- Pointer event handlers for drag in gap-space
- Draft band overlay (valid/invalid states)
- Live readout (date range + day count, or error)
- `BandedHeatmapCreatePopup` with name/intention, keyboard shortcuts
- Retire `CycleCalendarDialog`
- Accessibility: `aria-live` on draft, `role="dialog"` + focus trap on popup

**Phase 6 — Integration + mobile safety net (Days 8–9)**
- Wire into `CycleDeck` in place of `CycleStrip`
- Wire `onCycleCreate` to `CycleService.createCycle`
- Remove `CycleStrip` import + `createDialogOpen` state from `CycleDeck` (3 render paths: `CycleDeck.tsx` lines 428, 446, 480)
- `< 600px` stub fallback
- Verify on 600–899px (landscape phone)
- Verify dark mode (stone-900 canvas, stone-50 paper for active band)

**Phase 7 — Polish (Days 10–14, can slip)**
- `prefers-reduced-motion` guards
- Full ARIA grid labeling
- Focused band state (brackets darken on >400ms center dwell)
- Hovered band state (bracket opacity → 100% on cell hover)
- Scrollbar styling (6px, `--hair` thumb, always-visible)

---

## Rabbit holes

**Drag interaction on touch (landscape phone).** Touch and pointer events diverge on iOS Safari for drag-create. Use `touch-action: none` on scroll container during active drag. Test on real device early — Safari's scroll-vs-drag disambiguation is where gesture implementations break.

**"Draft cycle" visual state.** Draft = newly-created in popup until first moment is allocated, tracked via transient ui-store `recentlyCreatedCycleIds`. Clears on session load. Avoids schema change.

**Scroll performance with many days.** 70 days = ~1120px wide. 365 days = ~5840px. CSS grid is fine for 70. For 365+, observe before reaching for canvas/virtualization.

**The `CycleStrip` deletion.** Imported in three render paths in `CycleDeck.tsx` (lines 428, 446, 480). Audit carefully — risk is incomplete substitution.

---

## No-gos

- No completion counts on bands ("12 moments this cycle" violates surface contract).
- No streak indicators or consistency patterns.
- No animation on needle or bands. User-initiated motion only.
- No "+ add moment" on empty cells. Planting happens on timeline.
- No blending of two area colors in one cell.
- No portrait mobile design. `LandscapePrompt` already handles portrait.
- No resize-by-dragging cycle edges in this batch. Creation only.
- No `isDraft` field added to `Cycle`. Derived from ui-store.
- No new color tokens beyond `--now` vermillion.

---

**Note (added by roundtable orchestrator, 2026-04-29):** This pitch was shaped without consulting `git log` recent history. Before execution, verify: no in-flight branch already addresses banded heatmap or `CycleStrip` replacement.

*Spec: `~/Downloads/Banded heatmap spec.html` (2026-04-23)*
*Related idea: `docs/ideas/2026-04-23-harvest-dense-heatmap.md` — harvest gets the dense minimap variant*
