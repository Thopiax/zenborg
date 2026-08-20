import type { AreaId, Duration, RuleId } from "../../attention/ids";
import type { GateSpec } from "../Primitive";
import type { DistalRef } from "../ProximalOutcome";
import type { RuleSpec } from "../RuleSpec";

/**
 * The breath — the first rule that offers something instead of taking something
 * away, and the first use of `mechanism: "substitution"`.
 *
 * ── The hole it is shaped to ────────────────────────────────────────────
 *
 * Every other rule here subtracts: a gate interrupts, a cooldown waits, a host
 * block refuses. Subtraction is the wrong instrument for a gap, because a gap is
 * already an absence. Nothing is happening and something will fill it.
 *
 * `keel/docs/references/2026-08-05-ai-wait-gap-evidence.md` measured which
 * something, against 36 days of the principal's own logs:
 *
 *   - 45.6% of active session wall-clock is spent waiting on the agent.
 *   - Drift is 1.65× more likely per minute inside that wait — but the effect is
 *     carried by messaging, not scrolling. WhatsApp alone is 45% of it.
 *   - The excess sits at **15–60s** (~2.9× over baseline). Past 300s the drift
 *     rate is ordinary, and past 600s it is *below* baseline (0.70×).
 *   - Median time to first drift inside a gap: **38 seconds**. p25 is 12.
 *
 * That is the signature of a reflexive check, not a boredom-driven scroll, and it
 * sets the design constraint that matters: **the substitute has to fit in about
 * forty seconds.** A deliberate defocus break of ten to thirty minutes is the
 * right medicine for a ninety-minute bout and is useless here — it is two orders
 * of magnitude too large for the hole being measured. The instinct to defend the
 * long wait is also wrong; the long wait is the safe one.
 *
 * ── Why a gate primitive for a substitution ─────────────────────────────
 *
 * `mechanism` and `Primitive` are different axes. The mechanism is the
 * behaviour-change theory — here substitution, offering an alternative act rather
 * than removing the tempting one. The primitive is the actuator, and `GateSpec`
 * carries `frictionType: { type: "breath", cycles }`, which exists for exactly
 * this and had no caller until now.
 *
 * It is gate-shaped in the sense that counts: it puts a surface where a reflex
 * would otherwise go. What it interrupts is not a tool call but the gap itself.
 * `proceedAffordance` is required by type and is the honest exit — the offer can
 * always be waved past, which is what keeps this an offer.
 */

/** Past this, the principal's own data shows drift running at ordinary baseline,
 * so a claim about the gap stops being a claim about the gap. */
export const FIVE_MINUTES: Duration = 5 * 60_000;

/** Slow enough to be a breath rather than a pause. Three is the smallest count
 * that reads as a practice instead of an interruption. */
export const DEFAULT_CYCLES = 3;

export interface BreatheInput {
  readonly id: RuleId;
  readonly name: string;
  readonly description: string;
  /** The season intention this serves. A pointer, not a second declaration. */
  readonly serves: DistalRef;
  /**
   * The plots attention should NOT land in during the wait.
   *
   * Stated as what to stay out of rather than what to return to, because the gap
   * has nothing to return *to* — the agent holds the work. The claim is that the
   * gap passes without a departure, which is the only thing that can be true of
   * a window where the person is, correctly, not working.
   */
  readonly staysOutOf: readonly AreaId[];
  readonly cycles?: number;
  readonly windowMs?: Duration;
  /** Defaults to 1: the offer is not what is in question, and a breath withheld
   * at half the gaps is a breath that cannot be leaned on. Pass a lower value to
   * run it as a comparison instead. */
  readonly deliveryProbability?: number;
}

export function breatheRule(input: BreatheInput): RuleSpec {
  const gate: GateSpec = {
    kind: "gate",
    frictionType: {
      type: "breath",
      cycles: input.cycles ?? DEFAULT_CYCLES,
    },
    /**
     * Required by type, and the reason this stays an offer. A breath that could
     * not be waved past would be a wall across a window in which the person is
     * doing nothing wrong — the agent is working, and waiting is correct.
     */
    proceedAffordance: {
      label: "Skip",
      action: { type: "continue" },
    },
  };

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    /**
     * No paths. This rule is not in force over a territory — it is in force over
     * an interval, and the interval is named by the agent starting work rather
     * than by anywhere the principal happens to be.
     */
    scope: { surface: "session", paths: [] },
    /** The first one. Everything else in this directory subtracts. */
    mechanism: "substitution",
    /**
     * Auto. A breath offered into gaps that stopped draining should be allowed to
     * lapse without anyone deciding it — it is scaffolding, and invariant 5
     * forbids scaffolding that cannot fade.
     */
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

/**
 * How long after the gap opens the offer should appear, in ms.
 *
 * Not zero. An offer that lands with the prompt is competing with the thought the
 * principal just finished having, and it would fire on every turn including the
 * ones that return instantly. p25 of time-to-first-drift is 12 seconds, so the
 * offer wants to be present before that and absent from turns too short to drift
 * in at all.
 *
 * Deliberately a constant rather than a rule field: it is a property of the
 * measured hole, not of anyone's intention, and a rule that let it be tuned would
 * invite tuning it away from the evidence.
 */
export const OFFER_AFTER_MS = 8_000;
