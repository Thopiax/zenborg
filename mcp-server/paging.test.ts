import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  filterHash,
  paginate,
} from "./paging.js";

describe("filterHash", () => {
  it("produces an 8-char hex string", () => {
    const h = filterHash({ areaId: "a-1" });
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic for same keys in different order", () => {
    const a = filterHash({ areaId: "a-1", phase: "MORNING" });
    const b = filterHash({ phase: "MORNING", areaId: "a-1" });
    expect(a).toBe(b);
  });

  it("ignores undefined values", () => {
    const a = filterHash({ areaId: "a-1" });
    const b = filterHash({ areaId: "a-1", phase: undefined });
    expect(a).toBe(b);
  });

  it("differs for different filters", () => {
    const a = filterHash({ areaId: "a-1" });
    const b = filterHash({ areaId: "a-2" });
    expect(a).not.toBe(b);
  });
});

describe("cursor encode/decode round-trip", () => {
  it("round-trips offset and filterHash", () => {
    const cursor = encodeCursor(50, "abcd1234");
    const decoded = decodeCursor(cursor);
    expect(decoded.offset).toBe(50);
    expect(decoded.filterHash).toBe("abcd1234");
  });

  it("rejects malformed base64", () => {
    expect(() => decodeCursor("not-valid!!!")).toThrow("invalid cursor");
  });

  it("rejects valid base64 with wrong structure", () => {
    const bad = Buffer.from(JSON.stringify({ x: 1 })).toString("base64url");
    expect(() => decodeCursor(bad)).toThrow("invalid cursor");
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 120 }, (_, i) => ({ id: i }));
  const filter = { areaId: "a-1" };

  it("returns first page with no cursor", () => {
    const result = paginate(items, filter, {});
    expect(result.items).toHaveLength(50);
    expect(result.items[0]).toEqual({ id: 0 });
    expect(result.total).toBe(120);
    expect(result.truncated).toBe(true);
    expect(result.nextCursor).toBeTruthy();
  });

  it("returns correct offset when cursor is provided", () => {
    const first = paginate(items, filter, {});
    const second = paginate(items, filter, { cursor: first.nextCursor! });
    expect(second.items[0]).toEqual({ id: 50 });
    expect(second.items).toHaveLength(50);
    expect(second.truncated).toBe(true);
  });

  it("last page has truncated=false and nextCursor=null", () => {
    const first = paginate(items, filter, {});
    const second = paginate(items, filter, { cursor: first.nextCursor! });
    const third = paginate(items, filter, { cursor: second.nextCursor! });
    expect(third.items).toHaveLength(20);
    expect(third.truncated).toBe(false);
    expect(third.nextCursor).toBeNull();
  });

  it("respects custom limit", () => {
    const result = paginate(items, filter, { limit: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it("clamps limit to max 200", () => {
    const big = Array.from({ length: 300 }, (_, i) => ({ id: i }));
    const result = paginate(big, filter, { limit: 999 });
    expect(result.items).toHaveLength(200);
  });

  it("clamps limit to min 1", () => {
    const result = paginate(items, filter, { limit: 0 });
    expect(result.items).toHaveLength(1);
  });

  it("returns empty envelope for empty collection", () => {
    const result = paginate([], filter, {});
    expect(result).toEqual({
      items: [],
      total: 0,
      truncated: false,
      nextCursor: null,
    });
  });

  it("errors on cursor from a different filter", () => {
    const first = paginate(items, { areaId: "a-1" }, {});
    expect(() =>
      paginate(items, { areaId: "a-2" }, { cursor: first.nextCursor! }),
    ).toThrow("cursor was issued for a different filter");
  });

  it("errors on invalid cursor", () => {
    expect(() => paginate(items, filter, { cursor: "garbage" })).toThrow(
      "invalid cursor",
    );
  });
});
