---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:a1ae1fb174a726f6b855b1613e53f4e13b698825e347938a2179fbc5e7254f4d
  signedAt: 2026-08-07T13:03:28.267714Z
  signature: ed25519:hdCAyCYByd+BepEk6FWHtzos+R2u+n5el/svlVz4tjFApNybcwwM0F49keeO8wG17hRxLeHNWt/30zV2yUWsDQ==
type: decision
---
# People are a kind on Habit, not a new collection

**Date:** 2026-08-07
**Context:** zenborg — modelling the ~48 person-shaped habits living in Family, Friends and Sensitive.

## Problem

48 of 126 habits are people. A `Moment` links to exactly one habit via `habitId`, so a dinner with Yanik, Yoel and Manu cannot be recorded as one moment. It needs three — which collides with the max-3-per-(day, phase) cap and misrepresents one evening as three separate intentions. Two records already encode the strain by fusing two people into one: `Paul & Mari` and `Yaya & Abuelo`.

The concept is also simply wrong. A habit is a recurring moment template. A person is not.

## Decision

A person is a `Habit` carrying `kind: "person"`. There is no `people.json`.

The one genuinely new field is `Moment.personIds: string[] | null`, which lets many people compose under a single moment.

## Why not a new collection

A `Person` needs name, areaId, tags, aliases, emoji, isArchived, order, description, rhythm and timestamps. `Habit` already carries every one of them, `aliases` included. The three fields a person would not use — attitude, phase, guidance — are nullable and harmless.

A new collection would cost an entry in `ALLOWED_COLLECTIONS` (`fs.rs`), `COLLECTION_NAMES` and `CollectionTypeMap` (`mcp-server/vault.ts`), `src/domain/registry.ts`, and three store wirings — plus a migration that moves data instead of tagging it. It would buy nothing.

**Rejected:** a `person` tag instead of a typed `kind`. Zero schema change, but a typo'd `persons` silently makes someone not-a-person, and the filter is load-bearing. The typed field is correct on edge cases for one line.

**Rejected:** moment `tags` as the people link. Tags are free text, so a rename breaks history and identity stops being a UUID — against the substrate's id rule in spirit.

**Price accepted:** one table, two concepts. People must be filtered out of the plant deck, the cultivate view, and cycle budgeting. Several small filters, cheaper than a second collection and its migration.

## What gets built

1. `Habit.kind?: "person"` — TypeScript only. The Rust vault treats collections as opaque JSON, so `fs.rs` is untouched.
2. `Moment.personIds: string[] | null` — optional, so the substrate's *preserve unknown fields on write* rule keeps older builds safe.
3. `HabitHealthService` — the moment filter becomes `m.habitId === habit.id || m.personIds?.includes(habit.id)`. Wilting for people then falls out of the existing KEEPING branch, which is already exactly "silence threshold derived from declared rhythm".
4. `list_people_to_reach` — the outreach queue.
5. Migration — tag the 48; split `Paul & Mari` and `Yaya & Abuelo` into two records each; leave `colloc auber` and `family breakfast` as habits, since they are rituals rather than people.

## The loop is prospective

The purpose is outreach, not record-keeping. Zenborg names who has gone quiet, you reach out, you agree a date, you plant the moment. The moment *is* the record, so nothing needs to parse anything after the fact.

An earlier draft routed Things entries through a consumer that reconstructed the record retroactively. The forward loop removes the need for it, and it is not built.

`list_people_to_reach` returns habits where `kind` is person and health is wilting, excluding anyone who already has a moment dated in the future, sorted by days overdue, filterable by place tag.

## Arranged people stop nagging

`latestAllocationDate` skips moments dated after now. That is correct for habits — a planned run is not a run. It is wrong for outreach: arranging dinner three weeks out leaves the person wilting, so the queue nags you to contact someone you have already contacted.

The fix lives in the query, not in `Health`. Exclude anyone with a future moment. No new health state, no union change, no rendering work.

A dinner that keeps being postponed will hold someone out of the queue indefinitely. Accepted, and visible in the moment itself.

## Places stay tags

Already live, already spanning both people and habits: paris 15, sp 12, london 7, bcn 7, imperial 5, close 4, parent 3, nyc 3, madrid 1. Nothing to build. Promote place to an entity only when a query needs something a tag cannot express.

## Not built

Modality (call versus in-person) — a tag on the moment covers it. Per-modality rhythm. A people UI; day one is MCP-only. Outside-signal sync from calendar or messages. A Things consumer. Cycle budgeting for people, excluded by choice.

## Consequences

- Most of the 48 carry `rhythm: null`, which yields `unstated`, not `wilting`. The queue stays short until rhythms are set. That is honest — a roster is not a commitment.
- People inherit `attitude`. The field stays and is never surfaced in a people view.
- Splitting `Paul & Mari` and `Yaya & Abuelo` is one-way. Existing moments keep their `habitId`, so history survives, but the pair's shared history attaches to whichever record keeps the original id.
- Health for people ignores phase entirely. Correct: contact has a day, not a time-of-day band.

## Verification

One test earns its place — the health filter is a real branch. Assert that a moment carrying `personIds` and a null `habitId` counts toward that person's health, and that a moment dated in the future does not remove them from `list_people_to_reach`'s input but does remove them from its output.
