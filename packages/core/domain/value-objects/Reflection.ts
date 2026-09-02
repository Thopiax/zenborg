/**
 * Reflection — the two rungs of what a season held.
 *
 * `Cycle.reflection` is ONE string on the vault. L0 (the line you can carry)
 * and L1 (the paragraph behind it) are a *convention*, split on the first
 * blank line, parsed at render. The pilot has read it this way from the start.
 *
 * Deliberately not two stored fields: prefer derived over stored, and every
 * stored field costs both vault implementations (`src-tauri/src/vault/fs.rs`
 * and `mcp-server/vault.ts`). It also keeps acceptance 7 true — with zenborg
 * uninstalled, a reflection is still plain readable prose in `cycles.json`.
 */
export interface Reflection {
  /** The line that carries the season. */
  readonly l0: string;
  /** Everything behind it. Empty when the reflection is a single line. */
  readonly l1: string;
}

/** A blank line — nothing, or whitespace, between two newlines. */
const BLANK_LINE = /\n[ \t]*\n/;

/**
 * Reads the stored string into its two rungs.
 *
 * @param reflection - `Cycle.reflection` as stored, possibly null
 * @returns The two rungs, or null when the season carries no reflection
 */
export function parseReflection(reflection: string | null): Reflection | null {
  if (reflection === null) {
    return null;
  }

  const trimmed = reflection.trim();
  if (!trimmed) {
    return null;
  }

  const separator = BLANK_LINE.exec(trimmed);
  if (!separator) {
    return { l0: trimmed, l1: "" };
  }

  return {
    l0: trimmed.slice(0, separator.index).trim(),
    l1: trimmed.slice(separator.index + separator[0].length).trim(),
  };
}

/**
 * Writes the two rungs back into the single stored string.
 *
 * The inverse of `parseReflection` — a composed reflection always parses back
 * to the rungs it was built from.
 *
 * @param l0 - The line that carries the season
 * @param l1 - Everything behind it
 * @returns The stored shape, or null when neither rung carries text
 */
export function composeReflection(l0: string, l1: string): string | null {
  const rungs = [l0.trim(), l1.trim()].filter(Boolean);

  return rungs.length ? rungs.join("\n\n") : null;
}
