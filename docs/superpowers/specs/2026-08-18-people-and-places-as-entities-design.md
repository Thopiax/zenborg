# People and Places are Entities (Design)

**Date:** 2026-08-18
**Status:** draft, for review and stamp
**Problem owner:** Rafa
**Supersedes:** [`docs/decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md`](../../decisions/2026-08-07-people-are-a-kind-on-habit-not-a-new-collection.md) (signed and attested, therefore superseded rather than edited) and its corrigendum
**Finishes:** `kairos/kernel/entities.md` (draft, 2026-08-14, "for review and stamp")
**Prior art:** Rafa's Notion "people" database, 46 rows, exported 2026-08-18. It is the
origin of the hotline and the source for D10's entity shape. Real contact data: read for
schema, never copied into a test fixture or a commit.

---

## Problem

On 2026-08-18 Rafa ate breakfast with his parents and his sister, then drank coffee
with his grandparents. Two gatherings. Zenborg recorded five moments:

| moment | phase | habitId | tags |
|---|---|---|---|
| `Pat` | MORNING | `83b27bed` | `parent`, `london`, `place-london` |
| `Mo` | MORNING | `dc5821fe` | `parent`, `london`, `place-london` |
| `Sam` | AFTERNOON | `955c7f19` | `nyc`, `place-new-york` |
| `Cal` | AFTERNOON | `12fea18d` | `sp`, `place-sao-paulo` |
| `Ada` | AFTERNOON | `8e55e8d4` | `sp`, `place-sao-paulo` |

Three failures are visible in that table.

**A person is not a perennial.** Each row points at its own habit. Forty-three habits
across Family, Friends and Sensitive are people. A habit is a recurring moment
template, and "Mo" is not one. The 2026-08-07 decision accepted this cost and
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

**This design adds no collection to zenborg.** Two earlier drafts proposed one: first
`people.json` and `places.json`, then a `hotline.json` for contact cadence. Both were
the same mistake, which is reaching for storage when the contract already says where
the data lives. Zenborg gains two fields on `Moment` and loses one on `Habit`.

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

### D9: The hotline is a read, not a record.

**Ruled 2026-08-18.** The queue is the point, not a side effect. Rafa: *"the queue is
important for me to remember to stay in touch with people who are far... it's an idea of
a hotline that I used to have in Notion, basically a personal CRM."*

It stores nothing new. It composes three things that already exist:

| ingredient | lives in | why there |
|---|---|---|
| declared cadence | registry, on the person entity | a fact about how Rafa relates to someone, like an alias |
| last contact | zenborg moments, via `personIds` | it is what he did, which is zenborg's ink |
| the ranking | computed at read time, stored nowhere | derived data is rebuildable by definition |

An earlier draft of this design gave cadence its own zenborg collection. That was wrong
for the reason D1 is right: reaching for storage when the contract already says where
something lives.

**This does not breach the kernel's no-scoring invariant.** Wake *stores* the cadence
and ranks nobody. Zenborg does the ranking, over its own moments, against a cadence Rafa
declared himself. A machine's opinion about a friendship would be a verdict; a garden
saying you are behind your own stated intention is the same act as `list_wilting_habits`,
which has never been controversial. `entities.md` keeps its sentence verbatim and gains
a paragraph drawing exactly this line.

**"People who are far" is a real filter.** Where a person is based is registry metadata;
where Rafa is now is the `placeIds` on his current cycle. A person whose base place is
not his current place is far. That query needs entity keys on both sides, which is what
D3, D4 and D5 deliver.

`list_people_to_reach` keeps its ranking intact (overdue ratio, never raw days, for the
reason the corrigendum records: raw days permanently starves a twice-weekly friend
behind an annual relative). It reads cadence from the registry instead of from a habit
record, and gains a `far` filter.

### D10: The person entity's shape comes from the Notion CRM, minus what rotted.

The source is Rafa's Notion export, 46 rows and 13 columns. It settles what a person
entity carries, and more usefully, what it must not.

**Ports to registry metadata:**

| Notion column | entity field | values observed |
|---|---|---|
| Category | `category` | friend (31), family (7), lover (5), colleague (3) |
| Frequency | `cadence` | weekly (12), monthly (10), quarterly (15), yearly (8), absent (1) |
| Status | `status` | active (44), paused (2) |
| Favorite | `favorite` | 4 true |
| feedbacks | `notes` | free text, 19 filled |

**Cadence is four buckets, not a `Rhythm`.** Weekly, monthly, quarterly, yearly. Zenborg's
`Rhythm { period, count }` is richer than this problem needs, and the Notion data shows
Rafa never wanted the extra dimension. Four values, ordered, and the overdue ratio is
days-since divided by the bucket's day count.

**`status: paused` is real** and earns its place: two people were paused. A paused person
is absent from the queue and is not wilting. This is the difference between "I have let
this slide" and "I have decided not to right now", and losing it makes the queue nag
about people Rafa deliberately stepped back from.

**Dropped, because they were empty in all 46 rows:** `Time to Chat`, `Share Moment`,
`Reasons to chat`. Three columns that seemed like good ideas and were never once filled.
Do not port them and do not invent equivalents.

**Dropped, because zenborg derives them:** `Last Chat At` and `Next Chat At`. Rafa
maintained these by hand and filled them 12 and 11 times out of 46. They are exactly what
`personMoments` and `hasArrangedContact` compute for free from moments and future-dated
moments. **This is the whole argument for the port.** The two columns that made the Notion
version rot are the two that stop existing.

`Tags` is dropped too: 21 rows carry the single value `Moments` and nothing else, which
is a column that never became a taxonomy.

**Category versus area.** `category` is a property of the person; the area on a moment
comes from its ritual (D2). A coffee with a `family` person still lands in the Friends
plot if it was planted as the Friends `coffee`. That is the cost Rafa accepted when he
chose area-scoped rituals, and `category` is what makes it recoverable: the queue can
filter by category even when the moment's plot says otherwise. `colleague` has no zenborg
area today and needs none, since the queue filters on the entity, not the plot.

---

## The shape, after

```
registry (wake, ~/.wake/<pond>/derived/knowledge-graph.json)
  kairos:person/pai        display, aliases, category: family,
                           cadence: weekly, status: active,
                           favorite, notes, basePlace: london
  kairos:place/sao-paulo
  kairos:place/vila-madalena   parent: sao-paulo
  kairos:place/coffee-lab      parent: vila-madalena, lat, lon, url

zenborg (moments.json, habits.json)     no new collection
  Habit  { …, no kind }                 nine rituals, area-scoped
  Moment { habitId    → instance-of
           areaId     → in
           cycleId    → during
           personIds  → with     entity keys
           placeIds   → at       entity keys
           placeUrl   → the string you pasted
           refs       → about  }

the hotline                              derived, stored nowhere
  cadence  ← registry
  lastSeen ← max(moment.day) over personIds
  next     ← any future-dated moment  (was "Next Chat At", by hand)
  rank     ← daysSince / cadenceDays
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
   2025-11-09 was an instance of a perennial named Mo) and keeps the true one (he saw
   her). `momentInvolvesHabit` already handles `habitId: null` with `personIds` set, and
   `src/hooks/__tests__/useHabitHealth.test.ts:83` already pins the behaviour.
4. **Fold the Notion CRM into the registry export.** The 46 rows carry `category`,
   `cadence`, `status`, `favorite` and `notes` (D10) that the 43 person-habits do not.
   Join the two by slugged name and emit one registry export. Where a habit's `rhythm`
   and the CSV's `Frequency` disagree, the CSV wins: it is the record Rafa actually
   curated, and only twelve habits carry a rhythm at all. Report every name that appears
   in one source and not the other rather than guessing at a match.
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

**C4: Person health stays in zenborg, and gains a dependency on the registry.** Resolved
by D9. `PersonService` and `mcp-server/people.ts` survive, taking cadence as a parameter
and reading moments for the last contact. Neither reads a habit any more, which removes
the coupling the corrigendum complained about.

The cost is that the queue now needs the registry to be populated before it ranks
anyone, where today it reads a self-contained vault. Until wake exposes a key-resolve
tool (C2), the queue has no cadence to compare against and returns nothing. **That makes
the registry export in migration step 4 load-bearing rather than incidental**, and it
means S2 does not deliver a working hotline on its own. This is the one place the
no-new-storage decision costs something real, and it is worth naming plainly rather than
discovering during implementation.

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

**S2: The registry (wake).** Person entities with the D10 shape, fed by the Notion CSV
joined to the 43 person-habits, plus the key-resolve tool zenborg reads cadence through.
**This moved ahead of the zenborg work**, because C4 shows the queue cannot rank anyone
until cadence has somewhere to live. The earlier ordering assumed a zenborg-local store
that no longer exists.

**S3: People (zenborg).** Delete `Habit.kind`. Create the nine rituals. Repoint
`PersonService`, `mcp-server/people.ts` and `list_people_to_reach` at registry cadence.
Rewrite person-moments to `habitId: null` with keys in `personIds`, archive the habits.
Retire the `person-` tag. This is the slice that fixes today's
five-moments-for-two-gatherings.

**S4: Places (zenborg).** Add `placeIds` and `placeUrl`. Convert `place-` tags, drop the
short-form duplicates, drop the inherited lies. The tag drawer empties here. The `far`
filter lands with this slice, since it needs place keys on both sides.

**S5: Minting (wake).** Parse `placeUrl`, mint place entities with parent chains and
coordinates. Until this ships, `placeIds` holds keys with no metadata behind them, which
is the degraded-not-broken state C3 describes.

Order is S1 → S2 → S3 → S4 → S5. S3 and S4 are independent of each other once S2 lands.

**If appetite is short, S1 plus S3 is the bet**, accepting that the queue stays dark
until S2. It still cures the problem that started this: two gatherings recorded as two
moments, and a breakfast that stops claiming it happened in London. The hotline is the
reason to keep going, not the reason to start.

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
5. The queue ranks by overdue ratio, not raw days: a weekly-cadence person silent for 20
   days outranks a yearly one silent for 400. This is the regression the corrigendum
   warns about, and it is the whole reason the queue is usable.
6. A person with a moment dated in the future is absent from the queue. Arranging dinner
   three weeks out must stop the nagging, which the current tool already gets right and
   a rewrite could easily lose.
7. A person with `status: paused` is absent from the queue and is not wilting. Two of
   the 46 Notion rows were paused, and conflating "I stepped back deliberately" with
   "I let this slide" is how the queue becomes something Rafa ignores.
8. A person with no cadence yields `unstated`, never `wilting`. A roster is not a
   commitment, and one Notion row has no Frequency at all.

All fixtures are synthetic. No real person from the vault appears in a test.

Manual check, once: re-plant 2026-08-18 as two moments and confirm the day reads as two
gatherings, in São Paulo, with five people between them.

---

_Drafted by Claude (scribe). Not stamped._
