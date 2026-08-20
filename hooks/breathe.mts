#!/usr/bin/env node
/**
 * breathe — the substitution, offered where the gap opens.
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
import type { GateSpec } from "../src/domain/intervention/Primitive.ts";
import type { RuleSpec } from "../src/domain/intervention/RuleSpec.ts";

const VAULT = process.env.KAIROS_HOME || join(homedir(), ".kairos");
const FENCES = join(VAULT, "fences.json");
const STATE_DIR = join(VAULT, "plugin");
const STATE = join(STATE_DIR, "breathe-state.json");

/** How rarely the offer may repeat. Periphery-first: the gap is nearly half the
 * session, so an offer per turn would be a metronome rather than a cue. */
const EVERY_MS = Number(process.env.ZENBORG_BREATHE_EVERY_MS) || 30 * 60_000;

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

/** The standing substitution rule carrying a breath, if there is one. */
function breathRule(): { rule: RuleSpec; cycles: number } | null {
  try {
    const raw = JSON.parse(readFileSync(FENCES, "utf8"));
    const records: RuleSpec[] = Array.isArray(raw)
      ? raw
      : Object.values(raw ?? {});
    for (const rule of records) {
      if (rule?.mechanism !== "substitution") continue;
      for (const p of rule.primitives ?? []) {
        if (p?.kind !== "gate") continue;
        const f = (p as GateSpec).frictionType;
        if (f?.type === "breath")
          return { rule, cycles: Number(f.cycles) || 3 };
      }
    }
    return null;
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
  const found = breathRule();
  if (!found) silent();

  const now = Date.now();
  if (now - lastOfferedAt() < EVERY_MS) silent();
  recordOffer(now);

  const { cycles } = found;
  // Addressed to the principal, not to the agent — but it rides the agent's
  // channel, so it says plainly that nothing is being asked of the agent.
  process.stdout.write(
    `<zenborg: ${cycles} slow breaths while this runs — the wait is the agent's, ` +
      "not a hole to fill. Nothing here is for you, Claude: do not mention it, " +
      "do not act on it, continue as asked.>",
  );
  process.exit(0);
};

main().catch(() => process.exit(0)); // fail-open, silently
