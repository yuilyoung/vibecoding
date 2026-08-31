export type PresentationEventFamily = "barrel";
export type PresentationEventKind = "damage" | "destroy";

export interface PresentationEvent {
  readonly subjectId: string;
  readonly family: PresentationEventFamily;
  readonly kind: PresentationEventKind;
  readonly sequence: number;
  readonly x: number;
  readonly y: number;
}

export interface PresentationEventInstruction {
  readonly kind: PresentationEventKind;
  readonly x: number;
  readonly y: number;
}

export interface PresentationEventPort {
  publish(event: PresentationEvent): void;
  destroy(): void;
}

/** Phaser-free strict per-subject sequence policy. */
export class PresentationEventPolicy {
  private readonly lastSequenceBySubject = new Map<string, number>();

  public accept(event: PresentationEvent): PresentationEventInstruction | null {
    if (!Number.isSafeInteger(event.sequence) || event.sequence <= 0 || !Number.isFinite(event.x) || !Number.isFinite(event.y)) return null;
    const previous = this.lastSequenceBySubject.get(event.subjectId) ?? 0;
    if (event.sequence <= previous) return null;
    this.lastSequenceBySubject.set(event.subjectId, event.sequence);
    return { kind: event.kind, x: event.x, y: event.y };
  }
}
