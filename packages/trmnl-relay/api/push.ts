import { kv } from "@vercel/kv";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();

    // Store payload keyed by API key (24h TTL)
    await kv.set(`zenborg:${apiKey}`, JSON.stringify(body), { ex: 86400 });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Bad request", { status: 400 });
  }
}
