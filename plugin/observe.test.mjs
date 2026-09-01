import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OBSERVE = join(import.meta.dirname, "observe.mjs");
const run = (hook, input, env = {}) =>
  execFileSync("node", [OBSERVE, hook], {
    input: input ? JSON.stringify(input) : undefined,
    env: { ...process.env, ...env },
    timeout: 5000,
  });

test("writes an agent event to the log dir", () => {
  const tmp = mkdtempSync(join(tmpdir(), "observe-"));
  run("pre-tool", { session_id: "s1", tool_name: "Read" }, { KEEL_HOME: tmp });
  const files = readdirSync(join(tmp, "log"));
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith(".agent.jsonl"));
  const event = JSON.parse(readFileSync(join(tmp, "log", files[0]), "utf8"));
  assert.equal(event.kind, "tool_dispatched");
  assert.equal(event.surface, "agent");
  assert.equal(event.sessionId, "s1");
  assert.equal(event.payload.tool_name, "Read");
  rmSync(tmp, { recursive: true });
});

test("unknown hook exits silently", () => {
  const tmp = mkdtempSync(join(tmpdir(), "observe-"));
  run("banana", {}, { KEEL_HOME: tmp });
  const logDir = join(tmp, "log");
  assert.ok(
    !existsSync(logDir),
    "no log dir should be created for unknown hooks",
  );
  rmSync(tmp, { recursive: true });
});

test("truncates large payload fields", () => {
  const tmp = mkdtempSync(join(tmpdir(), "observe-"));
  run("user-submit", { session_id: "s2", big: "x".repeat(5000) }, { KEEL_HOME: tmp });
  const files2 = readdirSync(join(tmp, "log"));
  const event = JSON.parse(readFileSync(join(tmp, "log", files2[0]), "utf8"));
  assert.equal(event.payload.big.truncated, true);
  assert.equal(event.payload.big.bytes, 5000);
  rmSync(tmp, { recursive: true });
});

test("no stdin exits cleanly", () => {
  const tmp = mkdtempSync(join(tmpdir(), "observe-"));
  execFileSync("node", [OBSERVE, "stop"], {
    env: { ...process.env, KEEL_HOME: tmp },
    timeout: 5000,
  });
  const files3 = readdirSync(join(tmp, "log"));
  assert.equal(files3.length, 1);
  rmSync(tmp, { recursive: true });
});
