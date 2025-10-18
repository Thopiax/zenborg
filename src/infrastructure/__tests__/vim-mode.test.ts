import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Moment } from "@/domain/entities/Moment";
import { Phase } from "@/domain/value-objects/Phase";
import {
  enterCommandMode,
  enterInsertMode,
  enterNormalMode,
  resetVimState,
  setFocusedCell,
  setFocusedMoment,
  setYankBuffer,
  updateCommandInput,
  VimMode,
  vimState$,
} from "../state/vim-mode";

describe("Vim Mode", () => {
  beforeEach(() => {
    // Reset state before each test
    resetVimState();
  });

  afterEach(() => {
    // Reset state after each test to ensure clean slate
    resetVimState();
  });

  describe("Initial State", () => {
    it("should start in NORMAL mode", () => {
      expect(vimState$.mode.get()).toBe(VimMode.NORMAL);
    });

    it("should have empty command input", () => {
      expect(vimState$.commandInput.get()).toBe("");
    });

    it("should have no focused moment", () => {
      expect(vimState$.focusedMomentId.get()).toBeNull();
    });

    it("should have no focused cell", () => {
      expect(vimState$.focusedCell.get()).toBeNull();
    });

    it("should have no yank buffer", () => {
      expect(vimState$.yankBuffer.get()).toBeNull();
    });
  });

  describe("Mode Transitions", () => {
    it("should enter INSERT mode from NORMAL", () => {
      expect(vimState$.mode.get()).toBe(VimMode.NORMAL);
      enterInsertMode();
      expect(vimState$.mode.get()).toBe(VimMode.INSERT);
    });

    it("should enter INSERT mode with moment ID", () => {
      const momentId = "test-moment-id";
      enterInsertMode(momentId);
      expect(vimState$.mode.get()).toBe(VimMode.INSERT);
      expect(vimState$.focusedMomentId.get()).toBe(momentId);
    });

    it("should enter COMMAND mode from NORMAL", () => {
      expect(vimState$.mode.get()).toBe(VimMode.NORMAL);
      enterCommandMode();
      expect(vimState$.mode.get()).toBe(VimMode.COMMAND);
    });

    it("should clear command input when entering COMMAND mode", () => {
      vimState$.commandInput.set("previous command");
      enterCommandMode();
      expect(vimState$.commandInput.get()).toBe("");
    });

    it("should return to NORMAL mode from INSERT", () => {
      enterInsertMode();
      expect(vimState$.mode.get()).toBe(VimMode.INSERT);
      enterNormalMode();
      expect(vimState$.mode.get()).toBe(VimMode.NORMAL);
    });

    it("should return to NORMAL mode from COMMAND", () => {
      enterCommandMode();
      expect(vimState$.mode.get()).toBe(VimMode.COMMAND);
      enterNormalMode();
      expect(vimState$.mode.get()).toBe(VimMode.NORMAL);
    });

    it("should clear command input when entering NORMAL mode", () => {
      enterCommandMode();
      updateCommandInput("ty1");
      expect(vimState$.commandInput.get()).toBe("ty1");
      enterNormalMode();
      expect(vimState$.commandInput.get()).toBe("");
    });
  });

  describe("Command Input", () => {
    it("should update command input", () => {
      updateCommandInput("ty1");
      expect(vimState$.commandInput.get()).toBe("ty1");
    });

    it("should handle multiple updates", () => {
      updateCommandInput("t");
      expect(vimState$.commandInput.get()).toBe("t");
      updateCommandInput("ty");
      expect(vimState$.commandInput.get()).toBe("ty");
      updateCommandInput("ty1");
      expect(vimState$.commandInput.get()).toBe("ty1");
    });
  });

  describe("Focus Management", () => {
    it("should set focused moment", () => {
      const momentId = "test-moment-id";
      setFocusedMoment(momentId);
      expect(vimState$.focusedMomentId.get()).toBe(momentId);
    });

    it("should clear focused moment", () => {
      setFocusedMoment("test-moment-id");
      setFocusedMoment(null);
      expect(vimState$.focusedMomentId.get()).toBeNull();
    });

    it("should set focused cell", () => {
      const cell = { day: "2025-01-15", phase: Phase.MORNING };
      setFocusedCell(cell);
      expect(vimState$.focusedCell.get()).toEqual(cell);
    });

    it("should clear focused cell", () => {
      setFocusedCell({ day: "2025-01-15", phase: Phase.MORNING });
      setFocusedCell(null);
      expect(vimState$.focusedCell.get()).toBeNull();
    });
  });

  describe("Yank Buffer", () => {
    it("should set yank buffer", () => {
      const moment: Moment = {
        id: "test-id",
        name: "Test Moment",
        areaId: "area-id",
        phase: Phase.MORNING,
        day: "2025-01-15",
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setYankBuffer(moment);
      expect(vimState$.yankBuffer.get()).toEqual(moment);
    });

    it("should clear yank buffer", () => {
      const moment: Moment = {
        id: "test-id",
        name: "Test Moment",
        areaId: "area-id",
        phase: null,
        day: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setYankBuffer(moment);
      setYankBuffer(null);
      expect(vimState$.yankBuffer.get()).toBeNull();
    });
  });

  describe("Reset State", () => {
    it("should reset all state to initial values", () => {
      // Modify state
      enterCommandMode();
      updateCommandInput("ty1");
      setFocusedMoment("test-id");
      setFocusedCell({ day: "2025-01-15", phase: Phase.MORNING });
      setYankBuffer({
        id: "test-id",
        name: "Test",
        areaId: "area-id",
        phase: null,
        day: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Reset
      resetVimState();

      // Verify all back to initial
      expect(vimState$.mode.get()).toBe(VimMode.NORMAL);
      expect(vimState$.commandInput.get()).toBe("");
      expect(vimState$.focusedMomentId.get()).toBeNull();
      expect(vimState$.focusedCell.get()).toBeNull();
      expect(vimState$.yankBuffer.get()).toBeNull();
    });
  });
});
