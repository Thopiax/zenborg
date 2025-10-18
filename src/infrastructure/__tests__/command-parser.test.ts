import { describe, it, expect } from "vitest";
import { parseCommand, isCommandError } from "../state/command-parser";
import { Phase } from "@/domain/value-objects/Phase";

describe("Command Parser", () => {
  describe("Allocation Commands", () => {
    it("should parse :ty1 (today morning)", () => {
      const result = parseCommand("ty1");
      expect(result).toEqual({
        type: "allocate",
        day: "today",
        phase: Phase.MORNING,
      });
    });

    it("should parse :ty2 (today afternoon)", () => {
      const result = parseCommand("ty2");
      expect(result).toEqual({
        type: "allocate",
        day: "today",
        phase: Phase.AFTERNOON,
      });
    });

    it("should parse :ty3 (today evening)", () => {
      const result = parseCommand("ty3");
      expect(result).toEqual({
        type: "allocate",
        day: "today",
        phase: Phase.EVENING,
      });
    });

    it("should parse :ty4 (today night)", () => {
      const result = parseCommand("ty4");
      expect(result).toEqual({
        type: "allocate",
        day: "today",
        phase: Phase.NIGHT,
      });
    });

    it("should parse :wy1 (tomorrow morning)", () => {
      const result = parseCommand("wy1");
      expect(result).toEqual({
        type: "allocate",
        day: "tomorrow",
        phase: Phase.MORNING,
      });
    });

    it("should parse :wy3 (tomorrow evening)", () => {
      const result = parseCommand("wy3");
      expect(result).toEqual({
        type: "allocate",
        day: "tomorrow",
        phase: Phase.EVENING,
      });
    });

    it("should parse :yy1 (yesterday morning)", () => {
      const result = parseCommand("yy1");
      expect(result).toEqual({
        type: "allocate",
        day: "yesterday",
        phase: Phase.MORNING,
      });
    });

    it("should parse :yy2 (yesterday afternoon)", () => {
      const result = parseCommand("yy2");
      expect(result).toEqual({
        type: "allocate",
        day: "yesterday",
        phase: Phase.AFTERNOON,
      });
    });

    it("should be case insensitive", () => {
      const result = parseCommand("TY1");
      expect(result).toEqual({
        type: "allocate",
        day: "today",
        phase: Phase.MORNING,
      });
    });

    it("should handle whitespace", () => {
      const result = parseCommand("  ty1  ");
      expect(result).toEqual({
        type: "allocate",
        day: "today",
        phase: Phase.MORNING,
      });
    });
  });

  describe("Unallocation Command", () => {
    it("should parse :d (unallocate)", () => {
      const result = parseCommand("d");
      expect(result).toEqual({
        type: "unallocate",
      });
    });

    it("should be case insensitive", () => {
      const result = parseCommand("D");
      expect(result).toEqual({
        type: "unallocate",
      });
    });
  });

  describe("Navigation Commands", () => {
    it("should parse :area", () => {
      const result = parseCommand("area");
      expect(result).toEqual({
        type: "navigate",
        destination: "area",
      });
    });

    it("should parse :settings", () => {
      const result = parseCommand("settings");
      expect(result).toEqual({
        type: "navigate",
        destination: "settings",
      });
    });

    it("should parse :help", () => {
      const result = parseCommand("help");
      expect(result).toEqual({
        type: "navigate",
        destination: "help",
      });
    });

    it("should be case insensitive", () => {
      const result = parseCommand("AREA");
      expect(result).toEqual({
        type: "navigate",
        destination: "area",
      });
    });
  });

  describe("Error Handling", () => {
    it("should return error for empty command", () => {
      const result = parseCommand("");
      expect(isCommandError(result)).toBe(true);
      if (isCommandError(result)) {
        expect(result.error).toBe("Empty command");
      }
    });

    it("should return error for whitespace only", () => {
      const result = parseCommand("   ");
      expect(isCommandError(result)).toBe(true);
    });

    it("should return error for invalid day", () => {
      const result = parseCommand("xy1");
      expect(isCommandError(result)).toBe(true);
      if (isCommandError(result)) {
        expect(result.error).toContain("Invalid day");
      }
    });

    it("should return error for invalid phase", () => {
      const result = parseCommand("ty5");
      expect(isCommandError(result)).toBe(true);
      if (isCommandError(result)) {
        expect(result.error).toContain("Invalid phase");
      }
    });

    it("should return error for invalid format (missing 'y')", () => {
      const result = parseCommand("tx1");
      expect(isCommandError(result)).toBe(true);
      if (isCommandError(result)) {
        expect(result.error).toContain("Invalid command format");
      }
    });

    it("should return error for unknown command", () => {
      const result = parseCommand("foo");
      expect(isCommandError(result)).toBe(true);
      if (isCommandError(result)) {
        expect(result.error).toBeTruthy();
      }
    });

    it("should return error for wrong length", () => {
      const result = parseCommand("ty");
      expect(isCommandError(result)).toBe(true);
    });

    it("should return error for too long", () => {
      const result = parseCommand("ty1extra");
      expect(isCommandError(result)).toBe(true);
    });
  });

  describe("isCommandError type guard", () => {
    it("should identify error results", () => {
      const result = parseCommand("invalid");
      expect(isCommandError(result)).toBe(true);
    });

    it("should identify success results", () => {
      const result = parseCommand("ty1");
      expect(isCommandError(result)).toBe(false);
    });
  });
});
