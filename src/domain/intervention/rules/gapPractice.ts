import type { AreaId, Duration, HabitId, RuleId } from "../../attention/ids";
import type { GateSpec } from "../Primitive";
import type { DistalRef } from "../ProximalOutcome";
import type { RuleSpec } from "../RuleSpec";

/**
 * The gap practice — a substitution that names a *tag*, not a practice.
 *
 * Replaces `breathe.ts`, which hardcoded three breaths. That was a second
 * definition of something the garden already held: `Mindfulness` has carried a
 * `breathwork` habit since 2026-08-14, tagged `gap` and `gap-2m`, described as
 * "short breath practice in an AI-wait gap. Logged on the Garmin." The rule was
 * inventing content that had already been authored, with worse metadata and no
 * Garmin story.
 *
 * So the intervention layer references and the garden defines. Anything tagged
 * `gap` can fill a gap — breath, qi gong, a walk to the window — and a practice
 * the principal already cultivates is a better substitute than one the software
 * made up, which is most of what BCT substitution means.
 *
 * ── Why `confirmation` and not `breath` ─────────────────────────────────
 *
 * `GateSpec.frictionType` carries a `breath` variant, and it is the only one
 * naming a bodily practice — `confirmation`, `intention` and `delay` are generic
 * interaction shapes. `Primitive.ts` says Notice, Suggestion, GapWindow and
 * HostBlock are "authoring sugar that desugars before anything reaches the
 * model"; `breath` is the same kind of thing and never got desugared. It is a
 * delay plus a named practice, and the practice half belongs to a plot.
 *
 * What is left once the practice moves out is an offer with no enforcement, and
 * **the primitive set has no shape for that.** `transform` comes closest and
 * carries no exit, which `validateDelivery` refuses — a rule written for
 * restrictions, applied to something that restricts nothing. `confirmation` is
 * the honest fit available: acknowledge and continue. Worth revisiting if an
 * `offer` primitive is ever added; recorded here so the compromise is visible.
 *
 * ── What it does not do ─────────────────────────────────────────────────
 *
 * It does not enforce the practice, time it, or check that it happened. The
 * Garmin logs breathwork already, and a rule that also policed it would be
 * inventing a second record of the same act.
 */

/** The tag a habit carries to say it fits a gap. A garden convention, not a
 * field — the same way `weeds` marks a plot without the schema knowing. */
export const GAP_TAG = "gap";

/** Sizing tags: `gap-30s`, `gap-2m`. The garden says how long its own practices
 * take; nothing here guesses. */
const SIZE_TAG = /^gap-(\d+)(s|m)$/;

/** The prefix a habit used to carry to bind a practice to a place.
 *
 * Superseded by `Habit.placeIds`. The tag was never really a tag: the kernel's
 * flatten rule makes `place-atlantis` and `kairos:place/atlantis` the same
 * reference, written smaller only because `Habit` had no field to hold one. It
 * has one now, and `placesOf` reads the tag only as a fallback until the
 * migration moves the data — so the roster does not go quiet mid-migration.
 *
 * Still exported because an edge may hold either spelling of "here". */
export const PLACE_PREFIX = "place-";

/** Where the principal is. A plain alias, like the ids: the vocabulary is worth
 * having, a brand is not. */
export type Place = string;

/** Past this the principal's own logs show ordinary baseline drift, so a claim
 * about the gap stops being one. */
export const FIVE_MINUTES: Duration = 5 * 60_000;

/** A habit, as much of one as this rule needs to see. */
export interface PracticeCandidate {
  readonly id: HabitId;
  readonly name: string;
  readonly tags?: readonly string[] | null;
  readonly isArchived?: boolean;
  /** Where its object actually is, as entity keys. Supersedes `place-` tags. */
  readonly placeIds?: readonly string[] | null;
}

export interface GapPractice {
  readonly habitId: HabitId;
  readonly name: string;
  /** From the `gap-*` tag. Undefined when the habit declares no size. */
  readonly fitsMs?: Duration;
}

/** Seconds or minutes from a `gap-30s` / `gap-2m` tag. */
function sizeOf(tags: readonly string[]): Duration | undefined {
  for (const t of tags) {
    const m = SIZE_TAG.exec(t.trim().toLowerCase());
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    return m[2] === "s" ? n * 1000 : n * 60_000;
  }
  return undefined;
}

/** A place as the garden spells it: trimmed, lowercased, prefix removed.
 * Tolerant of a caller that hands over the whole tag, because `place-sao-paulo`
 * and `sao-paulo` name the same city, and the alternative is every placed
 * practice disappearing with nothing raised. */
function placeName(value: string): Place {
  const v = value.trim().toLowerCase();
  return v.startsWith(PLACE_PREFIX) ? v.slice(PLACE_PREFIX.length) : v;
}

/**
 * The places a practice is bound to. Empty means bound to none, which is not the
 * same thing as bound to nowhere.
 *
 * Unlike `sizeOf` this does not return on the first match. Two sizes on one
 * habit contradict each other, so the first wins and the rest are noise. Two
 * places do not contradict: a practice that works in both cities says so by
 * carrying both tags, and taking only the first would exile it from one of them.
 */
function placesOf(
  placeIds: readonly string[] | null | undefined,
  tags: readonly string[],
): readonly Place[] {
  // The field wins whole, never merged with the tags. A habit the migration
  // has half-touched would otherwise stay bound to a place it was moved off,
  // and an offer in the wrong city is the failure this rule exists to prevent.
  // Empty is treated as absent, the same as everywhere else places are stored.
  const declared = (placeIds ?? [])
    .map((p) => placeName(String(p)))
    .filter((p) => p.length > 0);
  if (declared.length > 0) return declared;

  const out: Place[] = [];
  for (const t of tags) {
    const tag = t.trim().toLowerCase();
    if (!tag.startsWith(PLACE_PREFIX)) continue;
    const place = placeName(tag);
    if (place.length > 0) out.push(place);
  }
  return out;
}

/**
 * The practices that fit a gap, smallest first.
 *
 * Smallest first because the hole that actually drains is small: the drift
 * excess sits at 15–60s and the median time to first drift is 38 seconds. A
 * two-minute practice is the right answer to a three-minute wait and useless
 * against the reflex, so an unsized or oversized practice must never crowd out a
 * short one. Practices declaring no size sort last — unknown is not small.
 *
 * ── Where the principal is ────────────────────────────────────────
 *
 * `at` names the city. It is a parameter rather than a lookup because the domain
 * has no business knowing that this principal splits his year between two of
 * them; the edge holds that, the way `host-block-seed.mts` holds his plot ids
 * instead of pushing them into the rules.
 *
 * A practice tagged for a place is offered only there. `dead hang` needs a
 * pull-up bar, the bar is in Sao Paulo, and the roster's own test is that the
 * object is within reach or it never happens. An offer he cannot act on is worse
 * than no offer, because it teaches him the roster is not worth reading.
 *
 * A practice tagged for no place is offered everywhere. That is all of the
 * roster but two, and an unplaced practice is not a placed one with the place
 * missing: breathwork asks for a body and nothing else.
 *
 * **When `at` is unknown, placed practices are still offered.** It is the call
 * the `within` bound already made one field over: a practice is never excluded
 * by a constraint that cannot be checked against it. Hiding them would quietly
 * empty the roster on every surface not yet taught to say where he is, and a
 * roster that shrinks in silence is a failure nobody sees, while an out-of-town
 * suggestion is one he skips in the second it takes to read.
 */
export function practicesForGap(
  habits: readonly PracticeCandidate[],
  within?: Duration,
  at?: Place,
): readonly GapPractice[] {
  const here = at === undefined ? undefined : placeName(at);
  const out: GapPractice[] = [];
  for (const h of habits ?? []) {
    if (h?.isArchived) continue;
    const tags = (h?.tags ?? []).map((t) => String(t).trim().toLowerCase());
    if (!tags.includes(GAP_TAG)) continue;
    const places = placesOf(h?.placeIds, tags);
    if (here !== undefined && places.length > 0 && !places.includes(here))
      continue;
    const fitsMs = sizeOf(tags);
    if (within !== undefined && fitsMs !== undefined && fitsMs > within)
      continue;
    out.push({ habitId: h.id, name: h.name, ...(fitsMs ? { fitsMs } : {}) });
  }
  return out.sort(
    (a, b) =>
      (a.fitsMs ?? Number.POSITIVE_INFINITY) -
      (b.fitsMs ?? Number.POSITIVE_INFINITY),
  );
}

export interface GapPracticeInput {
  readonly id: RuleId;
  readonly name: string;
  readonly description: string;
  readonly serves: DistalRef;
  /**
   * The plots attention should not land in during the wait.
   *
   * Stated as what to stay out of rather than what to return to: the gap has
   * nothing to return to, because the agent holds the work. The only thing that
   * can be true of it is that it passed without a departure.
   */
  readonly staysOutOf: readonly AreaId[];
  readonly windowMs?: Duration;
  readonly deliveryProbability?: number;
}

export function gapPracticeRule(input: GapPracticeInput): RuleSpec {
  const gate: GateSpec = {
    kind: "gate",
    /** On entry: the gap opening. The agent starting work is the event, and the
     * offer belongs at its edge — a cue fired part-way through a wait would be
     * interrupting the practice it just offered. */
    trigger: { type: "entry" },
    /** An acknowledgement, not a practice. Which practice is offered is resolved
     * from the garden at delivery, so the rule names none. */
    frictionType: { type: "confirmation" },
    /** Required by type, and what keeps this an offer. Waiting is correct
     * behaviour — the agent is working — so a practice that could not be waved
     * past would be a wall across a window in which nothing is being done wrong. */
    proceedAffordance: { label: "Skip", action: { type: "continue" } },
  };

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    /** In force over an interval, not a territory: the gap is named by the agent
     * starting work, not by anywhere the principal happens to be. */
    scope: { surface: "session", paths: [] },
    /** Still the only one. Everything else in this directory subtracts. */
    mechanism: "substitution",
    /** Scaffolding. An offer into gaps that stopped draining should be allowed to
     * lapse without anyone deciding it. */
    fadeEligibility: "auto",
    outcome: {
      claim:
        "the wait passes without attention leaving for a messaging or media plot",
      measure: { kind: "no_span_matching", areaIds: input.staysOutOf },
      windowMs: input.windowMs ?? FIVE_MINUTES,
    },
    serves: input.serves,
    deliveryProbability: input.deliveryProbability ?? 1,
    primitives: [gate],
  };
}
