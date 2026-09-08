import type { AreaId, Duration, RuleId } from "../../attention/ids";
import type { GateSpec } from "../Primitive";
import type { DistalRef } from "../ProximalOutcome";
import type { RuleSpec } from "../RuleSpec";

/**
 * A browser-scoped dwell gate — the recurring stopping cue, expressed as a rule
 * that says what it is for.
 *
 * ── Why this exists, and why it is step 5 rather than slice E ───────────
 *
 * Slice E gave the extension a fence cache and made it actuate from that cache
 * and nothing else. It could not finish, and said so: zenborg's only fence
 * writer was `sessionFenceRule`, which produces `scope.surface: "session"` rules
 * that reach no browser. So the host kept reading a second store —
 * `~/.zenborg/keel/rules/*.json` — or the feature would have shipped inert.
 *
 * This factory is the missing half. A rule built here is browser-scoped, so it
 * survives the projection into the fence record, so the readers can collapse
 * onto `fences` as the single store.
 *
 * ── Why a gate and not a block ──────────────────────────────────────────
 *
 * `docs/pain/…linkedin-reloads-the-feed…` (keel `b59b01f`) is the case: a
 * standing block on a host you have a real reason to visit is answered by
 * lifting the block, and a block lifted in the moment is not a boundary, it is a
 * speed bump you have learned to take at speed. A dwell gate charges for the
 * *duration* rather than for the visit, which is the thing that actually goes
 * wrong. Attention is not asked to justify arriving; it is asked, every so
 * often, whether it is still what it came for.
 *
 * ── Invariant 6 ─────────────────────────────────────────────────────────
 *
 * `proceedAffordance` is a required field on `GateSpec`, so the exit is a
 * property of the type. The abort is separate and also given: a gate offering
 * only "carry on" is a wall wearing a question mark.
 */

const TEN_MINUTES: Duration = 10 * 60_000;

/** Never zero. A dwell gate at zero minutes is a gate on every frame, which is
 * not friction but a broken page — and the honest floor is a minute. */
const MIN_EVERY_MINUTES = 1;

export interface BrowserDwellGateInput {
  readonly id: RuleId;
  /** A registrable host, without scheme or path. */
  readonly host: string;
  readonly name: string;
  readonly description: string;
  /** The season intention this serves. A pointer, not a second declaration. */
  readonly serves: DistalRef;
  /**
   * The areas attention should land in after the gate.
   *
   * The proximal claim, and the same one every other rule here makes: the point
   * is not the interruption, it is where the next ten minutes go.
   */
  readonly returnsTo: readonly AreaId[];
  /** Accumulated attended dwell between firings. */
  readonly everyMinutes: number;
  /** What the gate asks. The person answers it; nothing else can. */
  readonly prompt: string;
  /** What proceeding is called. Defaults to the plain reading of proceeding. */
  readonly proceedLabel?: string;
  /** What leaving is called. */
  readonly abortLabel?: string;
  readonly windowMs?: Duration;
}

export function browserDwellGateRule(input: BrowserDwellGateInput): RuleSpec {
  const everyMinutes = Number.isFinite(input.everyMinutes)
    ? Math.max(MIN_EVERY_MINUTES, Math.round(input.everyMinutes))
    : MIN_EVERY_MINUTES;

  const gate: GateSpec = {
    kind: "gate",
    trigger: { type: "dwell", everyMinutes },
    frictionType: { type: "intention", prompt: input.prompt },
    proceedAffordance: {
      label: input.proceedLabel ?? "Still what I came for",
      action: { type: "continue" },
    },
    abortAffordance: { label: input.abortLabel ?? "Close the tab" },
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
    mechanism: "friction",
    /**
     * Auto, where a host block is manual. A recurring cue is scaffolding: if the
     * habit it interrupts stops happening, the cue should be allowed to stop
     * mattering without a decision. A standing block is a commitment and must
     * not lapse quietly; this is not one.
     */
    fadeEligibility: "auto",
    outcome: {
      claim: `the ${input.host} gate returns attention to a planted area rather than to the next scroll`,
      measure: { kind: "next_span_in", areaIds: input.returnsTo },
      windowMs: input.windowMs ?? TEN_MINUTES,
    },
    serves: input.serves,
    /**
     * Below 1, deliberately. Unlike a host block, nobody knows whether this
     * works: the whole open question is whether a recurring stopping cue returns
     * attention or is merely absorbed. A rule shipped to find that out ships
     * with a comparison condition, which is what a probability below 1 buys.
     */
    deliveryProbability: 0.7,
    primitives: [gate],
  };
}

/**
 * The one that has actually been hurting.
 *
 * Named here rather than typed into a tool call so the pain and the rule stay
 * attached to each other. It is one person's list, same as `DROGUE_SEED_HOSTS`;
 * productizing means moving it to config.
 */
export const LINKEDIN_FEED_GATE = Object.freeze({
  host: "linkedin.com",
  name: "linkedin feed",
  description:
    "The feed reloads and the visit becomes a session. Charge for the duration, not for arriving.",
  everyMinutes: 5,
  prompt: "You came here for something. Is this still it?",
});
