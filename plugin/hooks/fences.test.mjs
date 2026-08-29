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
