import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Store payload keyed by API key (24h TTL)
    await redis.set(`zenborg:${apiKey}`, JSON.stringify(body), { ex: 86400 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
