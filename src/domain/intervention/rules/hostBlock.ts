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
 * The hosts that take a standing wall.
 *
 * keel ships no watchlist entries by design; the drogue's seed blocklist is its
 * one explicitly consented exception, and this carries that exception forward
 * rather than inventing a second one. Productizing for anyone else means moving
 * this to config: it is one person's list, not a default.
 *
 * ── What is on it, and why each one ─────────────────────────────────────
 *
 * `youtube.com`: the original, unchanged.
 *
 * `chess.com`: the original, unchanged.
 *
 * `lichess.org`: added. The one genuine hole in the old list: chess was named
 * as a thing to curb and the second place it happens was matched by nothing.
 * `lichess.org` is a different registrable domain, so no `chess.com` pattern
 * reaches it, and it is a full site rather than a doorway to one. Closing it
 * closes a route that was open.
 *
 * ── What was considered and left off ────────────────────────────────────
 *
 * `m.youtube.com`, `www.linkedin.com` and every other subdomain: already
 * covered. `hostBlockRule` emits `*://*.${host}/*` alongside the bare host, and
 * keel's DNR projection matches `requestDomains` against subdomains too. Naming
 * a subdomain would be a second name for a route already closed, and a second
 * name is a second place to forget.
 *
 * `youtu.be`: a pure redirector. Every path through it ends in a request to
 * `youtube.com`, which is already refused, so adding it closes no route; it only
 * moves where the refusal appears. It does not help on the phone either: a
 * `youtu.be` link there hands off to the YouTube app, which never asks for
 * either host. Left off deliberately rather than overlooked.
 *
 * `lnkd.in`: the same shape for LinkedIn, and moot besides: see below.
 *
 * ── Why LinkedIn is not here ────────────────────────────────────────────
 *
 * It was, and it was the wrong primitive. `keel/docs/pain/2026-08-19-linkedin-
 * reloads-the-feed-because-it-is-on-the-wrong-primiti.md` records what a
 * standing access-block does to a site you are already inside: the feed is an
 * SPA that is still running when the block lands, its data requests fail one at
 * a time, and its client reads each failure as a transient network error and
 * re-mounts. The shell keeps rendering because `licdn.com` is a different
 * registrable domain. The result is a page that reloads forever rather than one
 * that cleanly refuses.
 *
 * That is not a wall. A wall a site can keep knocking on is the least reliable
 * shape available, which is why removing it *is* the shield getting better
 * rather than the shield being dropped. LinkedIn belongs on the `gate` that
 * measurably curbed YouTube: friction with an exit, nothing touched at the
 * network layer. The gate rule itself lives in the runtime rules, which are
 * private tier; the order in the pain doc holds, and lifting the block comes
 * first.
 */
export const DROGUE_SEED_HOSTS: readonly string[] = Object.freeze([
  "youtube.com",
  "chess.com",
  "lichess.org",
]);

/**
 * A rule id derived from the host it blocks.
 *
 * Deterministic on purpose. The seed is installed by hand into the runtime
 * rules, and a re-derived id replaces the file it replaces instead of standing
 * up a second wall beside the first. Rule ids are never reused for a *different*
 * rule, which this respects: one host, one id, forever.
 */
export function seedRuleId(host: string): RuleId {
  return `host-block-${host
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
}

/**
 * The seed, as rules.
 *
 * `HostBlockInput.returnsTo` has carried the whole proximal claim since the rule
 * was written, and nothing built the rules, so nothing ever supplied it. This is
 * that missing half: one place that turns a host list plus the plots attention
 * should come back to into `RuleSpec[]`.
 *
 * It names no area and no cycle. The concrete plots are one person's garden, and
 * they belong at the composition edge with the rest of his ids, the same
 * arrangement `things-area-map.seed.json` uses, and the reason `resolveArea` in
 * `use-cases/fences.ts` resolves ids rather than holding any.
 *
 * Validation stays where it already is. A seed built with no return areas is
 * unsettleable and `validateRuleSpec` says so; inventing a plot to point at here
 * would silence the one check that matters.
 */
export interface HostBlockSeedInput {
  /** The season intention every seeded rule points at. */
  readonly serves: DistalRef;
  /**
   * The plots attention should return to when any of these walls is met.
   *
   * Shared across the seed rather than per host: the claim is about where
   * attention lands next, and that does not change with which wall stopped it.
   */
  readonly returnsTo: readonly AreaId[];
  readonly resolverProfile: string;
  readonly unlockNote: string;
  /** Defaults to `DROGUE_SEED_HOSTS`. Anyone else's seed is their own list. */
  readonly hosts?: readonly string[];
  readonly windowMs?: Duration;
}

export function hostBlockSeedRules(
  input: HostBlockSeedInput,
): readonly RuleSpec[] {
  const rules: RuleSpec[] = [];

  for (const host of input.hosts ?? DROGUE_SEED_HOSTS) {
    rules.push(
      hostBlockRule({
        id: seedRuleId(host),
        host,
        name: host,
        description: `A standing wall at ${host}, lifted only out of band.`,
        serves: input.serves,
        returnsTo: input.returnsTo,
        resolverProfile: input.resolverProfile,
        unlockNote: input.unlockNote,
        ...(input.windowMs === undefined ? {} : { windowMs: input.windowMs }),
      }),
    );
  }

  return rules;
}
