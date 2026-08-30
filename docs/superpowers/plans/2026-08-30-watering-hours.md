# Watering Hours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standing temporal attention policies ("watering hours") that enforce which plots get watered when, with friction for watering the wrong plot at the wrong time. Three modes: regular (gentle gate), dry (standing block), by-hand (tool-level friction).

**Architecture:** Watering hours are ordinary `RuleSpec` records in `fences.json`, built from the existing `ScheduleSpec` primitive (which has zero writers today — this activates it). One new MCP tool (`set_watering_hours`) takes a policy declaration and generates N per-surface `RuleSpec` records with derived ids. The hook (`plugin/hooks/fences.mts`) learns to evaluate schedule windows, match tool names, and handle inside-match polarity. Garden-surface advisories are injected into `add_moment` / `update_moment` responses following the existing `dayViewOverflow` pattern.

**Tech Stack:** TypeScript, Zod (mcp-server), Vitest

**Spec:** Watering Hours artifact (2026-08-30), session context from Fable architect

## Global Constraints

- **No vault shape change.** `fences.json` is outside the two-implementation vault registry — extending it costs zero Rust.
- Both domain mirrors (`src/domain/intervention/` and `plugin/domain/intervention/`) must stay in sync for `ScheduleSpec`, `RuleSpec`, and `RuleScope`. Apply identical edits to both.
- New fields on `ScheduleSpec.window` and `RuleScope` are **optional**. Absence means "no weekday filter" / "outside match" / "no tool filter". Zero migration.
- Derived rule ids follow pattern: `watering:{policyName}:{surface}:{qualifier}`. Idempotent: re-declaring replaces, never accumulates.
- Invariant 6: every primitive that can trap someone must carry a proceed affordance. `carriesExit` recurses through `schedule` to the wrapped primitive. `exitProblems` in `fences.ts` refuses empty exit notes at the writer's door.
- `Weekday` enum already exists in `src/domain/value-objects/Schedule.ts`. Import it — do not redeclare.
- `Phase` enum already exists in `src/domain/value-objects/Phase.ts`.
- pnpm only. Vitest for tests. Biome for formatting.
- MVP scope: **session + garden surfaces only**. Browser-surface schedule evaluation in the extension is deferred to a second slice.

---

### Task 1: Type Extensions (ScheduleSpec + RuleScope)

**Files:**
- Modify: `src/domain/intervention/Primitive.ts:182-187`
- Modify: `plugin/domain/intervention/Primitive.ts:163-168`
- Modify: `src/domain/intervention/RuleSpec.ts:26-33` (RuleScope) and `:89-133` (validateRuleSpec)
- Modify: `plugin/domain/intervention/RuleSpec.ts:26-33` and `:89-133`
- Modify: `src/domain/intervention/__tests__/RuleSpec.test.ts`

**Interfaces:**
- Consumes: `Weekday` from `src/domain/value-objects/Schedule.ts`, `Phase` from `src/domain/value-objects/Phase.ts`
- Produces:
  - Extended `ScheduleSpec.window` with optional `weekdays` and `cutFrom`
  - Extended session `RuleScope` with optional `match` and `tools`
  - New garden `RuleScope` variant
  - Updated `validateRuleSpec` accepting garden scope

- [ ] **Step 1: Write failing tests for new scope validation**

Add to `src/domain/intervention/__tests__/RuleSpec.test.ts`:

```ts
import type { RuleSpec } from "../RuleSpec";

function ruleWithScope(scope: any): RuleSpec {
  return {
    id: "test-rule",
    name: "test",
    description: "test",
    scope,
    mechanism: "friction",
    fadeEligibility: "manual",
    outcome: {
      claim: "attention returns",
      measure: { kind: "next_span_in", areaIds: ["area-1"] },
      windowMs: 600_000,
    },
    serves: { cycleId: "c-1", areaId: "area-1" },
    deliveryProbability: 1,
    primitives: [
      {
        kind: "gate",
        trigger: { type: "entry" },
        frictionType: { type: "confirmation" },
        proceedAffordance: { label: "Cross", action: { type: "continue" } },
      },
    ],
  };
}

describe("validateRuleSpec — garden scope", () => {
  it("accepts a garden scope with non-empty areaIds", () => {
    const rule = ruleWithScope({ surface: "garden", areaIds: ["area-craft"] });
    expect(validateRuleSpec(rule)).toEqual([]);
  });

  it("rejects a garden scope with empty areaIds", () => {
    const rule = ruleWithScope({ surface: "garden", areaIds: [] });
    expect(validateRuleSpec(rule)).toContainEqual(
      expect.stringContaining("areaIds"),
    );
  });
});

describe("validateRuleSpec — session scope with tools", () => {
  it("accepts a session scope with match and tools", () => {
    const rule = ruleWithScope({
      surface: "session",
      paths: ["/Users/rafa/Developer"],
      match: "inside",
      tools: ["Edit", "Write"],
    });
    expect(validateRuleSpec(rule)).toEqual([]);
  });

  it("accepts a session scope without match (defaults to outside)", () => {
    const rule = ruleWithScope({
      surface: "session",
      paths: ["/Users/rafa/Developer"],
    });
    expect(validateRuleSpec(rule)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/domain/intervention/__tests__/RuleSpec.test.ts -v
```

Expected: FAIL — `garden` is not a valid surface, type errors.

- [ ] **Step 3: Extend ScheduleSpec.window in src/domain/intervention/Primitive.ts**

Change lines 182-187 from:

```ts
export interface ScheduleSpec {
  readonly kind: "schedule";
  readonly window: { readonly fromHour: number; readonly toHour: number };
  readonly wraps: Primitive;
  readonly outsideWindow: "inactive" | "passthrough";
}
```

To:

```ts
export interface ScheduleSpec {
  readonly kind: "schedule";
  readonly window: {
    readonly fromHour: number;
    readonly toHour: number;
    readonly weekdays?: readonly Weekday[];
    readonly cutFrom?: Phase;
  };
  readonly wraps: Primitive;
  readonly outsideWindow: "inactive" | "passthrough";
}
```

Add the imports at the top of the file:

```ts
import type { Weekday } from "../value-objects/Schedule";
import type { Phase } from "../value-objects/Phase";
```

- [ ] **Step 4: Apply the identical ScheduleSpec change to plugin/domain/intervention/Primitive.ts**

Same change at lines 163-168. The plugin mirror imports from `src/`:

```ts
import type { Weekday } from "../../../src/domain/value-objects/Schedule.ts";
import type { Phase } from "../../../src/domain/value-objects/Phase.ts";
```

- [ ] **Step 5: Extend RuleScope in src/domain/intervention/RuleSpec.ts**

Change lines 26-33 from:

```ts
export type RuleScope =
  | {
      readonly surface: "browser";
      readonly domain: string;
      readonly matches: readonly string[];
    }
  | { readonly surface: "session"; readonly paths: readonly string[] }
  | { readonly surface: "desktop"; readonly apps: readonly string[] };
```

To:

```ts
export type RuleScope =
  | {
      readonly surface: "browser";
      readonly domain: string;
      readonly matches: readonly string[];
    }
  | {
      readonly surface: "session";
      readonly paths: readonly string[];
      readonly match?: "outside" | "inside";
      readonly tools?: readonly string[];
    }
  | { readonly surface: "desktop"; readonly apps: readonly string[] }
  | {
      readonly surface: "garden";
      readonly areaIds: readonly string[];
    };
```

- [ ] **Step 6: Update validateRuleSpec in the same file**

Add a garden scope validation block after the browser scope check (after line 130):

```ts
  if (rule.scope.surface === "garden") {
    if (rule.scope.areaIds.length === 0) {
      problems.push("scope.areaIds must be non-empty for a garden-scoped rule");
    }
  }
```

- [ ] **Step 7: Apply identical RuleScope + validateRuleSpec changes to plugin/domain/intervention/RuleSpec.ts**

Same changes as steps 5-6.

- [ ] **Step 8: Run tests to verify they pass**

```bash
pnpm test -- src/domain/intervention/__tests__/RuleSpec.test.ts -v
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/domain/intervention/Primitive.ts plugin/domain/intervention/Primitive.ts src/domain/intervention/RuleSpec.ts plugin/domain/intervention/RuleSpec.ts src/domain/intervention/__tests__/RuleSpec.test.ts
git commit -m "feat(intervention): extend ScheduleSpec with weekdays/cutFrom, RuleScope with garden surface and session tools"
```

---

### Task 2: Watering Hours Rule Factory

**Files:**
- Create: `src/domain/intervention/rules/wateringHours.ts`
- Create: `src/domain/intervention/rules/__tests__/wateringHours.test.ts`

**Interfaces:**
- Consumes: `RuleSpec`, `validateRuleSpec` from `../RuleSpec`, `GateSpec`, `CooldownSpec`, `ScheduleSpec` from `../Primitive`, `Weekday` from `../../value-objects/Schedule`, `Phase` from `../../value-objects/Phase`, `AreaId`, `RuleId`, `Duration` from `../../attention/ids`, `DistalRef` from `../ProximalOutcome`
- Produces:
  - `WateringHoursInput` interface
  - `WateringHoursMode = "regular" | "dry" | "by_hand"`
  - `wateringHoursRules(input: WateringHoursInput): RuleSpec[]`
  - `wateringPolicyId(policyName: string, surface: string, qualifier?: string): RuleId`

- [ ] **Step 1: Write failing tests**

Create `src/domain/intervention/rules/__tests__/wateringHours.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { carriesExit } from "../../Primitive";
import { validateRuleSpec } from "../../RuleSpec";
import {
  wateringHoursRules,
  wateringPolicyId,
  type WateringHoursInput,
} from "../wateringHours";
import { Weekday } from "@/domain/value-objects/Schedule";
import { Phase } from "@/domain/value-objects/Phase";

const serves = { cycleId: "c-1", areaId: "area-wellness" };

const REGULAR_INPUT: WateringHoursInput = {
  policyName: "morning-wellness",
  mode: "regular",
  window: { fromHour: 6, toHour: 12, cutFrom: Phase.MORNING },
  serves,
  returnsTo: ["area-wellness"],
  restricts: {
    areas: ["area-craft"],
    paths: ["/Users/rafa/Developer/themia"],
  },
  prompt: "Morning waters wellness. What brings you to craft?",
};

const DRY_INPUT: WateringHoursInput = {
  policyName: "mindful-monday",
  mode: "dry",
  window: { fromHour: 0, toHour: 24, weekdays: [Weekday.MON] },
  serves,
  returnsTo: ["area-wellness"],
  restricts: {
    hosts: ["netflix.com"],
    paths: ["/Users/rafa/Developer"],
    tools: ["Edit", "Write"],
  },
  unlockNote: "Re-declare watering hours tomorrow.",
};

const BY_HAND_INPUT: WateringHoursInput = {
  policyName: "artisanal-tuesday",
  mode: "by_hand",
  window: { fromHour: 0, toHour: 24, weekdays: [Weekday.TUE] },
  serves,
  returnsTo: ["area-craft"],
  restricts: {
    paths: ["/Users/rafa/Developer"],
    tools: ["Edit", "Write"],
  },
  prompt: "Irrigation is off today. By hand?",
};

describe("wateringPolicyId", () => {
  it("derives deterministic ids", () => {
    expect(wateringPolicyId("mindful-monday", "session")).toBe(
      "watering:mindful-monday:session",
    );
    expect(wateringPolicyId("mindful-monday", "browser", "netflix.com")).toBe(
      "watering:mindful-monday:browser:netflix.com",
    );
  });
});

describe("wateringHoursRules — regular mode", () => {
  const rules = wateringHoursRules(REGULAR_INPUT);

  it("generates one rule per surface declared in restricts", () => {
    expect(rules.length).toBe(2); // garden + session
    const surfaces = rules.map((r) => r.scope.surface);
    expect(surfaces).toContain("garden");
    expect(surfaces).toContain("session");
  });

  it("all rules pass the validator", () => {
    for (const rule of rules) {
      expect(validateRuleSpec(rule)).toEqual([]);
    }
  });

  it("all primitives carry exits (invariant 6)", () => {
    for (const rule of rules) {
      for (const p of rule.primitives) {
        expect(carriesExit(p)).toBe(true);
      }
    }
  });

  it("wraps gates in schedule primitives", () => {
    for (const rule of rules) {
      for (const p of rule.primitives) {
        expect(p.kind).toBe("schedule");
        if (p.kind === "schedule") {
          expect(p.window.fromHour).toBe(6);
          expect(p.window.toHour).toBe(12);
          expect(p.wraps.kind).toBe("gate");
        }
      }
    }
  });

  it("uses derived ids with policy prefix", () => {
    for (const rule of rules) {
      expect(rule.id).toMatch(/^watering:morning-wellness:/);
    }
  });

  it("session scope uses match: inside", () => {
    const session = rules.find((r) => r.scope.surface === "session")!;
    expect((session.scope as any).match).toBe("inside");
  });

  it("uses friction mechanism", () => {
    for (const rule of rules) {
      expect(rule.mechanism).toBe("friction");
    }
  });

  it("delivers always (not under test)", () => {
    for (const rule of rules) {
      expect(rule.deliveryProbability).toBe(1);
    }
  });

  it("builds an escalation ladder: intention gate then delay gate", () => {
    const session = rules.find((r) => r.scope.surface === "session")!;
    expect(session.primitives.length).toBe(2);
    const first = (session.primitives[0] as any).wraps;
    const second = (session.primitives[1] as any).wraps;
    expect(first.frictionType.type).toBe("intention");
    expect(second.frictionType.type).toBe("delay");
  });
});

describe("wateringHoursRules — dry mode", () => {
  const rules = wateringHoursRules(DRY_INPUT);

  it("generates rules for each surface", () => {
    const surfaces = rules.map((r) => r.scope.surface);
    expect(surfaces).toContain("session");
    expect(surfaces).toContain("browser");
  });

  it("all rules pass the validator", () => {
    for (const rule of rules) {
      expect(validateRuleSpec(rule)).toEqual([]);
    }
  });

  it("wraps a standing cooldown in schedule", () => {
    const session = rules.find((r) => r.scope.surface === "session")!;
    expect(session.primitives.length).toBe(1);
    const sched = session.primitives[0];
    expect(sched.kind).toBe("schedule");
    if (sched.kind === "schedule") {
      expect(sched.wraps.kind).toBe("cooldown");
      if (sched.wraps.kind === "cooldown") {
        expect(sched.wraps.duration).toEqual({ type: "standing" });
        expect(sched.wraps.unlockPath.type).toBe("out_of_band");
      }
    }
  });

  it("carries weekday restriction", () => {
    const session = rules.find((r) => r.scope.surface === "session")!;
    const sched = session.primitives[0];
    if (sched.kind === "schedule") {
      expect(sched.window.weekdays).toEqual([Weekday.MON]);
    }
  });

  it("uses access-block mechanism", () => {
    for (const rule of rules) {
      expect(rule.mechanism).toBe("access-block");
    }
  });
});

describe("wateringHoursRules — by_hand mode", () => {
  const rules = wateringHoursRules(BY_HAND_INPUT);

  it("generates a session-scoped rule only", () => {
    expect(rules.length).toBe(1);
    expect(rules[0].scope.surface).toBe("session");
  });

  it("scopes to specific tools", () => {
    const scope = rules[0].scope as any;
    expect(scope.tools).toEqual(["Edit", "Write"]);
    expect(scope.match).toBe("inside");
  });

  it("wraps a confirmation gate in schedule", () => {
    const sched = rules[0].primitives[0];
    expect(sched.kind).toBe("schedule");
    if (sched.kind === "schedule") {
      expect(sched.wraps.kind).toBe("gate");
      if (sched.wraps.kind === "gate") {
        expect(sched.wraps.frictionType.type).toBe("confirmation");
      }
    }
  });

  it("passes the validator", () => {
    expect(validateRuleSpec(rules[0])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/domain/intervention/rules/__tests__/wateringHours.test.ts -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the factory**

Create `src/domain/intervention/rules/wateringHours.ts`:

```ts
import type { AreaId, Duration, RuleId } from "../../attention/ids";
import type {
  CooldownSpec,
  GateSpec,
  Primitive,
  ScheduleSpec,
} from "../Primitive";
import type { DistalRef } from "../ProximalOutcome";
import type { RuleSpec } from "../RuleSpec";
import type { Weekday } from "../../value-objects/Schedule";
import type { Phase } from "../../value-objects/Phase";

export type WateringHoursMode = "regular" | "dry" | "by_hand";

export interface WateringHoursWindow {
  readonly fromHour: number;
  readonly toHour: number;
  readonly weekdays?: readonly Weekday[];
  readonly cutFrom?: Phase;
}

export interface WateringHoursInput {
  readonly policyName: string;
  readonly mode: WateringHoursMode;
  readonly window: WateringHoursWindow;
  readonly serves: DistalRef;
  readonly returnsTo: readonly AreaId[];
  readonly restricts: {
    readonly areas?: readonly AreaId[];
    readonly paths?: readonly string[];
    readonly hosts?: readonly string[];
    readonly tools?: readonly string[];
  };
  readonly prompt?: string;
  readonly unlockNote?: string;
  readonly windowMs?: Duration;
}

const TEN_MINUTES: Duration = 10 * 60_000;
const TEN_SECONDS = 10;

export function wateringPolicyId(
  policyName: string,
  surface: string,
  qualifier?: string,
): RuleId {
  const parts = ["watering", policyName, surface];
  if (qualifier) parts.push(qualifier);
  return parts.join(":");
}

function regularRungs(
  window: WateringHoursWindow,
  prompt: string,
  abortLabel: string,
): readonly Primitive[] {
  const wrap = (gate: GateSpec): ScheduleSpec => ({
    kind: "schedule",
    window,
    outsideWindow: "inactive",
    wraps: gate,
  });

  const first: GateSpec = {
    kind: "gate",
    trigger: { type: "entry" },
    frictionType: { type: "intention", prompt },
    proceedAffordance: { label: "Water it anyway", action: { type: "continue" } },
    abortAffordance: { label: abortLabel },
  };

  const second: GateSpec = {
    kind: "gate",
    trigger: { type: "entry" },
    frictionType: { type: "delay", seconds: TEN_SECONDS },
    proceedAffordance: { label: "Water it anyway", action: { type: "continue" } },
    abortAffordance: { label: abortLabel },
  };

  return [wrap(first), wrap(second)];
}

function dryRung(
  window: WateringHoursWindow,
  unlockNote: string,
): readonly Primitive[] {
  const cooldown: CooldownSpec = {
    kind: "cooldown",
    duration: { type: "standing" },
    unlockPath: { type: "out_of_band", note: unlockNote },
  };
  return [{ kind: "schedule", window, outsideWindow: "inactive", wraps: cooldown }];
}

function byHandRungs(
  window: WateringHoursWindow,
  prompt: string,
): readonly Primitive[] {
  const wrap = (gate: GateSpec): ScheduleSpec => ({
    kind: "schedule",
    window,
    outsideWindow: "inactive",
    wraps: gate,
  });

  const first: GateSpec = {
    kind: "gate",
    trigger: { type: "entry" },
    frictionType: { type: "confirmation" },
    proceedAffordance: { label: "By hand — write it", action: { type: "continue" } },
    abortAffordance: { label: "Describe it instead" },
  };

  const second: GateSpec = {
    kind: "gate",
    trigger: { type: "entry" },
    frictionType: { type: "intention", prompt: prompt || "What are you writing by hand?" },
    proceedAffordance: { label: "By hand — write it", action: { type: "continue" } },
    abortAffordance: { label: "Describe it instead" },
  };

  return [wrap(first), wrap(second)];
}

function primitivesFor(input: WateringHoursInput): readonly Primitive[] {
  switch (input.mode) {
    case "regular":
      return regularRungs(
        input.window,
        input.prompt || "This plot is watered at other hours. Continue?",
        "Back to the scheduled plots",
      );
    case "dry":
      return dryRung(
        input.window,
        input.unlockNote || "Re-declare watering hours to lift.",
      );
    case "by_hand":
      return byHandRungs(input.window, input.prompt || "");
  }
}

function mechanismFor(mode: WateringHoursMode): "friction" | "access-block" {
  return mode === "dry" ? "access-block" : "friction";
}

export function wateringHoursRules(input: WateringHoursInput): RuleSpec[] {
  const rules: RuleSpec[] = [];
  const { restricts, policyName } = input;
  const mechanism = mechanismFor(input.mode);
  const windowMs = input.windowMs ?? TEN_MINUTES;

  const base = {
    description: `Watering hours policy "${policyName}" (${input.mode})`,
    mechanism,
    fadeEligibility: "manual" as const,
    outcome: {
      claim: `attention returns to a watered plot rather than staying outside "${policyName}"`,
      measure: { kind: "next_span_in" as const, areaIds: [...input.returnsTo] },
      windowMs,
    },
    serves: input.serves,
    deliveryProbability: 1,
  };

  if (restricts.areas && restricts.areas.length > 0) {
    rules.push({
      ...base,
      id: wateringPolicyId(policyName, "garden"),
      name: `${policyName} (garden)`,
      scope: { surface: "garden", areaIds: [...restricts.areas] },
      primitives: primitivesFor(input),
    });
  }

  if (restricts.paths && restricts.paths.length > 0) {
    rules.push({
      ...base,
      id: wateringPolicyId(policyName, "session"),
      name: `${policyName} (session)`,
      scope: {
        surface: "session",
        paths: [...restricts.paths],
        match: "inside" as const,
        ...(restricts.tools && restricts.tools.length > 0
          ? { tools: [...restricts.tools] }
          : {}),
      },
      primitives: primitivesFor(input),
    });
  }

  if (restricts.hosts && restricts.hosts.length > 0) {
    for (const host of restricts.hosts) {
      rules.push({
        ...base,
        id: wateringPolicyId(policyName, "browser", host),
        name: `${policyName} (${host})`,
        scope: {
          surface: "browser",
          domain: host,
          matches: [`*://${host}/*`, `*://*.${host}/*`],
        },
        primitives: primitivesFor(input),
      });
    }
  }

  return rules;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/domain/intervention/rules/__tests__/wateringHours.test.ts -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/intervention/rules/wateringHours.ts src/domain/intervention/rules/__tests__/wateringHours.test.ts
git commit -m "feat(intervention): watering hours rule factory — regular, dry, by-hand modes"
```

---

### Task 3: Use-Case + MCP Tool

**Files:**
- Modify: `src/application/use-cases/fences.ts`
- Modify: `src/application/ports.ts`
- Create: `src/application/__tests__/wateringHoursFences.test.ts`
- Modify: `src/application/__tests__/fences.test.ts` (add phaseConfigs to deps)
- Modify: `src/application/__tests__/browserFences.test.ts` (add phaseConfigs to deps)
- Modify: `mcp-server/index.ts`

**Interfaces:**
- Consumes: `wateringHoursRules`, `wateringPolicyId` from Task 2, `FenceDeps` from ports, `resolveArea` + `resolveReturn` + `writeFence` + `exitProblems` (internal to fences.ts)
- Produces:
  - `declareWateringHours(deps, input): Promise<DeclareWateringHoursResult>`
  - Extended `ClearFencesTarget` with `{ policy: string }` variant
  - Extended `FenceGardenPort` with `phaseConfigs()` method
  - `set_watering_hours` MCP tool
  - `clear_fence` gains optional `policy` param

- [ ] **Step 1: Extend FenceGardenPort in ports.ts**

Add `phaseConfigs` to `FenceGardenPort` in `src/application/ports.ts`. Add after the `activeCycleId` method:

```ts
  phaseConfigs(): Promise<readonly PhaseConfigRef[]>;
```

Add the new type and import after `AreaRef`:

```ts
import type { Phase } from "../domain/value-objects/Phase";

export interface PhaseConfigRef {
  readonly phase: Phase;
  readonly startHour: number;
  readonly endHour: number;
}
```

- [ ] **Step 2: Write failing use-case tests**

Create `src/application/__tests__/wateringHoursFences.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AreaRef, FenceDeps, PhaseConfigRef } from "@/application/ports";
import {
  clearFences,
  declareWateringHours,
} from "@/application/use-cases/fences";
import type { RuleSpec } from "@/domain/intervention/RuleSpec";
import { validateRuleSpec } from "@/domain/intervention/RuleSpec";
import { Phase } from "@/domain/value-objects/Phase";

const AREAS: AreaRef[] = [
  { id: "area-wellness", name: "Wellness" },
  { id: "area-craft", name: "Craft" },
];

const PHASE_CONFIGS: PhaseConfigRef[] = [
  { phase: Phase.MORNING, startHour: 6, endHour: 12 },
  { phase: Phase.AFTERNOON, startHour: 12, endHour: 18 },
  { phase: Phase.EVENING, startHour: 18, endHour: 22 },
];

function deps(opts?: {
  areas?: readonly AreaRef[];
  cycleId?: string | null;
  fences?: Record<string, RuleSpec>;
  phaseConfigs?: readonly PhaseConfigRef[];
}) {
  let stored: Record<string, RuleSpec> = { ...(opts?.fences ?? {}) };
  const d: FenceDeps = {
    store: {
      read: async () => ({ ...stored }),
      write: async (all) => { stored = all; },
    },
    tally: { read: async () => ({}) },
    garden: {
      areas: async () => opts?.areas ?? AREAS,
      activeCycleId: async () => opts?.cycleId === undefined ? "cycle-1" : opts.cycleId,
      phaseConfigs: async () => opts?.phaseConfigs ?? PHASE_CONFIGS,
    },
    newRuleId: () => "rule-1",
  };
  return { d, stored: () => stored };
}

describe("declareWateringHours", () => {
  it("writes rules keyed by derived id", async () => {
    const { d, stored } = deps();
    const result = await declareWateringHours(d, {
      name: "morning-wellness",
      mode: "regular",
      window: { phases: [Phase.MORNING] },
      waters: ["Wellness"],
      restricts: { areas: ["Craft"], paths: ["/Users/rafa/Developer/themia"] },
      prompt: "Morning waters wellness.",
    });
    if ("problems" in result) throw new Error(result.problems.join("; "));

    expect(result.declared.length).toBeGreaterThan(0);
    for (const rule of result.declared) {
      expect(rule.id).toMatch(/^watering:morning-wellness:/);
      expect(validateRuleSpec(rule)).toEqual([]);
      expect(stored()[rule.id]).toBeDefined();
    }
  });

  it("rejects when no season is running", async () => {
    const { d } = deps({ cycleId: null });
    const result = await declareWateringHours(d, {
      name: "test",
      mode: "regular",
      window: { phases: [Phase.MORNING] },
      waters: ["Wellness"],
      restricts: { areas: ["Craft"] },
    });
    expect("problems" in result).toBe(true);
  });

  it("resolves phase names to hours", async () => {
    const { d } = deps();
    const result = await declareWateringHours(d, {
      name: "morning-wellness",
      mode: "regular",
      window: { phases: [Phase.MORNING] },
      waters: ["Wellness"],
      restricts: { areas: ["Craft"] },
    });
    if ("problems" in result) throw new Error(result.problems.join("; "));

    const gardenRule = result.declared.find((r) => r.scope.surface === "garden")!;
    const sched = gardenRule.primitives[0] as any;
    expect(sched.window.fromHour).toBe(6);
    expect(sched.window.toHour).toBe(12);
    expect(sched.window.cutFrom).toBe(Phase.MORNING);
  });

  it("resolves area names to ids", async () => {
    const { d } = deps();
    const result = await declareWateringHours(d, {
      name: "test",
      mode: "regular",
      window: { phases: [Phase.MORNING] },
      waters: ["Wellness"],
      restricts: { areas: ["Craft"] },
    });
    if ("problems" in result) throw new Error(result.problems.join("; "));

    const gardenRule = result.declared.find((r) => r.scope.surface === "garden")!;
    expect((gardenRule.scope as any).areaIds).toContain("area-craft");
  });

  it("is idempotent — re-declaring replaces", async () => {
    const { d, stored } = deps();
    await declareWateringHours(d, {
      name: "test",
      mode: "regular",
      window: { phases: [Phase.MORNING] },
      waters: ["Wellness"],
      restricts: { areas: ["Craft"] },
    });
    const countAfterFirst = Object.keys(stored()).length;
    await declareWateringHours(d, {
      name: "test",
      mode: "regular",
      window: { phases: [Phase.MORNING] },
      waters: ["Wellness"],
      restricts: { areas: ["Craft"] },
    });
    expect(Object.keys(stored()).length).toBe(countAfterFirst);
  });

  it("dry mode requires unlockNote", async () => {
    const { d } = deps();
    const result = await declareWateringHours(d, {
      name: "test",
      mode: "dry",
      window: { phases: [Phase.MORNING] },
      waters: ["Wellness"],
      restricts: { areas: ["Craft"] },
    });
    expect("problems" in result).toBe(true);
    if ("problems" in result) {
      expect(result.problems.join(" ")).toMatch(/unlock/i);
    }
  });
});

describe("clearFences with policy prefix", () => {
  it("clears all rules matching a policy prefix", async () => {
    const { d, stored } = deps();
    await declareWateringHours(d, {
      name: "morning-wellness",
      mode: "regular",
      window: { phases: [Phase.MORNING] },
      waters: ["Wellness"],
      restricts: { areas: ["Craft"], paths: ["/dev"] },
    });
    expect(Object.keys(stored()).length).toBeGreaterThan(0);

    const result = await clearFences(d, { policy: "morning-wellness" });
    if ("problems" in result) throw new Error(result.problems.join("; "));
    expect(result.cleared.length).toBeGreaterThan(0);
    expect(Object.keys(stored()).length).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test -- src/application/__tests__/wateringHoursFences.test.ts -v
```

Expected: FAIL — `declareWateringHours` does not exist, `ClearFencesTarget` missing `policy`.

- [ ] **Step 4: Implement declareWateringHours in fences.ts**

Add imports at the top of `src/application/use-cases/fences.ts`:

```ts
import {
  wateringHoursRules,
  type WateringHoursInput,
  type WateringHoursMode,
  type WateringHoursWindow,
} from "../../domain/intervention/rules/wateringHours.ts";
import type { Weekday } from "../../domain/value-objects/Schedule.ts";
import type { Phase } from "../../domain/value-objects/Phase.ts";
import type { PhaseConfigRef } from "../ports";
```

Add the declaration type after the existing `FenceDeclaration`:

```ts
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
```

Add the use-case function after `declareFence`:

```ts
export async function declareWateringHours(
  deps: FenceDeps,
  input: WateringHoursDeclaration,
): Promise<DeclareWateringHoursResult> {
  const problems: string[] = [];

  if (input.name.trim().length === 0) {
    problems.push("name must identify this watering policy");
  }

  if (input.mode === "dry" && (!input.unlockNote || input.unlockNote.trim() === "")) {
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
    const phaseConfigs = await deps.garden.phaseConfigs();
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
  } else if (input.window.fromHour !== undefined && input.window.toHour !== undefined) {
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
  const next = { ...all };
  for (const rule of rules) next[rule.id] = rule;
  await deps.store.write(next);
  return { declared: rules, standing: Object.keys(next).length };
}
```

- [ ] **Step 5: Extend ClearFencesTarget with policy prefix**

Change `ClearFencesTarget`:

```ts
export type ClearFencesTarget =
  | { readonly id: RuleId }
  | { readonly all: true }
  | { readonly policy: string };
```

Add the policy case in `clearFences`, after the `"all"` branch and before the `id` branch:

```ts
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
```

- [ ] **Step 6: Update existing test deps() to include phaseConfigs**

In `src/application/__tests__/fences.test.ts`, add `phaseConfigs` to the garden mock inside `deps()`:

```ts
      phaseConfigs: async () => [],
```

Do the same in `src/application/__tests__/browserFences.test.ts` if it has a `deps()` factory.

- [ ] **Step 7: Run all fence tests**

```bash
pnpm test -- src/application/__tests__/wateringHoursFences.test.ts src/application/__tests__/fences.test.ts src/application/__tests__/browserFences.test.ts -v
```

Expected: PASS

- [ ] **Step 8: Wire set_watering_hours MCP tool in mcp-server/index.ts**

Add the import at the top:

```ts
import { declareWateringHours } from "../src/application/use-cases/fences.ts";
```

Add after the `set_browser_transform` tool (around line 3371):

```ts
defineTool(server, {
  name: "set_watering_hours",
  description:
    "Declare a standing temporal attention policy — which plots get watered when, with friction for watering the wrong plot at the wrong time. Three modes: 'regular' (gentle gate friction), 'dry' (standing block, no water at all), 'by_hand' (tool-level friction, manual work passes through). One declaration generates per-surface rules with derived ids; re-declaring replaces.",
  schema: {
    name: z
      .string()
      .min(1)
      .describe("Policy handle — shown back at every crossing, used in derived ids"),
    mode: z
      .enum(["regular", "dry", "by_hand"])
      .describe("regular = gentle friction, dry = standing block, by_hand = tool-level gate"),
    window: z.object({
      phases: z
        .array(z.enum(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]))
        .optional()
        .describe("Phase names — resolved to hours at declaration, frozen with cutFrom provenance"),
      weekdays: z
        .array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]))
        .optional()
        .describe("Days of the week this policy is in force"),
      fromHour: z.number().min(0).max(23).optional(),
      toHour: z.number().min(0).max(23).optional(),
    }),
    waters: z
      .array(z.string().min(1))
      .min(1)
      .describe("Areas this window IS for — names or ids"),
    restricts: z.object({
      areas: z.array(z.string().min(1)).optional().describe("Areas that get friction (garden surface)"),
      paths: z.array(z.string().min(1)).optional().describe("Path prefixes that get friction (session surface)"),
      hosts: z.array(z.string().min(1)).optional().describe("Hosts that get friction (browser surface, deferred to slice 2)"),
      tools: z.array(z.string().min(1)).optional().describe("Tool names to gate — Edit, Write (by_hand mode)"),
    }),
    prompt: z.string().optional().describe("The gate's question (regular/by_hand modes)"),
    unlockNote: z.string().optional().describe("How the block is lifted (REQUIRED for dry mode)"),
  },
  handler: async (input) => {
    const result = await declareWateringHours(fenceDeps, {
      ...input,
      restricts: {
        ...input.restricts,
        paths: input.restricts.paths?.map(expandHome),
      },
    });
    if ("problems" in result) return err(result.problems.join("; "));
    return ok({
      declared: result.declared.map((r) => ({ id: r.id, surface: r.scope.surface })),
      standing: result.standing,
    });
  },
});
```

- [ ] **Step 9: Extend clear_fence with policy param**

Add to the `clear_fence` schema:

```ts
    policy: z
      .string()
      .optional()
      .describe("Clear all rules belonging to a watering policy by name"),
```

Update the handler:

```ts
  handler: async ({ id, all, policy }) => {
    if ([id, all, policy].filter(Boolean).length !== 1) {
      return err("pass exactly one of `id`, `all`, or `policy`");
    }
    const target = all
      ? { all: true as const }
      : policy
        ? { policy }
        : { id: id as string };
    const result = await clearFences(fenceDeps, target);
    if ("problems" in result) return err(result.problems.join("; "));
    return ok({
      cleared: result.cleared.map((f) => ({ id: f.id, label: f.name })),
    });
  },
```

- [ ] **Step 10: Extend fenceDeps garden adapter with phaseConfigs**

In `mcp-server/index.ts` where `fenceDeps` is constructed, add `phaseConfigs` to the garden adapter:

```ts
    phaseConfigs: async () => {
      const raw = readCollection(VAULT_ROOT, "phaseConfigs");
      return Object.values(raw).map((c: any) => ({
        phase: c.phase,
        startHour: c.startHour,
        endHour: c.endHour,
      }));
    },
```

- [ ] **Step 11: Run all fence tests + full suite**

```bash
pnpm test -v
```

Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/application/use-cases/fences.ts src/application/ports.ts src/application/__tests__/wateringHoursFences.test.ts src/application/__tests__/fences.test.ts src/application/__tests__/browserFences.test.ts mcp-server/index.ts
git commit -m "feat: declareWateringHours use-case + set_watering_hours MCP tool + clear_fence policy prefix"
```

---

### Task 4: Hook Enforcement — Schedule Evaluation

**Files:**
- Modify: `plugin/hooks/fences.mts`

**Interfaces:**
- Consumes: `RuleSpec`, `rungFor`, `shouldDeliver` (already imported), `ScheduleSpec`, `CooldownSpec` types from `../domain/intervention/Primitive.ts`
- Produces: Updated hook that evaluates schedule windows, handles `match: "inside"` polarity, matches tool names, and resets windowed tally

- [ ] **Step 1: Add schedule window evaluation functions**

Add these functions before `main` in `plugin/hooks/fences.mts`:

```ts
import type { ScheduleSpec, CooldownSpec } from "../domain/intervention/Primitive.ts";

const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function currentWeekday(): string {
  return WEEKDAY_NAMES[new Date().getDay()];
}

function isInWindow(window: ScheduleSpec["window"]): boolean {
  const now = new Date();
  const hour = now.getHours();

  if (window.weekdays && window.weekdays.length > 0) {
    if (!window.weekdays.includes(currentWeekday() as any)) return false;
  }

  const { fromHour, toHour } = window;
  if (toHour <= fromHour) {
    return hour >= fromHour || hour < toHour;
  }
  return hour >= fromHour && hour < toHour;
}
```

Update the existing import to add `ScheduleSpec` and `CooldownSpec`:

```ts
import type { GateSpec, Primitive, ScheduleSpec, CooldownSpec } from "../domain/intervention/Primitive.ts";
```

- [ ] **Step 2: Rewrite main to handle all fence types**

Replace the `main` function (starting at line 191):

```ts
const main = async (): Promise<void> => {
  const input = await readStdin();
  const fences = loadFences();
  if (fences.length === 0) allow();

  const path = String(input?.tool_input?.file_path || input?.cwd || "").trim();
  const toolName = String(input?.tool_name || "").trim();
  if (path === "" && toolName === "") allow();

  if (path && !ROOTS.some((r) => under(path, r))) allow();

  let crossedFence: RuleSpec | null = null;

  for (const fence of fences) {
    const scope = fence.scope as {
      paths: readonly string[];
      match?: "outside" | "inside";
      tools?: readonly string[];
    };
    const matchDir = scope.match ?? "outside";

    // Tool filter: if the rule scopes to specific tools, skip non-matching
    if (scope.tools && scope.tools.length > 0) {
      if (!scope.tools.includes(toolName)) continue;
    }

    const insidePaths = path
      ? scope.paths.some((p) => under(path, p))
      : false;

    if (matchDir === "outside") {
      // Classic session fence: friction when OUTSIDE the enclosed paths
      if (inside(fences, path)) continue; // inside any fence → no crossing
      crossedFence = fence;
      break;
    }

    // match: "inside" — watering hours: friction when INSIDE the restricted paths
    if (insidePaths) {
      // Only fire if the schedule window is active
      const firstPrim = fence.primitives[0];
      if (firstPrim?.kind === "schedule") {
        if (!isInWindow((firstPrim as ScheduleSpec).window)) continue;
      }
      crossedFence = fence;
      break;
    }
  }

  if (!crossedFence) allow();
  const fence = crossedFence!;

  const { crossings: taken, declined: passed } = tally(fence.id);

  // Windowed tally reset: if last crossing is from a different day, reset
  // ponytail: daily reset; upgrade to per-window when phase boundaries matter
  let effectiveCrossings = taken;
  if (fence.primitives[0]?.kind === "schedule") {
    const state = tally(fence.id);
    if (state.at > 0) {
      const lastDate = new Date(state.at).toDateString();
      if (lastDate !== new Date().toDateString()) effectiveCrossings = 0;
    }
  }

  if (!shouldDeliver(Number(fence.deliveryProbability), Math.random())) {
    recordCrossing(fence.id, taken, passed + 1);
    allow();
  }

  let rung = rungFor(fence, effectiveCrossings);
  if (!rung) allow();

  // Unwrap schedule to get the actual gate/cooldown
  if (rung!.kind === "schedule") {
    const sched = rung as unknown as ScheduleSpec;
    if (!isInWindow(sched.window)) allow();
    rung = sched.wraps;
  }

  if (rung!.kind !== "gate" && rung!.kind !== "cooldown") allow();

  const wait = dwellMs(rung!);
  if (wait > 0) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
  }
  recordCrossing(fence.id, effectiveCrossings + 1, passed);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: reason(fence, rung!, path),
      },
    }),
  );
  process.exit(0);
};
```

Add a helper that checks if a path is inside ANY classic (outside-match) fence:

```ts
function inside(fences: RuleSpec[], path: string): boolean {
  if (!path) return false;
  return fences
    .filter((f) => (f.scope as any).match !== "inside")
    .some((f) =>
      ((f.scope as { paths: readonly string[] }).paths ?? []).some((p) =>
        under(path, p),
      ),
    );
}
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test -v
```

Expected: all existing tests pass. The hook is not unit-tested (it runs as a process), so we verify nothing regresses.

- [ ] **Step 4: Commit**

```bash
git add plugin/hooks/fences.mts
git commit -m "feat(hook): evaluate schedule windows, match-inside polarity, tool-name matching, windowed tally reset"
```

---

### Task 5: Garden Advisories in MCP Moment Tools

**Files:**
- Modify: `mcp-server/index.ts`

**Interfaces:**
- Consumes: `readFencesFile` from `mcp-server/fences.ts`, `RuleSpec` from domain, `readCollection` (already used), moment tool response shapes
- Produces: `wateringHoursAdvisory` field on `add_moment` and `update_moment` responses

- [ ] **Step 1: Add advisory computation function**

Add near the fence tools section of `mcp-server/index.ts`:

```ts
import { readFencesFile } from "./fences.ts";

function wateringHoursAdvisory(
  areaId: string,
  phase: string | null,
): string | null {
  if (!phase) return null;
  try {
    const fences = readFencesFile(VAULT_ROOT);
    const now = new Date();
    const hour = now.getHours();
    const weekday = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][now.getDay()];

    for (const rule of Object.values(fences)) {
      if (rule.scope.surface !== "garden") continue;
      const scope = rule.scope as { surface: "garden"; areaIds: readonly string[] };
      if (!scope.areaIds.includes(areaId)) continue;

      for (const prim of rule.primitives) {
        if (prim.kind !== "schedule") continue;
        const w = prim.window as {
          fromHour: number;
          toHour: number;
          weekdays?: string[];
          cutFrom?: string;
        };

        if (w.weekdays && w.weekdays.length > 0 && !w.weekdays.includes(weekday)) continue;

        // Check if current hour is in the restriction window
        const inWindow =
          w.toHour <= w.fromHour
            ? hour >= w.fromHour || hour < w.toHour
            : hour >= w.fromHour && hour < w.toHour;
        if (!inWindow) continue;

        return `${rule.name}: this area is restricted during ${w.cutFrom || "this window"}`;
      }
    }
  } catch {
    // fail-soft: advisory is never worth an error
  }
  return null;
}
```

- [ ] **Step 2: Inject advisory into runAddMoment response**

In `runAddMoment`, after the moment is written and before the return, add:

```ts
  const advisory = wateringHoursAdvisory(result.moment.areaId, result.moment.phase);

  return {
    created: result.moment,
    ...(result.dayViewOverflow ? { dayViewOverflow: { count: result.dayViewOverflow } } : {}),
    ...(advisory ? { wateringHoursAdvisory: advisory } : {}),
  };
```

- [ ] **Step 3: Inject advisory into update_moment handler**

In the `update_moment` handler, after the update succeeds, add the same advisory check against the updated moment's area and phase. Follow the same pattern as step 2.

- [ ] **Step 4: Run the full test suite**

```bash
pnpm test -v
```

Expected: PASS

- [ ] **Step 5: Smoke test the MCP server**

```bash
cd mcp-server && pnpm smoke
```

- [ ] **Step 6: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): wateringHoursAdvisory on add_moment and update_moment responses"
```
