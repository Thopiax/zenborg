import type { AreaId, Duration, RuleId } from "../../attention/ids";
import type { SelectorChain, TransformSpec } from "../Primitive";
import type { DistalRef } from "../ProximalOutcome";
import type { RuleSpec } from "../RuleSpec";

/**
 * A browser-scoped DOM transform — the third fence tool, and the missing
 * `transform` writer. `hostBlockRule` answers "should I be able to reach
 * this at all" and `browserDwellGateRule` answers "have I been here longer
 * than I meant to be"; this one answers neither. It conceals a cue rather
 * than gating a crossing, which is why its mechanism is cue-removal rather
 * than access-block or friction, and why it has no exit to carry.
 *
 * ── Why `transform` needs no exit ────────────────────────────────────────
 *
 * `carriesExit(transform)` is `false` by design (`Primitive.test.ts`,
 * "renders without offering a way out") — and that is a true statement
 * about the primitive, not a violation of invariant 6. A CSS hide withholds
 * nothing: the concealed surface is still one direct navigation away, view
 * source away, or "disable this rule" away. Invariant 6 protects against a
 * primitive that can trap someone in a workflow requiring a click-through or
 * a wait; a transform offers no such workflow to be trapped in. `writeFence`
 * in `use-cases/fences.ts` now scopes its invariant-6 check to `gate` and
 * `cooldown` for exactly this reason, rather than reading every primitive's
 * `carriesExit() === false` as a refusal.
 *
 * ── The wire shape, and why it diverges from the domain contract ─────────
 *
 * `keel/docs/primitive-contracts.md` still shows `restyle` carrying
 * `rules: CssRule[]` with a `scope`. The interpreter that actually ships
 * (`apps/browser/modules/friction/transform/apply.ts`, and the loader at
 * `apps/agent/store.mjs#loadTransforms`) reads a flat `style` object instead,
 * and reads `targets`, never `target`. This factory writes the shape the
 * interpreter reads, which is the two production rules already prove out:
 * `~/.zenborg/keel/rules/linkedin-feed-hidden.json` and
 * `youtube-shorts-hidden.json` (pre-migration, hand-authored — this factory
 * is what lets a rule with the same shape be declared through `fences`
 * instead).
 */

const TEN_MINUTES: Duration = 10 * 60_000;

export type TransformReplacement = TransformSpec["replacement"];

export interface BrowserTransformInput {
  readonly id: RuleId;
  /** A registrable host, without scheme or path. */
  readonly host: string;
  readonly name: string;
  readonly description: string;
  /** The season intention this serves. A pointer, not a second declaration. */
  readonly serves: DistalRef;
  /** What gets hidden, restyled or replaced — the primary selector plus any
   * fallbacks to emit alongside it. `fallbacks` defaults to none. */
  readonly targets: {
    readonly primary: string;
    readonly fallbacks?: readonly string[];
  };
  /** Defaults to a plain hide — the common case, and the one that needs no
   * further argument to be complete. */
  readonly replacement?: TransformReplacement;
  /**
   * The areas attention should be free to land in with the cue gone.
   *
   * A transform fires no discrete crossing the way a block or a gate does —
   * it is continuously in force rather than triggered — so `next_span_in`
   * is a looser fit here than it is for the other two fence tools. It is
   * still the honest answer to "why does this rule exist": naming nothing
   * would leave the claim unanswerable, which `validateRuleSpec` already
   * refuses for the other two.
   */
  readonly returnsTo: readonly AreaId[];
  readonly windowMs?: Duration;
}

export function browserTransformRule(input: BrowserTransformInput): RuleSpec {
  const transform: TransformSpec = {
    kind: "transform",
    targets: {
      primary: input.targets.primary,
      fallbacks: input.targets.fallbacks ?? [],
    },
    replacement: input.replacement ?? { type: "hide" },
  };

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    scope: {
      surface: "browser",
      domain: input.host,
      matches: [`*://${input.host}/*`, `*://*.${input.host}/*`],
    },
    mechanism: "cue-removal",
    /**
     * Manual, same as a host block: a concealment is a standing decision
     * about what this surface looks like, not scaffolding that should be
     * allowed to lapse quietly the way a recurring cue can.
     */
    fadeEligibility: "manual",
    outcome: {
      claim: `concealing ${input.targets.primary} on ${input.host} leaves the next span free to land in a planted area rather than back on the cue`,
      measure: { kind: "next_span_in", areaIds: input.returnsTo },
      windowMs: input.windowMs ?? TEN_MINUTES,
    },
    serves: input.serves,
    /**
     * Never withholds. Unlike the dwell gate, whether concealment works is
     * not what a transform ships to find out — it either renders or it
     * doesn't, and a stale selector is a maintenance question, not an
     * experimental one.
     */
    deliveryProbability: 1,
    primitives: [transform],
  };
}

export type { SelectorChain };
