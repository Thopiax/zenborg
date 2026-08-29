// @ts-check
// Onboarding. Pure: every reading it needs is handed in, so the whole ceremony
// is testable without a vault, a browser or a permission dialog.
//
// Three parts, in the order a peer meets them, and the order is the argument:
//
//   1. the disclosure   what this is and why it appears in Login Items
//   2. the preflight    what you are asked to allow, named before it is asked
//   3. two questions    and then it stops
//
// Why exactly two, and why these two. Every `RuleSpec` requires
// `serves: DistalRef`, and a `DistalRef` is `{ cycleId, areaId }`. Every
// proximal `Measure` that names a place names it as `areaIds`. So a garden with
// no plots and no season intention cannot express a single rule, and no amount
// of onboarding polish gets around it. Those two are the only inputs the system
// cannot derive, infer or defer, so they are the only two asked.
//
// Everything else is deliberately not asked. The watchlist comes from
// `keel watchlist scan` over the peer's own history, once there is history. The
// blocklist is a commitment nobody should be invited to make in their first five
// minutes. Gap practices reference habits that do not exist yet. Fences are
// declared in a sentence when somebody wants one. Each is better authored later
// from observed data than guessed at now, and an intervention with no baseline
// behind it is an intervention nobody can evaluate.
//
// What onboarding does NOT do is write. Areas and cycles have exactly one
// writer and it is zenborg (kernel/substrate.md, rule 3). Onboarding asks, then
// says where the answer goes. A second writer is how the list forks, and the
// forked list is the failure this whole substrate exists to prevent.

/** A question, and the reason it is not optional.
 * @typedef {object} Question
 * @property {string} id
 * @property {string} ask
 * @property {string} why
 * @property {string} lands   where the answer is written, by whom */

/** @type {readonly Question[]} */
export const QUESTIONS = Object.freeze([
  Object.freeze({
    id: "plots",
    ask: "What parts of your life do you want to be able to name? Three to six of them, one or two words each.",
    why: "A plot is the only input the system cannot derive, infer or defer. Every rule names one, and every measure that asks whether attention came back asks it about a plot.",
    lands: "zenborg writes them to areas.json: create them in the garden, or ask the agent to (zenborg's create_area).",
  }),
  Object.freeze({
    id: "intention",
    ask: "What is this season for, in one sentence, and which plot is it in?",
    why: "The distal outcome. It is what makes `serves` inhabitable, and it is what harvest reads the season back against. Without it a rule points at nothing.",
    lands: "zenborg writes it onto the open cycle: set the intention in the garden, or ask the agent to (zenborg's update_cycle).",
  }),
]);

/** A vault reading, as the plugin reads it. Both collections are zenborg's.
 * @typedef {object} VaultReading
 * @property {{id: string, name: string}[]} areas
 * @property {{id: string, name: string, intention: string|null, startDate: string, endDate: string|null}[]} cycles */

/** The season: an open cycle carrying an intention. Ended cycles do not count,
 * because a rule serving a season that is over cannot be settled.
 * @param {VaultReading} vault @param {string} [today] */
export function season(vault, today = new Date().toISOString().slice(0, 10)) {
  return (vault.cycles ?? [])
    .filter((c) => c && c.id && typeof c.intention === "string" && c.intention.trim() !== "")
    .filter((c) => !c.endDate || c.endDate >= today)
    .sort((a, b) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")))[0] ?? null;
}

/** Which of the two are still open. Empty means a rule can be authored.
 * @param {VaultReading} vault @param {string} [today] @returns {Question[]} */
export function openQuestions(vault, today) {
  const open = [];
  if ((vault.areas ?? []).length === 0) open.push(QUESTIONS[0]);
  if (!season(vault, today)) open.push(QUESTIONS[1]);
  return open;
}

/** The exit condition, as a value.
 *
 * `ready` is not a feeling about the setup being finished. It is the claim that
 * `serves: DistalRef` is now inhabitable, and `serves` is the witness.
 * @param {VaultReading} vault @param {string} [today] */
export function readiness(vault, today) {
  const open = openQuestions(vault, today);
  const areas = vault.areas ?? [];
  const s = season(vault, today);
  return {
    ready: open.length === 0,
    open,
    serves: open.length === 0 && s ? { cycleId: s.id, areaId: areas[0].id } : null,
    areaIds: areas.map((a) => a.id),
    cycleId: s ? s.id : null,
  };
}

// ── the disclosure ─────────────────────────────────────────────

/** Shown once, before anything else, and re-readable on demand.
 *
 * Every clause is a property something already enforces rather than a promise:
 * the 256-character title cap is zenborg's `TITLE_CAP`; domains-not-URLs is
 * where the relay stops; the no-network claim is structural in the extension
 * manifest, which requests `declarativeNetRequest` rather than the
 * with-host-access variant and holds no host permissions at all; the input
 * sensor reads counters that cannot expose keycodes and is opt-in besides.
 *
 * The two inference paragraphs are the part that had to be decided before this
 * could be written at all. Local inference is the default and the hosted path is
 * gated off behind a build feature, so "local" is a property of the build rather
 * than a policy to trust. Say which of the two it is, because a peer cannot tell
 * from the outside, and say that the plugin's own classifier reaches localhost
 * while the app's reaches nothing: both are local and they are not the same
 * thing, and the difference is exactly what a peer would otherwise discover by
 * being surprised. */
export function disclosureLines() {
  return [
    "This appears in your Login Items and in your browser's Extensions because it observes. " +
    "It records which application and which domain had your attention and for how long: " +
    "window titles capped at 256 characters, domains, timings. " +
    "Never page contents, never URLs, never prompts, never keystrokes. " +
    "It writes to a folder on your machine that you can read, edit and delete. " +
    "None of it is sent anywhere: the extension holds no host permissions at all, so there " +
    "is nothing for it to send with. You can revoke any of it from System Settings or the " +
    "extensions page without uninstalling anything else.",
    "",
    "Classification runs on your machine, and it runs two ways depending on which surface " +
    "asks. The app runs the model in-process (candle, by way of mistral.rs) behind a build " +
    "feature, so nothing crosses a socket at all. This plugin's own classifier instead asks " +
    "a model server you started, at localhost. Both are local; neither needs a key.",
    "",
    "What is not there is the part worth checking. A hosted provider exists only behind a " +
    "second build feature that is off by default, so the binary you get carries no path to " +
    "one: there is no code in it that could call out, which is a stronger claim than a " +
    "promise not to. Turning that feature on is a deliberate act, it needs your own key, " +
    "and from then on the text being classified leaves this machine. Until you do that, " +
    "local is a property of the build rather than a policy you have to trust.",
    "",
    "One thing worth knowing in advance, because it looks like a fault and is not: the " +
    "browser extension is loaded unpacked, so your browser shows a developer-mode warning " +
    "every time it starts. It is benign and it does not stop the extension.",
  ];
}

/** Soft-wrap a paragraph for a terminal. Rendering only; the paragraphs above
 * stay whole so a reader of this file reads sentences rather than a column.
 * @param {string} text @param {number} [width] @returns {string[]} */
export function wrap(text, width = 88) {
  if (text === "") return [""];
  /** @type {string[]} */
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line === "") { line = word; continue; }
    if (line.length + 1 + word.length > width) { lines.push(line); line = word; }
    else { line += " " + word; }
  }
  if (line !== "") lines.push(line);
  return lines;
}

// ── the preflight ──────────────────────────────────────────────

/** What the plugin could find out about this machine.
 * @typedef {object} Probe
 * @property {string} vaultPath
 * @property {boolean} vaultWritable
 * @property {number|null} logEventsToday
 * @property {boolean|null} screenRecording      null when the check could not run
 * @property {string} screenRecordingProcess     what the check measured
 * @property {string[]} nativeHostProfiles */

/** One thing a peer grants or installs.
 * @typedef {object} Grant
 * @property {string} id
 * @property {string} name
 * @property {string} why
 * @property {"ok"|"missing"|"unmeasurable"} status
 * @property {string} detail */

/** Name every grant, check the ones this surface can honestly check, and mark
 * the rest unmeasurable rather than guessing.
 *
 * `unmeasurable` is a status and not an omission on purpose. An install whose
 * prompts are enumerated in advance is one a person can consent to; an install
 * whose prompts arrive one at a time from an unidentified background process is
 * one they revoke. Leaving a grant off the list because the plugin cannot read
 * it would trade the first for the second.
 *
 * Nothing here is ever reported as granted on someone else's behalf. macOS
 * grants Screen Recording per application, so a check run by this process
 * answers for this process and says so.
 * @param {Probe} p @returns {Grant[]} */
export function preflight(p) {
  const sr = p.screenRecording;
  const hosts = p.nativeHostProfiles ?? [];
  return [
    {
      id: "vault",
      name: "the vault",
      why: "everything observed is written here, in plain files you own.",
      status: p.vaultWritable ? "ok" : "missing",
      detail: p.vaultWritable
        ? `${p.vaultPath} is readable and writable.`
        : `${p.vaultPath} cannot be written. Nothing will be recorded until it can.`,
    },
    {
      id: "hooks",
      name: "Claude Code hooks",
      why: "the plugin's session events are the only thing this surface records.",
      status: (p.logEventsToday ?? 0) > 0 ? "ok" : "missing",
      detail: (p.logEventsToday ?? 0) > 0
        ? `${p.logEventsToday} event(s) logged today, so the hooks are firing.`
        : "no events logged today. If you installed the plugin in this session, the hooks register on the next one.",
    },
    {
      id: "login-items",
      name: "Login Items and Extensions, Allow in the Background",
      why: "without it the app runs when you open it and the background observer does not survive a restart.",
      status: "unmeasurable",
      detail: "Only the app can read its own registration, and it re-reads it after registering rather than trusting the call: registering can report success and still sit in RequiresApproval. Check the switch in System Settings under Login Items and Extensions.",
    },
    {
      id: "screen-recording",
      name: "Screen Recording",
      why: "window titles are how a span knows what it was.",
      status: sr === null ? "unmeasurable" : sr ? "ok" : "missing",
      detail: sr === null
        ? `the check could not be run here. macOS grants this per application, so check Screen Recording in System Settings for the app itself.`
        : sr
          ? `granted to ${p.screenRecordingProcess}, the process that ran this check. macOS grants this per application, so the app's own grant is separate; check it in System Settings.`
          : `not granted to ${p.screenRecordingProcess}. This is the one that fails quietly: without it the window list returns empty titles and the call still succeeds, so a missing grant looks exactly like an idle day.`,
    },
    {
      id: "native-host",
      name: "the browser relay",
      why: "the extension reads and writes the vault only through it, and it validates every message first.",
      status: hosts.length > 0 ? "ok" : "missing",
      detail: hosts.length > 0
        ? `installed for: ${hosts.join(", ")}.`
        : "not installed for any browser found here. Run the native-host installer before loading the extension.",
    },
    {
      id: "incognito",
      name: "Allow in Incognito",
      why: "without it a fence you declared does not hold in a private window, which is the window it was declared for.",
      status: "unmeasurable",
      detail: "The browser does not expose this to us. Turn it on at the extensions page, under keel, then Details.",
    },
  ];
}

const MARK = { ok: "ok", missing: "MISSING", unmeasurable: "not measurable here" };

/** @param {Grant[]} grants @returns {string[]} */
export function preflightLines(grants) {
  const out = ["Before anything is asked, here is what you are asked to allow.", ""];
  for (const g of grants) {
    out.push(`  ${g.name}  [${MARK[g.status]}]`);
    for (const l of wrap(g.why, 80)) out.push(`      ${l}`);
    for (const l of wrap(g.detail, 80)) out.push(`      ${l}`);
    out.push("");
  }
  return out;
}

// ── the whole ceremony ─────────────────────────────────────────

/** @param {{vault: VaultReading, probe: Probe, showDisclosure: boolean, today?: string}} args
 * @returns {string[]} */
export function onboardLines({ vault, probe, showDisclosure, today }) {
  const out = ["keel onboard", ""];

  if (showDisclosure) out.push(...disclosureLines().flatMap((p) => wrap(p)), "");
  else out.push("(the disclosure was shown on the first run: `keel onboard --disclosure` to read it again)", "");

  out.push(...preflightLines(preflight(probe)), "");

  const v = readiness(vault, today);
  if (v.open.length > 0) {
    out.push(
      `Two questions, and then this stops. ${v.open.length} still open.`,
      "",
    );
    for (const q of v.open) {
      out.push(`  ${q.ask}`);
      for (const l of wrap(`why: ${q.why}`, 80)) out.push(`      ${l}`);
      for (const l of wrap(`where it lands: ${q.lands}`, 80)) out.push(`      ${l}`);
      out.push("");
    }
    out.push(
      "No rule can be authored yet, and that is a property of the type rather than a gap in the screen:",
      "every rule declares `serves: { cycleId, areaId }`, so a garden with no plots and no season intention cannot express one.",
    );
  } else {
    out.push(
      "Both answered. A rule can be authored: `serves` is inhabitable now.",
      "",
      `  serves: { cycleId: ${JSON.stringify(v.cycleId)}, areaId: ${JSON.stringify(v.serves?.areaId)} }`,
      `  plots available as areaId: ${v.areaIds.map((a) => JSON.stringify(a)).join(", ")}`,
      "",
      "Nothing else is asked. The watchlist comes from `keel watchlist scan` once there is history to scan,",
      "and a fence is declared in a sentence when you want one.",
    );
  }
  return out;
}
