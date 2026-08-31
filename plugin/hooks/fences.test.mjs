import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The hooks are .mts and read the vault at module load, so they are exercised
// as the hook runner exercises them: a fresh process, a payload on stdin, and
// the vault pointed somewhere disposable. This is also what proves the vendored
// `domain/` slice resolves from `hooks/`, which a unit test of the hook's
// helpers would not.
const HERE = dirname(fileURLToPath(import.meta.url));
const NODE_ARGS = [
  "--experimental-transform-types",
  "--disable-warning=ExperimentalWarning",
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
];

function fenced() {
  const vault = mkdtempSync(join(tmpdir(), "kairos-fences-"));
  const roots = mkdtempSync(join(tmpdir(), "kairos-roots-"));
  const onStream = join(roots, "on-stream");
  mkdirSync(onStream, { recursive: true });

  // Built through the domain factory rather than hand-rolled, so the fixture
  // cannot drift from the shape the app writes.
  const rule = sessionFenceRule({
    id: "fence-test",
    label: "the merge",
    description: "a fence for the test",
    serves: { kind: "cycle", cycleId: "c1" },
    paths: [onStream],
    encloses: ["area-1"],
  });
  writeFileSync(join(vault, "fences.json"), JSON.stringify([rule]));
  return { vault, roots, onStream };
}

function runFences({ vault, roots }, filePath) {
  return execFileSync("node", [...NODE_ARGS, join(HERE, "fences.mts")], {
    input: JSON.stringify({
      session_id: "t",
      tool_name: "Read",
      tool_input: { file_path: filePath },
      cwd: filePath,
    }),
    env: { ...process.env, KAIROS_HOME: vault, ZENBORG_FENCE_ROOTS: roots },
    encoding: "utf8",
  });
}

const { sessionFenceRule } = await import(
  "../domain/intervention/rules/sessionFence.ts"
);

test("a path inside the fence passes silently", () => {
  const f = fenced();
  assert.equal(runFences(f, join(f.onStream, "file.ts")), "");
});

test("a crossing asks, at the first rung, naming the stream", () => {
  const f = fenced();
  const out = runFences(f, join(f.roots, "elsewhere", "file.ts"));
  const decision = JSON.parse(out).hookSpecificOutput;
  assert.equal(decision.hookEventName, "PreToolUse");
  assert.equal(decision.permissionDecision, "ask");
  assert.match(decision.permissionDecisionReason, /the merge/);
});

test("a path outside every root is not the fence's business", () => {
  const f = fenced();
  const outside = mkdtempSync(join(tmpdir(), "kairos-outside-"));
  assert.equal(runFences(f, join(outside, "file.ts")), "");
});

test("no fences declared is silence, not a crash", () => {
  const vault = mkdtempSync(join(tmpdir(), "kairos-empty-"));
  const roots = mkdtempSync(join(tmpdir(), "kairos-roots-"));
  assert.equal(runFences({ vault, roots }, join(roots, "file.ts")), "");
});

// ── Watering hours ─────────────────────────────────────────────────────

/** Spawn the hook with a custom tool_name. */
function runFencesEx({ vault, roots }, filePath, toolName = "Read") {
  return execFileSync("node", [...NODE_ARGS, join(HERE, "fences.mts")], {
    input: JSON.stringify({
      session_id: "t",
      tool_name: toolName,
      tool_input: { file_path: filePath },
      cwd: filePath,
    }),
    env: { ...process.env, KAIROS_HOME: vault, ZENBORG_FENCE_ROOTS: roots },
    encoding: "utf8",
  });
}

/** A minimal gate primitive for watering-hours tests. */
const CONFIRM_GATE = {
  kind: "gate",
  trigger: { type: "entry" },
  frictionType: { type: "confirmation" },
  proceedAffordance: { label: "Continue", action: { type: "continue" } },
  abortAffordance: { label: "Stop" },
};

const DELAY_GATE = {
  kind: "gate",
  trigger: { type: "entry" },
  frictionType: { type: "delay", seconds: 0 },
  proceedAffordance: { label: "Continue", action: { type: "continue" } },
};

/**
 * Build a watering-hours RuleSpec (match: "inside").
 * sessionFenceRule doesn't support match/tools, so hand-build.
 */
function wateringRule({ paths, tools, schedule } = {}) {
  const primitives = schedule
    ? [
        {
          kind: "schedule",
          window: schedule,
          wraps: CONFIRM_GATE,
          outsideWindow: "inactive",
        },
        DELAY_GATE,
      ]
    : [CONFIRM_GATE];

  return {
    id: "watering-test",
    name: "watering hours",
    description: "test watering",
    scope: {
      surface: "session",
      paths: paths ?? [],
      match: "inside",
      ...(tools ? { tools } : {}),
    },
    mechanism: "friction",
    fadeEligibility: "manual",
    outcome: {
      claim: "test",
      measure: { kind: "next_span_in", areaIds: ["a1"] },
      windowMs: 600_000,
    },
    serves: { kind: "cycle", cycleId: "c1" },
    deliveryProbability: 1,
    primitives,
  };
}

function watered(overrides = {}) {
  const vault = mkdtempSync(join(tmpdir(), "kairos-water-"));
  const roots = mkdtempSync(join(tmpdir(), "kairos-roots-"));
  const restricted = join(roots, "restricted-project");
  mkdirSync(restricted, { recursive: true });

  const rule = wateringRule({ paths: [restricted], ...overrides });
  writeFileSync(join(vault, "fences.json"), JSON.stringify([rule]));
  return { vault, roots, restricted };
}

test("match:inside fires when path IS inside the restricted paths", () => {
  const w = watered();
  const out = runFencesEx(w, join(w.restricted, "src", "app.ts"));
  const decision = JSON.parse(out).hookSpecificOutput;
  assert.equal(decision.permissionDecision, "ask");
  assert.match(decision.permissionDecisionReason, /watering hours/);
});

test("match:inside is silent for paths outside the restricted paths", () => {
  const w = watered();
  const elsewhere = join(w.roots, "other-project", "file.ts");
  assert.equal(runFencesEx(w, elsewhere), "");
});

test("scope.tools skips a tool not in the list", () => {
  const w = watered({ tools: ["Edit", "Write"] });
  // Read is not in the list → silent
  assert.equal(runFencesEx(w, join(w.restricted, "file.ts"), "Read"), "");
});

test("scope.tools fires for a matching tool", () => {
  const w = watered({ tools: ["Edit", "Write"] });
  const out = runFencesEx(w, join(w.restricted, "file.ts"), "Edit");
  const decision = JSON.parse(out).hookSpecificOutput;
  assert.equal(decision.permissionDecision, "ask");
});

test("schedule window covering all hours fires inside restricted path", () => {
  const w = watered({ schedule: { fromHour: 0, toHour: 24 } });
  const out = runFencesEx(w, join(w.restricted, "file.ts"));
  const decision = JSON.parse(out).hookSpecificOutput;
  assert.equal(decision.permissionDecision, "ask");
});

test("schedule window on a different weekday is silent", () => {
  const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const otherDay = WEEKDAYS[(new Date().getDay() + 3) % 7];
  const w = watered({
    schedule: { fromHour: 0, toHour: 24, weekdays: [otherDay] },
  });
  assert.equal(runFencesEx(w, join(w.restricted, "file.ts")), "");
});

test("windowed tally resets when the last crossing was on a different day", () => {
  const vault = mkdtempSync(join(tmpdir(), "kairos-water-"));
  const roots = mkdtempSync(join(tmpdir(), "kairos-roots-"));
  const restricted = join(roots, "restricted");
  mkdirSync(restricted, { recursive: true });

  const rule = wateringRule({
    paths: [restricted],
    schedule: { fromHour: 0, toHour: 24 },
  });
  rule.id = "watering-daily";
  writeFileSync(join(vault, "fences.json"), JSON.stringify([rule]));

  // Pre-write state: 5 crossings from yesterday
  const stateDir = join(vault, "plugin");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, "fences-state.json"),
    JSON.stringify({
      "watering-daily": {
        crossings: 5,
        declined: 0,
        at: Date.now() - 86_400_000,
      },
    }),
  );

  // With daily reset, effectiveCrossings → 0 → rung 0 (schedule wrapping
  // confirmation gate).  Without reset it would be 5 → rung 1 (delay gate,
  // whose reason contains "sat ... for this one").
  const out = runFencesEx({ vault, roots }, join(restricted, "file.ts"));
  const decision = JSON.parse(out).hookSpecificOutput;
  assert.equal(decision.permissionDecision, "ask");
  assert.doesNotMatch(
    decision.permissionDecisionReason,
    /sat.*for this one/,
    "should have reset to rung 0 (confirmation), not stayed at rung 1 (delay)",
  );
});
