import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  QUESTIONS,
  openQuestions,
  readiness,
  disclosureLines,
  preflight,
  preflightLines,
  onboardLines,
} from "./onboard.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEEL = join(HERE, "keel.mjs");

const BLANK = { areas: [], cycles: [] };
const PROBE = {
  vaultPath: "/tmp/vault",
  vaultWritable: true,
  logEventsToday: 0,
  screenRecording: null,
  screenRecordingProcess: "osascript",
  nativeHostProfiles: [],
};

// ── the two questions ──────────────────────────────────────────

test("onboarding asks exactly two things, and stops", () => {
  assert.equal(QUESTIONS.length, 2);
  assert.deepEqual(
    QUESTIONS.map((q) => q.id),
    ["plots", "intention"],
  );
});

test("a blank vault leaves both open, plots first", () => {
  assert.deepEqual(
    openQuestions(BLANK).map((q) => q.id),
    ["plots", "intention"],
  );
});

test("plots alone leaves the season intention open", () => {
  const r = {
    areas: [{ id: "a1", name: "craft" }],
    cycles: [
      {
        id: "c1",
        name: "First Cycle",
        intention: null,
        startDate: "2026-08-01",
        endDate: null,
      },
    ],
  };
  assert.deepEqual(
    openQuestions(r).map((q) => q.id),
    ["intention"],
  );
  assert.equal(readiness(r).ready, false);
});

test("an intention alone leaves the plots open: a DistalRef needs both halves", () => {
  const r = {
    areas: [],
    cycles: [
      {
        id: "c1",
        name: "First Cycle",
        intention: "ship the thing",
        startDate: "2026-08-01",
        endDate: null,
      },
    ],
  };
  assert.deepEqual(
    openQuestions(r).map((q) => q.id),
    ["plots"],
  );
  assert.equal(readiness(r).ready, false);
});

test("both answered: nothing is left to ask and serves becomes inhabitable", () => {
  const r = {
    areas: [
      { id: "a1", name: "craft" },
      { id: "a2", name: "body" },
    ],
    cycles: [
      {
        id: "c1",
        name: "First Cycle",
        intention: "ship the thing",
        startDate: "2026-08-01",
        endDate: null,
      },
    ],
  };
  assert.deepEqual(openQuestions(r), []);
  const v = readiness(r);
  assert.equal(v.ready, true);
  assert.deepEqual(v.serves, { cycleId: "c1", areaId: "a1" });
  assert.deepEqual(v.areaIds, ["a1", "a2"]);
});

test("a closed season does not count: the intention has to be this season's", () => {
  const r = {
    areas: [{ id: "a1", name: "craft" }],
    cycles: [
      {
        id: "c0",
        name: "Last",
        intention: "old",
        startDate: "2026-01-01",
        endDate: "2026-02-01",
      },
    ],
  };
  assert.equal(readiness(r).ready, false);
  assert.deepEqual(
    openQuestions(r).map((q) => q.id),
    ["intention"],
  );
});

// ── nothing of anybody's ships ─────────────────────────────────

/** Every string this module can put in front of a peer. */
function everythingOnboardingSays() {
  const ready = {
    areas: [{ id: "a1", name: "craft" }],
    cycles: [
      {
        id: "c1",
        name: "First Cycle",
        intention: "x",
        startDate: "2026-08-01",
        endDate: null,
      },
    ],
  };
  return [
    ...disclosureLines(),
    ...preflightLines(preflight(PROBE)),
    ...onboardLines({ vault: BLANK, probe: PROBE, showDisclosure: true }),
    ...onboardLines({ vault: ready, probe: PROBE, showDisclosure: false }),
    ...QUESTIONS.flatMap((q) => [q.ask, q.why]),
  ].join("\n");
}

test("onboarding offers no plot, no habit and no intention of its own", () => {
  const said = everythingOnboardingSays();
  // A suggestion is a seed with better manners: whatever is offered first is
  // what most peers keep. The two questions are the one input the system cannot
  // derive, so they arrive with nothing in the box.
  for (const q of QUESTIONS) {
    assert.equal(
      "suggestions" in q,
      false,
      `question "${q.id}" ships candidate answers`,
    );
    assert.equal(
      "default" in q,
      false,
      `question "${q.id}" ships a default answer`,
    );
  }
  assert.doesNotMatch(
    said,
    /\be\.g\.\s+(work|health|family|craft|body|fitness|learning)\b/i,
  );
});

test("onboarding names no host: a blocklist is not something to seed", () => {
  assert.doesNotMatch(
    everythingOnboardingSays(),
    /\b[a-z0-9-]+\.(com|org|net|io|dev|tv|gg|co|be|in)\b/,
  );
});

// ── the disclosure ─────────────────────────────────────────────

test("the disclosure says where it appears and why, in the first sentence", () => {
  const d = disclosureLines().join("\n");
  assert.match(d, /Login Items/);
  assert.match(d, /Extensions/);
  assert.match(d, /because it observes/i);
});

test("the disclosure states what is recorded and what is not", () => {
  const d = disclosureLines().join("\n");
  assert.match(d, /256/);
  assert.match(
    d,
    /never page contents, never URLs, never prompts, never keystrokes/i,
  );
  assert.match(d, /read, edit and delete/i);
  assert.match(d, /revoke/i);
});

test("the disclosure says inference is local by construction and that the hosted path leaves the machine", () => {
  const d = disclosureLines().join("\n");
  assert.match(d, /candle/i);
  assert.match(d, /in-process/i);
  assert.match(d, /off by default/i);
  assert.match(d, /leaves this machine/i);
});

test("the disclosure distinguishes the two local paths rather than describing one and shipping the other", () => {
  // The app runs the model in-process; this plugin asks a server on localhost.
  // Both are local, and saying "local" once would hide that they are not the
  // same thing, which is the sort of gap a peer finds by being surprised.
  const d = disclosureLines().join("\n");
  assert.match(d, /in-process/);
  assert.match(d, /localhost/);
});

test("the disclosure discloses the developer-mode warning rather than letting it be discovered", () => {
  assert.match(disclosureLines().join("\n"), /developer.mode/i);
});

test("nothing in the disclosure uses an em dash", () => {
  assert.doesNotMatch(disclosureLines().join("\n"), /—/);
});

// ── the preflight ──────────────────────────────────────────────

test("the preflight names every grant before anything is asked", () => {
  const ids = preflight(PROBE).map((g) => g.id);
  assert.deepEqual(ids, [
    "vault",
    "hooks",
    "login-items",
    "screen-recording",
    "native-host",
    "incognito",
  ]);
  for (const g of preflight(PROBE)) {
    assert.ok(g.name.length > 0, `${g.id} has no name`);
    assert.ok(g.why.length > 0, `${g.id} does not say why it is wanted`);
  }
});

test("a grant this surface cannot measure is never reported as granted", () => {
  const g = preflight(PROBE);
  const byId = Object.fromEntries(g.map((x) => [x.id, x]));
  assert.equal(byId["login-items"].status, "unmeasurable");
  assert.equal(byId["incognito"].status, "unmeasurable");
  assert.match(byId["login-items"].detail, /System Settings/);
  assert.match(byId["incognito"].detail, /Details/);
});

test("screen recording is reported against the process that was measured, never against the app", () => {
  const granted = preflight({ ...PROBE, screenRecording: true });
  const row = granted.find((g) => g.id === "screen-recording");
  assert.equal(row.status, "ok");
  assert.match(row.detail, /osascript/);
  assert.match(row.detail, /per application/i);
});

test("a missing screen-recording grant names the silent failure", () => {
  const row = preflight({ ...PROBE, screenRecording: false }).find(
    (g) => g.id === "screen-recording",
  );
  assert.equal(row.status, "missing");
  assert.match(row.detail, /empty/i);
  assert.match(row.detail, /succeed/i);
});

test("the preflight runs before the questions, in the rendered order", () => {
  const out = onboardLines({
    vault: BLANK,
    probe: PROBE,
    showDisclosure: true,
  }).join("\n");
  const disclosureAt = out.indexOf("because it observes");
  const preflightAt = out.indexOf("what you are asked to allow");
  const questionAt = out.indexOf(QUESTIONS[0].ask);
  assert.ok(
    disclosureAt >= 0 && preflightAt > disclosureAt && questionAt > preflightAt,
    `order was disclosure=${disclosureAt} preflight=${preflightAt} questions=${questionAt}`,
  );
});

// ── the exit condition, from genuinely empty state ─────────────

/** Run the real CLI against a vault of our own, with WAKE_VAULT unset so a
 * shell that has one cannot reach past the sandbox. */
function keel(home, ...args) {
  const env = { ...process.env, KAIROS_HOME: home };
  delete env.WAKE_VAULT;
  delete env.KEEL_HOME;
  return spawnSync(process.execPath, [KEEL, ...args], {
    encoding: "utf8",
    env,
  });
}

/** What zenborg's writer puts there when the peer answers. keel never writes
 * these files: areas and cycles have exactly one writer and it is not this one. */
function answerAsZenborgWould(home) {
  writeFileSync(
    join(home, "areas.json"),
    JSON.stringify({
      "area-1": { id: "area-1", name: "one", order: 0 },
    }),
  );
  writeFileSync(
    join(home, "cycles.json"),
    JSON.stringify({
      "cycle-1": {
        id: "cycle-1",
        name: "First Cycle",
        startDate: "2026-08-01",
        endDate: null,
        intention: "the one thing this season is for",
      },
    }),
  );
}

test("a blank vault reaches a state where a rule can be authored", () => {
  const home = mkdtempSync(join(tmpdir(), "keel-onboard-"));
  try {
    // Genuinely empty: no vault files at all, not even the ones zenborg seeds.
    assert.deepEqual(existsSync(join(home, "areas.json")), false);

    const before = keel(home, "onboard");
    assert.equal(before.status, 0, before.stderr);
    assert.match(before.stdout, /no rule can be authored yet/i);
    assert.match(
      before.stdout,
      new RegExp(
        QUESTIONS[0].ask.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ),
    );
    assert.match(
      before.stdout,
      new RegExp(
        QUESTIONS[1].ask.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ),
    );

    // keel does not write the kernel's collections. Onboarding must not be the
    // exception that makes areas a two-writer collection.
    for (const f of [
      "areas.json",
      "cycles.json",
      "moments.json",
      "habits.json",
      "phaseConfigs.json",
    ]) {
      assert.equal(existsSync(join(home, f)), false, `onboarding wrote ${f}`);
    }

    answerAsZenborgWould(home);

    const after = keel(home, "onboard");
    assert.equal(after.status, 0, after.stderr);
    assert.match(after.stdout, /a rule can be authored/i);
    assert.match(after.stdout, /cycleId: "cycle-1"/);
    assert.match(after.stdout, /areaId: "area-1"/);
    assert.doesNotMatch(after.stdout, /no rule can be authored yet/i);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("the disclosure is shown once, and stays reachable on purpose", () => {
  const home = mkdtempSync(join(tmpdir(), "keel-onboard-"));
  try {
    const first = keel(home, "onboard");
    assert.match(first.stdout, /because it observes/);

    const second = keel(home, "onboard");
    assert.doesNotMatch(second.stdout, /because it observes/);
    assert.match(second.stdout, /keel onboard --disclosure/);

    const asked = keel(home, "onboard", "--disclosure");
    assert.match(asked.stdout, /because it observes/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("an unwritable vault is reported before the peer is asked anything, not after failing", () => {
  const home = mkdtempSync(join(tmpdir(), "keel-onboard-"));
  // A regular file where a directory would have to go: mkdir cannot recover
  // from it, which is the closest a test gets to a vault the peer cannot write.
  writeFileSync(join(home, "wall"), "");
  try {
    const out = keel(join(home, "wall", "vault"), "onboard");
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /the vault {2}\[MISSING\]/);
    assert.match(out.stdout, /Nothing will be recorded until it can/);
    // Still asks, still discloses: a preflight reports, it does not refuse.
    assert.match(out.stdout, /because it observes/);
    assert.match(out.stdout, /no rule can be authored yet/i);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
