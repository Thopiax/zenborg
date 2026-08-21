import type { AreaId, Duration, RuleId } from "../../attention/ids";
import type { CooldownEnforcement, CooldownSpec } from "../Primitive";
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
  readonly resolverProfile?: string;
  /**
   * Where the block is applied. Defaults to the resolver when a profile is
   * named, because that is the reach nothing else here has.
   *
   * One rule, one enforcement point, on purpose. A host wanting both the phone
   * and the laptop browser gets two rules with two ids, so a delivery stays
   * attributable to the surface that actually made it — which is the whole
   * reason `Delivery` records an origin.
   */
  readonly enforcement?: CooldownEnforcement;
  /** How the block is lifted, deliberately outside the running system. */
  readonly unlockNote: string;
  readonly windowMs?: Duration;
}

export function hostBlockRule(input: HostBlockInput): RuleSpec {
  const enforcement: CooldownEnforcement =
    input.enforcement ??
    (input.resolverProfile === undefined
      ? { at: "browser" }
      : { at: "resolver", profile: input.resolverProfile });

  const cooldown: CooldownSpec = {
    kind: "cooldown",
    enforcement,
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

export interface HostBlockSeedInput {
  readonly serves: DistalRef;
  readonly returnsTo: readonly AreaId[];
  readonly unlockNote: string;
  /** Defaults to the browser — the surface migration step 5 flips. */
  readonly enforcement?: CooldownEnforcement;
  readonly hosts?: readonly string[];
}

/**
 * The seed blocklist as fences, ready to be written.
 *
 * ── Why the id is derived and not random ────────────────────────────────
 *
 * Every other rule in this domain takes its id from the caller, because every
 * other rule is one the principal declared once. A seed is different: it is the
 * *same* commitment re-expressed whenever the collection is (re)seeded, and a
 * fresh uuid each time would leave three fences per host after three runs, each
 * with its own crossing tally, each firing on the same navigation. Deriving the
 * id from the host and the enforcement point makes re-seeding a replace.
 *
 * The enforcement point is in the id on purpose. A host blocked at the resolver
 * and at the browser is two rules — see `HostBlockInput.enforcement` — and two
 * rules need two ids or the second silently overwrites the first.
 *
 * ── Why it defaults to the browser ──────────────────────────────────────
 *
 * A resolver-enforced rule reaches the phone and is enforced by a DNS profile
 * nothing in this system writes; the rule *describes* it. A browser-enforced one
 * is actuated here and now, by the extension, from the armed record. Step 5's
 * job is the second of those, so that is the default, and the first stays one
 * argument away.
 */
export function hostBlockSeedRules(
  input: HostBlockSeedInput,
): readonly RuleSpec[] {
  const enforcement: CooldownEnforcement = input.enforcement ?? {
    at: "browser",
  };
  const at =
    enforcement.at === "resolver"
      ? `resolver-${enforcement.profile}`
      : enforcement.at;

  return (input.hosts ?? DROGUE_SEED_HOSTS).map((host) =>
    hostBlockRule({
      id: `seed-block-${at}-${host}`,
      host,
      name: host,
      description: `The seed blocklist, carried forward as a fence rather than as a list.`,
      serves: input.serves,
      returnsTo: input.returnsTo,
      unlockNote: input.unlockNote,
      enforcement,
    }),
  );
}
