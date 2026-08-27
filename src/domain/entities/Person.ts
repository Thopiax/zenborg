import type { Cadence } from "../value-objects/Cadence";

/**
 * Person -- a registry entity referenced by Moment.personIds.
 *
 * Zenborg holds only references: moments carry entity keys, and the person
 * record supplies cadence, status and category for the outreach queue.
 * Health is NEVER stored -- recomputed on every read by PersonService.
 */
export interface Person {
  id: string;
  name: string;
  key: string;
  cadence: Cadence | null;
  status: "active" | "paused";
  category: string | null;
  basePlace: string | null;
  emoji: string | null;
  createdAt: string;
  updatedAt: string;
}
