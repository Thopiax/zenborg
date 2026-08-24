# Sign-on — the morning screen

**Date:** 2026-08-08
**Status:** design, not yet built
**Consumers:** zenborg (owner), keel (reads the outcome)

The day opens in zenborg. This spec describes the screen that opens it: what it
shows, where the data comes from, and the one field it writes.

## Why this exists

keel's `signOnGate` already holds `Edit`/`Write`/`MultiEdit`/`NotebookEdit`/`Bash`
until today has a name (`apps/agent/core.mjs`, `signOnBlocks`). It keys on
`dayNotes.json` — a non-empty `title` for `focusDayKey(now)`, the 04:00 roll — and
fails **open** on a missing or garbled vault. Reads, `~/journals` and `~/.keel`
stay writable throughout.

So the lock exists and the key exists. What is missing is the **door**: today the
only way to name the day is inline title editing in the Plant timeline
(`DayHeaderTitle.tsx`), which is a field, not a doorway. `/` redirects straight to
`/plant`.

The `/sign-on` skill walks the same ground as a conversation. That works, but it
puts the day-open inside Claude Code — the thing the gate is holding shut. The key
cannot live inside the box it opens.

## What the routine is

Four beats, in order. The embodied wake-up (sun · sit · move) is **not** here — it
is pen-and-paper and already done by the time this screen opens. Do not add it.

1. **How you slept** — last night, read and released. Not scored, not trended.
2. **Today's intentions** — the moments already planted on today, per phase.
3. **One priority intention** — pick a single one. *New.* The skill currently names
   two (personal + professional); this replaces that with one.
4. **Tasks** — what is waiting in Things and in Linear, as **real items with real
   links**, not counts. A count helps you decide nothing; two issue titles decide
   the morning. Capped at three per source with an "and N more" tail, per the
   Bounded Page Rule.

   Links need no new modelling: `Moment.refs` is already `readonly string[]` —
   *"URLs this moment refers to"* — and its parser already anticipates
   `things:///show?id=…`. A listed task opens in its own app; it does **not** set
   the priority.

   **No ranking, no multi-select.** The single priority intention is the point of
   this design; ranking six items each morning is a chore, and multi-select
   quietly reinstates the two priorities it replaced.

Beats 1 and 4 are read-only. Beat 3 is the only write on the screen, and it is one
touch.

**Beats 2 and 3 render as one section.** Reviewing today's intentions and picking
the priority are the same list looked at twice: show today's moments once, and a
tap marks one as the priority. Four beats, three sections.

## The one data-model change

`DayNote` gains an optional field:

```ts
priorityMomentId?: string   // UUID of the moment that is today's priority
```

Day-scoped, on the record that already means "this day", owned by the writer that
already owns it. It outlives the current block, which is the whole point — the
active moment turns over as blocks change and would lose the day's priority by
lunch.

**Selecting the priority also names the day.** If `title` is empty, it is set to
the priority moment's name. One touch satisfies both the new field and keel's
existing gate, and **the gate logic needs no change** — it still asks only whether
today has a name, never what the name says. (keel's deny *string* does change, to
carry a way in; see The cue.)

*Rejected:* a `priorityMomentId` that lives on `Moment`. The pointer would be
identical on every instance of a recurring habit, and it would mean touching the
moment entity for something that is a property of the day.

*Deferred, not built:* also arming `activeMoment` when the priority is picked.
Natural follow-on, but a second write for a second concept — let the day-scoped
one prove itself first.

## Where the data comes from

Beat 2 is zenborg's own vault — read natively, no machinery.

Beats 1 and 4 are not. Sleep lives in keel's subtree; Things is a local app;
Linear is an API. Three integrations for a screen you look at for a minute would
sink this.

**They are already integrated — as MCP servers.** MCP is JSON-RPC over stdio; a
model is one possible client, not a required one. A protocol declares its calls
and a dumb client dispatches them, daily, with nothing intelligent in the loop.

Rejected alternative: have Claude Code pre-generate each morning's screen with the
data baked in. It works, and it costs an agent run every single day. The screen
must open whether or not anyone is talking to a model.

### The runtime

One Node sidecar, invoked **one-shot**:

```
zenborg-protocol-run sign-on   →   resolves every declared read, prints JSON, exits
```

A Tauri command shells out to it; the frontend renders the result.

zenborg already has every piece of this: it bundles sidecars (`externalBin` +
`src-tauri/scripts/build-sidecars.sh`), ships its own MCP server compiled with
bun, and depends on `@modelcontextprotocol/sdk` — which ships the client, not
only the server.

*ponytail: one-shot per screen open. No long-lived client, no connection
management, no streaming. Make it long-lived when a mid-screen refresh is
actually needed — a stale reading on a screen open for 60 seconds is not a
problem worth a daemon.*

### The server registry

zenborg needs its own list of which MCP servers it may spawn — **not** inherited
from Claude Code's config. A small file zenborg owns, which doubles as the
security boundary: an allowlist of servers, and per screen an allowlist of tools.

**No credentials enter zenborg.** Each MCP server already holds its own — Garmin's
login, Linear's token. The app stores none, and the local-first posture is
unchanged. Do not later "simplify" this by putting a token in `tauri-plugin-store`.

### Failure is normal, not exceptional

Any of the three sources can be down, unauthenticated, or slow. A beat that cannot
resolve renders as **absent, not broken** — the screen still opens, the priority
can still be picked, the gate still lifts. Mirrors the substrate's fail-soft rule:
a missing collection means empty, never an error.

A hard timeout per call, and the screen never blocks on the network to let you
through it.

## The screen

`/` routes to the sign-on screen when today has no title, and redirects to
`/plant` as it does now once it does. That is the entire trigger — no flag, no
"shown today" record, because the DayNote title already answers the question. Same
key keel uses, one source of truth.

**The escape hatch:** a five-second press-and-hold on a *skip* control leaves the
screen without naming the day. It navigates to `/plant` and the screen is not
shown again **until the app is relaunched** — held in memory, never written to
disk, so nothing has to remember a skip across days. The gate stays shut, which is
the honest outcome, but zenborg never traps you inside a ritual: deliberate
friction, not a wall. Without the in-memory skip, navigating back to `/` would
re-trap you, which would make the hold pointless.

**Register:** quiet, present-tense, one screen. This is a doorway — you cross it
and leave. It is explicitly *not* a control center; `/plant` is that, and it
already exists. Resist every future request to add a panel here.

### Composition

The page file is a manifest — every concern on screen is a named child, nothing
inline. The reference is `behale/crush`'s `MicoHomePage`, fifteen lines of real
code, which also records its own restraint: three tabs designed, two commented
out, one content region shipped.

```
SignOnPage
  <SignOnMasthead />     date · "sign on" · hairline rule
  <Beat label="SLEPT">      last night, mono numerals
  <Beat label="TODAY">      today's moments — tap one to make it the priority
  <Beat label="WAITING">    real linked items, capped 3 per source
  <DayNoteBody />        the day's own markdown, click to edit — exists
  <SignOnFoot />         commit · hold-to-skip
```

`Beat` is the one new primitive, earning its place at three uses rather than one:
mono eyebrow label per the Labels spec, hairline separation, φ-ladder section gap,
and **loading / unavailable / ready baked in**, so no beat can forget to handle an
unreachable source. That three-state discipline is the other thing lifted from the
reference — `MicoVideoGalleryContent` branches on searching, empty and loaded as
first-class states.

**One page, not a wizard.** Three sections, fitting on a laptop screen without
scrolling. Two of the three are read-only and only one is a decision; stepping
would mean clicking through two read-only screens to reach the single choice. The
`/sign-on` skill paces its beats because a conversation is linear — a screen holds
three things at once. Honors the Bounded Page Rule.

**What is deliberately not lifted from the reference.** `DESIGN.md` is org-wide and
wins: cards-on-a-surface become a **hairline matrix** (`gap: 1px`, rule background,
paper cells — the Hairline-First Rule); the selection **modal** becomes inline
(*"inline editing by default, no dialog and no modal"*); **infinite scroll** is
forbidden outright; the colored `primary` header bar becomes a masthead with a
hairline bottom rule. Analytics capture does not come across at all.

Note for implementation: zenborg's `--radius: 0.625rem` is flagged in `DESIGN.md`
as shadcn drift that should come down to the 4px ceiling.

### Why the briefing is not a markdown document

Considered and rejected: generating the whole screen as markdown, rendering it
with links, and letting it be edited.

**Links do not require markdown.** SLEPT is three numbers and WAITING is a list of
titles with hrefs — both already structured in memory. Generating markdown from
them and parsing it back is a round-trip through a text format to arrive where it
started, and it costs a parser dependency `DayNoteBody` explicitly refused:
*"zenborg has no markdown parser, and pulling one in to italicise a day note would
be a dependency for decoration."* An `<a>` is not markdown.

**Editing is already solved.** `DayNote.body` is free markdown and `DayNoteBody`
already edits it — click, Escape to cancel, blur or Cmd/Ctrl+Enter to commit. The
sign-on screen includes that component; it does not reimplement it, and it does
not need the briefing to be a document in order to offer a place to write.

**Portability is not a reason.** A markdown blob would render on TRMNL, in the
extension, on a phone — but so does the structured briefing, and better. This is
the conclusion the workout already forced: **data travels, renderers do not.**
TRMNL has its own `trmnl-template.liquid`; shipping markdown to every surface is
one renderer pretending to be portable.

The rejected option becomes right if the day's briefing ever needs to be read by
something with no renderer at all — a plain file in the vault, opened in an editor.
That is a different requirement from this screen.

### Build from what exists

This screen is assembly, not invention. Nothing below is new work:

- **`DayHeaderTitle` + `application/services/DayNoteService`** — the day-title
  write path already exists and is already what keel's gate reads.
  `priorityMomentId` extends that service; no new service.
- **`MomentCard`** — the TODAY beat is today's moments with area attribution,
  which this already does, selection rings included.
- **`src/lib/design-tokens.ts`** — `spacing`, `typography`, `momentCard`, `grid`,
  `animation`, `keyboardShortcuts`, `ariaLabels`. Styling comes from here, never
  ad-hoc utility classes.
- **`PaneHeader`** — the masthead.
- **`DayNoteBody`** — the day's markdown note, already click-to-edit against the
  same `DayNoteService`. Included as-is; the screen writes no prose of its own.

`src/components/ui` holds no button and no card, only accordion, command, dialog,
drawer, dropdown-menu, emoji-picker, input, popover, select, visually-hidden. That
absence is deliberate and consistent with the Hairline-First Rule: `Beat` is a
hairline section, and **no card primitive gets added**.

### Collisions to settle first

Reuse surfaces these early, which is the argument for it.

1. **`MomentCard`'s plain click opens the edit modal**, but on sign-on a tap marks
   the priority. Add an interaction-mode prop; do not fork the component.
2. **Alt-click already sets the active moment** — block-scoped, the intention keel
   surfaces in every session. The priority is day-scoped. Two near-identical
   gestures with different lifetimes need distinguishing, which brings forward the
   deferred question of whether picking a priority should also arm the active
   moment.
3. **`elevation` tokens predate flat-at-rest** and are likely legacy alongside the
   already-stripped `--glass-*` tokens. Verify before use.

### Match the app as built, not the system as written

`MomentCard` renders a **full area-color fill** (`backgroundColor: area.color`),
`rounded-lg` (8px), semibold sans at 1.25rem, a hover lift, and a `◎` glyph when
the moment is active. `DESIGN.md` prescribes something different: area color "as a
border or pill rather than as a fill, so that text contrast is never at the mercy
of a user-chosen hue," and a 4px radius ceiling.

**Sign-on follows the app.** A doorway screen must not unilaterally start an
app-wide card migration, and a new screen that looks foreign inside its own app is
the worse failure. Closing that drift is a separate, deliberate decision covering
`/plant` and every other surface at once.

*(`phaseBackgrounds` is not part of this drift: it is tonal steps on the stone
ramp, which is exactly what the system permits. An earlier draft of this spec
claimed it assigned hues. It does not.)*

## The local assistant

The screen should help think the priority through, not just display it. A local
model (Ollama, already serving on `localhost:11434` with `qwen3:4b`,
`lfm2.5`, `qwen3.6:35b`) does the part that is genuinely language.

**Three constraints, in order of importance.**

**Never on the critical path.** Ollama down, model still pulling, machine cold —
the screen opens, the priority is pickable, the gate lifts. The assistant is an
affordance, never a dependency. This does not reverse the no-model-at-runtime
decision: assembling the briefing stays deterministic, and only deliberation is
model work.

**It observes and asks; it never recommends.** An assistant that names your
priority destroys the thing it is attached to — sovereignty is the floor of the
pyramid and the priority is the principal's to name. It may surface a tension, a
repetition, or the obvious unasked question. It may not rank, propose, or score.

**It cannot be Claude Code.** Claude Code is exactly what the gate holds shut, so
the assistant that helps open the day cannot live behind that door. Same argument
that put sign-on in zenborg rather than in a skill.

**Most of the noticing needs no model.** Run the deterministic checks first and let
the model only phrase what they found — it cannot then invent a pattern that is
not in the data:

- *"third day running as the priority"* — a scan of `dayNotes.json`.
- *"and the issue has not moved"* — Linear state.
- *"5h02 slept, and the heaviest thing on the board"* — a comparison.

**Shape: it speaks once (A).** One observation under the TODAY beat. No input box,
no conversation, no state. Transport is one `POST /api/chat` carried by the same
one-shot sidecar the MCP reads already need — no new infrastructure, no
credentials, nothing leaving the machine.

**B, deliberately deferred:** a few turns of reply. Wanting to answer the
observation is the signal to build it, and by then the affordance will be known
rather than guessed. A chat box also invites spending ten minutes in a doorway.

## The cue

The behavioural problem is not the screen, it is opening zenborg at all — *a
routine you can't see isn't a routine* (`docs/ideas/2026-05-31-morning-routines-visible.md`).

**A morning notification is the wrong instrument.** It is a clock-based prompt
(BCT 7.1, Prompts/cues) competing with everything else on screen, and it
habituates. It was only ever needed for steps happening away from the machine, and
there are none.

**The better cue already ships.** keel's `SIGNON_DENY` fires at the exact moment of
the competing behaviour, in the place you actually are — textbook JITAI timing that
a clock cannot match. It is simply **inert**: it says "name the day in zenborg" and
leaves you to go find zenborg.

- **must-have** — make the deny message actionable. keel's `SIGNON_DENY` string
  gains a copy-pasteable command that opens zenborg on the sign-on screen; zenborg
  registers the deep link it invokes. Terminals do not reliably make custom
  schemes clickable, so the command is the contract and the scheme is what it
  calls. BCT 12.5, adding objects to the environment; PDP Reduction.
- **should-have** — an ambient unnamed-day state in keel's tray. Persistent and
  glanceable (BCT 12.1, restructuring the physical environment) rather than
  interruptive.
- **not building** — a daily notification. If one is ever added: fire once, no
  repeat, no badge, no escalation, and design it to be **retired** once the habit
  holds (BCT 7.3, fading — equanimitech's fade-by-design).

## Scope

**must-have**

- `DayNote.priorityMomentId`, and title derived from the priority when empty
- The sign-on screen: four beats, one write, five-second-hold skip
- `/` routing on title presence
- The one-shot MCP runtime + server allowlist, with per-source fail-soft
- keel's deny message made actionable

- Real linked Things/Linear items in WAITING, capped, instead of counts

**should-have**

- Ambient unnamed-day state in keel's tray
- The deterministic noticing (repetition, staleness, sleep-vs-weight)

**nice-to-have**

- The local assistant phrasing that noticing as one observation (shape A)
- Arming `activeMoment` from the priority
- Attaching a listed Linear issue to a moment as a `ref`
- Sleep trend rather than one night (`SleepPhaseService` already models it)

## Deliberately deferred: the protocol abstraction

This screen came out of a larger idea — **protocols**: pre-generated guides
attached to moments (recipes, workouts, morning routines), authored by Claude Code
as declarative data, rendered by one generic component, calling a named tool
allowlist. Sign-on would be one instance.

That abstraction is probably right. It is being deferred anyway, because it is
currently being designed against a sample size of one, and the sign-on screen is
the wrong thing to bend around a guessed vocabulary. **Build sign-on as a screen.
Extract the format when the second protocol arrives** — from two real examples
rather than one imagined one.

The sketched vocabulary, recorded so it is not re-derived: a step has `text`, an
optional `durationSec` (the timer), and optional `input`/`tool` for steps that
record something; a protocol has an optional `items` preamble, an optional
`repeat` over a group, and an explicit tool allowlist.

### What the second example taught

A quick workout — push ups · pull ups · roll outs · squats/bulgarians, three
rounds — was drafted against this vocabulary. Three findings, all of which make
the deferral look better rather than worse:

**A portal is not necessarily a screen we own.** The right surface for this
workout is the **Garmin workout on the watch**, which already does rounds, rest
and rep counting, and is on your wrist where a laptop is not. zenborg builds no
workout screen at all — it authors the workout (`create_strength_workout`) and
puts it on the calendar (`schedule_workout`) through the same MCP runtime this
spec already needs. The general rule: a protocol declares the surface that
*enacts* it, and that surface is often external.

**`repeat` is load-bearing for translation, not just for authoring.** A circuit
(A B C D, three times) and per-exercise sets (A×3, then B×3) are different
workouts, and Garmin's model is the latter. Expanding `repeat: 3` into twelve
steps at `sets: 1` preserves the circuit through the translation. A flat list
without `repeat` silently produces the wrong workout.

**The destination dictates required fields.** `create_strength_workout` requires
`reps`, so a workout protocol cannot omit them however little the author tracks
them. Conversely `category` must be omitted by default: anything outside Garmin's
enum — *including* `UNASSIGNED` and `OTHER` — is rejected with `400 Invalid
category`, while omission is accepted.

**Renderers do not generalize; data does.** Sign-on wants a bounded page read all
at once. A workout wants one step at a time, large target, minimal reading, hands
busy. Had a single generic `<Protocol>` component been built first, one of the two
would have been bent to fit the other.

**A protocol is a derivation from the plan, not a stored list.** The four
exercises were not invented: the `gym` habit
(`c89d7707-0a17-4459-900a-af08c3443739`, area Fitness) carries the program in its
own description — *"Restarted 2026-08-07 with **Back In · Push/Pull + Core/Legs**"*
— and push / pull / core / legs is exactly that split. The habit also carries the
dial: `attitude: RETURNING` on the BEGINNING → RETURNING → KEEPING → BUILDING →
PUSHING → BEING ladder, `rhythm` weekly ×3. RETURNING prescribes rebuilding rather
than loading, so conservative volume is derived rather than chosen, and promoting
the attitude changes the session with nothing re-authored.

This is the same architecture as sign-on: a skill's judgment reduced to a
deterministic rule the MCP runtime evaluates, with no model in the loop. The
protocol's input is the habit; its output is a Garmin workout.

**The integration already runs one way and this is the other.**
`src/domain/garmin/GarminHabitMap.ts` resolves an inbound Garmin *activity* to a
habit, and the Fitness area is tagged `integrates-garmin`. Composing a workout from a
habit is the outbound direction across the same seam — and is where a Garmin
`category` would come from, if one is ever wanted.

Two constraints the eventual abstraction must respect, both established here:

- **Declarative data, never generated components.** zenborg is a static export
  with no runtime compiler. Inert data is also the only shape that survives the
  hosted future and renders in the browser extension.
- **Writes go through the intent queue.** Per
  `docs/decisions/2026-08-06-reach-via-snapshot-and-intent-queue.md`, a surface
  that is not zenborg emits `intents/<ts>-<uuid>.json` and zenborg replays it
  through the existing `mcp-server` handlers. The extension can render a protocol
  and emit intents without `native-host.mjs` losing its command-less, append-only
  posture, and zenborg stays sole writer.

### Portals distribute

The general rule the workout revealed: **a portal goes to whichever surface best
enacts the moment**, and that is frequently a surface we do not own and should not
rebuild. The fleet already has more surfaces than the design had been counting.

- **zenborg, bounded page** — several things read, one decided. Sign-on. *To build.*
- **Garmin watch** — rounds, rest, reps; hands busy, eyes elsewhere. *Exists.*
- **keel, the gate** — the intention arms the focus lock, and the deny message
  fires at the moment of the competing behaviour. *Exists.*
- **TRMNL e-ink** — glanceable, never interactive, no notification cost.
  `docs/trmnl-template.liquid` and `TrmnlSettingsSection.tsx` already exist.
- **Alfred** (`keel-alfred`) — capture during something else; the only surface
  fast enough not to break the thing you were doing. *Exists.*
- **keel menubar tray** — standing state cue rather than a ping. *To build.*
- **keel browser extension** — renders a protocol, emits intents. *Deferred.*

The corollary is a scope rule, not just a taxonomy: **build a portal only where no
good surface already exists.** The workout's best portal is a watch face nobody
here has to maintain.

## Constraint: the vault guard

Sleep readings come from the Garmin MCP, which sits behind the kairos vault
guard — a `PreToolUse` hook whose contract is **aggregates only**. The SLEPT beat
must therefore show aggregates (duration, deep total, score) and never raw
samples. This happens to be exactly what the beat wants — *"read and released, not
scored, not trended"* — so the guard and the design agree, but a future
"show me the hypnogram" request is out of contract and should be refused rather
than routed around.

## Naming

This is **not the helm.** In keel, `helm` is a shipped concept with a narrow
meaning — a pure function reading heading against tide and modulating the dwell
gate's cadence, ambient by construction, with no surface at all
(`keel/docs/superpowers/specs/2026-08-06-helm-design.md`). Sign-on is a doorway.
Different thing, and the names must not collide.

## Follow-up outside this spec

The `/sign-on` skill's Close section states that the day-open record lives at
`$KAIROS_HOME/signon.json`, written by a zenborg `/sign-on` screen. **That file
does not exist and never did** — the gate reads `dayNotes.json`. The paragraph
needs correcting, and the skill's two-priority beat needs reconciling with the
single priority intention above. Both once this ships, not before.
