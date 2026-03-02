import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

import { NextResponse } from "next/server";

export const runtime = "edge";

interface TrmnlMoment {
  name: string;
  area_name: string;
}

interface TrmnlPhase {
  label: string;
  moments: TrmnlMoment[];
  moment_count: number;
}

interface TrmnlMergeVariables {
  date_label: string;
  cycle_name: string;
  phase: TrmnlPhase | null;
}

function renderMomentItem(m: TrmnlMoment): string {
  const areaLabel = m.area_name
    ? `<span class="description">${m.area_name}</span>`
    : "";

  return `<div class="item item--emphasis-2">
  <div class="meta"></div>
  <div class="content">
    <span class="title title--large">${m.name}</span>
    ${areaLabel}
  </div>
</div>`;
}

function renderMarkup(vars: TrmnlMergeVariables): string {
  const cycleSuffix = vars.cycle_name ? ` &middot; ${vars.cycle_name}` : "";
  const phaseLabel = vars.phase ? vars.phase.label : "";

  let bodyHtml = "";

  if (vars.phase) {
    if (vars.phase.moment_count > 0) {
      bodyHtml = `<div class="flex flex--col flex--center-x flex--center-y gap--large">`;
      for (const m of vars.phase.moments) {
        bodyHtml += renderMomentItem(m);
      }
      bodyHtml += `</div>`;
    } else {
      bodyHtml = `<div class="flex flex--col flex--center-x flex--center-y stretch">
  <span class="title">No moments yet</span>
</div>`;
    }
  } else {
    bodyHtml = `<div class="flex flex--col flex--center-x flex--center-y stretch">
  <span class="title title--large">Between phases</span>
  <span class="description">Rest well</span>
</div>`;
  }

  return `<div class="screen">
<div class="view view--full">
  <div class="layout layout--col">
    <div class="flex flex--col flex--center-x flex--center-y stretch">${bodyHtml}</div>
  </div>
  <div class="title_bar">
    <img class="image" src="https://usetrmnl.com/images/plugins/trmnl--render.svg" />
    <span class="title">Zenborg &middot; ${vars.date_label}${cycleSuffix}</span>
    <span class="instance">${phaseLabel}</span>
  </div>
</div>
</div>`;
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
  const raw = await redis.get<string>(`zenborg:${accessToken}`);

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
