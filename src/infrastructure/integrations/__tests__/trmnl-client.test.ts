import { describe, it, expect, vi, beforeEach } from "vitest";
import { pushToTrmnlDirect, pushToRelay } from "../trmnl-client";
import type { TrmnlPayload } from "@/domain/services/TrmnlFormatter";

const mockPayload: TrmnlPayload = {
  merge_variables: {
    date: "2026-02-22",
    date_label: "Sunday, Feb 22",
    cycle_name: "",
    phases: [],
    total_allocated: 0,
    total_unallocated: 0,
    updated_at: "2026-02-22T12:00:00.000Z",
  },
};

describe("trmnl-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("pushToTrmnlDirect", () => {
    it("returns success on 200 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 200 })
      );

      const result = await pushToTrmnlDirect("test-uuid", mockPayload);

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://trmnl.com/api/custom_plugins/test-uuid",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("returns rateLimited on 429 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 429 })
      );

      const result = await pushToTrmnlDirect("test-uuid", mockPayload);

      expect(result.success).toBe(false);
      expect(result.rateLimited).toBe(true);
    });

    it("returns error on network failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error")
      );

      const result = await pushToTrmnlDirect("test-uuid", mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("returns error on 4xx response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Bad Request", { status: 400 })
      );

      const result = await pushToTrmnlDirect("test-uuid", mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("400");
    });

    it("rejects empty UUID", async () => {
      const result = await pushToTrmnlDirect("", mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("UUID");
    });
  });

  describe("pushToRelay", () => {
    it("returns success on 200 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 200 })
      );

      const result = await pushToRelay(
        "https://my-relay.vercel.app/api/push",
        "my-api-key",
        mockPayload
      );

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://my-relay.vercel.app/api/push",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer my-api-key",
          },
        })
      );
    });

    it("returns error on network failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Connection refused")
      );

      const result = await pushToRelay(
        "https://my-relay.vercel.app/api/push",
        "key",
        mockPayload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection refused");
    });

    it("rejects empty relay URL", async () => {
      const result = await pushToRelay("", "key", mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("URL");
    });
  });
});
