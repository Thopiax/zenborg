#!/usr/bin/env node

/**
 * host-block-seed: the composition edge for the standing walls.
 *
 * `hostBlockSeedRules` in the domain names no plot and no season, because the
 * plots below are one person's garden and the domain is not the place for one
 * person's ids. This file is that place, the same arrangement
 * `things-area-map.seed.json` uses: the proposal is committed to the repo, the
 * live artefact lands in the vault, and the vault is edited by hand.
 *
 * It writes nothing. `$KAIROS_HOME/keel/rules/` is private tier, so this prints
 * and stops; installing is a deliberate act, which is the same thing the rules
 * it emits say about their own exit.
 *
 * Usage:
 *   node scripts/host-block-seed.mts --cycle <cycleId>
 *   node scripts/host-block-seed.mts --cycle <id> --profile <resolver-profile>
 *   node scripts/host-block-seed.mts --cycle <id> --host lichess.org --host chess.com
 *
 * To install, one file per rule:
 *   node scripts/host-block-seed.mts --cycle <id> \
 *     | jq -c '.[]' \
 *     | while read -r r; do
 *         printf '%s' "$r" | jq . > "$KAIROS_HOME/keel/rules/$(printf '%s' "$r" | jq -r .id).json"
 *       done
 *
 * What installing does *not* do: it does not block anything. These rules declare
 * `enforcement.at: "resolver"`, and keel's browser blocklist deliberately skips
 * resolver-enforced cooldowns (`apps/agent/store.mjs`, `loadBlockDomains`)
 * because the DNS profile carries them, not the extension. The file is the
 * declaration; the wall is the resolver, and pointing the resolver at these
 * hosts is a hand edit outside this repo.
 */

import { validateDelivery } from "../src/domain/intervention/Delivery.ts";
import { validateRuleSpec } from "../src/domain/intervention/RuleSpec.ts";
import { hostBlockSeedRules } from "../src/domain/intervention/rules/hostBlock.ts";

/**
 * The plots attention should return to when a wall is met.
 *
 * Not "anywhere but here". The whole proximal claim of a host block is that the
 * ten minutes after the refusal land somewhere planted, and these are the three
 * that are actually planted on a working day.
 */
const THEMIA = "20ef74ee-293d-4440-9c96-b115cd9a3b5c"; // ⚖️ Themia (work)
const EQUANIMI_TECH = "08bad0bd-fd50-46a1-b0ef-bd4f8077190a"; // ≃ equanimi.tech (craft)
const MINDFULNESS = "604bdd2d-06eb-4f1f-81f2-aeb4a28caf94"; // 🧘 Mindfulness

const RETURNS_TO = [THEMIA, EQUANIMI_TECH, MINDFULNESS] as const;

/**
 * `serves` takes one area, and it is Mindfulness rather than either of the two
 * the block is meant to protect. Curbing a reach is what Mindfulness cultivates;
 * Themia and equanimi.tech are what the curbed time is *for*, which is the
 * proximal claim above and already said there.
 */
const SERVES_AREA = MINDFULNESS;

/** The resolver profile is not settled in this repo; the notes carry NextDNS
 * and AdGuard-over-Tailscale as live alternatives. Overridable, and the default
 * is a name rather than a claim. */
const DEFAULT_PROFILE = "kairos";

const DEFAULT_UNLOCK =
  "edit the resolver profile and wait for propagation; not doable from the browser you are in";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function args(flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) {
      out.push(process.argv[i + 1]);
    }
  }
  return out;
}

function main(): void {
  const cycleId = arg("--cycle");
  if (!cycleId) {
    console.error(
      "--cycle <cycleId> is required: a rule points at the season's intention you already wrote,\n" +
        "and inventing a placeholder would leave an outcome nothing can ever settle against.",
    );
    process.exit(2);
  }

  const hosts = args("--host");
  const rules = hostBlockSeedRules({
    serves: { cycleId, areaId: SERVES_AREA },
    returnsTo: [...RETURNS_TO],
    resolverProfile: arg("--profile") ?? DEFAULT_PROFILE,
    unlockNote: arg("--unlock") ?? DEFAULT_UNLOCK,
    ...(hosts.length > 0 ? { hosts } : {}),
  });

  const problems: string[] = [];
  for (const rule of rules) {
    for (const p of validateRuleSpec(rule)) problems.push(`${rule.id}: ${p}`);
    // Invariant 6 binds at the foundational layer, so it is checked on what
    // would actually be delivered rather than on the rule that wraps it.
    for (const p of validateDelivery({
      origin: "self",
      primitives: rule.primitives,
    })) {
      problems.push(`${rule.id}: ${p}`);
    }
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }

  // Emitted as a superset document. `scope.matches` is what the garden's model
  // reads; `domains` and `defaultEnabled` are what every keel loader reads
  // (`resolveRuleDomains`, `apps/agent/store.mjs`). A rule authored without
  // `domains` resolves to the empty domain set and covers nothing while still
  // reading as enabled, the failure the 2026-08-19 pain doc caught in
  // `primitive-contracts.md`. One file, both readers.
  const documents = rules.map((rule) => ({
    ...rule,
    domains: [rule.scope.surface === "browser" ? rule.scope.domain : ""],
    defaultEnabled: true,
  }));

  console.log(JSON.stringify(documents, null, 2));
}

main();
