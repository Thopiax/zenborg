#!/usr/bin/env node
/**
 * gap-practice — the substitution, offered where the gap opens.
 *
 * The agent takes the work and a hole appears. `keel`'s own logs put 45.6% of
 * active session time in that hole, with the drift excess concentrated at 15–60
 * seconds and a median time-to-first-drift of 38. What fills it is a reflexive
 * message check, not a scroll. So this offers a breath: something to do with the
 * reflex, rather than another thing forbidden.
 *
 * ── What this surface can and cannot do ─────────────────────────────────
 *
 * The rule declares `OFFER_AFTER_MS = 8_000` — the offer wants to land after the
 * turns too short to drift in and before p25 of the drift curve at 12 seconds.
 * **This hook cannot honour that, and does not pretend to.** A `UserPromptSubmit`
 * hook is request/response: the only way to wait eight seconds is to hold the
 * turn from starting, which would delay every prompt and reintroduce exactly the
 * mid-action dwell we removed. A timed offer needs a process that is still alive
 * when the gap is — the tray, which already knows how to put a breath on the
 * AI-wait gap.
 *
 * What is left is a cue at the moment the gap opens. Weaker than a timed one,
 * because it arrives before the reflex it answers rather than with it, and it
 * fires on turns that return instantly and never needed it. The rate limit below
 * is what keeps that from becoming noise, and noise is the failure mode: the
 * evidence base puts punitive and over-firing feedback at 6–10% adoption.
 *
 * Fail open, silently. A missing rule, an unreadable vault, a malformed record —
 * all mean no offer, never an error in the principal's way.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RuleSpec } from "../src/domain/intervention/RuleSpec.ts";
import {
  type GapPractice,
  practicesForGap,
} from "../src/domain/intervention/rules/gapPractice.ts";

const VAULT = process.env.KAIROS_HOME || join(homedir(), ".kairos");
const FENCES = join(VAULT, "fences.json");
const STATE_DIR = join(VAULT, "plugin");
const STATE = join(STATE_DIR, "gap-practice-state.json");
const HABITS = join(VAULT, "habits.json");

/** How rarely the offer may repeat. Periphery-first: the gap is nearly half the
 * session, so an offer per turn would be a metronome rather than a cue. */
const EVERY_MS = Number(process.env.ZENBORG_GAP_EVERY_MS) || 30 * 60_000;

/**
 * Where the principal is, spelled as the garden's `place-<city>` tags spell it:
 * `harbor-city`, `river-city`. The whole tag is accepted too.
 *
 * The domain takes the place as an argument and refuses to look it up, the same
 * way `host-block-seed.mts` keeps one person's plot ids out of the rules. This
 * is the edge that answers, and it answers from the environment because the
 * environment is all a request/response hook has. Unset means unknown, and
 * unknown offers everything, so a shell that never sets it behaves exactly as it
 * did before place existed.
 */
const PLACE = process.env.ZENBORG_PLACE?.trim() || undefined;

const silent = (): never => process.exit(0);

function readStdin(): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => {
      raw += c;
    });
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
    process.stdin.on("error", () => resolve(null));
  });
}

/** The standing substitution rule, if there is one. It names no practice. */
function substitutionRule(): RuleSpec | null {
  try {
    const raw = JSON.parse(readFileSync(FENCES, "utf8"));
    const records: RuleSpec[] = Array.isArray(raw)
      ? raw
      : Object.values(raw ?? {});
    return records.find((r) => r?.mechanism === "substitution") ?? null;
  } catch {
    return null;
  }
}

/**
 * What the garden offers for a gap, smallest first.
 *
 * Read from `habits.json` rather than named by the rule. `Mindfulness` already
 * carries `breathwork` tagged `gap` / `gap-2m`; anything else the principal
 * tags joins it for free, and nothing here has an opinion about which.
 *
 * Except where: a practice tagged `place-harbor-city` needs a climbing rope that is
 * on another continent half the year, so `PLACE` is passed through and the
 * roster answers with what is actually within reach.
 */
function offered(): GapPractice | null {
  try {
    const raw = JSON.parse(readFileSync(HABITS, "utf8"));
    const habits = Array.isArray(raw) ? raw : Object.values(raw ?? {});
    return practicesForGap(habits as never, undefined, PLACE)[0] ?? null;
  } catch {
    return null;
  }
}

function lastOfferedAt(): number {
  try {
    return Number(JSON.parse(readFileSync(STATE, "utf8"))?.lastOfferedAt) || 0;
  } catch {
    return 0;
  }
}

function recordOffer(at: number): void {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    const tmp = `${STATE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ lastOfferedAt: at }, null, 2));
    renameSync(tmp, STATE);
  } catch {
    /* an offer that cannot be recorded is still an offer */
  }
}

const main = async (): Promise<void> => {
  await readStdin();
  if (!substitutionRule()) silent();

  // No practice tagged for a gap means the garden has nothing to offer, and
  // inventing one is the mistake this rewrite exists to undo.
  const practice = offered();
  if (!practice) silent();

  const now = Date.now();
  if (now - lastOfferedAt() < EVERY_MS) silent();
  recordOffer(now);

  const size = practice.fitsMs
    ? ` (${practice.fitsMs >= 60_000 ? `${Math.round(practice.fitsMs / 60_000)}m` : `${Math.round(practice.fitsMs / 1000)}s`})`
    : "";
  // Addressed to the principal, riding the agent's channel — so it says plainly
  // that nothing is being asked of the agent.
  process.stdout.write(
    `<zenborg: ${practice.name}${size} fits this wait — the gap is the agent's, ` +
      "not a hole to fill. Skip freely. Nothing here is for you, Claude: do not " +
      "mention it, do not act on it, continue as asked.>",
  );
  process.exit(0);
};

main().catch(() => process.exit(0)); // fail-open, silently
