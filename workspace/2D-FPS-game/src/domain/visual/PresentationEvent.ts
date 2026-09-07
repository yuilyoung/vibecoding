/** Business-layer, non-authoritative event vocabulary shared by game families. */
export type PresentationEventFamily =
  | "actor"
  | "barrel"
  | "mine"
  | "crate"
  | "cover"
  | "bounce-wall"
  | "teleporter"
  | "service-gate"
  | "vent-hazard"
  | "ammo-pickup"
  | "health-pickup";

export type PresentationEventKind =
  | "damage"
  | "destroy"
  | "arm"
  | "trigger"
  | "reflect"
  | "teleport"
  | "gate-open"
  | "gate-close"
  | "hazard-pulse"
  | "collect"
  | "respawn"
  | "idle"
  | "run"
  | "fire"
  | "hit"
  | "death";

export interface PresentationEvent {
  readonly subjectId: string;
  readonly family: PresentationEventFamily;
  readonly kind: PresentationEventKind;
  readonly sequence: number;
  readonly x: number;
  readonly y: number;
  /** Scene-clock value only; it is never used to alter gameplay timing. */
  readonly occurredAt: number;
  readonly state: string;
  readonly movementDirection?: number | null;
  readonly aimDirection?: number | null;
}

export interface PresentationSnapshot {
  readonly subjectId: string;
  readonly state: string;
  readonly sequence: number;
}

export interface PresentationEventInstruction {
  readonly kind: PresentationEventKind;
  readonly family: PresentationEventFamily;
  readonly x: number;
  readonly y: number;
  readonly state: string;
}

export interface PresentationEventPort {
  publish(event: PresentationEvent): void;
  syncSnapshot(snapshot: PresentationSnapshot): boolean;
  releaseSubject(subjectId: string): void;
  destroy(): void;
}

/** Phaser-free strict per-subject sequence policy. */
export class PresentationEventPolicy {
  private readonly lastSequenceBySubject = new Map<string, number>();

  public accept(event: PresentationEvent): PresentationEventInstruction | null {
    if (!isValidEvent(event)) return null;
    const previous = this.lastSequenceBySubject.get(event.subjectId) ?? 0;
    if (event.sequence <= previous) return null;
    this.lastSequenceBySubject.set(event.subjectId, event.sequence);
    return { kind: event.kind, family: event.family, x: event.x, y: event.y, state: event.state };
  }

  /** A newer authoritative snapshot establishes the next accepted sequence. */
  public syncSnapshot(snapshot: PresentationSnapshot): boolean {
    if (!isValidSnapshot(snapshot)) return false;
    const previous = this.lastSequenceBySubject.get(snapshot.subjectId) ?? 0;
    if (snapshot.sequence < previous) return false;
    this.lastSequenceBySubject.set(snapshot.subjectId, snapshot.sequence);
    return true;
  }

  /** Called when a scene-owned subject is disposed, before its ID can be reused. */
  public releaseSubject(subjectId: string): void {
    this.lastSequenceBySubject.delete(subjectId);
  }
}

function isValidEvent(event: PresentationEvent): boolean {
  return isValidSnapshot(event)
    && event.family.length > 0
    && event.kind.length > 0
    && Number.isFinite(event.x)
    && Number.isFinite(event.y)
    && Number.isFinite(event.occurredAt)
    && isDirection(event.movementDirection)
    && isDirection(event.aimDirection);
}

function isValidSnapshot(snapshot: PresentationSnapshot): boolean {
  return snapshot.subjectId.length > 0
    && snapshot.state.length > 0
    && Number.isSafeInteger(snapshot.sequence)
    && snapshot.sequence >= 0;
}

function isDirection(direction: number | null | undefined): boolean {
  return direction === undefined || direction === null || Number.isFinite(direction);
}
