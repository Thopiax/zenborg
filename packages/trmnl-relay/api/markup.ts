import { kv } from "@vercel/kv";

export const config = { runtime: "edge" };

interface TrmnlPhase {
  label: string;
  emoji: string;
  moments: Array<{ name: string; area_name: string; area_emoji: string }>;
  moment_count: number;
  is_current: boolean;
}

interface TrmnlMergeVariables {
  date_label: string;
  cycle_name: string;
  phases: TrmnlPhase[];
  total_allocated: number;
  total_unallocated: number;
}

function renderMarkup(vars: TrmnlMergeVariables): string {
  let phasesHtml = "";

  for (const phase of vars.phases) {
    if (phase.moment_count === 0) {
      continue;
    }

    const nowMarker = phase.is_current ? " [NOW]" : "";
    let momentsHtml = "";
    for (const m of phase.moments) {
      momentsHtml += `<p class="content">${m.area_emoji} ${m.name} <span class="label">${m.area_name}</span></p>`;
    }

    phasesHtml += `<p class="label label--underline">${phase.emoji} ${phase.label}${nowMarker}</p>${momentsHtml}`;
  }

  if (vars.total_allocated === 0) {
    phasesHtml = `<p class="title" style="text-align:center;margin-top:2em;">No moments allocated</p><p class="description" style="text-align:center;">Open Zenborg to plan your day</p>`;
  }

  const cycleHtml = vars.cycle_name
    ? `<p class="description">${vars.cycle_name}</p>`
    : "";
  const deckLabel =
    vars.total_unallocated > 0
      ? ` &middot; ${vars.total_unallocated} in deck`
      : "";

  return `<div class="view view--full"><div class="layout"><div class="columns"><div class="column"><div class="markdown"><div class="title_bar"><span class="title_bar__title">Zenborg</span><span class="title_bar__instance">${vars.date_label}</span></div>${cycleHtml}${phasesHtml}<p class="label" style="margin-top:1em;">${vars.total_allocated} allocated${deckLabel}</p></div></div></div></div></div>`;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // TRMNL sends access_token in authorization header
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Read stored payload
  const raw = await kv.get<string>(`zenborg:${accessToken}`);

  if (!raw) {
    const emptyMarkup = renderMarkup({
      date_label: "Today",
      cycle_name: "",
      phases: [],
      total_allocated: 0,
      total_unallocated: 0,
    });

    return new Response(JSON.stringify({ markup: emptyMarkup }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
  const vars = payload.merge_variables as TrmnlMergeVariables;
  const markup = renderMarkup(vars);

  return new Response(
    JSON.stringify({
      markup,
      markup_half_horizontal: markup,
      markup_half_vertical: markup,
      markup_quadrant: markup,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
