#!/usr/bin/env node
// @ts-check
// zenborg observer — append-only activity log for Claude Code sessions.
// Fail-open: any error → exit 0. A hook must never trap the user.

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const ZENBORG = process.env.ZENBORG_HOME || process.env.KAIROS_HOME || join(homedir(), ".zenborg");
const LOG_DIR = process.env.KEEL_HOME
  ? join(process.env.KEEL_HOME, "log")
  : join(ZENBORG, "log");

const KIND = {
  "session-start": "session_start",
  "user-submit": "prompt",
  "pre-tool": "tool_dispatched",
  "post-tool": "tool_completed",
  "post-tool-failure": "tool_failed",
  "stop": "turn_stop",
  "subagent-stop": "subagent_stop",
  "session-end": "session_end",
  "notification": "notification",
  "pre-compact": "pre_compact",
  "permission-request": "permission_request",
  "config-change": "config_change",
  "file-changed": "file_changed",
};

function logFileName(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.agent.jsonl`;
}

function capValue(v, max = 2048) {
  if (v == null) return v;
  const s = typeof v === "string" ? v : JSON.stringify(v) ?? "";
  const bytes = Buffer.byteLength(s, "utf8");
  if (bytes <= max) return v;
  return { truncated: true, bytes, value: s.slice(0, max) };
}

function capPayload(obj) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = capValue(v);
  return out;
}

function readStdin() {
  return new Promise((res) => {
    if (process.stdin.isTTY) return res(null);
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => {
      try { res(JSON.parse(d)); } catch { res(null); }
    });
  });
}

async function main() {
  try {
    const hook = process.argv[2];
    const kind = KIND[hook];
    if (!kind) process.exit(0);

    const input = await readStdin();
    const now = Date.now();

    const event = JSON.stringify({
      id: randomUUID(),
      surface: "agent",
      kind,
      ts: now,
      sessionId: input?.session_id ?? "",
      payload: capPayload(input),
    });

    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(join(LOG_DIR, logFileName(now)), event + "\n");
  } catch {
    // fail-open
  }
  process.exit(0);
}

main();
