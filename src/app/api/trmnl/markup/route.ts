import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

interface TrmnlPhase {
  label: string;
  emoji: string;
  moments: Array<{ name: string; emoji: string }>;
  moment_count: number;
}

interface TrmnlMergeVariables {
  date_label: string;
  cycle_name: string;
  phase: TrmnlPhase | null;
}

function renderMarkup(vars: TrmnlMergeVariables): string {
  const cycleSuffix = vars.cycle_name ? ` &middot; ${vars.cycle_name}` : "";

  let bodyHtml = "";

  if (vars.phase) {
    bodyHtml += `<p class="label" style="margin-top:0.5em;">${vars.phase.emoji} ${vars.phase.label} &middot; ${vars.date_label}${cycleSuffix}</p>`;

    if (vars.phase.moment_count > 0) {
      for (const m of vars.phase.moments) {
        bodyHtml += `<p class="title" style="margin-top:1.5em;text-align:center;font-size:48px;">${m.emoji} ${m.name}</p>`;
      }
    } else {
      bodyHtml += `<p class="title" style="margin-top:3em;text-align:center;">No moments yet</p>`;
    }
  } else {
    bodyHtml = `<p class="label" style="margin-top:0.5em;">${vars.date_label}${cycleSuffix}</p><p class="title" style="margin-top:3em;text-align:center;">Between phases</p><p class="description" style="text-align:center;">Rest well</p>`;
  }

  return `<div class="view view--full"><div class="layout"><div class="columns"><div class="column"><div class="markdown"><div class="title_bar"><span class="title_bar__title">Zenborg</span></div>${bodyHtml}</div></div></div></div></div>`;
}

export async function POST(request: Request): Promise<NextResponse> {
  // TRMNL sends access_token in authorization header
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read stored payload
  const raw = await kv.get<string>(`zenborg:${accessToken}`);

  if (!raw) {
    const emptyMarkup = renderMarkup({
      date_label: "Today",
      cycle_name: "",
      phase: null,
    });

    return NextResponse.json({ markup: emptyMarkup });
  }

  const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
  const vars = payload.merge_variables as TrmnlMergeVariables;
  const markup = renderMarkup(vars);

  return NextResponse.json({
    markup,
    markup_half_horizontal: markup,
    markup_half_vertical: markup,
    markup_quadrant: markup,
  });
}
