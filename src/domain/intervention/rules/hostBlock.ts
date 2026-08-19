import type { AreaId, Duration, RuleId } from "../../attention/ids";
import type { CooldownSpec } from "../Primitive";
import type { DistalRef } from "../ProximalOutcome";
import type { RuleSpec } from "../RuleSpec";

/**
 * Host blocking, expressed as a rule that says what it is for.
 *
 * The blocklist is the oldest working piece of this system and the only one
 * with teeth that survived. It has never carried a statement of what it should
 * achieve, which is the single gap the whole design exists to close, so this is
 * where closing it is worth the most.
 *
 * It is a `cooldown`, not an `intercept`. `CooldownSpec` already carries
 * resolver enforcement, a standing duration, and a required unlock path, so
 * host blocking needs no exception to invariant 6 and never did.
 */

const TEN_MINUTES: Duration = 10 * 60_000;

export interface HostBlockInput {
  readonly id: RuleId;
  /** A registrable host, without scheme or path. */
  readonly host: string;
  readonly name: string;
  readonly description: string;
  /** The season intention this serves. A pointer, not a second declaration. */
  readonly serves: DistalRef;
  /**
   * The areas attention should return to when the wall is met.
   *
   * This is the whole proximal claim. Blocking a site is not the point; not
   * losing the next ten minutes to something else is.
   */
  readonly returnsTo: readonly AreaId[];
  /** The resolver profile carrying the block. Reaches devices the app does not. */
  readonly resolverProfile: string;
  /** How the block is lifted, deliberately outside the running system. */
  readonly unlockNote: string;
  readonly windowMs?: Duration;
}

export function hostBlockRule(input: HostBlockInput): RuleSpec {
  const cooldown: CooldownSpec = {
    kind: "cooldown",
    enforcement: { at: "resolver", profile: input.resolverProfile },
    duration: { type: "standing" },
    unlockPath: { type: "out_of_band", note: input.unlockNote },
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
    mechanism: "access-block",
    /**
     * Manual, not never. A standing block that could never be lifted would be
     * the forever scaffolding `fadeEligibility` exists to forbid; manual says it
     * does not fade on its own and lifting it is a deliberate act, which is the
     * same thing `out_of_band` says about the exit.
     */
    fadeEligibility: "manual",
    outcome: {
      claim: `meeting the ${input.host} wall returns attention to a planted area rather than to another reach`,
      measure: { kind: "next_span_in", areaIds: input.returnsTo },
      windowMs: input.windowMs ?? TEN_MINUTES,
    },
    serves: input.serves,
    /**
     * Never withholds, and the spec permits exactly this: `deliveryProbability`
     * below 1 is for rules shipped to find out whether they work. This one
     * already works. What is unknown is not whether the block holds but what
     * happens in the ten minutes after it does, and randomly unblocking a
     * resolver profile could not answer that anyway.
     */
    deliveryProbability: 1,
    primitives: [cooldown],
  };
}

/**
 * The three that have actually been running.
 *
 * keel ships no watchlist entries by design; the drogue's seed blocklist is its
 * one explicitly consented exception, and this carries that exception forward
 * rather than inventing a second one. Productizing for anyone else means moving
 * this to config: it is one person's list, not a default.
 */
export const DROGUE_SEED_HOSTS: readonly string[] = Object.freeze([
  "linkedin.com",
  "youtube.com",
  "chess.com",
]);
