import { describe, expect, it } from "vitest";
import {
  createDayNote,
  type DayNote,
  setDayNoteBody,
} from "../entities/DayNote";

const note = (): DayNote => {
  const created = createDayNote({ date: "2026-08-07", title: "Ship export" });
  if ("error" in created) {
    throw new Error(created.error);
  }
  return created;
};

describe("setDayNoteBody", () => {
  it("stores trimmed markdown", () => {
    const updated = setDayNoteBody(note(), "  # plan\n- land the writer  ");
    expect(updated.body).toBe("# plan\n- land the writer");
  });

  it("drops the field entirely when the body is blank", () => {
    // Absent and empty must not be two different states — keel reads this
    // collection and `""` would look like a note that exists but says nothing.
    const withBody = setDayNoteBody(note(), "something");
    const cleared = setDayNoteBody(withBody, "   \n  ");
    expect("body" in cleared).toBe(false);
  });

  it("leaves the title alone and never validates it", () => {
    // The body has no word limit; running it through the 1-3 word title rule
    // would reject any real note.
    const updated = setDayNoteBody(
      note(),
      "a much longer sentence than three words",
    );
    expect(updated.title).toBe("Ship export");
  });

  it("creates a note without a body by default", () => {
    expect("body" in note()).toBe(false);
  });
});
