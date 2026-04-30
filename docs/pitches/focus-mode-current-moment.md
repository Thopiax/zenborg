# Focus mode — `currentMoment` as attention primitive

Pitch — 2026-04-30. Source: `docs/ideas/2026-04-30-focus-mode-current-moment.md`

## Problem

Today, allocating a moment is the only commitment Zenborg captures. The user plants "morning run" into Today/Morning, then closes the app and goes to do it. The card sits in the timeline cell as past intention, not present engagement. There is no surface that says *I am inside this moment now*, and there is no machinery for that statement to mean anything to other tools.

The user has named the gap directly: a focus mode for moments. Not a productivity timer — Zenborg already rejects that frame. What is missing is a primitive — `currentMoment` — that the rest of the system can read. Once that primitive exists, three downstream behaviors become possible:

1. The equanimi browser shields can engage *because* a moment is current, instead of always-on.
2. A macOS toolbar surface can show "you are tending: morning run — 18 min remaining" without dragging the user into the web app.
3. A later LLM friction layer (unrelated screens, unrelated Claude sessions, unrelated tabs) has a target intention to compare drift against.

Without `currentMoment`, every one of these has to invent its own activation primitive. With it, they share a single anchor: the moment the user has chosen to be inside.

The pitch is to ship that primitive — small, stored, obviously correct — and one engagement surface (a card-level affordance on today's moments) that lets the user enter and leave it. Everything else is deferred but legible.

## Appetite

**Small.**

Rationale: this is a one-field domain change (`currentMomentId` on a singleton-ish ui state) plus a state-transition use case (`engageMoment` / `releaseMoment`) plus a card affordance and a thin "current" chrome on the timeline cell. No new entity. No persistence migration of `Moment` itself. No tray. No shields. No LLM. The big questions in the idea (verb, default-duration storage, shield orchestration, tray surface) are answered by *deferring* them — this batch picks the smallest shape that makes the next pitches possible.

The medium-sized adjacent appetites — Tauri tray, shield orchestration, default duration on Habit — get clean follow-on pitches once `currentMoment` is real.

## Solution

### Principles fit check (do this first)

This pitch threads three red lines and one principle. The shape below is what survives all four.

**Red line — no completion.** Engaging a moment must not flip a "done" bit. Releasing a moment must not record a streak, a percent-complete, or a time-tracked total presented as a score. The simplest way to honor this is to make engagement **stateless on the Moment entity**. The moment knows nothing about whether you ever engaged with it. Engagement lives on a separate, transient pointer (`currentMomentId`) and an optional historical session log that stores duration as a fact, not a score. No checkmarks render on the card after release. The card returns to its prior state.

**Red line — no notifications.** Releasing a moment when the timer expires does *not* trigger a popup, sound, badge, or modal. Time elapsing is silent. The toolbar (later) shows the countdown in the periphery; the web app dims the "current" chrome to a passive "released" tone. The user discovers the end the next time they look. Principle 4 (Peripheral Presence) is the test: the system never visits the user, the user visits the system.

**Red line — no engagement-as-score.** "3 focus sessions today" is information; "5-day focus streak" is a score. The session log this pitch introduces is **append-only and unrendered in this batch**. It exists so future surfaces (review, harvest) can pull from it. No UI reads it yet.

**Principle — Bounded Experiences.** The duration is configurable but bounded. Default 25 minutes when nothing else is set; per-habit override allowed (deferred); maximum 4 hours hard cap. No "infinite focus" mode. The user enters and leaves; the boundary is a feature.

Verdict: focus mode is a permitted primitive provided (a) it stores no completion state on `Moment`, (b) ending is silent, (c) the session log is invisible this batch.

### Where zenborg ends and equanimi begins

The consolidation doc names this directly: zenborg is cultivation, equanimi is protection, tides bridge them. Focus mode is cultivation that *signals* protection. The split that survives the principles:

- **Zenborg owns** `currentMomentId`, the engagement state machine, the engage/release card affordance, and the file-based signal that other surfaces read.
- **Equanimi reads** the signal. Shields decide for themselves whether to engage based on which moment is current (e.g., a shield could activate only when no moment is current, or only when the current moment's area is "Craft", etc.). That decision graph is equanimi's domain.

The mechanism: zenborg writes `~/.zenborg/current-moment.json` whenever `currentMomentId` changes. The browser extension watches that file (or a related signal — bridging mechanism is equanimi's pitch, not this one). Same shape as `active-context.json` from the areas-orchestration pitch:

```json
{
  "momentId": "...",
  "areaId": "...",
  "habitId": "...",
  "engagedAt": "2026-04-30T08:14:00Z",
  "plannedDurationMinutes": 25,
  "expiresAt": "2026-04-30T08:39:00Z"
}
```

Zenborg does not call out. Zenborg writes a file. Equanimi visits that file. Peripheral Presence is preserved on both sides. This pattern is already established by the areas-orchestration pitch — focus mode reuses the same posture.

### Verb choice

Recommendation: **`engage`** (verb), **`current`** (state), **"engage"** (button label, lowercase per project memory).

Rationale:
- `play` reads as media/timer — wrong frame.
- `track` reads as quantification — wrong frame, fights the no-completion red line.
- `tend` is right philosophically (the gardening metaphor) but unfamiliar as a button verb; reserve it for prose.
- `engage` is what you do with attention. It is the word principle 4 already uses ("demand focal attention"). It is unambiguous: engaging a moment is choosing to be inside it.

The internal state name is `currentMoment` (idea phrasing) and the field is `currentMomentId`. The button is "engage". Releasing it: "release" (button), `releasedAt` (timestamp).

### `currentMoment` — derived state vs stored field

Recommendation: **stored**, in ui-store, single value.

```typescript
// src/infrastructure/state/ui-store.ts
export interface CurrentMomentState {
  momentId: string;
  engagedAt: string;          // ISO timestamp
  plannedDurationMinutes: number;
  expiresAt: string;          // engagedAt + plannedDurationMinutes
}

export const currentMoment$ = observable<CurrentMomentState | null>(null);
```

Rationale: derived state would mean asking "given moments and timestamps, which is current?" — but engagement is not a function of moment data. It is a fact about the user's current decision. There is no signal in the moment data that distinguishes "engaged" from "not engaged"; only the user knows. Storing it is the simpler, truer model.

Persistence: `currentMoment$` is persisted to localStorage (lightweight, synchronous, single value). On app load, if `expiresAt < now`, the engagement is treated as released (auto-cleared on read). This handles the "user closed the laptop mid-session" case without notification, without ceremony.

Singleton constraint: only one moment can be current at a time. Engaging a new moment while another is current implicitly releases the previous one. (No prompt, no warning — the user has already chosen.)

### Default duration — where it lives

Recommendation: **on `Habit`** as `defaultDurationMinutes?: number`, with a global fallback constant (25) when habit has none and when the moment has no habit. **Deferred from this batch.**

This batch ships with a single global default (25 minutes) and a popover on the engage button to pick a different duration ad-hoc (presets: 15 / 25 / 45 / 60 / custom). Per-habit defaults arrive in a follow-on pitch alongside the engage button polish.

Rationale for habit-level (when we ship it): the idea explored per-attitude and per-phase too. Per-attitude is too coarse — "BUILDING" doesn't predict duration. Per-phase is wrong — duration is about the activity, not the time of day. Per-habit matches user intuition: "morning run is 30 min, deep work is 90 min". Habits are also the layer where guidance and rhythm already live; duration belongs in the same neighborhood.

`Moment.plannedDurationMinutes` is *not* added in this batch. The plan duration lives on the engagement state, not the moment. The moment stays clean.

### Engagement state machine

Two transitions, one timer:

```
              engage(durationMinutes)
              ─────────────────────►
   [idle]                              [engaged]
              ◄─────────────────────
              release()  /  expiresAt < now (silent auto-clear)
```

`engageMoment(momentId, durationMinutes)`:
1. If `currentMoment$` exists, call `releaseMoment()` first (silent).
2. Validate moment exists and `moment.day === today` (focus is today-only per the idea).
3. Set `currentMoment$` to `{ momentId, engagedAt: now, plannedDurationMinutes, expiresAt: now + duration }`.
4. Append a `FocusSession` entry to the session log (see below).
5. Write `~/.zenborg/current-moment.json` via the Tauri vault writer.

`releaseMoment()`:
1. If `currentMoment$` is null, no-op.
2. Update the open `FocusSession` log entry with `releasedAt: now`.
3. Set `currentMoment$ = null`.
4. Write `~/.zenborg/current-moment.json` with `null` payload.

`expiresAt` lapsing is treated identically to `releaseMoment()` but no UI motion happens — the next render that reads `currentMoment$` sees `null` after the auto-clear at session-load. The clear is lazy: we do not run a setInterval looking for expiration. We compute "is current?" at read time. This avoids a constantly-firing timer and keeps the system silent.

### `FocusSession` log (append-only, unrendered)

```typescript
// src/domain/entities/FocusSession.ts
export interface FocusSession {
  readonly id: string;
  readonly momentId: string;
  readonly habitId: string | null;
  readonly areaId: string;
  readonly engagedAt: string;
  readonly plannedDurationMinutes: number;
  readonly releasedAt: string | null;   // null while engaged or if released auto-silently
}
```

Stored in a new vault collection `focusSessions.json`. No UI reads it this batch. Future surfaces (cycle review, harvest) can derive engagement counts from it. **Critically, no streak, no daily total, no completion percent is computed or rendered.**

The collection's existence is the only forward-compatible move this batch makes. Everything else is gated behind future pitches.

### UI — the engage affordance

Two surfaces in this batch:

**1. Card-level engage button.** On `MomentCard`, when the moment is allocated to today and is not currently engaged, a small "engage" pill appears on hover (desktop) or always-visible at lower opacity (touch). Clicking it opens a popover with duration presets (15 / 25 / 45 / 60 / custom) and an "engage" confirm. The popover follows the existing `SelectorPopover` pattern.

**2. Current-moment chrome.** When a moment is `current`, its `MomentCard` renders a subtle chrome distinct from selection: a 1px solid ring in the area color (not the 60% selection ring), a tiny non-animated indicator dot in the upper-right corner, and a "release" affordance replacing "engage". No countdown text on the card — the countdown lives on the toolbar (deferred). The card stays calm.

`TimelineCell` itself is unchanged. The chrome is owned by `MomentCard`.

A persistent thin status row in the app header (existing `PaneHeader` area) shows "engaged: morning run · 18 min remaining" in stone tones with the area color as a small dot. This is the only ambient indicator inside the web app; it does not animate, does not flash on expiry. On expiry it dims and the text becomes "released — morning run". Click "release" anywhere to clear.

### Files touched

```
src/domain/entities/FocusSession.ts            (new)
src/infrastructure/state/store.ts              (add focusSessions$ collection)
src/infrastructure/state/ui-store.ts           (add currentMoment$ observable)
src/infrastructure/persistence/vault.ts        (write/read current-moment.json)
src/application/services/FocusService.ts       (new — engageMoment, releaseMoment)
src/components/MomentCard.tsx                  (engage/release affordance + current chrome)
src/components/EngagePopover.tsx               (new — duration picker)
src/components/CurrentMomentBar.tsx            (new — header status row)
src/components/LayoutClient.tsx                (mount CurrentMomentBar)
```

No changes to `Moment.ts`, `Habit.ts`, or any existing service.

### MCP tool surface

Two read-only tools, mirroring the areas-orchestration pattern:

- `get_current_moment()` — returns the current moment state (id, area, habit, engagedAt, expiresAt) or null.
- `release_current_moment()` — silently clears `currentMoment$`. (One write tool here is justified: external surfaces — toolbar, MCP — need to release.)

`engage_current_moment(momentId, durationMinutes)` is **not** exposed in this batch. Engagement is initiated from the web UI only. This avoids the surface ambiguity of an LLM saying "I've started your focus session for you" — wrong posture. A future pitch can add it once the toolbar surface needs it.

## Boundaries

**In:**
- `currentMoment$` ui-store observable, persisted to localStorage.
- `FocusSession` entity + `focusSessions.json` vault collection (append-only, unrendered).
- `FocusService` with `engageMoment` and `releaseMoment`.
- Card-level engage popover with duration presets (15 / 25 / 45 / 60 / custom).
- Current-moment chrome on `MomentCard` + a header status row (`CurrentMomentBar`).
- File signal: `~/.zenborg/current-moment.json` written on every transition.
- MCP: `get_current_moment`, `release_current_moment`.
- Lazy expiry — no interval, no notification on lapse.

**Out (this batch):**
- Per-habit `defaultDurationMinutes` field. Use global default 25 + ad-hoc selection.
- Per-attitude / per-phase duration defaults.
- Tauri tray / menubar surface.
- Equanimi shield orchestration. Equanimi reads the file signal in its own pitch.
- LLM-driven friction (unrelated screens, websites, Claude sessions).
- Any rendering of `FocusSession` history (counts, totals, charts).
- `engage_current_moment` MCP tool.
- Engaging moments scheduled for days other than today.
- Multi-engage / parallel current moments.
- Pause / resume semantics. Release-and-re-engage covers the use case without state explosion.
- Sound, haptic, or visual feedback on expiry.

**Deferred to clearly-named follow-on pitches:**
1. **`focus-mode-tray.md`** — Tauri tray icon + menubar countdown, global shortcut to release.
2. **`focus-mode-habit-defaults.md`** — `Habit.defaultDurationMinutes` field, propagation to engage popover.
3. **`focus-mode-shield-bridge.md`** — equanimi-side pitch consuming `current-moment.json`.
4. **`focus-mode-llm-friction.md`** — much later, much riskier; needs its own principles review.

## Elements

| Layer | Element | Shape |
|---|---|---|
| Domain | `FocusSession` entity | new file, append-only log shape |
| Infrastructure | `focusSessions$` collection | new vault collection |
| Infrastructure | `currentMoment$` observable | ui-store, persisted to localStorage |
| Infrastructure | `current-moment.json` writer | extends existing vault writer |
| Application | `FocusService.engageMoment` | use case, validates today-only, writes file signal |
| Application | `FocusService.releaseMoment` | use case, silent expiry handling |
| Presentation | `MomentCard` engage/release affordance | hover pill (desktop) / persistent low-opacity (touch) |
| Presentation | `EngagePopover` | new — duration presets + custom |
| Presentation | `CurrentMomentBar` | new — header-area ambient status row |
| Presentation | Current-moment chrome | 1px area-color ring + indicator dot on `MomentCard` |
| MCP | `get_current_moment` | read-only |
| MCP | `release_current_moment` | write — clears state |

Domain language that does not change: `Moment`, `Habit`, `Area`, `Cycle`, `Phase`. The primitive composes; it does not modify.

## Risks & rabbit holes

**Principle 4 (Peripheral Presence) under load.** The `CurrentMomentBar` is the most ambient-prone element in this batch. It is permanent chrome when a moment is engaged. If we are not careful, it becomes a clock-watching surface — the user keeps glancing at the countdown, which *is* the system visiting the user. Mitigation: render the duration in coarse buckets ("18 min remaining" updates only at minute boundaries; never seconds). Stone tones, no animation, no color shift on expiry. If during build the bar feels gravitational, cut the countdown text and leave only the moment name + area dot.

**Silent expiry feels broken.** A user is used to timers that ding. Silent expiry will feel "did it work?" the first few times. This is correct — the principle holds — but it needs a single sentence in onboarding ("focus mode ends silently. you'll notice when you look."). The onboarding update is not in this batch; flag for the next docs pass.

**Singleton constraint clashes with multi-task days.** Some users will want to engage two moments at once ("I'm cooking dinner and listening to a podcast"). Reject this for now. If it returns as real feedback, model multi-engagement as a separate pitch. The 1-current-moment rule preserves the primitive's meaning.

**The `FocusSession` log is a future-completion-tracker if we are not disciplined.** The temptation in batch 2 will be to render counts ("you focused 4 times today") which crosses into score territory. Guardrail: any future pitch that proposes rendering `focusSessions` data must justify itself against the no-completion red line in this pitch's principles fit check. Add a comment in `FocusSession.ts` pointing back to this section.

**Shield boundary ambiguity.** The split (zenborg writes file, equanimi reads it) is clean in theory but assumes equanimi has a file-watcher. The browser extension does not — it lives in chrome.storage. Bridging chrome.storage and a filesystem file requires either a native messaging host or a desktop helper. This pitch does not solve that; the equanimi-side pitch (`focus-mode-shield-bridge.md`) does. Risk: until that bridge ships, the file signal is consumable only by the (future) Tauri tray and the MCP, not the browser shields. Acceptable — the primitive's existence still unblocks the bridge pitch.

**Tauri tray feasibility.** The Tauri 2 ecosystem supports tray via `tauri-plugin-tray` and the core `tray` API, and `tauri-plugin-global-shortcut` is already in `Cargo.toml` (good — global "release" shortcut is straightforward). The tray surface is a known-cost task, not exotic. Out of scope this batch but a confirmed seam.

**LocalStorage as persistence for `currentMoment$`.** localStorage is synchronous and reliable, but cleared on full browser data wipe. Acceptable: the worst case is "the user wiped browser data and Zenborg forgot they were engaged" — silent recovery is fine. Do not move this to IndexedDB; the latency would matter for the engage interaction, and the data is genuinely transient.

**File-signal write atomicity.** `~/.zenborg/current-moment.json` is written on every engage/release. If two writes race (engage immediately followed by release), the consumer must not see a stale state. Use the existing vault writer's atomic-rename pattern. Same constraint the areas-orchestration pitch flagged; same answer.

**Today-only constraint.** The idea says "any moment scheduled for today (no phase lock for now)." Enforce `moment.day === today`. Engaging an unallocated moment, a tomorrow moment, or a yesterday moment is rejected. This is conservative and correct — focus is a today action by definition. Future moments can be allocated and then engaged when "today" reaches them.

**Verb migration if `engage` proves wrong in use.** Renaming the button is cheap (one component). Renaming the field (`currentMoment$`) is also cheap (no persistence to migrate beyond a single localStorage key). Use the names; revisit after two weeks of dogfood if they feel wrong.

## No-gos

- No `engaged` / `done` / `completed` field on `Moment`.
- No streak, total, or count rendering anywhere in this batch.
- No notifications, sounds, haptics, or modals on engage, release, or expiry.
- No automatic engagement (e.g., "engage at 09:00 because morning"). Always user-initiated.
- No multi-engage. One current moment at a time.
- No tray / menubar in this batch.
- No browser extension changes in this batch.
- No LLM in this batch.
- No `engage_current_moment` MCP tool. UI-only initiation.
- No engagement on non-today moments.
- No pause/resume. Release-and-re-engage instead.
- No countdown precision below the minute.

## Pitch

Zenborg has named the room ("morning run, today, morning") but has no door. The user walks out of the app to actually do the thing, and the app stops being part of it. `currentMoment` is the door — small, silent, cheap to build, and the unblocker for everything the consolidation doc promised: tides, shields, the tray, the LLM that knows what you're inside.

The shape that survives the principles is austere on purpose. One field (`currentMomentId`), one transition (engage/release), one log (`FocusSession`, unrendered). No completion. No streak. No notification. No tray yet. No shield orchestration yet. Just the primitive, expressed in a card affordance and a quiet header strip, plus a file the future surfaces will read.

This batch costs **small**. Once it lands, the next four pitches — tray, habit defaults, shield bridge, LLM friction — each have a clean target to attach to. None of them can be coherently shaped before this one exists. Start here.

---

*Idea: `docs/ideas/2026-04-30-focus-mode-current-moment.md`*
*Related: `docs/pitches/areas-as-orchestration-layer.md` (file-signal pattern), `~/Developer/equanimitech/ZENBORG-CONSOLIDATION.md` (cultivation/protection split)*
