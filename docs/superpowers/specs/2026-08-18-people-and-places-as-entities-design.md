# People and Places are Entities (Design)

**Date:** 2026-08-18
**Status:** draft, for review and stamp
**Problem owner:** Rafa
**Supersedes:** [`docs/decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md`](../../decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md) (signed and attested, therefore superseded rather than edited) and its corrigendum
**Finishes:** `kairos/kernel/entities.md` (draft, 2026-08-14, "for review and stamp")

---

## Problem

On 2026-08-18 Rafa ate breakfast with his parents and his sister, then drank coffee
with his grandparents. Two gatherings. Zenborg recorded five moments:

| moment | phase | habitId | tags |
|---|---|---|---|
| `Pai` | MORNING | `83b27bed` | `parent`, `london`, `place-london` |
| `Mama` | MORNING | `dc5821fe` | `parent`, `london`, `place-london` |
| `Sasa` | AFTERNOON | `955c7f19` | `nyc`, `place-new-york` |
| `Cal` | AFTERNOON | `12fea18d` | `sp`, `place-sao-paulo` |
| `Ada` | AFTERNOON | `8e55e8d4` | `sp`, `place-sao-paulo` |

Three failures are visible in that table.

**A person is not a perennial.** Each row points at its own habit. Forty-three habits
across Family, Friends and Sensitive are people. A habit is a recurring moment
template, and "Mama" is not one. The 2026-08-07 decision accepted this cost and
predicted it would stay small. It did not: the corrigendum records that person health
needed a separate attitude-free `PersonService`, that health is implemented twice
(`src/domain/services/HabitHealthService.ts` and `mcp-server/health.ts`), and that five
read paths needed widening behind a `momentInvolvesHabit` helper. The collection that
was avoided returned as a service plus five filters.

**The many-to-many shipped and nothing uses it.** `Moment.personIds` exists, carries
tests, and feeds `harvestViewModel`. Not one moment in the vault sets it. The breakfast
above should be one moment naming three people; the planting path never reaches for the
field, so it produced three.

**The place tags lie.** A `place-` tag on a person-habit means *where that person
lives*. Inherited onto a moment, the same tag reads *where this happened*. Rafa ate
breakfast in São Paulo. The vault says London and New York, and
`get_tag_neighborhood` will report that he was in three cities at once on 2026-08-18.
This is not cosmetic: the read model produces false history.

Underneath all three sits a fourth problem. A person currently has three inks at once:
a habit carrying `kind: "person"`, an id inside `Moment.personIds`, and a `person-`
tag that `mcp-server/tags.ts:6` calls "the graph's stopgap". Three spellings of one
identity, none of them authoritative.

---

## Decisions

### D1: A person and a place are registry entities. Zenborg stores references.

`kairos/kernel/entities.md` already settles ownership: wake's knowledge graph is the
registry, it owns display name, aliases, notes and typed edges, and *"instruments never
store entity metadata. A zenborg tag is a reference, not a record."*

The kernel rejects the alternative by name: *"a first-class entity collection in each
instrument makes every vault pay a schema change and every capture heavier."*

**There is no `people.json` and no `places.json`.** An earlier draft of this design
proposed exactly those two collections and was wrong.

One collection is added, and it is not an entity collection: `hotline.json` holds
Rafa's contact commitments keyed by entity key, and no metadata about anyone. See D10
for why it is the exception that proves D1 rather than a breach of it.

### D2: `Habit.kind` is deleted. Habits are rituals again.

A habit names the action, never the person. The nine that replace forty-three:

| area | rituals |
|---|---|
| Family | `FaceTime`, `sunday dinner`, `breakfast` |
| Friends | `long call`, `reach out`, `coffee`, `drinks`, `football night` |
| Sensitive | `date` |

Rituals stay area-scoped. A `coffee` may later exist in more than one plot, and that is
not duplication: identity now lives in the registry, so two same-named perennials in
two plots are two cadences (weekly with friends, monthly with family), which is what a
plot budget is for. The forty-three-habit problem was that identity lived in the habit.
It no longer does.

`sunday dinner` carries the guidance "when I'm in SP" rather than a conditional rhythm.
Rhythm has no notion of place and will not grow one here.

### D3: `personIds` carries entity keys, not habit UUIDs.

The field keeps its name, per the kernel's rule that field names are edge labels
(`personIds` derives the `with` edge). Its contents change from zenborg habit UUIDs to
registry keys: `["pai", "mama", "sasa"]`.

### D4: `placeIds` replaces the `place-` tag.

The kernel already anticipates this field, describing the place ink as *"`place-` tag
(future `placeIds` if places ever get records)"*. This design exercises that future.
`placeIds` derives the `at` edge.

The `place-` tag was never really a tag. The kernel's flatten rule is total and
reversible for slug-keyed types: `<type>-<key>` ⇄ `kairos:<type>/<key>`. `place-london`
*is* `kairos:place/london`, written smaller because zenborg had no field to hold a
reference. Giving it a field is not a new concept; it is the same reference, stored
where it belongs.

### D5: Every place is an entity. A pasted map link mints one.

Place is one recursive entity. `kairos:place/coffee-lab` has parent
`kairos:place/vila-madalena`, which has parent `kairos:place/sao-paulo`. A moment names
whatever grain it knows, and coarser grains roll up through the tree.

Zenborg's ink is `Moment.placeUrl`: the raw string you pasted, validated as a URL by
the existing `isParseableRef` (`src/domain/entities/Moment.ts`). Wake reads that
string, parses label and coordinates from it, mints the entity with its parent chain,
and owns the metadata from then on. The ~10-line regex specified in
[`docs/pitches/2026-08-07-a-pasted-map-link-is-the-place.md`](../../pitches/2026-08-07-a-pasted-map-link-is-the-place.md)
moves to wake's side, because label, latitude and longitude are entity metadata and D1
forbids zenborg from holding them.

This preserves the kernel's one-writer rule. Zenborg writes keys and the string you
pasted. Wake writes everything the graph knows about the place.

**Rejected:** two place layers, `placeIds` for the city entity and a `Moment.location`
value object for the venue. It keeps one-off cafés out of the registry and matches the
kernel's definition of an entity as *"somewhere your life keeps returning to"*. Rafa
chose one layer, accepting that the registry fills with venues visited once. See C1.

### D6: A deterministic slug rule enters the kernel.

Zenborg derives a key from a pasted label to write `placeIds`; wake derives a key from
the same label to mint the entity. They must agree without coordination. The rule,
added to `entities.md`:

```
lowercase → strip diacritics → non-alphanumeric to dash → collapse dashes → trim dashes
"Café Lab, Vila Madalena" → "cafe-lab-vila-madalena"
```

Collisions disambiguate with a dash, as the existing key grammar already specifies.
Wake owns collision resolution because wake owns the registry; zenborg's derived key is
a proposal, and an unresolvable key renders as itself under the kernel's fail-soft rule.

### D7: The 13-character key cap is dropped.

`entities.md` bounds keys at 13 characters "where zenborg must carry it", because
zenborg tags cap at 20 including the `person-` prefix, and it sanctions lifting that cap
to 32. Keys move from tags into `personIds` and `placeIds`, which have no length
constraint. The bound and the sanctioned workaround both disappear.

### D8: Person attributes leave the tag drawer for the registry.

`parent`, `close` and `imperial` are neither places nor rituals. They are facts about a
person: relation, closeness, and where you met. They become registry metadata on the
entity. Zenborg's tag drawer is left holding only genuine tags.

### D9: The queue stays. It is the hotline, and it is zenborg's, not the graph's.

**Ruled 2026-08-18.** The queue is the point, not a side effect. Rafa: *"the queue is
important for me to remember to stay in touch with people who are far... it's an idea of
a hotline that I used to have in Notion, basically a personal CRM."*

This looks like it contradicts the kernel, which closes with: *"No scoring. The graph
answers questions brought to it; it never volunteers verdicts about people ('you haven't
seen X in N days' is a coupling pattern, not a feature). This is a design invariant, not
a UI preference."*

It does not, and the distinction is worth stating precisely because it is easy to lose.
**The invariant governs the graph, not the instrument.** Wake derives what it observes
across every source, so a verdict it volunteers is a machine's opinion about a
relationship. Zenborg holds what Rafa declared: a rhythm is a commitment he made, and
reporting that he is behind his own commitment is a garden telling him a plot is dry. It
is the same act as `list_wilting_habits`, which has never been controversial.

So: wake never ranks people, and `entities.md` keeps that sentence unchanged. The
hotline lives in zenborg, reads zenborg's own ink, and is specified in D10.

### D10: The hotline is a zenborg collection keyed by entity key.

Contact cadence needs a home. It cannot go to the registry, because a rhythm is not
entity metadata: it says nothing about who someone is, only what Rafa intends. It
cannot go on a habit, because D2 just deleted person-habits. It therefore gets the one
new collection this design adds.

```
hotline.json
  "<entityKey>": { rhythm: Rhythm, startedAt: string, pausedAt?: string }
```

That is the whole record. No display name, no aliases, no notes, no relation: every one
of those is registry metadata and D1 forbids zenborg from holding it. `hotline.json`
stores commitments about references, which is zenborg's own ink under the kernel's
one-writer rule.

**This is the one place this design pays the collection cost** it avoids everywhere
else: two lines in `src-tauri/src/vault/fs.rs:50`, entries in `mcp-server/vault.ts`
(`COLLECTION_NAMES`, `CollectionTypeMap`), `src/domain/registry.ts` and
`EXPORTABLE_MODELS`, and one store wiring. Worth paying, because it buys the feature
Rafa most wants and it keeps person metadata out of the vault.

While adding it, close the drift already present: `dayNotes` exists in
`src/domain/registry.ts` but not in `mcp-server/vault.ts`, so the two lists disagree
today.

**"People who are far" is a real filter, not a figure of speech.** The hotline ranks by
overdue ratio against each person's own rhythm, as the current tool does, and gains one
filter the old one could not express: distance. Where a person is based is a registry
edge; where Rafa is now is the `placeIds` on his current cycle. A person whose base
place is not his current place is far. That query needs entity keys on both sides,
which is exactly what D3, D4 and D5 deliver.

`list_people_to_reach` survives with its ranking intact (overdue ratio, never raw days,
for the reason the corrigendum records: raw days permanently starves a twice-weekly
friend behind an annual relative). It reads `hotline.json` instead of person-habits, and
gains a `far: boolean` filter.

---

## The shape, after

```
registry (wake, ~/.wake/<pond>/derived/knowledge-graph.json)
  kairos:person/pai            display "Pai", aliases, relation: parent
  kairos:person/sasa           display "Sasa", basePlace: new-york
  kairos:place/sao-paulo
  kairos:place/vila-madalena   parent: sao-paulo
  kairos:place/coffee-lab      parent: vila-madalena, lat, lon, url

zenborg (moments.json, habits.json)
  Habit  { …, no kind }                        nine rituals, area-scoped
  Moment { habitId    → instance-of
           areaId     → in
           cycleId    → during
           personIds  → with     entity keys
           placeIds   → at       entity keys
           placeUrl   → the string you pasted
           refs       → about  }
```

This morning, recorded correctly, is one moment:

```json
{ "habitId": "<breakfast>", "areaId": "<Family>", "phase": "MORNING",
  "day": "2026-08-18",
  "personIds": ["pai", "mama", "sasa"],
  "placeIds": ["sao-paulo"] }
```

---

## Migration

Derived at run time. No count is hardcoded, for the reason the 2026-08-07 corrigendum
records: the vault is live and was edited three times during the last migration.

1. **Create the nine rituals** in Family, Friends and Sensitive.
2. **Export the person-habits to the registry.** Name, aliases and emoji become entity
   metadata. `parent`, `close` and `imperial` become relation, closeness and metAt (D8).
   Keys derive by D6's slug rule from the habit name.
3. **Rewrite person-moments.** A moment whose `habitId` points at a person-habit becomes
   `habitId: null` with the person's key in `personIds`. This drops a false claim (that
   2025-11-09 was an instance of a perennial named Mama) and keeps the true one (he saw
   her). `momentInvolvesHabit` already handles `habitId: null` with `personIds` set, and
   `src/hooks/__tests__/useHabitHealth.test.ts:83` already pins the behaviour.
4. **Seed the hotline.** Every person-habit carrying a `rhythm` becomes a `hotline.json`
   entry keyed by its entity key, with `startedAt` taken from the habit's `createdAt`.
   Only twelve of the forty-three carry one, so the hotline starts short. That is
   honest, and matches the corrigendum's note that a roster is not a commitment. The
   other thirty-one exist in the registry and can be added to the hotline whenever Rafa
   decides to commit to a cadence.
5. **Archive the person-habits.** Archive, not delete, so nothing dangles if step 3
   missed a row.
6. **Convert place tags.** `place-<key>` on a moment becomes `placeIds: [<key>]`. The
   short-form duplicates (`sp`, `bcn`, `nyc`, `london`, `paris`, `madrid`) are dropped,
   since each duplicates a `place-` tag already present. Mint the six city entities in
   the registry.
7. **Drop the inherited lie.** A `place-` tag that arrived on a moment by inheritance
   from a person-habit is not converted. Where a person lives is a registry edge on the
   person, not a fact about the moment. Moments left with no `placeIds` are honest:
   zenborg never knew where they happened.
8. **Retire `Habit.kind`** and the `person-` tag fallback.

**The migration is written, reviewed and not run.** It rewrites hundreds of live moments
and forty-three habits, so running it is a separate act requiring Rafa's explicit
go-ahead with the desktop app closed. Zenborg is the sole writer of `habits.json` and a
running app overwrites from its in-memory store. Every step above is reversible only
from a vault backup, so the script takes one before writing.

The existing migration script's refusal-to-write check and its `--force` escape hatch
are reused as written.

---

## Consequences

**C1: The registry fills with one-off venues.** D5 mints an entity for a café visited
once, which contradicts the kernel's definition of an entity as *"someone or somewhere
your life keeps returning to."* That sentence must be loosened, or places need a lighter
tier than people. Accepted knowingly. The `entities.md` revision carries the loosening.

**C2: The `.ics` feed now depends on wake.** Coordinates live in the registry, so
emitting `GEO` means resolving keys against the graph. The feed is unbuilt, so nothing
regresses today, but it cannot ship until wake exposes a key-resolve tool. The read is
aggregate-tier (keys, labels, coordinates, no prose), so the privacy contract permits
it.

**C3: Two instruments must ship together.** Zenborg writes keys that only wake can
resolve. Until wake mints from `placeUrl`, a pasted link yields a key rendering as
itself. The kernel's fail-soft rule makes this a degraded state rather than an error,
and it is the correct order: zenborg's ink first, wake's derivation second.

**C4: Person health stays in zenborg.** Resolved by D9. `PersonService` and
`mcp-server/people.ts` survive, reading `hotline.json` for the rhythm and moments for
the last contact. Neither reads a habit any more, which removes the coupling the
corrigendum complained about: person health was already attitude-free and already
refused to share code with `HabitHealthService`. It now has a record of its own to read,
which is what it wanted all along.

**C5: History loses `habitId` on person-moments.** Step 3 nulls it. Anything counting
moments per habit sees those rows leave. Two narrow filters in
`src/application/services/CycleService.ts` (`:754`, `:822`) were parked by the last bet
because people were excluded from cycle budgeting; they stay parked for the same
reason. The corrigendum cited these as `:742` and `:812`; both have drifted since, which
is the usual argument for citing the predicate rather than the line.

---

## The `entities.md` revision

The kernel doc is draft and awaiting stamp, so this finishes it rather than reopening
it. Changes:

- **Projections table, people row.** `Moment.personIds` → habit with `kind: "person"`
  becomes `Moment.personIds` → entity key. The citation of the 2026-08-07 decision is
  replaced by a citation of this one.
- **Projections table, places row.** The flattened `place-` tag becomes `Moment.placeIds`
  → entity key, with `Moment.placeUrl` named as the minting evidence.
- **Relations table.** `place-` tag *(future `placeIds`…)* becomes `placeIds`, plain.
- **The key grammar.** The ≤13-character bound and the sanctioned 32-character lift are
  both removed (D7). The slug rule is added (D6).
- **The entity definition.** Loosened to admit a place visited once (C1).
- **Ownership.** One sentence stating that an instrument may write a raw capture (a
  pasted URL) from which the registry mints, and that this is not the instrument
  storing metadata.

---

## Slices

The design spans three repos, so it is not one implementation plan. C3 fixes the order:
zenborg's ink first, wake's derivation second.

**S1: The contract.** Revise `kairos/kernel/entities.md` per the section above and
stamp it. Nothing else can be built against a draft that still says `kind: "person"`.
Prose only, no code.

**S2: People and the hotline (zenborg).** Delete `Habit.kind`. Create the nine rituals.
Add `hotline.json` (D10) and seed it from the twelve person-habits that carry a rhythm.
Repoint `PersonService`, `mcp-server/people.ts` and `list_people_to_reach` at it. Migrate
the person-habits to registry metadata, rewrite person-moments to `habitId: null` with
keys in `personIds`, archive the habits. Retire the `person-` tag. This slice alone
fixes today's five-moments-for-two-gatherings and keeps the hotline working throughout,
and it does not depend on wake having minted anything, because keys render as themselves
under fail-soft. The `far` filter is the one part that waits for S3.

**S3: Places (zenborg).** Add `placeIds` and `placeUrl`. Convert `place-` tags, drop
the short-form duplicates, drop the inherited lies. The tag drawer empties here.

**S4: Minting (wake).** Parse `placeUrl`, mint place entities with parent chains and
coordinates, expose the key-resolve tool that C2 needs. Until this ships, `placeIds`
holds keys with no metadata behind them, which is the degraded-not-broken state C3
describes.

S2 and S3 are independent of each other and both depend on S1. S4 depends on S3. If
appetite is short, S1 and S2 are the bet worth making: they cure the problem that
started this, and they leave places exactly as broken as they are today rather than
half-migrated.

---

## Verification

Four tests earn their place. Each pins a branch that this design creates and that a
future edit could silently break.

1. A moment carrying three keys in `personIds` and `habitId` set to the `breakfast`
   ritual counts once toward `breakfast`, and once toward each of the three people.
   This is the failure today's five-moment breakfast represents.
2. A person-moment migrated to `habitId: null` still resolves through
   `momentInvolvesHabit`. Extends the existing pin at
   `src/hooks/__tests__/useHabitHealth.test.ts:83` to the migrated shape.
3. The D6 slug rule is deterministic across diacritics, punctuation and repeated
   separators. `"Café Lab, Vila Madalena"` yields `cafe-lab-vila-madalena` on both
   sides.
4. A `place-` tag inherited onto a moment from a person-habit does not become a
   `placeId` (migration step 7). This is the London breakfast, and it must stay absent
   rather than become wrong in a new field.
5. The hotline ranks by overdue ratio, not raw days: a twice-weekly entry silent for 20
   days outranks an annual one silent for 400. This is the regression the corrigendum
   warns about, and it is the whole reason the queue is usable.
6. A hotline entry whose person has a moment dated in the future is absent from the
   queue. Arranging dinner three weeks out must stop the nagging, which the current tool
   already gets right and a rewrite could easily lose.

All fixtures are synthetic. No real person from the vault appears in a test.

Manual check, once: re-plant 2026-08-18 as two moments and confirm the day reads as two
gatherings, in São Paulo, with five people between them.

---

_Drafted by Claude (scribe). Not stamped._
