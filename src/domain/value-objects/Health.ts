// src/domain/value-objects/Health.ts
/**
 * Health — observed state of a habit, computed from attitude + rhythm + history.
 *
 * NOT stored on disk. Re-computed on read. Rendered through opacity treatment
 * of the habit's existing emoji; no additional icons.
 *
 * States:
 *   - seedling:  BEGINNING, low allocation count
 *   - budding:   new rhythm, history forming (first ~3 periods after rhythm set)
 *   - blooming:  on-rhythm, healthy
 *   - wilting:   off-rhythm or past silence threshold
 *   - dormant:   intentionally paused (reserved for v2, not computed in v1)
 *   - evergreen: BEING attitude, crystallized
 *   - unstated:  no attitude set or insufficient signal — pure presence
 */
export type Health =
  | "seedling"
  | "budding"
  | "blooming"
  | "wilting"
  | "dormant"
  | "evergreen"
  | "unstated";
