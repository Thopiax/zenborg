/**
 * The 7 foundational primitives.
 *
 * The domain speaks this layer and only this layer. `Notice`, `Suggestion`,
 * `GapWindow` and `HostBlock` are authoring sugar that desugars before anything
 * reaches the model, exactly as keel's contracts specify: the foundational layer
 * is contract, the intent layer is presentation, and the validator only ever sees
 * foundational primitives.
 *
 * Contract: `keel/docs/primitive-contracts.md`.
 *
 * There is deliberately no `AmbientPrimitive`. keel restricted which primitives a
 * rule could arm by excluding CooldownSpec from a union; that restricted category
 * is gone. A rule may arm any primitive, teeth included. What protects the person
 * is not who armed the thing, it is that every armed thing can be got out of.
 */

export interface TransformSpec {
  readonly kind: "transform";
  readonly replacement:
    | { readonly type: "hide" }
    | { readonly type: "text"; readonly content: string }
    | { readonly type: "template"; readonly templateId: string };
}

/**
 * Interrupt an action with a surface the user must engage with to proceed.
 *
 * `proceedAffordance` is required, not optional. A gate without an exit does not
 * typecheck, which is what makes invariant 6 a property of the type rather than a
 * promise a validator has to keep.
 */
/**
 * When a gate fires.
 *
 * Optional, and the reason is the surface. A session fence has no trigger to
 * declare: the tool call the PreToolUse hook already sees *is* the event, and a
 * rule that restated it would be asserting a fact about a harness rather than
 * about a commitment. A browser gate has no such event — overconsumption's whole
 * problem is that nothing happens — so it names an accumulated-dwell interval,
 * and the extension reads that interval off the rule instead of off a constant.
 *
 * `everyMinutes` counts *attended* dwell, not wall-clock: a backgrounded tab or
 * an idle person does not accrue it. That is keel's contract for the same
 * trigger (`packages/domain/src/rules.ts`), carried over rather than re-derived.
 */
export type GateTrigger =
  | { readonly type: "navigation" }
  | { readonly type: "dwell"; readonly everyMinutes: number };

export interface GateSpec {
  readonly kind: "gate";
  /** Absent means "the surface's own event is the trigger" — see `GateTrigger`. */
  readonly trigger?: GateTrigger;
  readonly frictionType:
    | { readonly type: "confirmation" }
    | { readonly type: "intention"; readonly prompt: string }
    | { readonly type: "delay"; readonly seconds: number }
    | { readonly type: "breath"; readonly cycles: number };
  readonly proceedAffordance: {
    readonly label: string;
    readonly action:
      | { readonly type: "continue" }
      | { readonly type: "redirect"; readonly to: string }
      | { readonly type: "abort" };
  };
  readonly abortAffordance?: { readonly label: string };
}

/**
 * Temporal lockout after a triggering event.
 *
 * `unlockPath` is required for the same reason `proceedAffordance` is. This is
 * what makes a rule-armed cooldown a boundary rather than a punishment, and it is
 * the structural answer to the Screen Time counter-evidence: the teeth cannot be
 * armed without a way out, whoever armed them.
 */
/**
 * Where the lockout is applied.
 *
 * `resolver` is the one that reaches a phone, which is the reason host blocking
 * is kept rather than retired. Nothing else in this system covers a device the
 * app does not run on.
 */
export type CooldownEnforcement =
  | { readonly at: "browser" }
  | { readonly at: "resolver"; readonly profile: string }
  | { readonly at: "device" };

/**
 * How long the lockout holds.
 *
 * `standing` never lapses. It is what the drogue blocklist has always been, and
 * expressing it here is what let host blocking stop being an exception to
 * invariant 6.
 */
export type CooldownDuration =
  | { readonly type: "seconds"; readonly seconds: number }
  | { readonly type: "standing" };

export interface CooldownSpec {
  readonly kind: "cooldown";
  /** Defaults to `browser` when absent. */
  readonly enforcement?: CooldownEnforcement;
  readonly duration: CooldownDuration;
  /**
   * Required, and the reason a cooldown satisfies invariant 6 by type.
   *
   * `out_of_band` is the honest name for a lift that lives outside the running
   * system, so it cannot be taken in the moment of wanting. A costly exit is
   * still an exit, and the cost is what makes the wall hold.
   */
  readonly unlockPath:
    | { readonly type: "wait" }
    | { readonly type: "unlock_with_intention"; readonly prompt: string }
    | { readonly type: "unlock_with_delay"; readonly seconds: number }
    | { readonly type: "out_of_band"; readonly note: string };
}

export interface ObserveSpec {
  readonly kind: "observe";
  readonly signal: string;
  readonly persistedKey: string;
}

export interface ScheduleSpec {
  readonly kind: "schedule";
  readonly window: { readonly fromHour: number; readonly toHour: number };
  readonly wraps: Primitive;
  readonly outsideWindow: "inactive" | "passthrough";
}

/**
 * Event behaviour modification. Offers no surface of any kind.
 *
 * This is the one primitive that can violate invariant 6, which is why it is the
 * one to watch. Note that it is scoped to events, not to hosts: it carries no
 * host, URL or network field, and neither does any other primitive here.
 */
export interface InterceptSpec {
  readonly kind: "intercept";
  readonly events: readonly ("wheel" | "keydown" | "click" | "scroll")[];
  readonly whenKey?: readonly string[];
  readonly behavior:
    | { readonly type: "suppress" }
    | { readonly type: "rate_limit"; readonly minIntervalMs: number };
}

export interface ActuateSpec {
  readonly kind: "actuate";
  readonly action:
    | { readonly type: "pause_media" }
    | { readonly type: "mute_media" }
    | { readonly type: "blur" };
}

export type Primitive =
  | TransformSpec
  | GateSpec
  | CooldownSpec
  | ObserveSpec
  | ScheduleSpec
  | InterceptSpec
  | ActuateSpec;

/**
 * Whether the primitive can be got out of.
 *
 * `gate` and `cooldown` carry an exit by construction, as required fields.
 * Nothing else does. A `schedule` is transparent: it reads through to the
 * primitive it wraps, because a scheduled gate is still a gate.
 */
export function carriesExit(primitive: Primitive): boolean {
  switch (primitive.kind) {
    case "gate":
    case "cooldown":
      return true;
    case "schedule":
      return carriesExit(primitive.wraps);
    default:
      return false;
  }
}
