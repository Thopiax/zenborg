#!/usr/bin/env node
/**
 * Smoke test: spawn the MCP server against a temp vault, exercise key tools,
 * and print a pass/fail summary. Not a replacement for proper tests; it
 * verifies the happy path wires up end-to-end.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const vault = mkdtempSync(path.join(tmpdir(), 'zenborg-smoke-'));
const child = spawn('node', ['dist/index.js', '--vault', vault], {
  cwd: path.resolve('.'),
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (d) => (stderr += d.toString()));

// Reader: parse newline-delimited JSON-RPC responses from stdout
let buf = '';
const pending = new Map(); // id -> { resolve, reject }
child.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id).resolve(msg);
        pending.delete(msg.id);
      }
    } catch (e) {
      console.error('parse error on line:', line);
    }
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout on ${method}`));
      }
    }, 5000);
  });
}

function callTool(name, args) {
  return rpc('tools/call', { name, arguments: args });
}

function toolText(resp) {
  if (resp.error) return `ERROR: ${JSON.stringify(resp.error)}`;
  const c = resp.result?.content?.[0];
  return c?.text ?? JSON.stringify(resp.result);
}

function parseOk(resp) {
  const t = toolText(resp);
  if (t.startsWith('Error:') || t.startsWith('ERROR:')) {
    throw new Error(t);
  }
  return JSON.parse(t);
}

const results = [];
function step(label, fn) {
  return fn().then(
    (v) => {
      results.push({ label, ok: true, v });
      console.log(`\u2713 ${label}`);
      return v;
    },
    (e) => {
      results.push({ label, ok: false, e: e.message });
      console.log(`\u2717 ${label}: ${e.message}`);
      throw e;
    },
  );
}

try {
  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '0' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // 1. list_areas on empty vault → []
  await step('list_areas on empty vault', async () => {
    const resp = await callTool('list_areas', {});
    const list = parseOk(resp);
    if (!Array.isArray(list) || list.length !== 0) throw new Error(`expected [], got ${JSON.stringify(list)}`);
  });

  // 2. create_area
  const areaResp = await step('create_area Work', async () => {
    const resp = await callTool('create_area', {
      name: 'Work',
      color: '#ff6600',
      emoji: '\ud83d\udcbc',
      order: 0,
    });
    return parseOk(resp);
  });
  const areaId = areaResp.created.id;

  // 3. create_habit under Work
  const habitResp = await step('create_habit Deep Work', async () => {
    const resp = await callTool('create_habit', {
      name: 'Deep Work',
      areaId,
      order: 0,
      phase: 'MORNING',
    });
    return parseOk(resp);
  });
  const habitId = habitResp.created.id;

  // 4. plan_cycle
  const cycleResp = await step('plan_cycle Sprint 1', async () => {
    const resp = await callTool('plan_cycle', {
      name: 'Sprint 1',
      startDate: '2026-04-20',
      endDate: '2026-05-04',
    });
    return parseOk(resp);
  });
  const cycleId = cycleResp.created.id;

  // 5. budget_habit_to_cycle
  await step('budget_habit_to_cycle 5x', async () => {
    const resp = await callTool('budget_habit_to_cycle', { cycleId, habitId, count: 5 });
    return parseOk(resp);
  });

  // 5b. allocate_from_plan — materialize a plan-linked moment on a day/phase
  let planLinkedMomentId = null;
  await step('allocate_from_plan 2026-04-22 MORNING', async () => {
    const resp = await callTool('allocate_from_plan', {
      cycleId,
      habitId,
      day: '2026-04-22',
      phase: 'MORNING',
    });
    const parsed = parseOk(resp);
    const m = parsed.allocated;
    if (!m || !m.id) throw new Error(`expected allocated moment, got ${JSON.stringify(parsed)}`);
    if (m.day !== '2026-04-22') throw new Error(`expected day 2026-04-22, got ${m.day}`);
    if (m.phase !== 'MORNING') throw new Error(`expected phase MORNING, got ${m.phase}`);
    if (!m.cyclePlanId) throw new Error(`expected cyclePlanId set, got ${m.cyclePlanId}`);
    if (m.habitId !== habitId) throw new Error(`expected habitId ${habitId}, got ${m.habitId}`);
    // Verify written to vault
    const momentsFile = JSON.parse(readFileSync(path.join(vault, 'moments.json'), 'utf8'));
    if (!momentsFile[m.id]) throw new Error(`moment ${m.id} not written to vault`);
    if (momentsFile[m.id].cyclePlanId !== m.cyclePlanId) throw new Error(`vault cyclePlanId mismatch`);
    planLinkedMomentId = m.id;
  });

  // 5c. unallocate_moment — derive paradigm: deletes the plan-linked row entirely
  await step('unallocate_moment deletes plan-linked row', async () => {
    const resp = await callTool('unallocate_moment', { id: planLinkedMomentId });
    parseOk(resp);
    const momentsFile = JSON.parse(readFileSync(path.join(vault, 'moments.json'), 'utf8'));
    if (momentsFile[planLinkedMomentId]) {
      throw new Error(`moment ${planLinkedMomentId} still present after unallocate_moment`);
    }
  });

  // 5d. unallocate_moment rejects spontaneous moments
  await step('unallocate_moment rejects spontaneous', async () => {
    const spawn = await callTool('spawn_spontaneous_from_habit', {
      habitId,
      day: '2026-04-23',
      phase: 'MORNING',
    });
    const spawned = parseOk(spawn);
    const spontaneousId = spawned.created.id;
    const resp = await callTool('unallocate_moment', { id: spontaneousId });
    const text = toolText(resp);
    if (!text.toLowerCase().includes('spontaneous')) {
      throw new Error(`expected spontaneous rejection, got: ${text}`);
    }
    // Should still be present in vault
    const momentsFile = JSON.parse(readFileSync(path.join(vault, 'moments.json'), 'utf8'));
    if (!momentsFile[spontaneousId]) {
      throw new Error(`spontaneous ${spontaneousId} should NOT be deleted`);
    }
    // Clean up so later phase-cap + archive assertions line up
    await callTool('delete_moment', { id: spontaneousId });
  });

  // 6. spawn_spontaneous_from_habit
  await step('spawn_spontaneous_from_habit today MORNING', async () => {
    const resp = await callTool('spawn_spontaneous_from_habit', {
      habitId,
      day: '2026-04-21',
      phase: 'MORNING',
    });
    return parseOk(resp);
  });

  // 7. list_moments (allocated)
  await step('list_moments allocated', async () => {
    const resp = await callTool('list_moments', { filter: { allocation: 'allocated' } });
    const list = parseOk(resp);
    // Only the spontaneous moment from step 6 remains (plan-linked was unallocated in 5c).
    if (list.length !== 1) throw new Error(`expected 1 allocated, got ${list.length}`);
  });

  // 8. Enforce phase cap (3 moments max)
  await step('phase cap enforced', async () => {
    // Already 1 allocated. Add 2 more, then 4th should fail.
    await callTool('spawn_spontaneous_from_habit', { habitId, day: '2026-04-21', phase: 'MORNING' });
    await callTool('spawn_spontaneous_from_habit', { habitId, day: '2026-04-21', phase: 'MORNING' });
    const resp = await callTool('spawn_spontaneous_from_habit', { habitId, day: '2026-04-21', phase: 'MORNING' });
    const text = toolText(resp);
    if (!text.toLowerCase().includes('max')) throw new Error(`expected cap error, got: ${text}`);
  });

  // 9. archive_habit — derive paradigm: plans deleted, allocated moments preserved
  await step('archive_habit keeps allocated moments, deletes plans', async () => {
    // Snapshot moments with this habitId before archiving.
    const momentsBefore = JSON.parse(readFileSync(path.join(vault, 'moments.json'), 'utf8'));
    const allocatedBefore = Object.values(momentsBefore).filter(
      (m) => m.habitId === habitId && m.day !== null && m.phase !== null,
    );
    if (allocatedBefore.length === 0) {
      throw new Error('precondition: expected at least one allocated moment for habit');
    }

    const resp = await callTool('archive_habit', { id: habitId });
    const parsed = parseOk(resp);
    if (parsed.deletedPlans !== 1) throw new Error(`expected 1 plan deleted, got ${parsed.deletedPlans}`);
    // New semantics: moments are NOT deleted; the response no longer reports deletedMoments.
    if ('deletedMoments' in parsed) {
      throw new Error(`archive_habit must not report deletedMoments, got ${JSON.stringify(parsed)}`);
    }

    // Verify vault: every allocated moment for this habit still exists.
    const momentsAfter = JSON.parse(readFileSync(path.join(vault, 'moments.json'), 'utf8'));
    for (const m of allocatedBefore) {
      if (!momentsAfter[m.id]) {
        throw new Error(`allocated moment ${m.id} was deleted by archive_habit (should survive)`);
      }
      if (momentsAfter[m.id].habitId !== habitId) {
        throw new Error(`moment ${m.id} habitId was altered by archive_habit`);
      }
    }

    // Plans for this habit must be gone.
    const plansAfter = JSON.parse(readFileSync(path.join(vault, 'cyclePlans.json'), 'utf8'));
    for (const p of Object.values(plansAfter)) {
      if (p.habitId === habitId) {
        throw new Error(`plan ${p.id} for archived habit still present`);
      }
    }
  });

  // 10. delete_cycle cascade
  await step('delete_cycle cascade', async () => {
    const resp = await callTool('delete_cycle', { id: cycleId });
    return parseOk(resp);
  });

  console.log('\n--- vault files ---');
  const files = ['areas.json', 'habits.json', 'cycles.json', 'cyclePlans.json', 'moments.json'];
  for (const f of files) {
    const p = path.join(vault, f);
    if (existsSync(p)) {
      const parsed = JSON.parse(readFileSync(p, 'utf8'));
      console.log(`${f}: ${Object.keys(parsed).length} entries`);
    }
  }
} catch (e) {
  console.error('\nFAIL:', e.message);
  console.error('stderr tail:', stderr.split('\n').slice(-10).join('\n'));
  process.exitCode = 1;
} finally {
  child.kill();
  rmSync(vault, { recursive: true, force: true });
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} passed`);
}
