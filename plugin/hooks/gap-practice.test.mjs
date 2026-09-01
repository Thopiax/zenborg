import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NODE_ARGS = [
  "--experimental-transform-types",
  "--disable-warning=ExperimentalWarning",
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
];

const { GAP_TAG } = await import(
  "../domain/intervention/rules/gapPractice.ts"
);

/** A vault with one habit tagged for the gap. No fences needed — the hook
 * fires when gap-tagged habits exist, not when an intervention rule does. */
function garden({ tagged = true } = {}) {
  const vault = mkdtempSync(join(tmpdir(), "kairos-gap-"));
  writeFileSync(
    join(vault, "habits.json"),
    JSON.stringify([
      { id: "h1", name: "three breaths", tags: tagged ? [GAP_TAG] : ["other"] },
    ]),
  );
  return vault;
}

function runGap(vault) {
  return execFileSync("node", [...NODE_ARGS, join(HERE, "gap-practice.mts")], {
    input: JSON.stringify({ session_id: "t", prompt: "go" }),
    // ZENBORG_PLACE is cleared so the roster is not filtered by where the
    // machine thinks it is when the suite runs somewhere else.
    env: { ...process.env, KAIROS_HOME: vault, ZENBORG_PLACE: "" },
    encoding: "utf8",
  });
}

test("a tagged practice is offered, named, and marked as not for the agent", () => {
  const out = runGap(garden());
  assert.match(out, /three breaths/);
  assert.match(out, /Nothing here is for you, Claude/);
});

test("the offer is made once, not on every prompt", () => {
  const vault = garden();
  assert.notEqual(runGap(vault), "");
  assert.equal(runGap(vault), "");
});

test("no habit tagged for the gap means the garden stays quiet", () => {
  assert.equal(runGap(garden({ tagged: false })), "");
});

test("an empty vault is silence, not a crash", () => {
  assert.equal(runGap(mkdtempSync(join(tmpdir(), "kairos-bare-"))), "");
});
