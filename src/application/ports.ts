import type { ActivityEvent } from "../domain/attention/ActivityEvent";
import type { AreaMap } from "../domain/attention/AreaMap";
import type { Discrepancy } from "../domain/attention/Discrepancy";
import type {
  AreaId,
  CycleId,
  Instant,
  MomentId,
  RuleId,
} from "../domain/attention/ids";
import type { SpanDerivationConfig } from "../domain/attention/SpanDerivation";
import type { RuleSpec } from "../domain/intervention/RuleSpec";

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

/**
 * One thing the library found: when it was written, what it says, how well it
 * matched.
 */
type NoteHit = {
  /**
   * Local ISO date. The library's id for an entry, and a concept the garden
   * already has, which is why it crosses without translation.
   */
  readonly date: string;
  /** Opaque prose. The garden renders it, never parses it. */
  readonly preview: string;
  readonly score: number;
};

/**
 * Read access to the library — penceive's notes, now a crate in this process.
 *
 * Slice C's whole payoff. Harvest reads back what a season held, and until now
 * the season's own account of itself was in a journal the app had no way to
 * ask. This is the way to ask.
 *
 * **The seam carries dates and text. Nothing else crosses.** A date is a
 * concept both contexts already have and neither owns; text is opaque to the
 * garden. So the traffic that actually needs to cross needs no translation at
 * all, and therefore needs no context map, no shared kernel, and no
 * anticorruption layer. Ownership was never what made this boundary hard.
 * Translation was, and this boundary does not translate.
 *
 * **One method is the point, not a placeholder.** Every method added here is a
 * concept crossing the boundary, and each one needs the same argument made
 * again. A method that cannot be described as dates and text belongs in a
 * design of its own.
 *
 * Read-only, and not because writing is unimplemented: what the garden writes
 * to the ponds is prose arriving from a device, and that is `NotebookPort`
 * below rather than a second method here.
 */
export interface LibraryPort {
  search(
    query: string,
    opts?: {
      readonly limit?: number;
      /** Inclusive ISO date lower bound — a season's first day. */
      readonly since?: string;
      /** Inclusive ISO date upper bound — a season's last day. */
      readonly until?: string;
    },
  ): Promise<readonly NoteHit[]>;
}

/**
 * Bringing prose in from the device.
 *
 * Slice C step 5's data half. `journals` used to have two instrument writers —
 * `wake sync` pulling the Supernote's handwriting into a pond, and a person
 * with a text editor — and the substrate's one-writer rule was written about
 * instruments and had no shape for that pair. The app absorbed the pull, so
 * there is exactly one instrument writing the prose and the rule stands
 * unchanged. The person stays the author; this does not compete with them.
 *
 * **A second port rather than a second method on `LibraryPort`.** Nothing
 * crosses here: no date, no text, no library concept and no garden concept. It
 * is a different relationship with the same neighbour, and giving it its own
 * interface is what keeps the seam's tripwire meaningful rather than merely
 * passed. A surface handed only a `LibraryPort` still cannot write.
 *
 * The pull writes markdown and marks the index stale. It never takes the index
 * writer lock, so it cannot block a `wake reindex` in a terminal, and a
 * terminal cannot block it. The next read pays for the staleness, which is the
 * standing answer to who owns reindex.
 */
export interface NotebookPort {
  /** Pull the device's notes into the journals pond. Returns what happened. */
  pull(opts?: {
    /** `lan` (the device's export server) or `server` (a local export dir). */
    readonly mode?: "lan" | "server";
    /** Pin the device when LAN discovery is flaky. */
    readonly ip?: string;
    readonly port?: number;
  }): Promise<string>;
}

export type { NoteHit };

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

  /**
   * Instants in `[from, to)` at which the plan says one stretch ended.
   *
   * Phase-band edges, and the start and end of any moment planted with a clock
   * time. Without these a span straddles a boundary and then gets judged
   * against whichever cell its first observation happened to fall in, so a
   * therapy session in the afternoon would be measured against the morning.
   */
  boundaries(from: Instant, to: Instant): Promise<readonly Instant[]>;
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

/**
 * Read/write access to the `fences` collection — the rules currently in force.
 *
 * Per the substrate contract, `fences` has exactly one writer: zenborg. This
 * port is that writer's seam, and it is the *only* place the application layer
 * touches the collection, which is what keeps "one writer" a property of the
 * architecture rather than a promise every tool handler has to re-keep.
 *
 * `read` returns the whole collection because a fence declaration is a
 * read-modify-write over a handful of records, not a query over a corpus.
 */
export interface FenceStorePort {
  read(): Promise<Record<RuleId, RuleSpec>>;
  write(all: Record<RuleId, RuleSpec>): Promise<void>;
}

/**
 * One fence's crossing count, as the plugin's PreToolUse hook records it.
 * `at` is when the last crossing happened, epoch ms.
 */
export interface CrossingRecord {
  readonly crossings: number;
  readonly at: Instant;
}

/**
 * Read access to the plugin's crossing tally (`plugin/fences-state.json`).
 *
 * Read-only on purpose: that file is plugin-owned runtime state, and writing
 * it here would make zenborg a second writer of someone else's file — the
 * exact disagreement the substrate's one-writer rule exists to prevent. The
 * tally "resets when the fence comes down" structurally, not by deletion: a
 * cleared fence's id is never reused, so its entry goes inert on its own.
 */
export interface CrossingTallyPort {
  read(): Promise<Readonly<Record<RuleId, CrossingRecord>>>;
}

/** What declaring a fence needs to know about the garden: which areas exist
 * (to resolve the names the principal speaks in) and which season is running
 * (a rule's `serves` points at the season's intention, so a fence cannot be
 * declared into no season at all). */
export interface FenceGardenPort {
  /** Active (non-archived) areas, id + name only. */
  areas(): Promise<readonly AreaRef[]>;
  /** The cycle containing today, or null when no season is running. */
  activeCycleId(): Promise<CycleId | null>;
}

export interface AreaRef {
  readonly id: AreaId;
  readonly name: string;
}

export interface FenceDeps {
  readonly store: FenceStorePort;
  readonly tally: CrossingTallyPort;
  readonly garden: FenceGardenPort;
  readonly newRuleId: () => RuleId;
}
