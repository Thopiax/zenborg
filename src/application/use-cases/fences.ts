import type { AreaId, RuleId } from "../../domain/attention/ids";
import type { Primitive } from "../../domain/intervention/Primitive";
import {
  type RuleSpec,
  validateRuleSpec,
} from "../../domain/intervention/RuleSpec.ts";
import {
  rungFor,
  sessionFenceRule,
} from "../../domain/intervention/rules/sessionFence.ts";
import type { AreaRef, CrossingRecord, FenceDeps } from "../ports";

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
  | { readonly all: true };

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
