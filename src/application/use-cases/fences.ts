import type { AreaId, RuleId } from "../../domain/attention/ids";
import {
  carriesExit,
  type Primitive,
} from "../../domain/intervention/Primitive.ts";
import {
  type RuleSpec,
  validateRuleSpec,
} from "../../domain/intervention/RuleSpec.ts";
import { browserDwellGateRule } from "../../domain/intervention/rules/browserGate.ts";
import type {
  BrowserTransformInput,
  TransformReplacement,
} from "../../domain/intervention/rules/browserTransform.ts";
import { browserTransformRule } from "../../domain/intervention/rules/browserTransform.ts";
import {
  hostBlockRule,
  hostBlockSeedRules,
} from "../../domain/intervention/rules/hostBlock.ts";
import {
  rungFor,
  sessionFenceRule,
} from "../../domain/intervention/rules/sessionFence.ts";
import {
  wateringHoursRules,
  type WateringHoursMode,
  type WateringHoursWindow,
} from "../../domain/intervention/rules/wateringHours.ts";
import type { Phase } from "../../domain/value-objects/Phase.ts";
import type { Weekday } from "../../domain/value-objects/Schedule.ts";
import type {
  AreaRef,
  CrossingRecord,
  FenceDeps,
  PhaseConfigRef,
} from "../ports";

/**
 * Declaring, taking down, and reading back fences — the conversational writer
 * the `fences` collection was opened for.
 *
 * The 2026-08-20 decision (`kairos/docs/decisions/2026-08-20-open-fences-to-
 * declared-rules-before-step-5.md`) permits **declared** rules here and forbids
 * derived ones, and this module is built so the distinction is structural
 * rather than reviewed: every fence is constructed from the caller's arguments
 * by `sessionFenceRule`, and nothing in this file — or below it — reads
 * `discrepancy.json`. There is no code path from a derivation to a write.
 *
 * Construction and validation stay in the domain (`sessionFenceRule`,
 * `validateRuleSpec`); what lives here is orchestration: resolving the names
 * the principal speaks in ("Themia") to the ids the rule needs, pointing
 * `serves` at the running season, and refusing a declaration the domain would
 * turn into a rule that cannot work. The MCP tool handler above this is a
 * thin adapter and adds nothing.
 */

export interface FenceDeclaration {
  /** What the principal called the stream. Shown back at every rung. */
  readonly label: string;
  /** Absolute path prefixes inside the fence. Everything else is outside. */
  readonly paths: readonly string[];
  /** The areas the fence encloses — ids, or the names the principal uses. */
  readonly areas: readonly string[];
  readonly description?: string;
}

export type DeclareFenceResult =
  | { readonly declared: RuleSpec; readonly standing: number }
  | { readonly problems: readonly string[] };

export type ClearFencesTarget =
  | { readonly id: RuleId }
  | { readonly all: true }
  | { readonly policy: string };

export type ClearFencesResult =
  | { readonly cleared: readonly RuleSpec[] }
  | { readonly problems: readonly string[] };

/** One fence's current standing: the rule itself, how often it has been
 * crossed, and the rung the *next* crossing would land on — read off the
 * rule's own ladder via `rungFor`, so this report and the hook that enforces
 * the fence can never disagree about what happens next. */
export interface FenceStanding {
  readonly fence: RuleSpec;
  readonly crossings: number;
  /** Epoch ms of the last crossing, or null if never crossed. */
  readonly lastCrossedAt: number | null;
  readonly nextRung: Primitive | undefined;
}

/**
 * Resolve what the principal said to an area id. Ids pass through; names match
 * case-insensitively against active areas. Failures return prose rather than
 * throwing because the caller is composing a declaration and needs to see
 * every problem at once, in `validateRuleSpec`'s all-problems style.
 */
function resolveArea(
  areas: readonly AreaRef[],
  idOrName: string,
): { readonly id: AreaId } | { readonly problem: string } {
  const byId = areas.find((a) => a.id === idOrName);
  if (byId) return { id: byId.id };

  const needle = idOrName.trim().toLowerCase();
  const byName = areas.filter((a) => a.name.trim().toLowerCase() === needle);
  if (byName.length === 1) return { id: byName[0].id };
  if (byName.length > 1) {
    return {
      problem: `area "${idOrName}" is ambiguous — pass an id: ${byName.map((a) => a.id).join(", ")}`,
    };
  }
  const names = areas.map((a) => a.name).join(", ");
  return {
    problem: `unknown area "${idOrName}" — active areas: ${names || "(none)"}`,
  };
}

/** Declaration-shape problems the domain validator cannot see, because they
 * are about what the caller supplied rather than about the rule's structure.
 * A relative path deserves its own line: the enforcing hook prefix-matches
 * against absolute tool paths, so a relative prefix would never match anything
 * and the fence would silently enclose nothing. */
function declarationProblems(input: FenceDeclaration): string[] {
  const problems: string[] = [];
  if (input.label.trim().length === 0) {
    problems.push("label must name the stream the fence encloses");
  }
  if (input.paths.length === 0) {
    problems.push("a fence must enclose at least one path");
  }
  for (const p of input.paths) {
    if (!p.startsWith("/")) {
      problems.push(
        `path "${p}" is not absolute — the fence reader matches absolute path prefixes`,
      );
    }
  }
  if (input.areas.length === 0) {
    problems.push("a fence must enclose at least one area");
  }
  return problems;
}

/**
 * Declare a fence: build the rule from the caller's words, validate it, and
 * only then write. The write is inside this function rather than left to the
 * adapter so that "validated before written" is enforced in one place — an
 * adapter that forgot the check could otherwise put an unenforceable rule in
 * front of every session's hook.
 */
export async function declareFence(
  deps: FenceDeps,
  input: FenceDeclaration,
): Promise<DeclareFenceResult> {
  const problems = declarationProblems(input);

  const areas = await deps.garden.areas();
  const enclosed: AreaId[] = [];
  for (const ref of input.areas) {
    const resolved = resolveArea(areas, ref);
    if ("problem" in resolved) problems.push(resolved.problem);
    else enclosed.push(resolved.id);
  }

  // `serves` points at the season's intention already declared in cycle
  // planning — a pointer, not a second declaration — so a fence needs a
  // running season to point at. Refusing here is more honest than inventing
  // a placeholder the outcome loop would later try to settle against.
  const cycleId = await deps.garden.activeCycleId();
  if (cycleId === null) {
    problems.push(
      "no season is running — a fence serves the season's intention, so open a cycle first",
    );
  }

  if (problems.length > 0 || cycleId === null || enclosed.length === 0) {
    return { problems };
  }

  const label = input.label.trim();
  const fence = sessionFenceRule({
    id: deps.newRuleId(),
    label,
    description:
      input.description?.trim() ||
      `Only "${label}" — declared in conversation, in force until taken down.`,
    serves: { cycleId, areaId: enclosed[0] },
    paths: input.paths,
    encloses: enclosed,
  });

  const structural = validateRuleSpec(fence);
  if (structural.length > 0) return { problems: structural };

  const all = await deps.store.read();
  await deps.store.write({ ...all, [fence.id]: fence });
  return { declared: fence, standing: Object.keys(all).length + 1 };
}

// ── Watering hours ────────────────────────────────────────────────────
//
// A standing temporal attention policy: which plots get watered when, with
// friction for watering the wrong plot at the wrong time. One declaration
// generates per-surface rules with derived ids; re-declaring replaces.

export interface WateringHoursDeclaration {
  readonly name: string;
  readonly mode: WateringHoursMode;
  readonly window: {
    readonly phases?: readonly Phase[];
    readonly weekdays?: readonly Weekday[];
    readonly fromHour?: number;
    readonly toHour?: number;
  };
  readonly waters: readonly string[];
  readonly restricts: {
    readonly areas?: readonly string[];
    readonly paths?: readonly string[];
    readonly hosts?: readonly string[];
    readonly tools?: readonly string[];
  };
  readonly prompt?: string;
  readonly unlockNote?: string;
}

export type DeclareWateringHoursResult =
  | { readonly declared: readonly RuleSpec[]; readonly standing: number }
  | { readonly problems: readonly string[] };

export async function declareWateringHours(
  deps: FenceDeps,
  input: WateringHoursDeclaration,
): Promise<DeclareWateringHoursResult> {
  const problems: string[] = [];

  if (input.name.trim().length === 0) {
    problems.push("name must identify this watering policy");
  }

  if (
    input.mode === "dry" &&
    (!input.unlockNote || input.unlockNote.trim() === "")
  ) {
    problems.push(
      "dry mode requires unlockNote — a block that names no way out is refused (invariant 6)",
    );
  }

  const areas = await deps.garden.areas();

  const returnsTo: AreaId[] = [];
  for (const ref of input.waters) {
    const resolved = resolveArea(areas, ref);
    if ("problem" in resolved) problems.push(resolved.problem);
    else returnsTo.push(resolved.id);
  }

  const restrictedAreaIds: AreaId[] = [];
  for (const ref of input.restricts.areas ?? []) {
    const resolved = resolveArea(areas, ref);
    if ("problem" in resolved) problems.push(resolved.problem);
    else restrictedAreaIds.push(resolved.id);
  }

  const cycleId = await deps.garden.activeCycleId();
  if (cycleId === null) {
    problems.push(
      "no season is running — watering hours serve the season's intention, so open a cycle first",
    );
  }

  let window: WateringHoursWindow;
  if (input.window.phases && input.window.phases.length > 0) {
    const phaseConfigs: readonly PhaseConfigRef[] =
      await deps.garden.phaseConfigs();
    const phase = input.window.phases[0];
    const config = phaseConfigs.find((c) => c.phase === phase);
    if (!config) {
      problems.push(`phase "${phase}" not found in phase configs`);
      window = { fromHour: 0, toHour: 24 };
    } else {
      window = {
        fromHour: config.startHour,
        toHour: config.endHour,
        cutFrom: phase,
        ...(input.window.weekdays ? { weekdays: input.window.weekdays } : {}),
      };
    }
  } else if (
    input.window.fromHour !== undefined &&
    input.window.toHour !== undefined
  ) {
    window = {
      fromHour: input.window.fromHour,
      toHour: input.window.toHour,
      ...(input.window.weekdays ? { weekdays: input.window.weekdays } : {}),
    };
  } else {
    problems.push("window must specify either phases or fromHour/toHour");
    window = { fromHour: 0, toHour: 24 };
  }

  if (problems.length > 0 || cycleId === null || returnsTo.length === 0) {
    return { problems };
  }

  const rules = wateringHoursRules({
    policyName: input.name.trim(),
    mode: input.mode,
    window,
    serves: { cycleId, areaId: returnsTo[0] },
    returnsTo,
    restricts: {
      ...(restrictedAreaIds.length > 0 ? { areas: restrictedAreaIds } : {}),
      ...(input.restricts.paths ? { paths: [...input.restricts.paths] } : {}),
      ...(input.restricts.hosts ? { hosts: [...input.restricts.hosts] } : {}),
      ...(input.restricts.tools ? { tools: [...input.restricts.tools] } : {}),
    },
    prompt: input.prompt,
    unlockNote: input.unlockNote,
  });

  for (const rule of rules) {
    const bad = [...validateRuleSpec(rule), ...exitProblems(rule)];
    if (bad.length > 0) problems.push(...bad);
  }
  if (problems.length > 0) return { problems };

  const all = await deps.store.read();
  const prefix = `watering:${input.name.trim()}:`;
  const next: Record<string, RuleSpec> = {};
  for (const [id, rule] of Object.entries(all)) {
    if (!id.startsWith(prefix)) next[id] = rule;
  }
  for (const rule of rules) next[rule.id] = rule;
  await deps.store.write(next);
  return { declared: rules, standing: Object.keys(next).length };
}

// ── Browser-scoped fences ──────────────────────────────────────────────
//
// Migration step 5 is "flip the readers", and it could not be flipped without
// this. Slice E of the extension work said so in its own report: `loadArmed()`
// read `fences.json` *and* `~/.zenborg/keel/rules/*.json`, merged, because
// zenborg's only fence writer was `sessionFenceRule` and a session-scoped rule
// reaches no browser. A fences-only read would have shipped an inert feature.
//
// So the writer comes first and the reader collapses after it. Everything below
// builds `scope.surface: "browser"` rules, which is the scope the host's fence
// projection keeps and every other scope it drops.
//
// The 2026-08-20 guard still holds and is still structural: every rule here is
// built from the caller's arguments, and nothing in this file reads
// `discrepancy.json`. A host block and a dwell gate are declarations, not
// derivations.

/** A registrable host: no scheme, no path, no port, no wildcard. What the
 * fence record carries is domains, and the privacy posture stops URLs at this
 * boundary — so a caller who pasted a URL is told, not silently trimmed. */
const HOST_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function hostProblems(host: string): string[] {
  const trimmed = host.trim().toLowerCase();
  if (trimmed === "") return ["a host block must name a host"];
  if (!HOST_PATTERN.test(trimmed)) {
    return [
      `"${host}" is not a registrable host — pass "example.com", not a URL, a path or a wildcard`,
    ];
  }
  return [];
}

/**
 * Whether a primitive is the kind invariant 6 is about at all.
 *
 * `gate` and `cooldown` are the two primitives that can trap someone in a
 * workflow requiring a click-through or an out-of-band wait — that is what an
 * exit is for. `transform` was added to this file without one: `carriesExit`
 * already says `false` for it (`Primitive.test.ts`, "renders without offering
 * a way out"), and that is a true statement about a CSS conceal, not a
 * violation. Nothing about hiding an element withholds reachability — the
 * concealed content is still one direct navigation away — so there is no exit
 * to check for. `schedule` reads through to whatever it wraps, same as
 * `carriesExit` does, because a scheduled gate is still a gate and a scheduled
 * transform is still a transform.
 */
function requiresExit(primitive: Primitive): boolean {
  if (primitive.kind === "schedule") return requiresExit(primitive.wraps);
  return primitive.kind === "gate" || primitive.kind === "cooldown";
}

/**
 * Invariant 6, enforced at the writer's door.
 *
 * The type system already carries most of it: `gate` requires a
 * `proceedAffordance` and `cooldown` requires an `unlockPath`, so the two
 * primitives a fence is built from cannot be constructed without an exit. What
 * this adds is the case the types cannot see — a rule assembled from some other
 * primitive, or one whose exit is present but empty. A fence with no way out is
 * refused here rather than set and refused later by the extension, because the
 * cheapest place to hold the line is the one place the record is written.
 *
 * Scoped by `requiresExit`, not applied to every primitive: a primitive that
 * was never going to trap anyone has nothing here to be refused for.
 */
function exitProblems(rule: RuleSpec): string[] {
  const problems: string[] = [];
  for (const primitive of rule.primitives) {
    if (!requiresExit(primitive)) continue;
    if (!carriesExit(primitive)) {
      problems.push(
        `primitive "${primitive.kind}" carries no proceed affordance — a fence with no exit is refused, not set (invariant 6)`,
      );
      continue;
    }
    // A schedule wraps a gate or a cooldown; the checks below are about the
    // wrapped primitive's exit, not about `schedule` itself.
    const inner = primitive.kind === "schedule" ? primitive.wraps : primitive;
    if (inner.kind === "cooldown") {
      const unlock = inner.unlockPath;
      if (unlock.type === "out_of_band" && unlock.note.trim() === "") {
        problems.push(
          "the lift is stated nowhere — an out-of-band exit whose note is empty is unreachable, which is no exit at all",
        );
      }
      if (
        unlock.type === "unlock_with_intention" &&
        unlock.prompt.trim() === ""
      ) {
        problems.push("the unlock asks nothing, so there is nothing to answer");
      }
    }
    if (inner.kind === "gate" && inner.proceedAffordance.label.trim() === "") {
      problems.push(
        "the gate's exit has no label, so there is nothing to press",
      );
    }
  }
  return problems;
}

/** Resolve the areas a browser rule returns attention to, and the season it
 * serves. Shared by both browser writers, because both make the same proximal
 * claim: the point is not the interruption, it is where the next ten minutes go. */
async function resolveReturn(
  deps: FenceDeps,
  returnsTo: readonly string[],
): Promise<
  | { readonly areaIds: AreaId[]; readonly cycleId: string }
  | { readonly problems: string[] }
> {
  const problems: string[] = [];
  const areas = await deps.garden.areas();
  const areaIds: AreaId[] = [];

  if (returnsTo.length === 0) {
    problems.push(
      "name at least one area attention should return to — a rule that cannot say where the next ten minutes go can never be settled",
    );
  }
  for (const ref of returnsTo) {
    const resolved = resolveArea(areas, ref);
    if ("problem" in resolved) problems.push(resolved.problem);
    else areaIds.push(resolved.id);
  }

  const cycleId = await deps.garden.activeCycleId();
  if (cycleId === null) {
    problems.push(
      "no season is running — a fence serves the season's intention, so open a cycle first",
    );
  }

  if (problems.length > 0 || cycleId === null || areaIds.length === 0) {
    return { problems };
  }
  return { areaIds, cycleId };
}

/** Validate, then write. One place, so no caller can skip the check. */
async function writeFence(
  deps: FenceDeps,
  rule: RuleSpec,
): Promise<DeclareFenceResult> {
  const problems = [...validateRuleSpec(rule), ...exitProblems(rule)];
  if (problems.length > 0) return { problems };

  const all = await deps.store.read();
  await deps.store.write({ ...all, [rule.id]: rule });
  return { declared: rule, standing: Object.keys(all).length + 1 };
}

export interface HostBlockDeclaration {
  /** A registrable host, without scheme or path. */
  readonly host: string;
  /** Areas attention should land in when the wall is met — ids or names. */
  readonly returnsTo: readonly string[];
  /** How the block is lifted, deliberately outside the running system. */
  readonly unlockNote: string;
  readonly name?: string;
  readonly description?: string;
  /**
   * The resolver profile carrying the block, when the block is a resolver one.
   * Absent means the browser enforces it, which is the surface this app reaches.
   */
  readonly resolverProfile?: string;
}

/**
 * Declare a standing host block, browser-enforced unless a resolver profile is
 * named.
 *
 * This is the writer `hostBlockSeedRules` has been waiting for. The seed
 * blocklist has been the oldest working piece of the system and has lived in
 * keel's own rules directory, invisible to the kernel; now it is a record in the
 * collection the contract registers, written by the one instrument allowed to
 * write it.
 */
export async function declareHostBlock(
  deps: FenceDeps,
  input: HostBlockDeclaration,
): Promise<DeclareFenceResult> {
  const problems = hostProblems(input.host);
  if (input.unlockNote.trim() === "") {
    problems.push(
      "say how the block is lifted — teeth that name no way out are a punishment, and invariant 6 forbids arming one",
    );
  }

  const resolved = await resolveReturn(deps, input.returnsTo);
  if ("problems" in resolved) problems.push(...resolved.problems);
  if (problems.length > 0 || "problems" in resolved) return { problems };

  const host = input.host.trim().toLowerCase();
  return writeFence(
    deps,
    hostBlockRule({
      id: deps.newRuleId(),
      host,
      name: input.name?.trim() || host,
      description:
        input.description?.trim() ||
        `A standing block on ${host} — declared in conversation, lifted out of band.`,
      serves: { cycleId: resolved.cycleId, areaId: resolved.areaIds[0] },
      returnsTo: resolved.areaIds,
      unlockNote: input.unlockNote.trim(),
      ...(input.resolverProfile === undefined
        ? { enforcement: { at: "browser" as const } }
        : { resolverProfile: input.resolverProfile }),
    }),
  );
}

export interface BrowserGateDeclaration {
  readonly host: string;
  readonly returnsTo: readonly string[];
  /** Accumulated attended dwell between firings. */
  readonly everyMinutes: number;
  /** What the gate asks. */
  readonly prompt: string;
  readonly name?: string;
  readonly description?: string;
}

/**
 * Declare a browser dwell gate — friction on the duration rather than on the
 * visit.
 *
 * The case for it is written up as a pain in keel (`b59b01f`): a standing block
 * on a host with a real use gets lifted, and a block lifted in the moment is not
 * a boundary. What actually goes wrong is that a visit becomes a session, so the
 * gate charges for the session.
 */
export async function declareBrowserGate(
  deps: FenceDeps,
  input: BrowserGateDeclaration,
): Promise<DeclareFenceResult> {
  const problems = hostProblems(input.host);
  if (input.prompt.trim() === "") {
    problems.push(
      "say what the gate asks — the question is the friction, and a gate with nothing to answer is a click",
    );
  }

  const resolved = await resolveReturn(deps, input.returnsTo);
  if ("problems" in resolved) problems.push(...resolved.problems);
  if (problems.length > 0 || "problems" in resolved) return { problems };

  const host = input.host.trim().toLowerCase();
  return writeFence(
    deps,
    browserDwellGateRule({
      id: deps.newRuleId(),
      host,
      name: input.name?.trim() || host,
      description:
        input.description?.trim() ||
        `A recurring stopping cue on ${host}, every ${input.everyMinutes} attended minutes.`,
      serves: { cycleId: resolved.cycleId, areaId: resolved.areaIds[0] },
      returnsTo: resolved.areaIds,
      everyMinutes: input.everyMinutes,
      prompt: input.prompt.trim(),
    }),
  );
}

export interface BrowserTransformDeclaration {
  readonly host: string;
  readonly selectors: {
    readonly primary: string;
    readonly fallbacks?: readonly string[];
  };
  /** Defaults to a plain hide. */
  readonly replacement?: TransformReplacement;
  readonly returnsTo: readonly string[];
  readonly name?: string;
  readonly description?: string;
}

function selectorProblems(selectors: { readonly primary: string }): string[] {
  return selectors.primary.trim() === ""
    ? ["a transform must name a primary selector"]
    : [];
}

/**
 * Declare a browser-scoped DOM transform: hide, restyle or replace a region
 * rather than gate or block it.
 *
 * Completes the fence trilogy `set_host_block` / `set_browser_gate` started —
 * `declareHostBlock` answers "should I be able to reach this at all",
 * `declareBrowserGate` answers "have I been here longer than I meant to be",
 * and this answers "does this cue need to be visible at all". Same
 * validate-before-write discipline (`writeFence`), same browser scope, same
 * collection — a rule with no exit to check for, because `requiresExit`
 * (above) does not ask a `transform` primitive for one.
 */
export async function declareBrowserTransform(
  deps: FenceDeps,
  input: BrowserTransformDeclaration,
): Promise<DeclareFenceResult> {
  const problems = [
    ...hostProblems(input.host),
    ...selectorProblems(input.selectors),
  ];

  const resolved = await resolveReturn(deps, input.returnsTo);
  if ("problems" in resolved) problems.push(...resolved.problems);
  if (problems.length > 0 || "problems" in resolved) return { problems };

  const host = input.host.trim().toLowerCase();
  const primary = input.selectors.primary.trim();
  return writeFence(
    deps,
    browserTransformRule({
      id: deps.newRuleId(),
      host,
      name: input.name?.trim() || host,
      description:
        input.description?.trim() ||
        `Conceals ${primary} on ${host} — declared in conversation, in force until taken down.`,
      serves: { cycleId: resolved.cycleId, areaId: resolved.areaIds[0] },
      returnsTo: resolved.areaIds,
      targets: {
        primary,
        fallbacks: input.selectors.fallbacks,
      },
      replacement: input.replacement,
    } satisfies BrowserTransformInput),
  );
}

export interface HostBlockSeedDeclaration {
  readonly returnsTo: readonly string[];
  readonly unlockNote: string;
  /**
   * The hosts to wall. Required, and with no default behind it: the domain
   * carries no list, so a seed with nothing in it walls nothing.
   */
  readonly hosts: readonly string[];
  readonly resolverProfile?: string;
}

export type SeedHostBlocksResult =
  | { readonly declared: readonly RuleSpec[]; readonly standing: number }
  | { readonly problems: readonly string[] };

/**
 * Write the seed blocklist into `fences`, as rules that say what they are for.
 *
 * Idempotent by construction: `hostBlockSeedRules` derives each id from the host
 * and the enforcement point, so a second run replaces the first rather than
 * standing a second fence on the same host. Anything the seeder did not write is
 * left exactly as it was — this is a migration of one list, not a reset of the
 * collection.
 *
 * One write, not one per host: the store's contract is read-modify-write over
 * the whole record set, and three sequential writes would leave a reader able to
 * catch the collection with one host fenced and two not.
 */
export async function seedHostBlocks(
  deps: FenceDeps,
  input: HostBlockSeedDeclaration,
): Promise<SeedHostBlocksResult> {
  const problems: string[] = [];
  if (input.unlockNote.trim() === "") {
    problems.push(
      "say how the block is lifted — teeth that name no way out are a punishment, and invariant 6 forbids arming one",
    );
  }
  for (const host of input.hosts) problems.push(...hostProblems(host));

  const resolved = await resolveReturn(deps, input.returnsTo);
  if ("problems" in resolved) problems.push(...resolved.problems);
  if (problems.length > 0 || "problems" in resolved) return { problems };

  const seeded = hostBlockSeedRules({
    serves: { cycleId: resolved.cycleId, areaId: resolved.areaIds[0] },
    returnsTo: resolved.areaIds,
    unlockNote: input.unlockNote.trim(),
    hosts: input.hosts,
    ...(input.resolverProfile === undefined
      ? {}
      : {
          enforcement: {
            at: "resolver" as const,
            profile: input.resolverProfile,
          },
        }),
  });

  for (const rule of seeded) {
    const bad = [...validateRuleSpec(rule), ...exitProblems(rule)];
    if (bad.length > 0) problems.push(...bad);
  }
  if (problems.length > 0) return { problems };

  const all = await deps.store.read();
  const next = { ...all };
  for (const rule of seeded) next[rule.id] = rule;
  await deps.store.write(next);
  return { declared: seeded, standing: Object.keys(next).length };
}

/**
 * Take a fence down — one by id, or all of them.
 *
 * The crossing tally is deliberately not touched: it is plugin-owned state,
 * and the reset the domain promises ("the count resets when the fence comes
 * down") is achieved by identity — rule ids are never reused, so a cleared
 * fence's tally entry can never gate anything again.
 */
export async function clearFences(
  deps: FenceDeps,
  target: ClearFencesTarget,
): Promise<ClearFencesResult> {
  const all = await deps.store.read();

  if ("all" in target) {
    const cleared = Object.values(all);
    if (cleared.length > 0) await deps.store.write({});
    return { cleared };
  }

  if ("policy" in target) {
    const prefix = `watering:${target.policy}:`;
    const cleared: RuleSpec[] = [];
    const rest: Record<string, RuleSpec> = {};
    for (const [id, rule] of Object.entries(all)) {
      if (id.startsWith(prefix)) cleared.push(rule);
      else rest[id] = rule;
    }
    if (cleared.length === 0) {
      return { problems: [`no watering hours with policy "${target.policy}"`] };
    }
    await deps.store.write(rest);
    return { cleared };
  }

  const fence = all[target.id];
  if (!fence) {
    const standing = Object.keys(all).join(", ");
    return {
      problems: [
        `no fence with id "${target.id}" — standing: ${standing || "(none)"}`,
      ],
    };
  }
  const { [target.id]: _, ...rest } = all;
  await deps.store.write(rest);
  return { cleared: [fence] };
}

/** Read back what is currently fenced, with each fence's crossing tally when
 * the plugin has recorded one. A fence the tally has never seen reads as zero
 * crossings — absence of state is the fresh state, same as the hook. */
export async function fenceReport(
  deps: FenceDeps,
): Promise<{ readonly fences: readonly FenceStanding[] }> {
  const [all, tally] = await Promise.all([
    deps.store.read(),
    deps.tally.read(),
  ]);

  const fences = Object.values(all).map((fence): FenceStanding => {
    const record: CrossingRecord | undefined = tally[fence.id];
    const crossings = record?.crossings ?? 0;
    return {
      fence,
      crossings,
      lastCrossedAt: record?.at ?? null,
      nextRung: rungFor(fence, crossings),
    };
  });

  return { fences };
}
