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

/** Past this the principal's own logs show ordinary baseline drift, so a claim
 * about the gap stops being one. */
export const FIVE_MINUTES: Duration = 5 * 60_000;

/** A habit, as much of one as this rule needs to see. */
export interface PracticeCandidate {
  readonly id: HabitId;
  readonly name: string;
  readonly tags?: readonly string[] | null;
  readonly isArchived?: boolean;
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

/**
 * The practices that fit a gap, smallest first.
 *
 * Smallest first because the hole that actually drains is small: the drift
 * excess sits at 15–60s and the median time to first drift is 38 seconds. A
 * two-minute practice is the right answer to a three-minute wait and useless
 * against the reflex, so an unsized or oversized practice must never crowd out a
 * short one. Practices declaring no size sort last — unknown is not small.
 */
export function practicesForGap(
  habits: readonly PracticeCandidate[],
  within?: Duration,
): readonly GapPractice[] {
  const out: GapPractice[] = [];
  for (const h of habits ?? []) {
    if (h?.isArchived) continue;
    const tags = (h?.tags ?? []).map((t) => String(t).trim().toLowerCase());
    if (!tags.includes(GAP_TAG)) continue;
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
