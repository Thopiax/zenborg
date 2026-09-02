import type { AreaId, Duration, RuleId } from "../../attention/ids";
import type { GateSpec } from "../Primitive";
import type { DistalRef } from "../ProximalOutcome";
import type { RuleSpec } from "../RuleSpec";

/**
 * A dwell gate — a recurring stopping cue on a site you are already inside.
 *
 * The shape that measurably curbed YouTube, said as a rule that names what it is
 * for. A content-script overlay fires every N minutes of attended dwell,
 * carrying the friction and both affordances the rule declares. Nothing is
 * touched at the network layer, the page keeps working, and the only cost is the
 * interstitial. That is why it curbs without feeling broken.
 *
 * ── Why this exists, and why it is not a host block ─────────────────────
 *
 * `hostBlock` is the other answer to "curb this site", and for LinkedIn it was
 * the wrong one. `keel/docs/pain/2026-08-19-linkedin-reloads-the-feed-because-
 * it-is-on-the-wrong-primiti.md` records what a standing access-block does to a
 * running SPA: its data requests fail one at a time, its client reads each
 * failure as a transient network error and re-mounts, and the shell keeps
 * rendering because the asset domain is a different registrable domain. The
 * result is a feed that reloads forever rather than a page that cleanly refuses.
 * A wall a site can keep knocking on is the least reliable shape available.
 *
 * The two rules answer two different questions. A wall answers *should I be able
 * to reach this at all*, and it holds because the key is out of the room
 * (`out_of_band`, resolver-enforced, reaching a phone). A dwell gate answers
 * *have I been here longer than I meant to be*, and it holds because the cue
 * arrives at all, not because it cannot be waved past. Choosing between them is
 * choosing which question the site poses. LinkedIn poses the second: the reach
 * is legitimate and the stretch is not.
 *
 * ── Escalation is a second rule, not a new field ────────────────────────
 *
 * keel's `evaluateGates` runs every gate on the domain and shows the one with
 * the larger interval when both come due, while still recording both. So a
 * twenty-minute cue and an hourly beat are two rules, and neither this factory
 * nor `GateSpec` grows a ladder field to hold them. The escalation path in the
 * pain doc is exactly this, and the test at the bottom of `dwellGate.test.ts`
 * pins it.
 */

/** The window a return is claimed inside. The same ten minutes `hostBlock` and
 * `areaDrift` use, and for the same reason: past it the principal's own logs
 * show ordinary drift, so a claim about the cue stops being one. */
export const TEN_MINUTES: Duration = 10 * 60_000;

/**
 * Never withholds.
 *
 * `areaDrift` ships at `UNDER_TEST` because whether the intervention works at
 * all is the open question there. It is not the open question here, twice over:
 * the dwell gate already curbed YouTube measurably, and the principal named
 * LinkedIn as a site to curb. Withholding the cue at half the eligible decision
 * points would withhold something he asked for in order to measure something he
 * did not ask about — the same argument `sessionFence` makes, and the same
 * constant.
 *
 * What that costs is real and worth stating: the proximal outcome settles
 * against no within-subject comparison condition, so it reports a rate rather
 * than a difference. The comparison available is the before, not the withheld.
 * `deliveryProbability` stays an input for the day that is the wrong trade.
 */
export const ALWAYS = 1;

export interface DwellGateInput {
  readonly id: RuleId;
  /** A registrable host, without scheme or path. */
  readonly host: string;
  readonly name: string;
  readonly description: string;
  /** The season intention this serves. A pointer, not a second declaration. */
  readonly serves: DistalRef;
  /**
   * The areas attention should return to when the cue lands.
   *
   * This is the whole proximal claim. Interrupting the scroll is not the point;
   * the next ten minutes landing somewhere planted is.
   */
  readonly returnsTo: readonly AreaId[];
  /** Minutes of *attended* dwell between cues. Idle and backgrounded time does
   * not accumulate, so this is time spent, not time elapsed. */
  readonly everyMinutes: number;
  /** What the cue asks. An intention, not a confirmation: a click costs nothing
   * and teaches nothing, and naming what you are still here for is the friction. */
  readonly prompt: string;
  readonly proceedLabel: string;
  /** The abort. Not required by type — `proceedAffordance` is what invariant 6
   * binds — but a stopping cue with no named way to stop is a cue that only ever
   * offers the way on. */
  readonly abortLabel: string;
  readonly windowMs?: Duration;
  readonly deliveryProbability?: number;
}

export function dwellGateRule(input: DwellGateInput): RuleSpec {
  const gate: GateSpec = {
    kind: "gate",
    trigger: { type: "dwell", everyMinutes: input.everyMinutes },
    frictionType: { type: "intention", prompt: input.prompt },
    /**
     * The exit, required by type. `continue` and not `redirect`: the cue's job
     * is to make the stretch visible, and routing the person somewhere they did
     * not choose would be the software deciding where attention goes next, which
     * is the thing this whole layer refuses to do.
     */
    proceedAffordance: {
      label: input.proceedLabel,
      action: { type: "continue" },
    },
    abortAffordance: { label: input.abortLabel },
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
    /**
     * Friction, not access-block. Nothing is made unreachable: the overlay
     * interrupts and then proceeds if the person says so, and no request is
     * touched. Calling it an access-block would both overstate what a gate does
     * and misfile it against the refused-BCT table — and it is the exact
     * mislabelling that put LinkedIn on a cooldown in the first place.
     */
    mechanism: "friction",
    /**
     * Auto. A cue into a stretch that stopped happening should be able to lapse
     * without a decision, which is what invariant 5 forbids scaffolding from
     * doing forever. The wall family sets this to manual because a wall quietly
     * lifting itself would be worse than no wall; a cue quietly stopping when
     * there is nothing to cue is just the scaffolding coming down.
     */
    fadeEligibility: "auto",
    outcome: {
      claim: `the cue ends the stretch — attention moves to a planted area rather than continuing on ${input.host}`,
      measure: { kind: "next_span_in", areaIds: input.returnsTo },
      windowMs: input.windowMs ?? TEN_MINUTES,
    },
    serves: input.serves,
    deliveryProbability: input.deliveryProbability ?? ALWAYS,
    primitives: [gate],
  };
}

/**
 * A rule id derived from the host it cues on.
 *
 * Deterministic, for the reason `seedRuleId` is: the seed is installed by hand
 * into the runtime rules, and a re-derived id replaces the file it replaces
 * instead of standing up a second cue beside the first. A second interval is a
 * deliberate second id, passed explicitly.
 */
export function dwellGateRuleId(host: string): RuleId {
  return `dwell-gate-${host
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
}

/** LinkedIn, bare. Domains are normalised before matching, so the `www.` host
 * resolves to the same key and `*://*.linkedin.com/*` covers the rest. */
export const LINKEDIN_HOST = "linkedin.com";

/**
 * Twenty minutes of attended dwell.
 *
 * From the pain doc, and a starting value rather than a finding. It is the
 * parameter the rule is least sure of, and the honest thing to say about it is
 * that the escalation path if it proves too cheap is a second rule at a longer
 * beat, not a smaller number here.
 */
export const LINKEDIN_EVERY_MINUTES = 20;

export interface LinkedinDwellGateInput {
  readonly serves: DistalRef;
  readonly returnsTo: readonly AreaId[];
  /** Defaults to `dwellGateRuleId(LINKEDIN_HOST)`. Pass one to stand a second
   * cue at a different beat beside the first. */
  readonly id?: RuleId;
  readonly everyMinutes?: number;
  readonly windowMs?: Duration;
  readonly deliveryProbability?: number;
}

/**
 * The LinkedIn cue.
 *
 * Named rather than left to the composition edge, unlike the host list, because
 * this is not a list: it is one site whose diagnosis is written down, and the
 * copy below is the answer to that diagnosis rather than one person's
 * preference. The plots and the season stay outside, where the rest of his ids
 * live.
 */
export function linkedinDwellGate(input: LinkedinDwellGateInput): RuleSpec {
  return dwellGateRule({
    id: input.id ?? dwellGateRuleId(LINKEDIN_HOST),
    host: LINKEDIN_HOST,
    name: "LinkedIn dwell gate",
    description: `A stopping cue every ${input.everyMinutes ?? LINKEDIN_EVERY_MINUTES} minutes of attended LinkedIn.`,
    serves: input.serves,
    returnsTo: input.returnsTo,
    everyMinutes: input.everyMinutes ?? LINKEDIN_EVERY_MINUTES,
    prompt: "Still what you came for?",
    proceedLabel: "Keep scrolling",
    abortLabel: "Close the tab",
    ...(input.windowMs === undefined ? {} : { windowMs: input.windowMs }),
    ...(input.deliveryProbability === undefined
      ? {}
      : { deliveryProbability: input.deliveryProbability }),
  });
}
