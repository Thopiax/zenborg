import { kv } from "@vercel/kv";

export const config = { runtime: "edge" };

interface TrmnlPhase {
  label: string;
  emoji: string;
  moments: Array<{ name: string; area_name: string; area_emoji: string }>;
  moment_count: number;
}

interface TrmnlMergeVariables {
  date_label: string;
  cycle_name: string;
  phase: TrmnlPhase | null;
}

function renderMarkup(vars: TrmnlMergeVariables): string {
  const cycleHtml = vars.cycle_name
    ? `<p class="description">${vars.cycle_name}</p>`
    : "";

  let bodyHtml = "";

  if (vars.phase) {
    bodyHtml += `<p class="title" style="text-align:center;margin-top:1em;">${vars.phase.emoji} ${vars.phase.label}</p>`;

    if (vars.phase.moment_count > 0) {
      for (const m of vars.phase.moments) {
        bodyHtml += `<p class="content" style="text-align:center;">${m.area_emoji} ${m.name}</p>`;
      }
    } else {
      bodyHtml += `<p class="description" style="text-align:center;margin-top:1em;">No moments allocated</p>`;
    }
  } else {
    bodyHtml = `<p class="title" style="text-align:center;margin-top:2em;">Between phases</p><p class="description" style="text-align:center;">Rest well</p>`;
  }

  return `<div class="view view--full"><div class="layout"><div class="columns"><div class="column"><div class="markdown"><div class="title_bar"><span class="title_bar__title">Zenborg</span><span class="title_bar__instance">${vars.date_label}</span></div>${cycleHtml}${bodyHtml}</div></div></div></div></div>`;
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
      phase: null,
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
