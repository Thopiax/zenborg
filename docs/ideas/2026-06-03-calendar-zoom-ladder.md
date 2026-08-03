---
$attestation:
  $type: tech.equanimi.secretariat.stamp
  signer: did:key:z6MkjB8PQaN1vuUzdtnJsxyXR2f8d3tckGHkUYZMDytQsfak
  act: attest
  docHash: sha256:3b96216cf5d9c731cc7fe8b1cf49cef7d7430b9e966e1c2f9c1027344a8eabf6
  docFilename: 2026-06-03-calendar-zoom-ladder.md
  stampedAt: 2026-06-03T22:04:46.607238Z
  signature: ed25519:Al4XastGtvRrlZ9yHy26zdWCvrDxQgkG2vxJo/hbAvejF75Fm75kxuZpPMSWL4+lgmnZllnzmQipdxPEo8OLDw==
---
# Zenborg Calendar & Zoom Ladder — plan

> Captured 2026-06-03, late night (wind-down). Consolidates the calendar-zoom-views reference + the circular-day brief into one plan — they were always the same project. High-altitude; conceptual only, no implementation until a spec exists (brainstorming hard-gate).

***

## 1. Vision — "Google Earth for your moments"

A continuous, pinch-zoomable map of your intentions. You travel from the season down to a single moment along one axis of precision, and the representation **re-rasterizes** at each depth — like map tiles re-rendering labels and roads as you zoom. The calendar sync is plumbing; **the pull is the zoom.**

## 2. The zoom ladder, as views

Each altitude in the domain model (Cycle → Day → Phase → Hour) gets a view:

| Zoom       | View                           | Grain          |
| ---------- | ------------------------------ | -------------- |
| Cycle      | **heatmap** (full zoom-out)    | season density |
| Cycle/Week | **week grid** (template below) | timed blocks   |
| Day        | **circular** (sleep at bottom) | radial day     |
| Hour       | (within week/day)              | clock + event  |

## 3. Navigation — pinch / rerasterize (the spine)

Settled 2026-06-03. **Google Earth / Maps for your moments**: continuous pinch-zoom across the whole ladder, representation **re-rasterizing** at each zoom band (level-of-detail).

```
  pinch OUT ──────────────────────────────▶ coarser
  Cycle          Week          Day           Hour
  heatmap   →    grid    →    circle    →    event blocks
  (blended       (timed        (sleep-        (precise
   day cols)      columns)      anchored)      moments)
  ◀────────────────────────────────────── pinch IN
     continuous gesture · detail RE-RASTERIZES at each band
```

* **Continuous gesture (map-like) + discrete LOD rendering (legible).** Reconciles the phoropter idea we floated: the "lenses" survive as the **level-of-detail bands**; pinch is the continuous travel between them. You don't *choose* a lens — you zoom, and detail re-rasterizes when you cross a band.

* **Transition = rerasterization, not fold/morph.** Zooming in, coarser marks resolve into finer ones (blended day-column → phase arcs → timed beads). Detail fades in with depth.

* **Desktop solved by the metaphor:** maps zoom on scroll-wheel / trackpad-scroll natively. Pinch on touch, scroll-to-zoom on pointer — same continuous axis.

**Equanimitech note:** Principle 5 (Attentional Granularity — gross↔subtle) made literally spatial. Bounded on the zoom axis (max-out = Cycle, max-in = the moment) and laterally by cycle dates — a map of a *finite* season, not an infinite plane.

## 4. Views in detail

### 4a. Cycle heatmap (full zoom out)

Season-scale pattern mirror — self-monitoring at the coarsest altitude.

⚠ **Equanimitech flag:** a heatmap reads dangerously close to a GitHub-style streak/contribution grid → red line ("no streak counts, no completion grid"). Keep it **texture/density by area color**, never intensity-as-achievement. It shows *where attention went*, not *how well you did*. Monochrome base; area color carries meaning. No "best week" highlighting.

**Refinements (2026-06-03, observed live):**

* **Cycle titles more visible.** Bracket labels read faint/secondary right now. At the heatmap altitude the *cycle name* is the primary handle — it should anchor each band more confidently (weight/contrast), while still deferring to area color as the meaning-carrier. Tune so the eye lands on "which season is this" before "what's the density."

* **Combined area colors when zoomed out.** As columns shrink toward full zoom-out, the 3 phase-rows × per-phase area stripes get too fine to read. Collapse them: each **day-column blends into a single combined color** — the day's area mix as one band (proportional blend, or dominant-area tint). Progressive disclosure across the zoom ladder: per-phase stripes at mid-zoom → blended day-column at full zoom-out. Keeps the coarsest view as *texture*, not pixel-counting. Blend stays area-attributed (no synthetic "intensity" color past the red line).

  * **What the coarse view communicates** (the framing principle): at full zoom-out we deliberately **stop showing the sequence** — not which moment came in which phase, in what order. We show **distribution of time / sequentiality / big themes**: how attention is *spread* across areas over the season, where the broad runs of a theme sit, what the cycle was *about*. Precise sequencing is a mid/fine-zoom concern; the heatmap answers "what was this season's shape," not "what did I do Tuesday morning." This is *why* the blend is honest — it's surfacing proportion + thematic flow, exactly the grain the coarsest altitude should carry.

### 4b. Week grid (template in §7)

**Phase 1's destination**: current Zenborg moments, serialized to timed blocks via `PhaseConfig.startHour/endHour`.

⚠ **Adapt to Zenborg's design system before use:**

* Template uses indigo/blue/pink accents. Zenborg is **monochrome (stone) + area color only**. → events colored **by area**, base stone. Strip indigo "Add event" / today-pill accents to stone or area.

* Mobile = **landscape only** (portrait not considered).

* No modals — inline editing.

### 4c. Day — circular, sleep at the bottom

The **Day** rung rendered radially — a sleep-framed clock face, not a clock-rigid one.

```
              ☀ phase 2 (midday)
        phase 1  ╱      ╲  phase 3
              ╱            ╲
    wake ▸ ◜                ◝ ◂ bedtime
    routine │   24h rim     │   routine
              ╲            ╱
                ╲        ╱
              ███ SLEEP ███   ← anchored at 6 o'clock
```

* **24h radial face**, arcs stretch to actual rhythm (code-till-5am → sleep arc shrinks, phases swell). Human-rhythm-shaped, not clock-dogma.

* **Sleep = solid arc at the bottom**, the gravitational base. **Wake/bedtime routines = thin bracket arcs** flanking it.

* **3 phases = broad arcs across the top.** Moments = beads/segments on the rim, **colored by area**.

* **Now = a sweeping hand.** **Untimed moments = a center cluster** (they ride *inside* the day, not pinned to the rim).

* A circle *closes* → Bounded Experiences, no infinite scroll.

⚠ **Open tension — zooming a circle is hard.** The map metaphor is *flat/linear*; the day-circle is *radial* — different topology, so the pinch-zoom model breaks at this band. Two paths:

1. **Flat continuum (de-risked):** Day = a finer *linear* zoom of the timeline; the **circle becomes a separate toggleable "dial" view, off the pinch axis.** Pinch works cleanly heatmap→grid→hours; circle isn't on the zoom path.
2. **Ring unrolls (gorgeous, hardest):** the Day→Hour transition is the circle *unspooling* into the linear hour-strip, cut at sleep/bottom — the one non-flat rerasterization ("open the day to work inside it").

**Lean:** build the flat continuum first; treat the circle as a delightful **side-view, not a mandatory zoom rung.** Promote to the unroll later if it earns the cost.

### 4d. Hour

Lives inside the week/day at full zoom-in: precise clock-time + duration. A moment's optional time-binding (implementation intention) materializes here as a calendar event.

## 5. Roadmap & strategic decisions

```
Phase 1   EventKit — moments gain time           (the instrument; iPhone via Mac/iCloud)
Phase 2   Behavioral graph from co-occurrence    (the mirror — only visible once moments
                                                   have times; oracle-free, introspective)
Phase 3+  Fluid UX (merge, untimed micro-acts,
          zoom ladder), reporting, sharing
~ plumbing  CalDAV when web parity / bidir matters (not a vision phase; the Next.js
                                                     deployed version needs it, EventKit can't)
~ elsewhere Oracles → Perceive/keel               (NOT Zenborg — witnessing is extrospective;
                                                     Zenborg only allocates, never grades)
```

**Calendar approach (Decision):** EventKit-first (Mac is the hub; iCloud propagates Mac↔iPhone for free, best sync, most local-first). CalDAV later for the deployed Next.js version + web-side bidirectional. `.ics` subscription rejected — read-only kills "then sync from."

**Oracles cut (Decision):** oracles belong to the Perceive/keel combination, not Zenborg. Keeps Zenborg pure (allocates intention, never surveils/scores) and the behavioral graph (§Phase 2) stays introspective — built from the user's own allocation data, not external witnesses.

## 6. Constraints (non-negotiable)

* Monochrome **stone** base; **area color only** for meaning

* **Landscape** mobile only (portrait not considered)

* **No modals** — inline editing

* Sleep-anchored radial; untimed moments = center cluster

## 7. Skills to pull (fresh session, in order)

1. `frontend-design` — distinctive, production-grade visual
2. `vercel-react-view-transitions` — the rerasterize/crossfade between LOD bands, pinch-driven
3. `tailwind-design-system` — token discipline

## 8. Open questions for tomorrow

* How do **floating phases** map to arc angles? (Proportional to actual hours, or equal thirds?)

* Interaction model: **tap rim to place** a moment? drag a bead to retime?

* Does the **hand move** or the **rim rotate**?

* Where are the **LOD band thresholds**? (at what zoom does heatmap → grid → circle → events?)

* Rerasterization rendering: crossfade between LOD layers, or progressive detail-in?

* ~~Pinch mechanics~~ **resolved** → continuous zoom, re-rasterize at LOD bands (map-style), not snap-to-rung.

* ~~Desktop input~~ **resolved** → scroll-to-zoom (map convention), same axis as pinch.

***

## 9. Week-view template (Tailwind UI + Headless UI) — verbatim reference

```tsx
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisHorizontalIcon } from '@heroicons/react/20/solid'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'

export default function Example() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-none items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-white/15 dark:bg-gray-800/50">
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">
          <time dateTime="2022-01">January 2022</time>
        </h1>
        <div className="flex items-center">
          <div className="relative flex items-center rounded-md bg-white shadow-sm outline outline-1 -outline-offset-1 outline-gray-300 md:items-stretch dark:bg-white/10 dark:shadow-none dark:outline-white/5">
            <button
              type="button"
              className="flex h-9 w-12 items-center justify-center rounded-l-md pr-1 text-gray-400 hover:text-gray-500 focus:relative md:w-9 md:pr-0 md:hover:bg-gray-50 dark:hover:text-white dark:md:hover:bg-white/10"
            >
              <span className="sr-only">Previous week</span>
              <ChevronLeftIcon aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              className="hidden px-3.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus:relative md:block dark:text-white dark:hover:bg-white/10"
            >
              Today
            </button>
            <span className="relative -mx-px h-5 w-px bg-gray-300 md:hidden dark:bg-white/10" />
            <button
              type="button"
              className="flex h-9 w-12 items-center justify-center rounded-r-md pl-1 text-gray-400 hover:text-gray-500 focus:relative md:w-9 md:pl-0 md:hover:bg-gray-50 dark:hover:text-white dark:md:hover:bg-white/10"
            >
              <span className="sr-only">Next week</span>
              <ChevronRightIcon aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="hidden md:ml-4 md:flex md:items-center">
            <Menu as="div" className="relative">
              <MenuButton
                type="button"
                className="flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-white/5 dark:hover:bg-white/20"
              >
                Week view
                <ChevronDownIcon aria-hidden="true" className="-mr-1 size-5 text-gray-400 dark:text-gray-500" />
              </MenuButton>

              <MenuItems
                transition
                className="absolute right-0 z-10 mt-3 w-36 origin-top-right overflow-hidden rounded-md bg-white shadow-lg outline outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in dark:bg-gray-800 dark:-outline-offset-1 dark:outline-white/10"
              >
                <div className="py-1">
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Day view</a>
                  </MenuItem>
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Week view</a>
                  </MenuItem>
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Month view</a>
                  </MenuItem>
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Year view</a>
                  </MenuItem>
                </div>
              </MenuItems>
            </Menu>
            <div className="ml-6 h-6 w-px bg-gray-300 dark:bg-white/10" />
            <button
              type="button"
              className="ml-6 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
            >
              Add event
            </button>
          </div>
          <div className="ml-6 md:hidden">
            <Menu as="div" className="relative">
              <MenuButton className="relative flex items-center rounded-full text-gray-400 outline-offset-8 hover:text-gray-500 dark:text-gray-400 dark:hover:text-white">
                <span className="absolute -inset-2" />
                <span className="sr-only">Open menu</span>
                <EllipsisHorizontalIcon aria-hidden="true" className="size-5" />
              </MenuButton>

              <MenuItems
                transition
                className="absolute right-0 z-10 mt-3 w-36 origin-top-right divide-y divide-gray-100 overflow-hidden rounded-md bg-white shadow-lg outline outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in dark:divide-white/10 dark:bg-gray-800 dark:-outline-offset-1 dark:outline-white/10"
              >
                <div className="py-1">
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Create event</a>
                  </MenuItem>
                </div>
                <div className="py-1">
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Go to today</a>
                  </MenuItem>
                </div>
                <div className="py-1">
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Day view</a>
                  </MenuItem>
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Week view</a>
                  </MenuItem>
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Month view</a>
                  </MenuItem>
                  <MenuItem>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white">Year view</a>
                  </MenuItem>
                </div>
              </MenuItems>
            </Menu>
          </div>
        </div>
      </header>
      <div className="isolate flex flex-auto flex-col overflow-auto bg-white dark:bg-gray-900">
        <div style={{ width: '165%' }} className="flex max-w-full flex-none flex-col sm:max-w-none md:max-w-full">
          <div className="sticky top-0 z-30 flex-none bg-white shadow ring-1 ring-black/5 sm:pr-8 dark:bg-gray-900 dark:shadow-none dark:ring-white/20">
            <div className="grid grid-cols-7 text-sm/6 text-gray-500 sm:hidden dark:text-gray-400">
              <button type="button" className="flex flex-col items-center pb-3 pt-2">M{' '}<span className="mt-1 flex size-8 items-center justify-center font-semibold text-gray-900 dark:text-white">10</span></button>
              <button type="button" className="flex flex-col items-center pb-3 pt-2">T{' '}<span className="mt-1 flex size-8 items-center justify-center font-semibold text-gray-900 dark:text-white">11</span></button>
              <button type="button" className="flex flex-col items-center pb-3 pt-2">W{' '}<span className="mt-1 flex size-8 items-center justify-center rounded-full bg-indigo-600 font-semibold text-white dark:bg-indigo-500">12</span></button>
              <button type="button" className="flex flex-col items-center pb-3 pt-2">T{' '}<span className="mt-1 flex size-8 items-center justify-center font-semibold text-gray-900 dark:text-white">13</span></button>
              <button type="button" className="flex flex-col items-center pb-3 pt-2">F{' '}<span className="mt-1 flex size-8 items-center justify-center font-semibold text-gray-900 dark:text-white">14</span></button>
              <button type="button" className="flex flex-col items-center pb-3 pt-2">S{' '}<span className="mt-1 flex size-8 items-center justify-center font-semibold text-gray-900 dark:text-white">15</span></button>
              <button type="button" className="flex flex-col items-center pb-3 pt-2">S{' '}<span className="mt-1 flex size-8 items-center justify-center font-semibold text-gray-900 dark:text-white">16</span></button>
            </div>

            <div className="-mr-px hidden grid-cols-7 divide-x divide-gray-100 border-r border-gray-100 text-sm/6 text-gray-500 sm:grid dark:divide-white/10 dark:border-white/10 dark:text-gray-400">
              <div className="col-end-1 w-14" />
              <div className="flex items-center justify-center py-3"><span>Mon{' '}<span className="items-center justify-center font-semibold text-gray-900 dark:text-white">10</span></span></div>
              <div className="flex items-center justify-center py-3"><span>Tue{' '}<span className="items-center justify-center font-semibold text-gray-900 dark:text-white">11</span></span></div>
              <div className="flex items-center justify-center py-3"><span className="flex items-baseline">Wed{' '}<span className="ml-1.5 flex size-8 items-center justify-center rounded-full bg-indigo-600 font-semibold text-white dark:bg-indigo-500">12</span></span></div>
              <div className="flex items-center justify-center py-3"><span>Thu{' '}<span className="items-center justify-center font-semibold text-gray-900 dark:text-white">13</span></span></div>
              <div className="flex items-center justify-center py-3"><span>Fri{' '}<span className="items-center justify-center font-semibold text-gray-900 dark:text-white">14</span></span></div>
              <div className="flex items-center justify-center py-3"><span>Sat{' '}<span className="items-center justify-center font-semibold text-gray-900 dark:text-white">15</span></span></div>
              <div className="flex items-center justify-center py-3"><span>Sun{' '}<span className="items-center justify-center font-semibold text-gray-900 dark:text-white">16</span></span></div>
            </div>
          </div>
          <div className="flex flex-auto">
            <div className="sticky left-0 z-10 w-14 flex-none bg-white ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-white/5" />
            <div className="grid flex-auto grid-cols-1 grid-rows-1">
              {/* Horizontal lines */}
              <div
                style={{ gridTemplateRows: 'repeat(48, minmax(3.5rem, 1fr))' }}
                className="col-start-1 col-end-2 row-start-1 grid divide-y divide-gray-100 dark:divide-white/5"
              >
                <div className="row-end-1 h-7" />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">12AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">1AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">2AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">3AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">4AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">5AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">6AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">7AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">8AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">9AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">10AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">11AM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">12PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">1PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">2PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">3PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">4PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">5PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">6PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">7PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">8PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">9PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">10PM</div></div>
                <div />
                <div><div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs/5 text-gray-400 dark:text-gray-500">11PM</div></div>
                <div />
              </div>

              {/* Vertical lines */}
              <div className="col-start-1 col-end-2 row-start-1 hidden grid-rows-1 divide-x divide-gray-100 sm:grid sm:grid-cols-7 dark:divide-white/5">
                <div className="col-start-1 row-span-full" />
                <div className="col-start-2 row-span-full" />
                <div className="col-start-3 row-span-full" />
                <div className="col-start-4 row-span-full" />
                <div className="col-start-5 row-span-full" />
                <div className="col-start-6 row-span-full" />
                <div className="col-start-7 row-span-full" />
                <div className="col-start-8 row-span-full w-8" />
              </div>

              {/* Events */}
              <ol
                style={{ gridTemplateRows: '1.75rem repeat(288, minmax(0, 1fr)) auto' }}
                className="col-start-1 col-end-2 row-start-1 grid grid-cols-1 sm:grid-cols-7 sm:pr-8"
              >
                <li style={{ gridRow: '74 / span 12' }} className="relative mt-px flex sm:col-start-3 dark:before:pointer-events-none dark:before:absolute dark:before:inset-1 dark:before:z-0 dark:before:rounded-lg dark:before:bg-gray-900">
                  <a href="#" className="group absolute inset-1 flex flex-col overflow-y-auto rounded-lg bg-blue-50 p-2 text-xs/5 hover:bg-blue-100 dark:bg-blue-600/15 dark:hover:bg-blue-600/20">
                    <p className="order-1 font-semibold text-blue-700 dark:text-blue-300">Breakfast</p>
                    <p className="text-blue-500 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300"><time dateTime="2022-01-12T06:00">6:00 AM</time></p>
                  </a>
                </li>
                <li style={{ gridRow: '92 / span 30' }} className="relative mt-px flex sm:col-start-3 dark:before:pointer-events-none dark:before:absolute dark:before:inset-1 dark:before:z-0 dark:before:rounded-lg dark:before:bg-gray-900">
                  <a href="#" className="group absolute inset-1 flex flex-col overflow-y-auto rounded-lg bg-pink-50 p-2 text-xs/5 hover:bg-pink-100 dark:bg-pink-600/15 dark:hover:bg-pink-600/20">
                    <p className="order-1 font-semibold text-pink-700 dark:text-pink-300">Flight to Paris</p>
                    <p className="text-pink-500 group-hover:text-pink-700 dark:text-pink-400 dark:group-hover:text-pink-300"><time dateTime="2022-01-12T07:30">7:30 AM</time></p>
                  </a>
                </li>
                <li style={{ gridRow: '122 / span 24' }} className="relative mt-px hidden sm:col-start-6 sm:flex dark:before:pointer-events-none dark:before:absolute dark:before:inset-1 dark:before:z-0 dark:before:rounded-lg dark:before:bg-gray-900">
                  <a href="#" className="group absolute inset-1 flex flex-col overflow-y-auto rounded-lg bg-gray-100 p-2 text-xs/5 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15">
                    <p className="order-1 font-semibold text-gray-700 dark:text-gray-300">Meeting with design team at Disney</p>
                    <p className="text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300"><time dateTime="2022-01-15T10:00">10:00 AM</time></p>
                  </a>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## 10. Wave lens (speculative — not committed)

> *"Everything is wave; as above, so below."* A substrate metaphor for the zoom ladder. Capture, not commitment — pick lenses later. **Information, never score.**

**Ontology mappings:** rhythm = frequency · phase = position-on-wave (physics sense) · day = circadian period (sleep = trough) · cycle = bounded wave-packet · co-occurrence = **resonance** (constructive) / **collision** (destructive interference — habits that cancel) · attention = the signal you shape; equanimity = a low-turbulence waveform.

**The spine — pinch slides the Gabor/Heisenberg tradeoff.** Gabor's limit (the signal-processing form of Heisenberg): a signal cannot be localized precisely in *time* and *frequency* at once — **Δt · Δf ≥ a constant**. In Zenborg the **zoom level *is* the window width**:

- **Zoom in = narrow window** → precise *time* (this moment, this hour) but no rhythm — measuring frequency needs many periods. You see **events, not cadence**.
- **Zoom out = wide window** → integrates the whole season → precise *frequency/rhythm* (which habits recur, the dominant themes) but you lose *when*. You see **cadence, not events**.
- **Pinch = sliding the window** along the Δt·Δf curve. The product is conserved: **there is no "see-everything" zoom.** You always trade time-precision for frequency-precision.

This is *why* the heatmap (§4a) shows distribution/themes not sequence, and the Hour view shows moments not rhythm — and why showing both at once would be fighting physics (it reads as clutter). Precisely, the ladder is a **continuous wavelet transform / multiresolution analysis** — narrow windows at high frequency, wide at low; pinch traverses its scales.

**Equanimitech reading:** the uncertainty principle is also a meditation truth — *you cannot be fully present to the moment and survey the whole pattern in the same instant.* Zoom is choosing your relationship to time. The physics and the practice agree.

**Novel depictions:**
- **Spectrogram-as-heatmap** — rhythms as horizontal bands by area color; structurally a frequency portrait, not a streak grid (dodges the red line by construction).
- **Fourier "what is this season made of"** — a graphic-EQ of your dominant rhythms; proportion + theme.
- **Destructive interference** — habits that crowd the same trough cancel (new, useful signal: "these two fight," not "you failed").
- **Cycle as wave-packet** — a finite Gaussian envelope (onset → crest → wind-down) = Bounded Experiences made visual.
- **Great Wave (Hokusai)** — fractal self-similarity = scale-invariance made art; foam = untimed micro-activities riding atop the big motion; Mt. Fuji = the still intention/anchor; ukiyo-e line work fits monochrome + one area accent.

**Wild interaction — volume buttons as the tuning dial (iPhone).** Repurpose volume ↑/↓ as zoom (frequency-band tuning) — the phone becomes a radio dial scanning season ↔ moment. Extension: **sonification** — tuning faintly plays your rhythm, an eyes-free/peripheral way to "listen" to your season (calm-tech ambient). Reality: iOS restricts volume-button hijacking (precedent: camera shutter) — fine for a **native/Tauri demo**, not a web PWA.

⚠ **Guardrails:** the metaphor is the *substrate*, not necessarily literal UI · amplitude = information (how much attention), never score (how well) · keep bounded (finite packet, not endless signal).

