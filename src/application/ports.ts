import type { ActivityEvent } from "../domain/attention/ActivityEvent";
import type { AreaMap } from "../domain/attention/AreaMap";
import type { Discrepancy } from "../domain/attention/Discrepancy";
import type { AreaId, Instant, MomentId } from "../domain/attention/ids";
import type { SpanDerivationConfig } from "../domain/attention/SpanDerivation";

/**
 * The application layer's boundary with everything outside it.
 *
 * keel never had one, which is how its derivation and rule layers ended up
 * knowing about the filesystem. penceive is the structural reference here: the
 * use case names what it needs, the infrastructure supplies it, and the domain
 * stays pure.
 */

/** The half-open window `[from, to)` a derivation covers. */
export interface Window {
  readonly from: Instant;
  readonly to: Instant;
}

/**
 * Read access to keel's activity log.
 *
 * Read-only on purpose. zenborg does not write activity events at migration
 * step 2; keel still owns that collection, and the writer only transfers at
 * step 5.
 */
export interface ActivityLogPort {
  /** Events falling in `[from, to)`, in no guaranteed order. */
  read(from: Instant, to: Instant): Promise<readonly ActivityEvent[]>;
}

/** What a (day, phase) cell held. A set, because a cell plants a lane. */
export interface Planting {
  readonly momentIds: readonly MomentId[];
  readonly areaIds: readonly AreaId[];
}

/**
 * Read access to the garden.
 *
 * Resolving an instant to its (day, phase) cell belongs to the adapter, which
 * already owns phase configs and their boundaries. The use case asks what was
 * planted at a moment in time and never learns that days or phases exist.
 */
export interface GardenPort {
  areaMap(): Promise<AreaMap>;
  plantingsAt(instant: Instant): Promise<Planting>;
}

/**
 * What lands in `discrepancy.json`.
 *
 * `shadow` is a literal `true` rather than a boolean. Step 2's whole discipline
 * is that the loop runs and nothing acts on it, and a type that cannot express
 * a non-shadow record is a cheaper guarantee than a convention that says so.
 */
export interface DiscrepancyRecord {
  readonly generatedAt: Instant;
  readonly window: Window;
  readonly discrepancies: readonly Discrepancy[];
  readonly shadow: true;
}

/** Single writer, per the substrate contract. The app owns `discrepancy`. */
export interface DiscrepancyStorePort {
  write(record: DiscrepancyRecord): Promise<void>;
}

export interface ClockPort {
  now(): Instant;
}

export interface ShadowDeps {
  readonly log: ActivityLogPort;
  readonly garden: GardenPort;
  readonly store: DiscrepancyStorePort;
  readonly clock: ClockPort;
  readonly span: SpanDerivationConfig;
}
