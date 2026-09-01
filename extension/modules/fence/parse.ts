/**
 * The parse boundary for a pushed `Fences` record.
 *
 * ── Why a cache and not a query ─────────────────────────────────────────
 *
 * The app decides what is armed; the extension decides when it fires. A
 * navigation cannot wait on a native-messaging round trip, and a shield that
 * depends on a live host is a shield that lifts whenever the host is asleep,
 * mid-update, or crashed. So the record is **pushed** and held locally, and
 * actuation reads nothing but local state.
 *
 * `docs/kernel/substrate.md` records why the push exists at all: the browser
 * extension has no filesystem access and never will, so it takes a pusher
 * rather than a loader. Pushing is a read with extra steps, not a second
 * writer — nothing here is authoritative, and nothing here is written back.
 *
 * ── Invariant 6 is enforced at the door ─────────────────────────────────
 *
 * `parseFences` refuses any entry that carries no reachable exit. Sovereignty
 * rests on the exit, not on who was allowed to arm the thing, so a block with
 * no visible way out is a bug rather than a stricter shield — and the cheapest
 * place to hold that line is the boundary the record crosses.
 *
 * Everything in this file is pure: no chrome APIs, no clock, no storage. The
 * chrome.storage mirror and the actuation wiring live elsewhere.
 */

import { normalizeDomain } from "../domains";
import type { DwellGate, GateFriction } from "../friction/gate/decide";
import type {
  Fence,
  FenceEnforcement,
  Fences,
  ParsedFences,
  ProceedAffordance,
  Refusal,
} from "./types";

const MAX_ID = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The exit, or null.
 *
 * Null is the invariant-6 refusal and it has three causes, all of them the
 * same failure from the person's side: nothing to read, nothing to press, or
 * an action this surface does not know how to offer.
 */
function readProceed(raw: unknown): ProceedAffordance | null {
  if (!isRecord(raw)) {
    return null;
  }
  const label = text(raw.label);
  if (label === "") {
    return null;
  }
  const action = isRecord(raw.action) ? raw.action : null;
  if (action === null) {
    return null;
  }
  switch (action.type) {
    case "continue":
      return { label, action: { type: "continue" } };
    case "abort":
      return { label, action: { type: "abort" } };
    case "wait":
      return { label, action: { type: "wait" } };
    case "redirect": {
      const to = text(action.to);
      // A redirect with no destination is a `continue` wearing another name.
      return to === "" ? null : { label, action: { type: "redirect", to } };
    }
    case "intention": {
      const prompt = text(action.prompt);
      return prompt === "" ? null : { label, action: { type: "intention", prompt } };
    }
    case "delay": {
      const seconds = Number(action.seconds);
      return Number.isFinite(seconds) && seconds >= 0
        ? { label, action: { type: "delay", seconds: Math.round(seconds) } }
        : null;
    }
    case "out_of_band": {
      const note = text(action.note);
      // The note IS the exit here — a lift with no stated path is unreachable.
      return note === "" ? null : { label, action: { type: "out_of_band", note } };
    }
    default:
      return null;
  }
}

function readFriction(raw: unknown): GateFriction | null {
  if (!isRecord(raw)) {
    return null;
  }
  switch (raw.type) {
    case "confirmation":
      return { type: "confirmation" };
    case "intention": {
      const prompt = text(raw.prompt);
      return prompt === "" ? null : { type: "intention", prompt };
    }
    case "delay": {
      const seconds = Number(raw.seconds);
      return Number.isFinite(seconds) ? { type: "delay", seconds: Math.round(seconds) } : null;
    }
    case "breath": {
      const cycles = Number(raw.cycles);
      return Number.isFinite(cycles) ? { type: "breath", cycles: Math.round(cycles) } : null;
    }
    default:
      return null;
  }
}

function readEnforcement(raw: unknown): FenceEnforcement | null {
  if (!isRecord(raw)) {
    return null;
  }
  if (raw.kind === "cooldown") {
    const at = raw.enforcement;
    const enforcement: "browser" | "resolver" | "device" =
      at === "resolver" || at === "device" ? at : "browser";
    return { kind: "block", enforcement, standing: raw.standing === true };
  }
  if (raw.kind === "gate") {
    const friction = readFriction(raw.friction);
    const everyMinutes = Number(raw.everyMinutes);
    if (friction === null || !Number.isFinite(everyMinutes) || everyMinutes <= 0) {
      return null;
    }
    return { kind: "gate", everyMinutes: Math.round(everyMinutes), friction };
  }
  return null;
}

function readDomains(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") {
      continue;
    }
    const host = normalizeDomain(entry);
    if (host !== null) {
      out.add(host);
    }
  }
  return [...out];
}

function readProbability(raw: unknown): number {
  const p = Number(raw);
  if (raw === undefined || raw === null || !Number.isFinite(p)) {
    return 1;
  }
  return Math.min(1, Math.max(0, p));
}

/**
 * Read a pushed fences record.
 *
 * Returns `null` when the push is not a record collection at all. That is the
 * difference that keeps the shields up: **malformed means keep what you have,
 * empty means lift.** An older host, a truncated frame or a garbled reply must
 * never read as "nothing is armed" — but an explicitly empty record is the
 * person taking a fence down, and it has to land.
 */
export function parseFences(raw: unknown): ParsedFences | null {
  if (!isRecord(raw)) {
    return null;
  }

  const fences: Record<string, Fence> = {};
  const refused: Refusal[] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) {
      continue;
    }
    const id = (text(value.id) || key).slice(0, MAX_ID);
    if (id === "") {
      continue;
    }

    const enforcement = readEnforcement(value.enforcement);
    if (enforcement === null) {
      refused.push({ id, reason: "unactuatable" });
      continue;
    }

    // Invariant 6 first among the content checks: a thing with no way out is
    // refused whatever else is right about it.
    const proceed = readProceed(value.proceed);
    if (proceed === null) {
      refused.push({ id, reason: "no_exit" });
      continue;
    }

    const domains = readDomains(value.domains);
    if (domains.length === 0) {
      refused.push({ id, reason: "no_domains" });
      continue;
    }

    const abortLabel = isRecord(value.abort) ? text(value.abort.label) : "";
    fences[id] = {
      id,
      label: text(value.label) || id,
      domains,
      enforcement,
      proceed,
      ...(abortLabel === "" ? {} : { abort: { label: abortLabel } }),
      deliveryProbability: readProbability(value.deliveryProbability),
    };
  }

  return { fences, refused };
}

/** Does `host` fall under `domain`? Exact match or a true subdomain, which is
 * what DNR's `requestDomains` already does — the two must not disagree. */
function covers(domain: string, host: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Everything armed on `host`. The hot-path read: pure, local, no round trip. */
export function fencesFor(fences: Fences, host: string): readonly Fence[] {
  const needle = normalizeDomain(host);
  if (needle === null) {
    return [];
  }
  const out: Fence[] = [];
  for (const entry of Object.values(fences)) {
    if (entry.domains.some((d) => covers(d, needle))) {
      out.push(entry);
    }
  }
  return out;
}

/**
 * Hosts under a standing block this surface enforces.
 *
 * Resolver- and device-enforced blocks are deliberately absent: they hold
 * somewhere the extension is not, and projecting them here would double-block
 * on this machine while reporting a firing that another surface actually made.
 */
export function standingBlockHosts(fences: Fences): readonly string[] {
  const out = new Set<string>();
  for (const entry of Object.values(fences)) {
    const e = entry.enforcement;
    if (e.kind !== "block" || !e.standing || e.enforcement !== "browser") {
      continue;
    }
    for (const domain of entry.domains) {
      out.add(domain);
    }
  }
  return [...out];
}

/**
 * Hosts a *timed* browser block may cover once armed.
 *
 * The candidate set, not the held set: a timed block is armed by a gesture —
 * the popup, the keyboard, the tray — and the arming state decides what actually
 * holds. This says which hosts a rule has made available to that gesture.
 */
export function armableHosts(fences: Fences): readonly string[] {
  const out = new Set<string>();
  for (const entry of Object.values(fences)) {
    const e = entry.enforcement;
    if (e.kind !== "block" || e.standing || e.enforcement !== "browser") {
      continue;
    }
    for (const domain of entry.domains) {
      out.add(domain);
    }
  }
  return [...out];
}

/**
 * A gate's exit, narrowed to the three actions an interstitial can offer.
 *
 * `wait`, `delay`, `intention` and `out_of_band` are block vocabulary — a
 * lockout's way out, not a gate's — so a gate carrying one degrades to
 * `continue` rather than being dropped. The label survives either way, which is
 * what the person actually reads.
 */
function gateAction(proceed: ProceedAffordance): DwellGate["proceed"]["action"] {
  const { action } = proceed;
  if (action.type === "redirect") {
    return { type: "redirect", to: action.to };
  }
  if (action.type === "abort") {
    return { type: "abort" };
  }
  return { type: "continue" };
}

/**
 * The armed gates, in the shape the dwell interpreter already speaks.
 *
 * Reusing `DwellGate` rather than inventing a parallel gate type is what keeps
 * one interstitial in the codebase: a fenced gate and a policy gate are the
 * same primitive arriving down two transports, and they must not diverge into
 * two overlays with two behaviours.
 */
export function gatesFrom(fences: Fences): readonly DwellGate[] {
  const out: DwellGate[] = [];
  for (const entry of Object.values(fences)) {
    if (entry.enforcement.kind !== "gate") {
      continue;
    }
    out.push({
      ruleId: entry.id,
      domains: entry.domains,
      everyMinutes: entry.enforcement.everyMinutes,
      friction: entry.enforcement.friction,
      proceed: { label: entry.proceed.label, action: gateAction(entry.proceed) },
      abort: entry.abort ?? { label: "Close the tab" },
    });
  }
  return out;
}

/**
 * The exit as one readable line.
 *
 * This is what makes invariant 6 visible rather than merely true. A standing
 * block replaces the page with the browser's own error page, where no
 * extension UI can run, so the way out has to be legible on a surface that is
 * always reachable — see the popup.
 */
export function exitLine(fence: Fence): string {
  const { label, action } = fence.proceed;
  switch (action.type) {
    case "out_of_band":
      return `${label} — ${action.note}`;
    case "intention":
      return `${label} — ${action.prompt}`;
    case "delay":
      return `${label} — after ${action.seconds}s`;
    case "redirect":
      return `${label} — goes to ${action.to}`;
    default:
      return label;
  }
}
