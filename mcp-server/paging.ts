import * as crypto from "node:crypto";

export function filterHash(filter: Record<string, unknown>): string {
  const sorted = Object.keys(filter)
    .filter((k) => filter[k] !== undefined)
    .sort();
  const normalized: Record<string, unknown> = {};
  for (const k of sorted) normalized[k] = filter[k];
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
  return digest.slice(0, 8);
}

export function encodeCursor(offset: number, fHash: string): string {
  return Buffer.from(JSON.stringify({ v: 1, o: offset, f: fHash })).toString(
    "base64url",
  );
}

export function decodeCursor(cursor: string): {
  offset: number;
  filterHash: string;
} {
  let parsed: { v?: number; o?: number; f?: string };
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
  } catch {
    throw new Error("invalid cursor: malformed base64url or JSON");
  }
  if (
    parsed.v !== 1 ||
    typeof parsed.o !== "number" ||
    typeof parsed.f !== "string"
  ) {
    throw new Error("invalid cursor: missing or unexpected fields");
  }
  return { offset: parsed.o, filterHash: parsed.f };
}

export type PageEnvelope<T> = {
  items: T[];
  total: number;
  truncated: boolean;
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function paginate<T>(
  items: T[],
  filter: Record<string, unknown>,
  opts: { limit?: number; cursor?: string },
): PageEnvelope<T> {
  const limit = Math.max(1, Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  const fHash = filterHash(filter);

  let offset = 0;
  if (opts.cursor) {
    const decoded = decodeCursor(opts.cursor);
    if (decoded.filterHash !== fHash) {
      throw new Error(
        "cursor was issued for a different filter — drop the cursor or restore the original filters.",
      );
    }
    offset = decoded.offset;
  }

  const page = items.slice(offset, offset + limit);
  const truncated = offset + limit < items.length;

  return {
    items: page,
    total: items.length,
    truncated,
    nextCursor: truncated ? encodeCursor(offset + limit, fHash) : null,
  };
}
