const ENABLED =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__DND_PERF__ === true;

let dragSession: {
  startTime: number;
  renders: Record<string, number>;
  frameCount: number;
  droppedFrames: number;
  lastFrameTime: number;
  rafId: number | null;
} | null = null;

function frameTick(now: number) {
  if (!dragSession) return;
  dragSession.frameCount++;
  const elapsed = now - dragSession.lastFrameTime;
  if (elapsed > 20) dragSession.droppedFrames++;
  dragSession.lastFrameTime = now;
  dragSession.rafId = requestAnimationFrame(frameTick);
}

export function dndPerfDragStart() {
  if (!ENABLED) return;
  dragSession = {
    startTime: performance.now(),
    renders: {},
    frameCount: 0,
    droppedFrames: 0,
    lastFrameTime: performance.now(),
    rafId: requestAnimationFrame(frameTick),
  };
  console.log("[dnd-perf] drag started");
}

export function dndPerfDragEnd() {
  if (!ENABLED || !dragSession) return;
  if (dragSession.rafId) cancelAnimationFrame(dragSession.rafId);
  const duration = performance.now() - dragSession.startTime;
  const { renders, frameCount, droppedFrames } = dragSession;

  const totalRenders = Object.values(renders).reduce((a, b) => a + b, 0);
  console.log(
    `[dnd-perf] drag ended: ${Math.round(duration)}ms, ${frameCount} frames, ${droppedFrames} dropped (${Math.round((droppedFrames / Math.max(frameCount, 1)) * 100)}%)`,
  );
  console.log(`[dnd-perf] total renders: ${totalRenders}`);
  console.table(renders);
  dragSession = null;
}

export function dndPerfRender(component: string) {
  if (!ENABLED || !dragSession) return;
  dragSession.renders[component] = (dragSession.renders[component] ?? 0) + 1;
}

export function enableDndPerf() {
  (window as unknown as Record<string, unknown>).__DND_PERF__ = true;
  console.log("[dnd-perf] enabled. Drag a card to see metrics.");
}

export function disableDndPerf() {
  (window as unknown as Record<string, unknown>).__DND_PERF__ = false;
  console.log("[dnd-perf] disabled.");
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).enableDndPerf = enableDndPerf;
  (window as unknown as Record<string, unknown>).disableDndPerf =
    disableDndPerf;
}
