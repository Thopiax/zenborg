#!/usr/bin/env node
/**
 * Native messaging host for the zenborg browser extension.
 *
 * Chrome spawns this on demand when the extension opens a native messaging
 * connection. Reads from stdin, writes to stdout, both framed with the Chrome
 * native messaging protocol (uint32 LE length prefix + UTF-8 JSON, 1MB max).
 *
 * Not a daemon — Chrome manages the lifecycle. The process lives as long as
 * the extension keeps the port open (usually 1-2s for a flush).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  readCollection,
  readActiveMoment,
  resolveVault,
  type Area,
  type Moment,
  type PhaseConfig,
} from "../mcp-server/vault.ts";
import { readFencesFile } from "../mcp-server/fences.ts";
import { readActivityLog, logDir } from "../mcp-server/activity-log.ts";
import type { RuleSpec, RuleScope } from "../src/domain/intervention/RuleSpec.ts";
import type { Primitive, TransformSpec } from "../src/domain/intervention/Primitive.ts";

const VAULT_ROOT = resolveVault().root;
const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
const DAY_START_HOUR = 4;
const EVENT_CHUNK_SIZE = 500;

// ── Native messaging protocol ──────────────────────────────────────────

let buf = Buffer.alloc(0);

function readExactly(n: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    if (buf.length >= n) {
      const result = buf.subarray(0, n);
      buf = buf.subarray(n);
      resolve(result);
      return;
    }

    const onData = (chunk: Buffer): void => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length >= n) {
        process.stdin.removeListener("data", onData);
        process.stdin.removeListener("end", onEnd);
        const result = buf.subarray(0, n);
        buf = buf.subarray(n);
        resolve(result);
      }
    };

    const onEnd = (): void => {
      process.stdin.removeListener("data", onData);
      resolve(null);
    };

    process.stdin.on("data", onData);
    process.stdin.once("end", onEnd);
  });
}

async function readMessage(): Promise<unknown | null> {
  const header = await readExactly(4);
  if (!header) return null;
  const length = header.readUInt32LE(0);
  if (length === 0 || length > MAX_MESSAGE_SIZE) return null;
  const body = await readExactly(length);
  if (!body) return null;
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
}

function writeMessage(msg: unknown): void {
  const body = Buffer.from(JSON.stringify(msg), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(header);
  process.stdout.write(body);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function localDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function todayStr(): string {
  const now = new Date();
  if (now.getHours() < DAY_START_HOUR) now.setDate(now.getDate() - 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function currentPhase(configs: Record<string, PhaseConfig>): string {
  const hour = new Date().getHours();
  for (const cfg of Object.values(configs)) {
    if (cfg.startHour <= cfg.endHour) {
      if (hour >= cfg.startHour && hour < cfg.endHour) return cfg.phase;
    } else {
      if (hour >= cfg.startHour || hour < cfg.endHour) return cfg.phase;
    }
  }
  return "MORNING";
}

function browserDomains(scope: RuleScope): string[] {
  if (scope.surface !== "browser") return [];
  return Array.isArray(scope.domain) ? [...scope.domain] : [scope.domain];
}

function extractTransforms(
  primitives: readonly Primitive[],
): TransformSpec[] {
  const out: TransformSpec[] = [];
  for (const p of primitives) {
    if (p.kind === "transform") out.push(p);
    if (p.kind === "schedule") out.push(...extractTransforms([p.wraps]));
  }
  return out;
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// ── Handlers ────────────────────────────────────────────────────────────

interface EventsMsg {
  type: "events";
  events: Array<{
    id: string;
    surface: string;
    kind: string;
    ts: number;
    sessionId: string;
    payload: Record<string, unknown>;
    durationMs?: number;
  }>;
}

function handleEvents(msg: EventsMsg): void {
  const dir = logDir(VAULT_ROOT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ids: string[] = [];
  const byDate = new Map<string, string[]>();

  for (const event of msg.events) {
    if (event.surface !== "browser") continue;
    if (!event.id || !event.ts) continue;

    ids.push(event.id);
    const date = localDate(event.ts);
    const lines = byDate.get(date) ?? [];
    lines.push(JSON.stringify(event));
    byDate.set(date, lines);
  }

  for (const [date, lines] of byDate) {
    const file = path.join(dir, `${date}.browser.jsonl`);
    fs.appendFileSync(file, lines.join("\n") + "\n", "utf8");
  }

  writeMessage({ type: "ack", ids });
}

function handleRequestArmed(): void {
  try {
    const armed = readFencesFile(VAULT_ROOT);
    writeMessage({ type: "armed", armed });
  } catch {
    writeMessage({ type: "armed", armed: {} });
  }
}

function handleRequestObserve(): void {
  try {
    const fences = readFencesFile(VAULT_ROOT);
    const domains = new Set<string>();
    for (const fence of Object.values(fences)) {
      for (const d of browserDomains(fence.scope)) domains.add(d);
    }
    writeMessage({ type: "observe", domains: [...domains] });
  } catch {
    writeMessage({ type: "observe", domains: [] });
  }
}

function handleRequestPolicy(): void {
  try {
    const fences = readFencesFile(VAULT_ROOT);
    const areas = readCollection(VAULT_ROOT, "areas");

    // Transforms from browser-scoped fences
    const transforms: Array<{
      ruleId: string;
      domains: string[];
      targets: { primary: string; fallbacks: readonly string[] };
      replacement: { type: string; style?: Record<string, string>; content?: string };
    }> = [];

    for (const fence of Object.values(fences)) {
      if (fence.scope.surface !== "browser") continue;
      const domains = browserDomains(fence.scope);
      for (const t of extractTransforms(fence.primitives)) {
        transforms.push({
          ruleId: fence.id,
          domains,
          targets: t.targets,
          replacement:
            t.replacement.type === "template"
              ? { type: "hide" }
              : t.replacement,
        });
      }
    }

    // Areas list
    const areaList = Object.values(areas).map((a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      color: a.color,
      tags: a.tags ?? [],
    }));

    // Moment friction from active moment
    let momentFriction: { allow: string[]; deny: string[] } | null = null;
    const pointer = readActiveMoment(VAULT_ROOT);
    if (pointer) {
      const moments = readCollection(VAULT_ROOT, "moments");
      const moment = moments[pointer.momentId];
      if (moment?.day === todayStr()) {
        const allow = (moment.refs ?? [])
          .map(hostnameFromUrl)
          .filter((h): h is string => h !== null);
        momentFriction = { allow, deny: [] };
      }
    }

    writeMessage({
      type: "policy",
      transforms,
      break: null,
      areas: areaList,
      momentFriction,
    });
  } catch {
    writeMessage({ type: "policy" });
  }
}

function handleRequestActiveMoment(): void {
  const pointer = readActiveMoment(VAULT_ROOT);
  if (!pointer) {
    writeMessage({ type: "active_moment", moment: null });
    return;
  }

  const moments = readCollection(VAULT_ROOT, "moments");
  const areas = readCollection(VAULT_ROOT, "areas");
  const moment = moments[pointer.momentId];

  if (!moment || moment.day !== todayStr()) {
    writeMessage({ type: "active_moment", moment: null });
    return;
  }

  const area = areas[moment.areaId];
  writeMessage({
    type: "active_moment",
    moment: {
      id: moment.id,
      name: moment.name,
      area: area?.name ?? "",
      emoji: area?.emoji ?? "",
    },
  });
}

function handleRequestTodayMoments(): void {
  const today = todayStr();
  const moments = readCollection(VAULT_ROOT, "moments");
  const areas = readCollection(VAULT_ROOT, "areas");
  const configs = readCollection(VAULT_ROOT, "phaseConfigs");
  const pointer = readActiveMoment(VAULT_ROOT);

  const todayMoments = Object.values(moments)
    .filter((m) => m.day === today)
    .sort((a, b) => a.order - b.order)
    .map((m) => {
      const area = areas[m.areaId];
      return {
        id: m.id,
        name: m.name,
        phase: m.phase ?? "",
        areaName: area?.name ?? "",
        areaEmoji: area?.emoji ?? "",
        areaColor: area?.color ?? "",
        active: pointer?.momentId === m.id,
        startTime: m.startTime ?? null,
        durationMin: m.durationMin ?? null,
        status: m.status ?? "accepted",
      };
    });

  writeMessage({
    type: "today_moments",
    moments: todayMoments,
    currentPhase: currentPhase(configs),
  });
}

function handleRequestEvents(msg: { since: number }): void {
  const dir = logDir(VAULT_ROOT);
  const now = Date.now();
  const events = readActivityLog(dir, msg.since, now, ["browser"]);

  for (let i = 0; i < events.length; i += EVENT_CHUNK_SIZE) {
    const chunk = events.slice(i, i + EVENT_CHUNK_SIZE);
    const done = i + EVENT_CHUNK_SIZE >= events.length;
    writeMessage({ type: "events_slice", events: chunk, done });
  }

  if (events.length === 0) {
    writeMessage({ type: "events_slice", events: [], done: true });
  }
}

// ── Dispatch ────────────────────────────────────────────────────────────

function dispatch(raw: unknown): void {
  if (typeof raw !== "object" || raw === null) return;
  const msg = raw as Record<string, unknown>;

  switch (msg.type) {
    case "events":
      handleEvents(msg as unknown as EventsMsg);
      break;
    case "request_armed":
      handleRequestArmed();
      break;
    case "request_observe":
      handleRequestObserve();
      break;
    case "request_policy":
      handleRequestPolicy();
      break;
    case "request_active_moment":
      handleRequestActiveMoment();
      break;
    case "request_today_moments":
      handleRequestTodayMoments();
      break;
    case "request_events":
      handleRequestEvents(msg as unknown as { since: number });
      break;
    default:
      break;
  }
}

// ── Main ────────────────────────────────────────────────────────────────

process.stderr.write(
  `[zenborg-native-host] vault=${VAULT_ROOT} pid=${process.pid}\n`,
);

process.stdin.resume();

(async () => {
  while (true) {
    const msg = await readMessage();
    if (msg === null) break;
    dispatch(msg);
  }
})();
